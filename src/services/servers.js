// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Server orchestration: CRUD, env assembly, container lifecycle. The single
// place that turns a DB server row into a running itzg container.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const path = require('node:path');
const { nanoid } = require('nanoid');
const db = require('../db');
const config = require('../config');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const secrets = require('./secrets');
const { pickJavaTag } = require('./javaMatrix');
const { suggestPorts, isPortFree } = require('./ports');
const containers = require('../docker/containers');
const images = require('../docker/images');
const { fetchLogs } = require('../docker/logs');

function rowToServer(row) {
  if (!row) return null;
  return {
    ...row,
    tags: JSON.parse(row.tags_json || '[]'),
    env: JSON.parse(row.env_json || '{}'),
  };
}

function listServers() {
  return db.all('SELECT * FROM servers WHERE deleted_at IS NULL ORDER BY created_at').map(rowToServer);
}

function getServer(id) {
  return rowToServer(db.get('SELECT * FROM servers WHERE id = ? AND deleted_at IS NULL', id));
}

/**
 * Assemble the container env from a server row. Panel-owned invariants
 * (EULA, RCON, memory, STOP_DURATION) are applied last so user env in
 * env_json can never break panel management.
 */
function assembleEnv(server) {
  const env = { ...server.env };
  env.EULA = 'TRUE';
  env.TYPE = server.type;
  if (server.mc_version && server.mc_version !== 'LATEST') env.VERSION = server.mc_version;
  env.MEMORY = `${server.heap_mb}M`;
  env.ENABLE_RCON = 'true';
  let rconPassword = secrets.tryDecrypt(server.rcon_password_cipher);
  if (!rconPassword) {
    // SESSION_SECRET changed — self-heal: mint a fresh password and persist it.
    rconPassword = secrets.generatePassword();
    db.run('UPDATE servers SET rcon_password_cipher = ? WHERE id = ?', secrets.encrypt(rconPassword), server.id);
    recordEvent({
      serverId: server.id,
      type: 'rcon-password-regenerated',
      summary:
        'Stored RCON password could not be decrypted (SESSION_SECRET changed) — a new one was generated automatically',
    });
  }
  env.RCON_PASSWORD = rconPassword;
  env.STOP_DURATION = env.STOP_DURATION || '60';
  // CurseForge features need the API key inside the container. It lives in
  // the panel's encrypted store — inject it whenever anything CF is in play.
  const usesCurseforge =
    server.type === 'AUTO_CURSEFORGE' ||
    env.CF_SLUG ||
    env.CF_FILE_ID ||
    env.CF_PAGE_URL ||
    env.CURSEFORGE_FILES ||
    env.CF_MODPACK_ZIP;
  if (usesCurseforge && !env.CF_API_KEY) {
    const cfKey = require('./apiKeys').getKey('curseforge');
    if (cfKey) env.CF_API_KEY = cfKey;
  }
  // The panel is the sole restart authority; never let packs override env.
  delete env.LOAD_ENV_FROM_FILE;
  delete env.LOAD_ENV_FROM_GENERIC_PACK;
  delete env.LOAD_ENV_FROM_ARCHIVE;
  delete env.REMOVE_OLD_MODS;
  return env;
}

function resolveImage(server) {
  const tag = server.java_tag || pickJavaTag(server.mc_version, server.type);
  return images.imageRef(tag);
}

// Creates are serialized through this chain so two concurrent creates can't both
// probe the same free port before either has inserted its row (port-allocation
// TOCTOU → duplicate host ports → one un-startable server). Creates are rare, so
// running them one-at-a-time is cheap insurance.
let createChain = Promise.resolve();

function createServer(input, opts = {}) {
  const run = () => createServerImpl(input, opts);
  const result = createChain.then(run, run);
  createChain = result.then(
    () => {},
    () => {}
  ); // a failed create must not break the chain
  return result;
}

/**
 * Create a server: DB row + data dir + container. Does not start it unless
 * opts.start. onProgress(status) receives human-readable progress strings.
 * On any failure before the container exists, the half-created row + data dirs
 * are rolled back so no ghost server holds ports.
 */
async function createServerImpl(input, { actor = 'system', start = false, onProgress = () => {} } = {}) {
  // Fail fast instead of shipping a crash-looping container: anything
  // CurseForge needs the API key present in the panel's store.
  const inputEnv = input.env || {};
  const wantsCurseforge =
    input.type === 'AUTO_CURSEFORGE' ||
    inputEnv.CF_SLUG ||
    inputEnv.CF_FILE_ID ||
    inputEnv.CF_PAGE_URL ||
    inputEnv.CURSEFORGE_FILES;
  if (wantsCurseforge && !require('./apiKeys').getKey('curseforge')) {
    throw httpError(
      412,
      'CurseForge needs an API key — add yours in Settings → API keys first (console.curseforge.com), then create the server.'
    );
  }

  const id = `srv_${nanoid(8)}`;

  // Ports: honor explicit choices (validated), else auto-suggest.
  let ports;
  if (input.portGame) {
    // The RCON port is derived when not given explicitly — validate the
    // DERIVED value too, or an explicit game port skips collision checks.
    const rcon = input.portRcon || input.portGame + config.ports.rconOffset;
    const toCheck = [input.portGame, rcon];
    if (input.portBedrock) toCheck.push(input.portBedrock);
    if (input.portQuery) toCheck.push(input.portQuery);
    for (const p of toCheck) {
      if (!(await isPortFree(p))) throw httpError(400, `Port ${p} is already in use or invalid`);
    }
    ports = { game: input.portGame, rcon, bedrock: input.portBedrock || null };
  } else {
    ports = await suggestPorts({ withBedrock: Boolean(input.withBedrock) });
  }

  const rconPassword = secrets.generatePassword();
  const defaults = config.defaults;

  db.run(
    `INSERT INTO servers (id, display_name, description, icon, accent, tags_json, type, mc_version,
       java_tag, env_json, port_game, port_rcon, port_query, port_bedrock, rcon_password_cipher,
       heap_mb, container_memory_mb, container_swap_mb, cpus, disk_quota_bytes, quota_strict,
       update_policy, auto_start, auto_restart, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stopped')`,
    id,
    input.name,
    input.description || '',
    input.icon || 'grass',
    input.accent || '#3fa62b',
    JSON.stringify(input.tags || []),
    input.type,
    input.mcVersion || 'LATEST',
    input.javaTag || '',
    JSON.stringify(input.env || {}),
    ports.game,
    ports.rcon,
    input.portQuery || null,
    ports.bedrock,
    secrets.encrypt(rconPassword),
    input.heapMb ?? defaults.heapMb,
    input.containerMemoryMb ?? defaults.containerMemoryMb,
    input.containerSwapMb ?? 0,
    input.cpus ?? defaults.cpus,
    (input.diskQuotaGb ?? defaults.diskQuotaGb) * 1024 ** 3,
    input.quotaStrict ? 1 : 0,
    input.updatePolicy || 'manual',
    input.autoStart ? 1 : 0,
    input.autoRestart === false ? 0 : 1
  );

  const server = getServer(id);

  try {
    fs.mkdirSync(dataPath('servers', id), { recursive: true });
    fs.mkdirSync(dataPath('logs', id, 'events'), { recursive: true });

    const image = resolveImage(server);
    onProgress(`Pulling image ${image} (first time can take a few minutes)…`);
    await images.ensureImage(image, ({ current, total }) => {
      if (total) onProgress(`Downloading image: ${Math.round((current / total) * 100)}%`);
    });

    onProgress('Creating container…');
    const containerId = await containers.createContainer({
      serverId: id,
      image,
      env: assembleEnv(server),
      dataDirHost: dataPath('servers', id),
      ports: { game: server.port_game, rcon: server.port_rcon, bedrock: server.port_bedrock },
      extraPorts: require('./map').extraPortsFor(server.id),
      resources: { memoryMb: server.container_memory_mb, swapMb: server.container_swap_mb, cpus: server.cpus },
    });
    db.run('UPDATE servers SET container_id = ? WHERE id = ?', containerId, id);
  } catch (err) {
    // Roll back: remove any partial container, drop the row (frees its ports),
    // and delete the freshly-made data/log dirs. Then surface the original error.
    await containers.removeContainer(id).catch(() => {});
    db.run('DELETE FROM servers WHERE id = ?', id);
    try {
      fs.rmSync(dataPath('servers', id), { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    try {
      fs.rmSync(dataPath('logs', id), { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    throw err;
  }

  recordEvent({
    serverId: id,
    actor,
    type: 'created',
    summary: `Server created: ${input.name} (${server.type} ${server.mc_version}, port ${ports.game})`,
    details: { type: server.type, mcVersion: server.mc_version, ports },
  });

  if (start) {
    onProgress('Starting server…');
    await startServer(id, { actor });
  }
  return getServer(id);
}

// ---------------------------------------------------------------------------
// Per-server lifecycle mutex: concurrent start calls share one promise; any
// other overlapping lifecycle op is rejected with 409 instead of racing into
// container-name collisions and half-recreated states.

const inFlightOps = new Map(); // serverId -> { op, promise }

function guardOp(op, fn) {
  return async function guarded(id, opts = {}) {
    const existing = inFlightOps.get(id);
    if (existing) {
      if (existing.op === op && op === 'start') return existing.promise; // piggyback on the same start
      throw httpError(409, `Cannot ${op}: a ${existing.op} operation is already in progress for this server`);
    }
    const promise = fn(id, opts);
    const entry = { op, promise };
    inFlightOps.set(id, entry);
    try {
      return await promise;
    } finally {
      if (inFlightOps.get(id) === entry) inFlightOps.delete(id);
    }
  };
}

async function startServerImpl(id, { actor = 'system' } = {}) {
  const server = mustGet(id);
  const info = await containers.inspectStatus(id);
  if (!info.exists || server.pending_recreate) {
    await recreateServerImpl(id, { actor, quiet: true });
  }
  await containers.startContainer(id);
  db.run("UPDATE servers SET status = 'starting', last_started_at = datetime('now') WHERE id = ?", id);
  recordEvent({ serverId: id, actor, type: 'started', summary: 'Server start requested' });
}

async function stopServerImpl(id, { actor = 'system' } = {}) {
  mustGet(id);
  recordEvent({ serverId: id, actor, type: 'stop-requested', summary: 'Graceful stop requested' });
  await containers.stopContainer(id);
  db.run("UPDATE servers SET status = 'stopped' WHERE id = ?", id);
  const excerpt = await fetchLogs(id, { tail: 100 }).catch(() => '');
  recordEvent({
    serverId: id,
    actor,
    type: 'stopped',
    summary: 'Server stopped gracefully',
    logExcerpt: excerpt || null,
  });
}

async function restartServerImpl(id, { actor = 'system' } = {}) {
  recordEvent({ serverId: id, actor, type: 'restart-requested', summary: 'Restart requested' });
  await stopServerImpl(id, { actor });
  await startServerImpl(id, { actor });
  recordEvent({ serverId: id, actor, type: 'restarted', summary: 'Server restarted' });
}

const startServer = guardOp('start', startServerImpl);
const stopServer = guardOp('stop', stopServerImpl);
const restartServer = guardOp('restart', restartServerImpl);

async function killServer(id, { actor = 'system' } = {}) {
  mustGet(id);
  recordEvent({ serverId: id, actor, type: 'kill-requested', summary: 'Force kill requested' });
  await containers.killContainer(id);
  db.run("UPDATE servers SET status = 'stopped' WHERE id = ?", id);
  recordEvent({ serverId: id, actor, type: 'killed', summary: 'Server force-killed (world may not have saved)' });
}

/** Recreate: remove + create with current env/resources. Applies pending changes. */
async function recreateServerImpl(id, { actor = 'system', quiet = false } = {}) {
  const server = mustGet(id);
  const info = await containers.inspectStatus(id);
  const wasRunning = info.exists && ['running', 'starting', 'unhealthy'].includes(info.status);
  if (wasRunning) await containers.stopContainer(id);
  await containers.removeContainer(id);

  const image = resolveImage(server);
  await images.ensureImage(image);
  const containerId = await containers.createContainer({
    serverId: id,
    image,
    env: assembleEnv(server),
    dataDirHost: dataPath('servers', id),
    ports: { game: server.port_game, rcon: server.port_rcon, bedrock: server.port_bedrock },
    extraPorts: require('./map').extraPortsFor(server.id),
    resources: { memoryMb: server.container_memory_mb, swapMb: server.container_swap_mb, cpus: server.cpus },
  });
  db.run('UPDATE servers SET container_id = ?, pending_recreate = 0 WHERE id = ?', containerId, id);
  if (!quiet)
    recordEvent({ serverId: id, actor, type: 'recreated', summary: 'Container recreated with current configuration' });
  if (wasRunning) await startServerImpl(id, { actor });
}

const recreateServer = guardOp('recreate', recreateServerImpl);

/** Update config fields; computes a diff event and flags recreate needs. */
function updateServer(id, changes, { actor = 'system' } = {}) {
  const before = mustGet(id);
  const columns = {
    name: 'display_name',
    description: 'description',
    icon: 'icon',
    accent: 'accent',
    notes: 'notes',
    mcVersion: 'mc_version',
    javaTag: 'java_tag',
    heapMb: 'heap_mb',
    containerMemoryMb: 'container_memory_mb',
    cpus: 'cpus',
    updatePolicy: 'update_policy',
  };
  const diff = {};
  const sets = [];
  const params = [];
  const RECREATE_FIELDS = new Set(['mcVersion', 'javaTag', 'heapMb', 'containerMemoryMb', 'cpus']);
  let needsRecreate = false;

  for (const [key, col] of Object.entries(columns)) {
    if (changes[key] === undefined) continue;
    const beforeVal = key === 'name' ? before.display_name : before[col];
    if (String(beforeVal) === String(changes[key])) continue;
    diff[key] = [beforeVal, changes[key]];
    sets.push(`${col} = ?`);
    params.push(changes[key]);
    if (RECREATE_FIELDS.has(key)) needsRecreate = true;
  }
  if (changes.tags) {
    diff.tags = [before.tags, changes.tags];
    sets.push('tags_json = ?');
    params.push(JSON.stringify(changes.tags));
  }
  if (changes.env) {
    diff.env = ['(changed)', '(changed)'];
    sets.push('env_json = ?');
    params.push(JSON.stringify(changes.env));
    needsRecreate = true;
  }
  if (changes.diskQuotaGb !== undefined) {
    diff.diskQuotaGb = [Math.round(before.disk_quota_bytes / 1024 ** 3), changes.diskQuotaGb];
    sets.push('disk_quota_bytes = ?');
    params.push(changes.diskQuotaGb * 1024 ** 3);
  }
  for (const flag of ['autoStart', 'autoRestart', 'quotaStrict']) {
    if (changes[flag] === undefined) continue;
    const col = { autoStart: 'auto_start', autoRestart: 'auto_restart', quotaStrict: 'quota_strict' }[flag];
    if (Boolean(before[col]) === Boolean(changes[flag])) continue;
    diff[flag] = [Boolean(before[col]), Boolean(changes[flag])];
    sets.push(`${col} = ?`);
    params.push(changes[flag] ? 1 : 0);
  }

  if (!sets.length) return { server: before, needsRecreate: false };
  if (needsRecreate) sets.push('pending_recreate = 1');
  db.run(`UPDATE servers SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
  recordEvent({
    serverId: id,
    actor,
    type: 'config-changed',
    summary: `Configuration changed: ${Object.keys(diff).join(', ')}${needsRecreate ? ' (recreate required)' : ''}`,
    details: { diff, needsRecreate },
  });
  return { server: getServer(id), needsRecreate };
}

/** Delete server: container, DB rows, and (optionally) its data directory. */
async function deleteServer(id, { actor = 'system', keepWorld = false } = {}) {
  const server = mustGet(id);
  await containers.stopContainer(id).catch(() => {});
  await containers.removeContainer(id);
  let freedBytes = 0;
  const dir = dataPath('servers', id);
  if (!keepWorld && fs.existsSync(dir)) {
    freedBytes = dirSize(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // Full cleanup cascade — without it schedules keep firing, backups pile up,
  // and server_content rows block library deletions forever.

  // Schedules: disarm the live cron jobs, not just the rows.
  const scheduler = require('./scheduler'); // lazy — avoids a require cycle
  for (const sched of db.all('SELECT id FROM schedules WHERE server_id = ?', id)) {
    try {
      scheduler.deleteSchedule(sched.id, { actor });
    } catch (err) {
      console.error(`[delete] schedule ${sched.id}:`, err.message);
    }
  }

  // Backups: DB rows + the files directory.
  const backupRows = db.all('SELECT size_bytes FROM backups WHERE server_id = ?', id);
  freedBytes += backupRows.reduce((n, b) => n + (b.size_bytes || 0), 0);
  db.run('DELETE FROM backups WHERE server_id = ?', id);
  const backupsDir = dataPath('backups', id);
  if (fs.existsSync(backupsDir)) fs.rmSync(backupsDir, { recursive: true, force: true });

  // Archived logs / event excerpts.
  const logsDir = dataPath('logs', id);
  if (fs.existsSync(logsDir)) fs.rmSync(logsDir, { recursive: true, force: true });

  // All row cleanup + the soft-delete flag run in ONE transaction so a mid-cleanup
  // error can't leave a "live" (deleted_at IS NULL) server whose content/backups
  // are already gone — a zombie. Either everything is removed or nothing is.
  const contentIds = db.all('SELECT id FROM server_content WHERE server_id = ?', id).map((r) => r.id);
  db.transaction(() => {
    db.run("DELETE FROM update_checks WHERE subject_type = 'pack' AND subject_id = ?", id);
    for (const cid of contentIds) {
      db.run("DELETE FROM update_checks WHERE subject_type = 'content' AND subject_id = ?", cid);
    }
    db.run('DELETE FROM server_content WHERE server_id = ?', id);
    db.run('DELETE FROM server_packs WHERE server_id = ?', id);
    db.run('DELETE FROM integrations WHERE server_id = ?', id);
    db.run('DELETE FROM player_events WHERE server_id = ?', id);
    db.run('DELETE FROM player_sessions WHERE server_id = ?', id);
    db.run('DELETE FROM player_stat_snapshots WHERE server_id = ?', id);
    db.run('DELETE FROM crash_reports WHERE server_id = ?', id);
    // Added: these were previously leaked on delete (no FK cascade).
    db.run('DELETE FROM chat_commands WHERE server_id = ?', id);
    db.run('DELETE FROM chat_command_settings WHERE server_id = ?', id);
    db.run('DELETE FROM storage_index WHERE rel_path = ? OR rel_path LIKE ?', `servers/${id}`, `servers/${id}/%`);
    // Keep the soft-deleted server row itself (history retains context).
    db.run("UPDATE servers SET deleted_at = datetime('now'), status = 'stopped' WHERE id = ?", id);
  });
  recordEvent({
    serverId: id,
    actor,
    type: 'deleted',
    summary: `Server deleted: ${server.display_name}${keepWorld ? ' (world kept on disk)' : ''}`,
    details: { keepWorld, freedBytes },
  });
  return { freedBytes };
}

/** Refresh cached status for all servers from Docker (called on boot + 60s poll). */
async function refreshStatuses() {
  for (const server of listServers()) {
    try {
      const info = await containers.inspectStatus(server.id);
      let status = info.exists ? info.status : 'stopped';
      // Healthcheck-less containers report 'running' from the moment the
      // process starts, long before the MC server accepts players. Keep the
      // panel's 'starting' until the log shows 'Done (' — but only spend a
      // log fetch on servers stuck 'starting' for over 2 minutes.
      if (server.status === 'starting' && info.exists && info.status === 'running' && info.health == null) {
        const startedMs = Date.parse(String(server.last_started_at || '').replace(' ', 'T') + 'Z');
        if (!Number.isFinite(startedMs) || Date.now() - startedMs > 2 * 60_000) {
          const tail = await fetchLogs(server.id, { tail: 50 }).catch(() => '');
          status = /Done \(/.test(tail) ? 'running' : 'starting';
        } else {
          status = 'starting';
        }
      }
      if (status !== server.status) db.run('UPDATE servers SET status = ? WHERE id = ?', status, server.id);
    } catch {
      /* daemon offline — leave cached */
    }
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += dirSize(p);
      else if (entry.isFile()) total += fs.statSync(p).size;
    } catch {
      /* transient file */
    }
  }
  return total;
}

function mustGet(id) {
  const server = getServer(id);
  if (!server) throw httpError(404, 'Server not found');
  return server;
}

/**
 * Set (or clear, when blank) the per-server console label used to prefix
 * panel-run console actions in-game. Strips control chars and § codes.
 * @returns {string} the sanitized label ('' when cleared)
 */
function setConsoleLabel(id, label) {
  const clean = String(label || '')
    .replace(/[\r\n\x00-\x1f\x7f§]/g, '')
    .trim()
    .slice(0, 48);
  db.run('UPDATE servers SET console_label = ? WHERE id = ?', clean || null, id);
  return clean;
}

module.exports = {
  listServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  startServer,
  stopServer,
  restartServer,
  killServer,
  recreateServer,
  refreshStatuses,
  assembleEnv,
  resolveImage,
  dirSize,
  setConsoleLabel,
};
