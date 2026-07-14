// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Controlled upgrade orchestrator: preview → pre-update backup → graceful stop
// → re-pin → recreate → start → monitor → one-click rollback on failure.
// Never automatic unless the server's update_policy is 'auto'.

const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');
const serversService = require('../services/servers');
const packsService = require('../services/packs');
const backupsService = require('../services/backups');
const { fetchLogs } = require('../docker/logs');
const { inspectStatus } = require('../docker/containers');

const activeUpgrades = new Map(); // serverId -> {step, startedAt}

function upgradeStatus(serverId) {
  return activeUpgrades.get(serverId) || null;
}

/**
 * Run the full safe upgrade to a target pack version.
 * onStep(step: string) is invoked as the flow progresses.
 * opts.allowVersionChange must be true to cross MC versions (409 otherwise).
 * opts.task: optional tasks.js handle — step() calls are mirrored to it.
 */
async function upgradePack(
  serverId,
  {
    versionId = null,
    skipBackup = false,
    allowVersionChange = false,
    actor = 'system',
    onStep = () => {},
    task = null,
  } = {}
) {
  if (activeUpgrades.has(serverId)) throw httpError(409, 'An upgrade is already running for this server');
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const pack = packsService.getPack(serverId);
  if (!pack) throw httpError(400, 'This server has no managed modpack');

  const STEP_LABELS = {
    resolving: 'Resolving target version',
    'backing-up': 'Creating pre-update backup',
    stopping: 'Stopping server',
    applying: 'Applying pack version',
    recreating: 'Recreating container',
    monitoring: 'Waiting for the server to come up',
    overlay: 'Restoring custom mod overlay',
  };
  const step = (s) => {
    activeUpgrades.set(serverId, { step: s, startedAt: activeUpgrades.get(serverId)?.startedAt || Date.now() });
    if (task) task.step(STEP_LABELS[s] || s);
    onStep(s);
  };

  try {
    step('resolving');
    const resolved = await packsService.resolvePack(pack.platform, pack.project_ref, { versionId });
    if (resolved.versionId === pack.pinned_version_id) {
      throw httpError(400, `Already on ${pack.pinned_version_name} — nothing to upgrade`);
    }

    // Cross-MC-version upgrades permanently convert the world — demand
    // explicit confirmation BEFORE any backup/stop work happens.
    if (
      resolved.mcVersion &&
      server.mc_version &&
      !['LATEST', 'SNAPSHOT'].includes(server.mc_version) &&
      resolved.mcVersion !== server.mc_version &&
      !allowVersionChange
    ) {
      const err = httpError(
        409,
        `${resolved.versionName} runs Minecraft ${resolved.mcVersion} but this server is on ${server.mc_version}. ` +
          'Upgrading will permanently convert the world to the new Minecraft version. Confirm the version change to proceed.'
      );
      err.requiresVersionConfirm = true;
      err.fromMcVersion = server.mc_version;
      err.toMcVersion = resolved.mcVersion;
      throw err;
    }

    let backupId = null;
    if (!skipBackup) {
      step('backing-up');
      const backup = await backupsService.createBackup(serverId, {
        reason: 'pre-update',
        actor,
        note: `Before pack ${pack.pinned_version_name} → ${resolved.versionName}`,
        task,
      });
      backupId = backup.id;
    }

    step('stopping');
    const wasRunning = ['running', 'starting', 'unhealthy'].includes(server.status);
    if (wasRunning) await serversService.stopServer(serverId, { actor });

    step('applying');
    // The pre-update backup above is the safety net; still require the caller
    // to have confirmed cross-MC-version upgrades (checked before backup by
    // the route via resolvePack diff) — here we proceed.
    const { previous } = await packsService.applyPack(serverId, resolved, { actor, force: true });

    step('recreating');
    await serversService.recreateServer(serverId, { actor, quiet: true });
    await serversService.startServer(serverId, { actor });

    step('monitoring');
    // CF/Modrinth installs download the whole pack on first boot — give them
    // twice the window.
    const timeoutMs = ['curseforge', 'modrinth'].includes(pack.platform) ? 20 * 60 * 1000 : 10 * 60 * 1000;
    const healthy = await waitForHealthy(serverId, { timeoutMs });
    const excerpt = await fetchLogs(serverId, { tail: 200 }).catch(() => '');

    if (!healthy) {
      recordEvent({
        serverId,
        actor,
        type: 'update-failed',
        summary: `Pack upgrade to ${resolved.versionName} failed to start — rollback available`,
        details: { backupId, previousVersion: previous ? previous.pinned_version_id : null },
        logExcerpt: excerpt || null,
      });
      const err = httpError(
        502,
        `The server did not come up healthy after the upgrade. Use rollback to restore ${pack.pinned_version_name}.`
      );
      err.rollbackAvailable = Boolean(backupId);
      throw err;
    }

    step('overlay');
    await packsService.afterPackOperation(serverId, { actor });

    recordEvent({
      serverId,
      actor,
      type: 'update-applied',
      summary: `Pack upgraded: ${pack.project_name} ${pack.pinned_version_name} → ${resolved.versionName}`,
      details: { backupId, from: pack.pinned_version_id, to: resolved.versionId },
      logExcerpt: excerpt || null,
    });
    return { ok: true, from: pack.pinned_version_name, to: resolved.versionName, backupId };
  } finally {
    activeUpgrades.delete(serverId);
  }
}

/** Roll back: restore the pre-update backup + re-pin the previous version. */
async function rollbackPack(serverId, { backupId, actor = 'system' } = {}) {
  const pack = packsService.getPack(serverId);
  if (!pack || !pack.previous_version_id) throw httpError(400, 'No previous pack version recorded');

  await serversService.stopServer(serverId, { actor }).catch(() => {});
  if (backupId) await backupsService.restoreBackup(serverId, backupId, { actor, skipSafety: true });

  const resolved = await packsService.resolvePack(pack.platform, pack.project_ref, {
    versionId: pack.previous_version_id,
  });
  await packsService.applyPack(serverId, resolved, { actor, force: true }); // backup restore precedes this
  await serversService.recreateServer(serverId, { actor, quiet: true });
  await serversService.startServer(serverId, { actor });

  recordEvent({
    serverId,
    actor,
    type: 'update-rolled-back',
    summary: `Rolled back to ${pack.previous_version_name}${backupId ? ' (backup restored)' : ''}`,
  });
  return { ok: true, version: pack.previous_version_name };
}

/**
 * Wait until the server is genuinely up.
 * With a Docker healthcheck: 3 consecutive 'running' (healthy) checks (~15s).
 * WITHOUT one (health null), inspect says 'running' the instant the process
 * starts — require 6 consecutive checks (~30s) AND a 'Done (' line in recent
 * logs, or slow-booting packs get a false OK (and false failures on rollback).
 */
async function waitForHealthy(serverId, { timeoutMs = 10 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let stableChecks = 0;
  while (Date.now() < deadline) {
    await sleep(5000);
    const info = await inspectStatus(serverId).catch(() => null);
    if (!info || !info.exists) return false;
    if (info.status === 'crashed') return false;
    if (info.status === 'running') {
      stableChecks += 1;
      const hasHealthcheck = info.health != null;
      if (hasHealthcheck && stableChecks >= 3) return true; // ~15s stable + healthy
      if (!hasHealthcheck && stableChecks >= 6) {
        const tail = await fetchLogs(serverId, { tail: 100 }).catch(() => '');
        if (/Done \(/.test(tail)) return true;
        // keep polling: the process is alive but the MC server isn't done booting
      }
    } else {
      stableChecks = 0;
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms).unref());
}

module.exports = { upgradePack, rollbackPack, upgradeStatus };
