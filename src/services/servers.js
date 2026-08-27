// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Server orchestration: CRUD, env assembly, container lifecycle. The single
// place that turns a DB server row into a running itzg container.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
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
const dockerSpec = require('./dockerSpec');
const settings = require('./settings');
const { withSaveLock } = require('./serverLocks');

function rowToServer(row) {
  if (!row) return null;
  return {
    ...row,
    tags: JSON.parse(row.tags_json || '[]'),
    env: JSON.parse(row.env_json || '{}'),
    containerName: row.container_name || null,
    networkName: row.network_name || null,
    extraPorts: JSON.parse(row.extra_ports_json || '[]'),
    extraBinds: JSON.parse(row.extra_binds_json || '[]'),
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
/** The host uid/gid the panel process runs as, or null where it doesn't apply
 *  (Windows / macOS Docker Desktop don't have this bind-mount ownership problem). */
function panelUidGid() {
  if (process.platform === 'win32' || typeof process.getuid !== 'function') return null;
  return { uid: process.getuid(), gid: process.getgid() };
}

function assembleEnv(server) {
  const env = { ...server.env };
  env.EULA = 'TRUE';
  env.TYPE = server.type;
  if (server.mc_version && server.mc_version !== 'LATEST') env.VERSION = server.mc_version;
  env.MEMORY = `${server.heap_mb}M`;
  env.ENABLE_RCON = 'true';
  let rconPassword = secrets.tryDecrypt(server.rcon_password_cipher);
  if (!rconPassword) {
    // SESSION_SECRET changed - self-heal: mint a fresh password and persist it.
    rconPassword = secrets.generatePassword();
    db.run('UPDATE servers SET rcon_password_cipher = ? WHERE id = ?', secrets.encrypt(rconPassword), server.id);
    recordEvent({
      serverId: server.id,
      type: 'rcon-password-regenerated',
      summary:
        'Stored RCON password could not be decrypted (SESSION_SECRET changed) - a new one was generated automatically',
    });
  }
  env.RCON_PASSWORD = rconPassword;
  env.STOP_DURATION = env.STOP_DURATION || '60';
  // The itzg image defaults TZ to UTC, which makes the JVM's own console
  // timestamps disagree with every other time shown in the panel (which
  // uses the configured panel timezone). Inherit it unless the user set
  // their own TZ for this server via the advanced env fields.
  env.TZ = env.TZ || settings.getTimezone();
  // CurseForge features need the API key inside the container. It lives in
  // the panel's encrypted store - inject it whenever anything CF is in play.
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
  // Docker's port bindings (docker/containers.js GAME_PORT/RCON_PORT) hardcode
  // the CONTAINER-side ports that host ports 25565/25575 forward to. Letting
  // these itzg env vars move the Minecraft process's actual listening port
  // would silently desync from that binding: the panel's own checks (docker
  // exec, healthcheck) never go through the mapped host port, so the server
  // would still show healthy/running while players get connection-refused.
  delete env.SERVER_PORT;
  delete env.RCON_PORT;
  delete env.QUERY_PORT;
  // Run the container as the panel's own host user so every file it writes under
  // ./data is owned by us. Otherwise it writes as its default uid (1000) and the
  // panel - a different user - can't manage those files (mod installs, deletes,
  // backups) and hits EACCES. This is the itzg image's intended ownership knob.
  const ids = panelUidGid();
  if (ids) {
    env.UID = String(ids.uid);
    env.GID = String(ids.gid);
  }
  return env;
}

/**
 * javaTagHint: a non-persisted, create-time-only fallback (see createServerImpl).
 * At create time no server_packs row exists yet, so the pin lookup below always
 * misses for a brand-new GTNH server - without the hint that resolves to java17,
 * the image is pulled once, then re-pulled at the correct tag on the recreate
 * `applyPack` schedules moments later. It's never used once a pin exists, and
 * it never overrides an explicit `server.java_tag` (that column means "the user
 * overrode auto" and must keep winning).
 */
function resolveImage(server, { javaTagHint } = {}) {
  // GTNH's Java support is a property of the pinned pack version, not of the
  // Minecraft version. Read it straight from the pin: packs.js requires this
  // module, so requiring it back would need a lazy-require cycle-breaker that a
  // single-column read doesn't justify.
  const pin =
    server.type === 'GTNH' ? db.get('SELECT max_java_version FROM server_packs WHERE server_id = ?', server.id) : null;
  const tag =
    server.java_tag ||
    (pin?.max_java_version == null && javaTagHint) ||
    pickJavaTag(server.mc_version, server.type, { maxJavaVersion: pin?.max_java_version });
  return images.imageRef(tag);
}

/**
 * Combine BlueMap's own (integrations-table-tracked) extra port with the
 * server's user-defined extra ports into the single array `createContainer`
 * expects. Lazily requires ./map - map.js requires this module (for
 * getServer), so a top-level require here would be circular.
 */
function mergeExtraPorts(server) {
  const bluemapPorts = require('./map').extraPortsFor(server.id);
  const userPorts = (server.extraPorts || []).map((p) => ({
    container: `${p.containerPort}/${p.protocol}`,
    host: p.hostPort,
  }));
  return [...bluemapPorts, ...userPorts];
}

/**
 * Best-effort preview of the container params a `createServer(input)` call
 * would produce - no persistence, no port allocation (unassigned ports show
 * as a placeholder since the real ones aren't claimed until creation).
 * Feeds the wizard's "Advanced Docker Settings" YAML preview.
 */
function previewCreateSpec(input) {
  const javaTag = input.javaTag || pickJavaTag(input.mcVersion || 'LATEST', input.type || 'VANILLA');
  const image = images.imageRef(javaTag);
  const defaults = config.defaults;
  const env = { ...(input.env || {}) };
  env.EULA = 'TRUE';
  env.TYPE = input.type || 'VANILLA';
  if (input.mcVersion && input.mcVersion !== 'LATEST') env.VERSION = input.mcVersion;
  env.MEMORY = `${input.heapMb ?? defaults.heapMb}M`;
  env.ENABLE_RCON = 'true';
  env.RCON_PASSWORD = '(generated at creation)';
  return {
    containerName: input.containerName || null,
    network: input.networkName || null,
    image,
    resources: {
      memoryMb: input.containerMemoryMb ?? defaults.containerMemoryMb,
      swapMb: input.containerSwapMb ?? 0,
      cpus: input.cpus ?? defaults.cpus,
    },
    ports: {
      game: input.portGame || '(auto-assigned)',
      rcon: input.portRcon || (input.portGame ? input.portGame + config.ports.rconOffset : '(auto-assigned)'),
      bedrock: input.withBedrock ? input.portBedrock || '(auto-assigned)' : null,
      extra: input.extraPorts || [],
    },
    volumes: {
      data: '<panel data dir>/servers/<server id> -> /data',
      extra: input.extraBinds || [],
    },
    env,
  };
}

/** Same shape as previewCreateSpec, but from a real, already-created server. */
function previewServerSpec(id) {
  const server = mustGet(id);
  const env = assembleEnv(server);
  env.RCON_PASSWORD = '(hidden)';
  if (env.CF_API_KEY) env.CF_API_KEY = '(hidden)';
  return {
    containerName: server.containerName || containers.containerName(server.id),
    network: server.networkName || null,
    image: resolveImage(server),
    resources: { memoryMb: server.container_memory_mb, swapMb: server.container_swap_mb, cpus: server.cpus },
    ports: {
      game: server.port_game,
      rcon: server.port_rcon,
      bedrock: server.port_bedrock,
      extra: server.extraPorts,
    },
    volumes: {
      data: `${dataPath('servers', id)} -> /data`,
      extra: server.extraBinds,
    },
    env,
  };
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
async function createServerImpl(input, { actor = 'system', start = false, onProgress = () => {}, javaTagHint } = {}) {
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
      'CurseForge needs an API key - add yours in Settings → API keys first (console.curseforge.com), then create the server.'
    );
  }

  const id = `srv_${nanoid(8)}`;

  // Ports: honor explicit choices (validated), else auto-suggest.
  let ports;
  if (input.portGame) {
    // The RCON port is derived when not given explicitly - validate the
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

  await dockerSpec.validateOverrides({
    containerName: input.containerName,
    networkName: input.networkName,
    extraPorts: input.extraPorts,
    extraBinds: input.extraBinds,
  });

  const rconPassword = secrets.generatePassword();
  const defaults = config.defaults;

  db.run(
    `INSERT INTO servers (id, display_name, description, icon, accent, tags_json, type, mc_version,
       java_tag, env_json, port_game, port_rcon, port_query, port_bedrock, rcon_password_cipher,
       heap_mb, container_memory_mb, container_swap_mb, cpus, disk_quota_bytes, quota_strict,
       update_policy, auto_start, auto_restart, status, container_name, network_name,
       extra_ports_json, extra_binds_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'stopped', ?, ?, ?, ?)`,
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
    input.autoRestart === false ? 0 : 1,
    input.containerName || null,
    input.networkName || null,
    JSON.stringify(input.extraPorts || []),
    JSON.stringify(input.extraBinds || [])
  );

  const server = getServer(id);

  try {
    fs.mkdirSync(dataPath('servers', id), { recursive: true });
    fs.mkdirSync(dataPath('logs', id, 'events'), { recursive: true });

    const image = resolveImage(server, { javaTagHint });
    onProgress(`Pulling image ${image} (first time can take a few minutes)…`);
    await images.ensureImage(image, ({ current, total }) => {
      if (total) onProgress(`Downloading image: ${Math.round((current / total) * 100)}%`);
    });

    onProgress('Creating container…');
    const containerId = await containers.createContainer({
      serverId: id,
      image,
      env: assembleEnv(server),
      dataDir: dataPath('servers', id),
      ports: { game: server.port_game, rcon: server.port_rcon, bedrock: server.port_bedrock },
      extraPorts: mergeExtraPorts(server),
      resources: { memoryMb: server.container_memory_mb, swapMb: server.container_swap_mb, cpus: server.cpus },
      containerName: server.containerName,
      networkName: server.networkName,
      extraBinds: server.extraBinds,
    });
    db.run('UPDATE servers SET container_id = ? WHERE id = ?', containerId, id);
  } catch (err) {
    // Roll back: remove any partial container, drop the row (frees its ports),
    // and delete the freshly-made data/log dirs. Then surface the original error.
    // A removal failure here isn't "expected" like the dir-cleanup misses below -
    // it can leak a real Docker container with nothing pointing back to it, so
    // it's worth a trace even though it doesn't block the rollback.
    await containers.removeContainer(id).catch((cleanupErr) => {
      console.warn(`[servers] rollback: could not remove partial container for ${id}: ${cleanupErr.message}`);
    });
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
    if (err.statusCode === 409 && input.containerName) {
      throw httpError(409, `Container name "${input.containerName}" is already in use by another Docker container`);
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

  // Every server gets a daily backup schedule out of the box - otherwise the
  // only backups that ever happen automatically are the pre-update ones, and a
  // server that never updates is never backed up. Staggered by a random hour
  // (02:00-05:59) + minute so many servers created together don't all archive
  // on the same cron tick and jointly hammer the disk. Best-effort: a schedule
  // failure must never fail the create. The user can retime or delete it.
  if (input.autoBackup !== false) {
    try {
      const h = 2 + Math.floor(Math.random() * 4);
      const m = Math.floor(Math.random() * 60);
      require('./scheduler').createSchedule(
        { serverId: id, taskType: 'backup', cron: `${m} ${h} * * *`, enabled: true },
        { actor }
      );
    } catch (err) {
      console.warn(`[servers] could not seed default backup schedule for ${id}: ${err.message}`);
    }
  }

  if (start) {
    onProgress('Starting server…');
    await startServer(id, { actor });
  }
  return getServer(id);
}

// ---------------------------------------------------------------------------
// Per-server lifecycle mutex: concurrent start calls share one promise; any
// other overlapping lifecycle OR destructive world op (backup restore,
// world install/rename/activate/reset - see opLock.js) is rejected with 409
// instead of racing into container-name collisions and half-recreated/
// half-restored states.

const { guardOp } = require('./opLock');

/**
 * Ensure a server's data dir is owned by the panel user so we can manage its
 * files. Containers now run as our uid (see assembleEnv), so this only does real
 * work once - migrating servers created before that, whose files the container
 * wrote as uid 1000. No-op when already aligned or on platforms without uids.
 */
async function ensureOwnership(id) {
  const ids = panelUidGid();
  if (!ids) return;
  const dir = dataPath('servers', id);
  let st;
  try {
    st = fs.statSync(dir);
  } catch {
    return; // no data dir yet
  }
  if (st.uid === ids.uid && st.gid === ids.gid) return; // already ours - fast path
  await containers.chownDataDir(dir, resolveImage(mustGet(id)), ids.uid, ids.gid);
}

async function startServerImpl(id, { actor = 'system' } = {}) {
  const server = mustGet(id);
  await ensureOwnership(id);
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
  // A graceful stop triggers the game's own shutdown-time world save (rcon
  // `stop`, or docker's SIGTERM if that doesn't finish in time). Sharing the
  // backup/world-export save lock means a stop that lands mid-backup waits
  // for the backup's save-off/copy/save-on section to finish instead of
  // racing its own save against the archiver's mid-read of the same files.
  try {
    await withSaveLock(id, () => containers.stopContainer(id));
  } catch (err) {
    // stopContainer only throws when the container is verifiably STILL running -
    // never claim a graceful stop that didn't happen.
    recordEvent({
      serverId: id,
      actor,
      type: 'stop-failed',
      summary: `Graceful stop did not take effect: ${err.message} - the container is still running. Try Force kill.`,
    });
    throw httpError(502, 'The server did not stop. Try Force stop, or check that Docker is running.');
  }
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

async function killServerImpl(id, { actor = 'system' } = {}) {
  mustGet(id);
  recordEvent({ serverId: id, actor, type: 'kill-requested', summary: 'Force kill requested' });
  await containers.killContainer(id);
  db.run("UPDATE servers SET status = 'stopped' WHERE id = ?", id);
  recordEvent({ serverId: id, actor, type: 'killed', summary: 'Server force-killed (world may not have saved)' });
}

const killServer = guardOp('kill', killServerImpl);

/** Recreate: remove + create with current env/resources. Applies pending changes. */
async function recreateServerImpl(id, { actor = 'system', quiet = false } = {}) {
  const server = mustGet(id);
  await ensureOwnership(id);
  const info = await containers.inspectStatus(id);
  const wasRunning = info.exists && ['running', 'starting', 'unhealthy'].includes(info.status);
  // A stop failure here isn't fatal to a recreate - removeContainer({force}) below
  // tears it down regardless - but log it so a chronically wedged daemon is visible.
  if (wasRunning) {
    await containers.stopContainer(id).catch((err) => {
      console.warn(`[servers] recreate ${id}: graceful stop failed (${err.message}); forcing removal`);
    });
  }
  await containers.removeContainer(id);

  const image = resolveImage(server);
  await images.ensureImage(image);
  const containerSpec = {
    serverId: id,
    image,
    env: assembleEnv(server),
    dataDir: dataPath('servers', id),
    ports: { game: server.port_game, rcon: server.port_rcon, bedrock: server.port_bedrock },
    extraPorts: mergeExtraPorts(server),
    resources: { memoryMb: server.container_memory_mb, swapMb: server.container_swap_mb, cpus: server.cpus },
    containerName: server.containerName,
    networkName: server.networkName,
    extraBinds: server.extraBinds,
  };
  let containerId;
  try {
    containerId = await containers.createContainer(containerSpec);
  } catch (err) {
    if (err.statusCode !== 409) throw err;
    // Most likely our OWN orphan: a prior recreate attempt crashed after Docker
    // created this container but before the DB write below landed, so this
    // process still thinks it needs to (re)create it. Verify via the msm.id
    // label before removing anything, then retry once - without this, that
    // crash window permanently strands the server on a 409 requiring a manual
    // `docker rm`.
    const targetName = server.containerName || containers.containerName(id);
    const removedOrphan = await containers.removeStaleNameConflict(targetName, id).catch(() => false);
    if (!removedOrphan) {
      if (server.containerName) {
        throw httpError(409, `Container name "${server.containerName}" is already in use by another Docker container`);
      }
      throw err;
    }
    containerId = await containers.createContainer(containerSpec);
  }
  db.run('UPDATE servers SET container_id = ? WHERE id = ?', containerId, id);
  // Only clear pending_recreate if none of the recreate-relevant columns changed
  // since we read `server` above - a concurrent config PATCH (updateServer) can
  // legally commit mid-recreate (it isn't covered by the op lock, since it's a
  // synchronous, Docker-independent DB write); if it flagged a NEW pending
  // change, this recreate's completion must not silently clear that flag, or
  // the new change would never actually get applied to the container.
  db.run(
    `UPDATE servers SET pending_recreate = 0 WHERE id = ?
       AND container_name IS ? AND network_name IS ?
       AND mc_version IS ? AND java_tag IS ?
       AND heap_mb IS ? AND container_memory_mb IS ? AND cpus IS ?
       AND extra_ports_json IS ? AND extra_binds_json IS ? AND env_json IS ?`,
    id,
    server.container_name,
    server.network_name,
    server.mc_version,
    server.java_tag,
    server.heap_mb,
    server.container_memory_mb,
    server.cpus,
    server.extra_ports_json,
    server.extra_binds_json,
    server.env_json
  );
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
  if (changes.containerName !== undefined) {
    const val = changes.containerName ? changes.containerName.trim() : null;
    if (val !== (before.container_name || null)) {
      diff.containerName = [before.container_name, val];
      sets.push('container_name = ?');
      params.push(val);
      needsRecreate = true;
    }
  }
  if (changes.networkName !== undefined) {
    const val = changes.networkName ? changes.networkName.trim() : null;
    if (val !== (before.network_name || null)) {
      diff.networkName = [before.network_name, val];
      sets.push('network_name = ?');
      params.push(val);
      needsRecreate = true;
    }
  }
  if (changes.extraPorts !== undefined) {
    diff.extraPorts = ['(changed)', '(changed)'];
    sets.push('extra_ports_json = ?');
    params.push(JSON.stringify(changes.extraPorts));
    needsRecreate = true;
  }
  if (changes.extraBinds !== undefined) {
    diff.extraBinds = ['(changed)', '(changed)'];
    sets.push('extra_binds_json = ?');
    params.push(JSON.stringify(changes.extraBinds));
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
async function deleteServerImpl(id, { actor = 'system', keepWorld = false } = {}) {
  const server = mustGet(id);
  await containers.stopContainer(id).catch(() => {});
  await containers.removeContainer(id);
  let freedBytes = 0;
  const dir = dataPath('servers', id);
  if (!keepWorld && fs.existsSync(dir)) {
    // Async, not dirSize()/rmSync() - a modded server's world+logs can be tens
    // of GB across tens of thousands of files, and the sync versions block the
    // event loop (every other request, every WebSocket console/stats stream)
    // for the whole walk. fs.promises still runs on the main thread but yields
    // between operations instead of monopolizing it in one long sync call.
    freedBytes = await dirSize(dir);
    try {
      await fsp.rm(dir, { recursive: true, force: true });
    } catch (err) {
      // The itzg container writes files as its own UID (default 1000). When the
      // panel runs as a different host user it can't delete them (EACCES/EPERM);
      // fall back to a root container that removes the directory for us.
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        await containers.removeDataDir(dir, resolveImage(server));
        await fsp.rm(dir, { recursive: true, force: true }); // no-op if the container cleared it
      } else {
        throw err;
      }
    }
  }

  // Full cleanup cascade - without it schedules keep firing, backups pile up,
  // and server_content rows block library deletions forever.

  // Schedules: disarm the live cron jobs, not just the rows.
  const scheduler = require('./scheduler'); // lazy - avoids a require cycle
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
  // force: true already no-ops on a missing path - no need for an existsSync guard.
  await fsp.rm(dataPath('backups', id), { recursive: true, force: true });

  // Archived logs / event excerpts.
  await fsp.rm(dataPath('logs', id), { recursive: true, force: true });

  // All row cleanup + the soft-delete flag run in ONE transaction so a mid-cleanup
  // error can't leave a "live" (deleted_at IS NULL) server whose content/backups
  // are already gone - a zombie. Either everything is removed or nothing is.
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

const deleteServer = guardOp('delete', deleteServerImpl);

// A container's healthcheck stays in `starting` for the whole StartPeriod
// (see docker/containers.js healthcheckSpec - 2h), and a hang - as opposed to
// a crash - never fires Docker's die/oom events either. Without a ceiling the
// loop below just kept re-writing 'starting' every poll, with nothing telling
// the user anything was wrong. Past this many ms since last_started_at, flag it
// once as 'stalled' instead. Generous on purpose: a big modpack's mod download +
// world generation can legitimately run long, and the boot-phase detail chip
// (liveCache's statusDetail) already shows real progress underneath this -
// the ceiling only exists for the "no progress being shown at all" case.
const STARTUP_STALL_MS = 10 * 60_000;

let refreshing = false;

/**
 * Refresh cached status for all servers from Docker.
 * @param {object} [opts]
 * @param {boolean} [opts.boot] first run after a panel (re)start - emits a
 *        one-time event for any server that was running before but isn't now
 *        and won't be auto-started, so a host reboot doesn't silently leave
 *        servers down.
 */
async function refreshStatuses({ boot = false } = {}) {
  // The 60s poll and an on-demand call can otherwise overlap and stack their
  // per-server inspect + log-fetch round trips when the daemon is slow.
  if (refreshing) return;
  refreshing = true;
  try {
    await refreshStatusesInner({ boot });
  } finally {
    refreshing = false;
  }
}

async function refreshStatusesInner({ boot }) {
  for (const server of listServers()) {
    try {
      const info = await containers.inspectStatus(server.id);
      let status = info.exists ? info.status : 'stopped';
      // Docker reports a container healthy only once `mc-health` passes, but it
      // sits in `starting` for the whole (long) StartPeriod before then and a
      // missing/lagging probe would leave it there. When the panel still thinks
      // this server is starting, cross-check the log for 'Done (' and apply the
      // stall ceiling. Also re-check a server already flagged 'stalled' so it
      // can recover to 'running' once 'Done (' finally shows up.
      const stillBooting =
        info.exists && (info.status === 'starting' || (info.status === 'running' && info.health == null));
      if ((server.status === 'starting' || server.status === 'stalled') && stillBooting) {
        const startedMs = Date.parse(String(server.last_started_at || '').replace(' ', 'T') + 'Z');
        const elapsedMs = Number.isFinite(startedMs) ? Date.now() - startedMs : Infinity;
        if (elapsedMs > 2 * 60_000) {
          const tail = await fetchLogs(server.id, { tail: 300 }).catch(() => '');
          if (/Done \(/.test(tail)) {
            status = 'running';
          } else if (elapsedMs > STARTUP_STALL_MS) {
            status = 'stalled';
            if (server.status !== 'stalled') {
              // Run the same fatal-error matcher the crash path uses - a hung
              // boot is often a config error (EULA, wrong Java, port clash)
              // that will never resolve itself, and the diagnosis says what to fix.
              const { diagnoseFatal } = require('../docker/watcher');
              const diag = diagnoseFatal(tail);
              recordEvent({
                serverId: server.id,
                type: 'startup-stalled',
                summary: diag
                  ? `Startup stalled after ${Math.round(elapsedMs / 60_000)} min: ${diag.summary}`
                  : `Still starting after ${Math.round(elapsedMs / 60_000)} minutes with no "Done" in the logs - check the console for what's blocking it`,
                details: { elapsedMs, diagnosis: diag ? diag.key : null },
                logExcerpt: tail || null,
              });
            }
          } else {
            status = 'starting';
          }
        } else {
          status = 'starting';
        }
      }

      // Host reboot / crash while the panel was down: the DB still says this
      // server was up, but its container isn't running now and nothing will
      // bring it back (auto_start is handled by the boot sequence, auto_restart
      // by the crash reconcile there). Say so once instead of silently flipping
      // the row to 'stopped'.
      if (
        boot &&
        !server.auto_start &&
        ['running', 'starting', 'unhealthy', 'stalled'].includes(server.status) &&
        ['stopped', 'crashed'].includes(status)
      ) {
        recordEvent({
          serverId: server.id,
          type: 'offline-after-restart',
          summary: `Server was ${server.status} before the panel restarted and is now ${status} - it was not auto-started. Start it from the panel when ready.`,
        });
      }

      if (status !== server.status) db.run('UPDATE servers SET status = ? WHERE id = ?', status, server.id);
    } catch {
      /* daemon offline - leave cached */
    }
  }
}

async function dirSize(dir) {
  let total = 0;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += await dirSize(p);
      else if (entry.isFile()) total += (await fsp.stat(p)).size;
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
  // Unguarded stop, for callers that have ALREADY taken the shared per-server
  // op lock themselves (e.g. backups.restoreBackup, guarded under 'restore')
  // and would otherwise deadlock calling the guarded `stopServer` reentrantly.
  // Do not call this from anywhere that hasn't already acquired that lock.
  stopServerUnguarded: stopServerImpl,
  refreshStatuses,
  assembleEnv,
  resolveImage,
  ensureOwnership,
  dirSize,
  setConsoleLabel,
  previewCreateSpec,
  previewServerSpec,
};
