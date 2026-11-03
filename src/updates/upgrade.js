// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Controlled upgrade orchestrator: preview → pre-update backup → graceful stop
// → re-pin → recreate → start → monitor → one-click rollback on failure.
// Never automatic unless the server's update_policy is 'auto'.

const path = require('node:path');
const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');
const serversService = require('../services/servers');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');
const packsService = require('../services/packs');
const backupsService = require('../services/backups');
const { fetchLogs } = require('../docker/logs');
const { inspectStatus } = require('../docker/containers');
const { retryWhileBusy } = require('../services/opLock');

const activeUpgrades = new Map(); // serverId -> {step, startedAt}

function upgradeStatus(serverId) {
  return activeUpgrades.get(serverId) || null;
}

/**
 * Run the full safe switch to a target pack version, newer or older (the
 * version picker uses it as well as the "upgrade to latest" buttons).
 * onStep(step: string) is invoked as the flow progresses.
 * opts.allowVersionChange must be true to move to a newer MC version (409
 * otherwise); a version on an OLDER MC version than the world is always
 * refused, since the game can't load a world a newer version has saved.
 * opts.task: optional tasks.js handle - step() calls are mirrored to it.
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
  if (activeUpgrades.has(serverId)) throw httpError(409, 'An upgrade or rollback is already running for this server');
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  // packIdentity, not getPack: a server whose pin was never recorded (the boot
  // sweep found no evidence) is pinned through this same guarded path.
  const pack = packsService.packIdentity(serverId);
  if (!pack) throw httpError(400, 'This server has no managed modpack');
  const fromName = pack.pinned_version_name || 'an unpinned version';

  const STEP_LABELS = {
    resolving: 'Resolving target version…',
    'backing-up': 'Creating pre-update backup…',
    stopping: 'Stopping server…',
    applying: 'Applying pack version…',
    recreating: 'Rebuilding the server…',
    monitoring: 'Waiting for the server to come up…',
    overlay: 'Restoring custom mod overlay…',
  };
  const step = (s) => {
    activeUpgrades.set(serverId, { step: s, startedAt: activeUpgrades.get(serverId)?.startedAt || Date.now() });
    if (task) task.step(STEP_LABELS[s] || s);
    logger.debug('A pack version change advanced.', { serverId, step: s });
    onStep(s);
  };

  logger.info('Started a pack version change.', { serverId, actor, pack: pack.project_name || pack.project_ref });
  try {
    step('resolving');
    // Thread the pin's own channel through: without this, an explicit versionId-less
    // upgrade on a beta-pinned GTNH server silently resolves to the newest STABLE
    // (pickLatest's default), while the UI (latestFor) showed the newest BETA - a
    // downgrade the user never confirmed. includeBeta is a no-op for every other
    // platform/branch, which doesn't key off a stored channel.
    const resolved = await packsService.resolvePack(pack.platform, pack.project_ref, {
      versionId,
      includeBeta: pack.channel === 'beta',
    });
    if (pack.pinned_version_id != null && resolved.versionId === String(pack.pinned_version_id)) {
      throw httpError(400, `Already on ${pack.pinned_version_name}. Nothing to change.`);
    }

    // Judged against the world's own version (else the server's): an older
    // game can't load it at all, and a newer one converts it for good. Both
    // are decided BEFORE any backup/stop work happens.
    const baseline = packsService.baselineMcVersion(server);
    const mcOrder = packsService.compareMcVersions(resolved.mcVersion, baseline);
    if (mcOrder === -1) {
      const err = httpError(
        409,
        `${resolved.versionName} runs Minecraft ${resolved.mcVersion}, which is older than this world (${baseline}). ` +
          'Minecraft cannot load a world on an older version, so this pack version cannot be installed here.'
      );
      err.olderMinecraft = true;
      throw err;
    }
    if (mcOrder === 1 && !allowVersionChange) {
      const err = httpError(
        409,
        `${resolved.versionName} runs Minecraft ${resolved.mcVersion} but this server is on ${baseline}. ` +
          'Changing will permanently convert the world to the new Minecraft version. Confirm the version change to proceed.'
      );
      err.requiresVersionConfirm = true;
      err.fromMcVersion = baseline;
      err.toMcVersion = resolved.mcVersion;
      throw err;
    }

    let backupId = null;
    if (!skipBackup) {
      step('backing-up');
      const backup = await backupsService.createBackup(serverId, {
        reason: 'pre-update',
        actor,
        note: `Before pack ${fromName} → ${resolved.versionName}`,
        task,
      });
      backupId = backup.id;
    }

    step('stopping');
    // 'stalled' is still a genuinely running container - it must be gracefully
    // stopped too, or applyPack() below rewrites mod/pack files on disk while
    // the still-live JVM may be concurrently reading/writing the same directory.
    const wasRunning = ['running', 'starting', 'unhealthy', 'stalled'].includes(server.status);
    if (wasRunning) await serversService.stopServer(serverId, { actor });

    step('applying');
    // The pre-update backup above is the safety net; still require the caller
    // to have confirmed cross-MC-version upgrades (checked before backup by
    // the route via resolvePack diff) - here we proceed.
    const { previous } = await packsService.applyPack(serverId, resolved, { actor, force: true });

    step('recreating');
    // Each step is locked on its own; a short action landing between them
    // (a port change, a backup cleanup) must delay this, not break it halfway.
    await retryWhileBusy(() => serversService.recreateServer(serverId, { actor, quiet: true }));
    await retryWhileBusy(() => serversService.startServer(serverId, { actor }));

    step('monitoring');
    // CF/Modrinth installs download the whole pack on first boot - give them
    // twice the window. GTNH downloads a ~1-2 GB server pack and then builds a
    // 1.7.10 world with several hundred mods, which routinely outlasts both.
    const INSTALL_TIMEOUTS_MS = { gtnh: 30 * 60 * 1000, curseforge: 20 * 60 * 1000, modrinth: 20 * 60 * 1000 };
    const timeoutMs = INSTALL_TIMEOUTS_MS[pack.platform] || 10 * 60 * 1000;
    const healthy = await waitForHealthy(serverId, { timeoutMs });
    const excerpt = await fetchLogs(serverId, { tail: 200 }).catch(() => '');

    if (!healthy) {
      // Rollback re-pins the recorded previous version; a server pinned here
      // for the first time has none, so only its backup is left to restore.
      const canRollBack = Boolean(backupId && previous);
      recordEvent({
        serverId,
        actor,
        type: 'update-failed',
        summary: canRollBack
          ? `Pack version ${resolved.versionName} failed to start. A rollback is available.`
          : `Pack version ${resolved.versionName} failed to start.`,
        details: { backupId, previousVersion: previous ? previous.pinned_version_id : null },
        logExcerpt: excerpt || null,
      });
      logger.warn('A pack version change did not come up healthy.', {
        serverId,
        toVersion: resolved.versionName,
        backupId,
        canRollBack,
      });
      const err = httpError(
        502,
        canRollBack
          ? `The server did not come up healthy on ${resolved.versionName}. Roll back to restore ${fromName}.`
          : `The server did not come up healthy on ${resolved.versionName}.${backupId ? ' Its pre-update backup can be restored from the Backups tab.' : ''}`
      );
      err.rollbackAvailable = canRollBack;
      // The unattended auto-update path needs the id to roll back without a
      // human in the loop; the interactive path keeps offering the button.
      err.backupId = backupId;
      throw err;
    }

    step('overlay');
    await packsService.afterPackOperation(serverId, { actor });

    recordEvent({
      serverId,
      actor,
      type: 'update-applied',
      summary: `Pack version changed: ${pack.project_name || resolved.projectName} ${fromName} → ${resolved.versionName}.`,
      details: { backupId, from: pack.pinned_version_id, to: resolved.versionId },
      logExcerpt: excerpt || null,
    });
    logger.info('Finished a pack version change.', {
      serverId,
      actor,
      from: pack.pinned_version_name,
      to: resolved.versionName,
      backupId,
    });
    return { ok: true, from: fromName, to: resolved.versionName, backupId };
  } finally {
    activeUpgrades.delete(serverId);
  }
}

/**
 * Apply pending pack updates for every server whose update_policy is 'auto',
 * one at a time, straight after the scheduled daily check (deliberately NOT
 * from the manual "check now" buttons - the settings label promises the daily
 * check, so that is the only trigger). Unattended safety: the pre-update
 * backup stays on, cross-MC-version updates are skipped with an event (they
 * permanently convert the world - always a human decision), and a failed
 * boot rolls back automatically instead of waiting for a click (#24).
 */
async function runAutoUpgrades({ actor = 'scheduler' } = {}) {
  const db = require('../db');
  const results = { applied: 0, skipped: 0, failed: 0 };
  for (const server of serversService.listServers()) {
    if (server.update_policy !== 'auto') continue;
    const pack = packsService.getPack(server.id);
    if (!pack) continue; // packs only for now; images/loaders stay manual
    const check = db.get(
      "SELECT * FROM update_checks WHERE subject_type = 'pack' AND subject_id = ? AND latest_version IS NOT NULL",
      server.id
    );
    if (!check || check.latest_version === pack.pinned_version_id) continue;
    // "Ignore this update" pins update_checks.ignored_version to the offered
    // build; auto policy must respect it exactly like the badge and digest do.
    // A newer build changes latest_version and the ignore lapses on its own.
    if (check.ignored_version != null && String(check.ignored_version) === String(check.latest_version)) {
      results.skipped += 1;
      continue;
    }
    try {
      await upgradePack(server.id, { versionId: check.latest_version, actor });
      results.applied += 1;
    } catch (err) {
      if (err.requiresVersionConfirm) {
        results.skipped += 1;
        recordEvent({
          serverId: server.id,
          actor,
          type: 'auto-update-skipped',
          summary: `Auto-update to ${check.latest_name || check.latest_version} skipped: it moves Minecraft ${err.fromMcVersion} → ${err.toMcVersion}, which permanently converts the world. Apply it manually when you are ready.`,
        });
        continue;
      }
      results.failed += 1;
      logger.warn('An automatic pack upgrade failed.', {
        serverId: server.id,
        toVersion: check.latest_name || check.latest_version,
        err: serializeError(err, { includeStack: false }),
      });
      if (err.rollbackAvailable && err.backupId) {
        try {
          await rollbackPack(server.id, { backupId: err.backupId, actor });
        } catch (rbErr) {
          // upgradePack already recorded update-failed; this event is the
          // "your server needs you" escalation for the truly bad night.
          recordEvent({
            serverId: server.id,
            actor,
            type: 'auto-update-failed',
            summary: `Auto-update failed, and the automatic rollback also failed. The server needs manual attention. The pre-update backup is intact.`,
          });
          logger.error('The automatic rollback after a failed auto-update also failed.', {
            serverId: server.id,
            backupId: err.backupId,
            err: serializeError(rbErr),
          });
        }
      }
    }
  }
  if (results.applied || results.skipped || results.failed) {
    logger.info('Finished the automatic pack upgrades.', results);
  }
  return results;
}

/** Roll back: restore the pre-update backup + re-pin the previous version. */
async function rollbackPack(serverId, { backupId, actor = 'system' } = {}) {
  // Same activeUpgrades guard as upgradePack - without it, a rollback fired
  // while an upgrade is still mid-flight for the same server (e.g. the user
  // gets impatient during the 'monitoring' wait) can interleave applyPack's
  // pinned/previous-version bookkeeping and the recreate/start sequence,
  // leaving it unclear which pack version actually ended up installed.
  if (activeUpgrades.has(serverId)) throw httpError(409, 'An upgrade or rollback is already running for this server');
  const pack = packsService.getPack(serverId);
  if (!pack || !pack.previous_version_id) throw httpError(400, 'No previous pack version recorded');

  activeUpgrades.set(serverId, { step: 'rolling-back', startedAt: Date.now() });
  logger.info('Started a pack rollback.', { serverId, actor, toVersion: pack.previous_version_name, backupId });
  try {
    await serversService.stopServer(serverId, { actor }).catch((err) => {
      logger.debug('A stop before rollback failed; continuing.', {
        serverId,
        err: serializeError(err, { includeStack: false }),
      });
    });
    if (backupId) {
      await retryWhileBusy(() => backupsService.restoreBackup(serverId, backupId, { actor, skipSafety: true }));
    }

    const resolved = await packsService.resolvePack(pack.platform, pack.project_ref, {
      versionId: pack.previous_version_id,
    });
    await packsService.applyPack(serverId, resolved, { actor, force: true }); // backup restore precedes this
    // Each step is locked on its own; a short action landing between them
    // (a port change, a backup cleanup) must delay this, not break it halfway.
    await retryWhileBusy(() => serversService.recreateServer(serverId, { actor, quiet: true }));
    await retryWhileBusy(() => serversService.startServer(serverId, { actor }));

    recordEvent({
      serverId,
      actor,
      type: 'update-rolled-back',
      summary: `Rolled back to ${pack.previous_version_name}${backupId ? ' (backup restored)' : ''}.`,
    });
    logger.info('Finished a pack rollback.', { serverId, actor, toVersion: pack.previous_version_name, backupId });
    return { ok: true, version: pack.previous_version_name };
  } finally {
    activeUpgrades.delete(serverId);
  }
}

/**
 * Wait until the server is genuinely up.
 * With a Docker healthcheck: 3 consecutive 'running' (healthy) checks (~15s).
 * WITHOUT one (health null), inspect says 'running' the instant the process
 * starts - require 6 consecutive checks (~30s) AND a 'Done (' line in recent
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
      // Healthcheck still inside its (long) StartPeriod: the container reports
      // 'starting', not 'running', even after the server is genuinely up. Accept
      // once the MC server itself says it's done, so a slow pack boot with a
      // lagging mc-health probe isn't falsely called a failed upgrade.
      if (info.status === 'starting') {
        const tail = await fetchLogs(serverId, { tail: 100 }).catch(() => '');
        if (/Done \(/.test(tail)) return true;
      }
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms).unref());
}

module.exports = { upgradePack, rollbackPack, upgradeStatus, runAutoUpgrades };
