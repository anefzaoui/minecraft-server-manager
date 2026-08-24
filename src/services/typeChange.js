// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Controlled server-type change (e.g. Paper -> Fabric): preview warnings ->
// pre-change backup -> graceful stop -> apply (type + env cleanup + Java tag
// reset + BlueMap disable if needed) -> recreate -> start -> monitor -> one-
// click rollback on failure. Mirrors src/updates/upgrade.js's pack-upgrade
// flow - same shape, different subject.

const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');
const db = require('../db');
const serversService = require('./servers');
const backupsService = require('./backups');
const modsService = require('./mods');
const mapService = require('./map');
const worldsService = require('./worlds');
const { fetchLogs } = require('../docker/logs');
const { inspectStatus } = require('../docker/containers');
const TYPE_FIELD = require('../config/field-catalog/general').find((f) => f.key === 'TYPE');

const activeChanges = new Map(); // serverId -> {step, startedAt}

function changeStatus(serverId) {
  return activeChanges.get(serverId) || null;
}

// The 4 modpack platforms need a platform-specific slug/version pin this
// generic switch has no way to collect - they go through the dedicated pack
// installer instead. CUSTOM needs a CUSTOM_SERVER download URL for the same
// reason. Every other TYPE option needs nothing beyond the type itself
// (itzg auto-resolves a build), so it's offered as-is here.
const UNSUPPORTED_TARGETS = new Set(['AUTO_CURSEFORGE', 'CURSEFORGE', 'MODRINTH', 'FTBA', 'GTNH', 'CUSTOM']);

function allowedTargetTypes() {
  return TYPE_FIELD.options.filter((o) => !UNSUPPORTED_TARGETS.has(o.value));
}

function typeLabel(type) {
  return TYPE_FIELD.options.find((o) => o.value === type)?.label || type;
}

// Env keys that belong to a specific server type/platform - meaningless (or
// actively wrong) once you leave the type that owns them. A stale
// FORGE_VERSION or CF_SLUG left behind after switching just confuses the
// next person who opens Advanced Settings, or worse, silently constrains a
// type that no longer expects it.
const LOADER_ENV_PREFIX = /^(CF_|MODRINTH_|FTB_|GTNH_|SKIP_GTNH_)/;
const LOADER_ENV_KEYS = new Set([
  'PAPER_BUILD',
  'PAPER_CHANNEL',
  'PURPUR_BUILD',
  'FORGE_VERSION',
  'NEOFORGE_VERSION',
  'FABRIC_LOADER_VERSION',
  'FABRIC_LAUNCHER_VERSION',
  'QUILT_LOADER_VERSION',
  'CUSTOM_SERVER',
]);
const isLoaderEnvKey = (key) => LOADER_ENV_PREFIX.test(key) || LOADER_ENV_KEYS.has(key);

function stripLoaderEnv(env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !isLoaderEnvKey(key)));
}

/** Everything the confirmation dialog needs to know before committing. */
function previewTypeChange(serverId, newType) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  if (!allowedTargetTypes().some((o) => o.value === newType)) {
    throw httpError(
      400,
      `Cannot switch directly to ${newType} - modpack platforms go through the modpack installer instead`
    );
  }
  if (newType === server.type) throw httpError(400, `${server.display_name} is already ${typeLabel(newType)}`);

  const warnings = worldsService.compatWarnings(
    { flavor: server.type, version: server.mc_version },
    { type: newType, mc_version: server.mc_version }
  );

  const clearedKeys = Object.keys(server.env).filter(isLoaderEnvKey);
  if (clearedKeys.length) {
    warnings.push(`These settings only apply to the current type and will be cleared: ${clearedKeys.join(', ')}.`);
  }

  const wasPlugin = modsService.contentDir({ type: server.type }, 'mod') === 'plugins';
  const willBePlugin = modsService.contentDir({ type: newType }, 'mod') === 'plugins';
  if (wasPlugin !== willBePlugin) {
    warnings.push(
      `${wasPlugin ? 'Plugins' : 'Mods'} installed through this panel won't run on ${typeLabel(newType)} - ` +
        `they'll stay on disk but won't be usable until you install ${willBePlugin ? 'plugin' : 'mod'} equivalents from the Mods tab.`
    );
  }

  if (mapService.getMapConfig(serverId).enabled) {
    warnings.push(
      'The live map (BlueMap) will be disabled by this change - re-enable it afterward from the World tab.'
    );
  }

  if (server.java_tag) {
    warnings.push(
      `The pinned Java version (${server.java_tag}) will be cleared so the panel can pick one that matches ${typeLabel(newType)}.`
    );
  }

  return { warnings, fromType: server.type, toType: newType };
}

/**
 * Run the full safe type change.
 * opts.onStep(step: string) is invoked as the flow progresses.
 */
async function changeType(serverId, newType, { skipBackup = false, actor = 'system', onStep = () => {} } = {}) {
  if (activeChanges.has(serverId)) throw httpError(409, 'A type change or rollback is already running for this server');
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');

  const step = (s) => {
    activeChanges.set(serverId, { step: s, startedAt: activeChanges.get(serverId)?.startedAt || Date.now() });
    onStep(s);
  };

  try {
    // previewTypeChange() re-validates newType/no-op here too - the route
    // already showed these warnings for confirmation, but nothing stops a
    // second, stale request from skipping straight to this call.
    previewTypeChange(serverId, newType);

    let backupId = null;
    if (!skipBackup) {
      step('backing-up');
      const backup = await backupsService.createBackup(serverId, {
        reason: 'pre-update',
        actor,
        note: `Before type change ${typeLabel(server.type)} → ${typeLabel(newType)}`,
      });
      backupId = backup.id;
    }

    step('stopping');
    const wasRunning = ['running', 'starting', 'unhealthy'].includes(server.status);
    if (wasRunning) await serversService.stopServer(serverId, { actor });

    step('applying');
    const cleanedEnv = stripLoaderEnv(server.env);
    // Stash the pre-change state for rollback before overwriting it - the
    // same role server_packs.previous_version_id plays for pack upgrades.
    db.run(
      `UPDATE servers SET
         previous_type = ?, previous_env_json = ?, previous_java_tag = ?,
         type = ?, env_json = ?, java_tag = '', pending_recreate = 1
       WHERE id = ?`,
      server.type,
      server.env_json,
      server.java_tag,
      newType,
      JSON.stringify(cleanedEnv),
      serverId
    );
    if (mapService.getMapConfig(serverId).enabled) {
      await mapService.disableMap(serverId, { actor });
    }

    step('recreating');
    await serversService.recreateServer(serverId, { actor, quiet: true });
    await serversService.startServer(serverId, { actor });

    step('monitoring');
    const healthy = await waitForHealthy(serverId, { timeoutMs: 10 * 60 * 1000 });
    const excerpt = await fetchLogs(serverId, { tail: 200 }).catch(() => '');

    if (!healthy) {
      recordEvent({
        serverId,
        actor,
        type: 'update-failed',
        summary: `Type change to ${typeLabel(newType)} failed to start - rollback available`,
        details: { backupId, previousType: server.type },
        logExcerpt: excerpt || null,
      });
      const err = httpError(
        502,
        `The server did not come up healthy after switching to ${typeLabel(newType)}. Use rollback to restore ${typeLabel(server.type)}.`
      );
      err.rollbackAvailable = Boolean(backupId);
      throw err;
    }

    recordEvent({
      serverId,
      actor,
      type: 'server-type-changed',
      summary: `Server type changed: ${typeLabel(server.type)} → ${typeLabel(newType)}`,
      details: { backupId, from: server.type, to: newType },
      logExcerpt: excerpt || null,
    });
    return { ok: true, from: typeLabel(server.type), to: typeLabel(newType), backupId };
  } finally {
    activeChanges.delete(serverId);
  }
}

/** Roll back: restore the pre-change backup + revert type/env/Java tag. */
async function rollbackTypeChange(serverId, { backupId, actor = 'system' } = {}) {
  if (activeChanges.has(serverId)) throw httpError(409, 'A type change or rollback is already running for this server');
  const row = db.get('SELECT * FROM servers WHERE id = ? AND deleted_at IS NULL', serverId);
  if (!row) throw httpError(404, 'Server not found');
  if (!row.previous_type) throw httpError(400, 'No previous server type recorded');

  activeChanges.set(serverId, { step: 'rolling-back', startedAt: Date.now() });
  try {
    await serversService.stopServer(serverId, { actor }).catch(() => {});
    if (backupId) await backupsService.restoreBackup(serverId, backupId, { actor, skipSafety: true });

    db.run(
      `UPDATE servers SET
         type = ?, env_json = ?, java_tag = ?,
         previous_type = NULL, previous_env_json = NULL, previous_java_tag = NULL,
         pending_recreate = 1
       WHERE id = ?`,
      row.previous_type,
      row.previous_env_json,
      row.previous_java_tag,
      serverId
    );
    await serversService.recreateServer(serverId, { actor, quiet: true });
    await serversService.startServer(serverId, { actor });

    recordEvent({
      serverId,
      actor,
      type: 'update-rolled-back',
      summary: `Server type rolled back to ${typeLabel(row.previous_type)}${backupId ? ' (backup restored)' : ''}`,
    });
    return { ok: true, type: typeLabel(row.previous_type) };
  } finally {
    activeChanges.delete(serverId);
  }
}

/** Same tolerant health-poll as the pack-upgrade flow - see upgrade.js for rationale. */
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
      if (hasHealthcheck && stableChecks >= 3) return true;
      if (!hasHealthcheck && stableChecks >= 6) {
        const tail = await fetchLogs(serverId, { tail: 100 }).catch(() => '');
        if (/Done \(/.test(tail)) return true;
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

module.exports = { allowedTargetTypes, typeLabel, previewTypeChange, changeType, rollbackTypeChange, changeStatus };
