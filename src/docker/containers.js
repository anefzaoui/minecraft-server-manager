// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Container lifecycle for managed Minecraft servers. All containers are
// labeled msm.id=<serverId> and named msm-<serverId>.

const path = require('node:path');
const { getDocker } = require('./connect');
const { toHostPath } = require('./hostPath');
const db = require('../db');

const LABEL = 'msm.id';
const GAME_PORT = '25565';
const RCON_PORT = '25575';
const BEDROCK_PORT = '19132';

function containerName(serverId) {
  return `msm-${serverId}`;
}

/**
 * Create (but do not start) a container for a server.
 * @param {object} spec
 * @param {string} spec.serverId
 * @param {string} spec.image            e.g. itzg/minecraft-server:java21
 * @param {object} spec.env              flat { KEY: 'value' }
 * @param {string} spec.dataDir          absolute panel-local data dir, re-rooted to the host and bind-mounted to /data
 * @param {object} spec.ports            { game, rcon, bedrock? } host ports
 * @param {object} spec.resources        { memoryMb, swapMb, cpus }
 * @param {string} [spec.containerName]  Docker container name override; default `msm-<serverId>`
 * @param {string} [spec.networkName]    existing host Docker network to attach to; default bridge
 * @param {Array}  [spec.extraBinds]     [{hostPath, containerPath, mode: 'rw'|'ro'}] - RAW host paths, not re-rooted
 */
async function createContainer(spec) {
  const docker = getDocker();
  const exposed = {
    [`${GAME_PORT}/tcp`]: {},
    [`${GAME_PORT}/udp`]: {}, // query protocol shares the game port
    [`${RCON_PORT}/tcp`]: {},
  };
  const bindings = {
    [`${GAME_PORT}/tcp`]: [{ HostPort: String(spec.ports.game) }],
    [`${GAME_PORT}/udp`]: [{ HostPort: String(spec.ports.game) }],
    [`${RCON_PORT}/tcp`]: [{ HostPort: String(spec.ports.rcon) }],
  };
  if (spec.ports.bedrock) {
    exposed[`${BEDROCK_PORT}/udp`] = {};
    bindings[`${BEDROCK_PORT}/udp`] = [{ HostPort: String(spec.ports.bedrock) }];
  }
  // Feature ports (e.g. BlueMap's web server) + user-defined extras - [{container: '8100/tcp', host: 8123}]
  for (const extra of spec.extraPorts || []) {
    exposed[extra.container] = {};
    bindings[extra.container] = [{ HostPort: String(extra.host) }];
  }

  const memoryBytes = Math.round(spec.resources.memoryMb * 1024 * 1024);
  const swapBytes = memoryBytes + Math.round((spec.resources.swapMb || 0) * 1024 * 1024);

  // Extra binds are already HOST paths (the admin types the real host
  // location), unlike dataDir which is panel-local and must be re-rooted -
  // running them through toHostPath would reject anything outside DATA_DIR,
  // which is the entire point of this escape hatch.
  const extraBindStrings = (spec.extraBinds || []).map(
    (b) => `${b.hostPath}:${b.containerPath}${b.mode === 'ro' ? ':ro' : ''}`
  );

  const hostConfig = {
    Binds: [`${toHostPath(spec.dataDir)}:/data`, ...extraBindStrings],
    PortBindings: bindings,
    Memory: memoryBytes,
    MemorySwap: swapBytes,
    NanoCpus: spec.resources.cpus ? Math.round(spec.resources.cpus * 1e9) : 0,
    RestartPolicy: { Name: 'no' }, // the panel owns restarts (crash backoff, quota stops)
  };
  if (spec.networkName) hostConfig.NetworkMode = spec.networkName;

  const container = await docker.createContainer({
    name: spec.containerName || containerName(spec.serverId),
    Image: spec.image,
    Env: Object.entries(spec.env).map(([k, v]) => `${k}=${v}`),
    Labels: { [LABEL]: spec.serverId, 'msm.managed': 'true' },
    ExposedPorts: exposed,
    Tty: false,
    OpenStdin: false,
    Healthcheck: healthcheckSpec(),
    HostConfig: hostConfig,
  });
  return container.id;
}

/**
 * Explicit container healthcheck. Without one, `docker inspect` reports a
 * container as running the instant its process starts - long before the
 * Minecraft server accepts players - which is why the panel otherwise has to
 * scrape "Done (" out of the logs to tell those two states apart.
 *
 * `mc-health` is bundled in the itzg image and is the same probe its own
 * Dockerfile uses: it knows the real game/RCON port and is auto-pause aware
 * (reports healthy while the process is intentionally frozen), so it never
 * wakes a paused server or false-flags one.
 *
 * StartPeriod is deliberately long (2h): a large modpack's first boot
 * (server-pack download + world generation) can legitimately run 30-60 min,
 * and while the start period is active a failing probe keeps health at
 * `starting`, never `unhealthy`. The panel's own STARTUP_STALL_MS ceiling
 * (services/servers.js) is what surfaces a boot that has genuinely wedged.
 * Once the server is up, a probe that then starts failing for Retries in a row
 * flips it to `unhealthy` - a "running process, dead server" signal the panel
 * previously had no way to detect.
 */
function healthcheckSpec() {
  return {
    Test: ['CMD-SHELL', 'mc-health'],
    Interval: 30 * 1e9,
    Timeout: 10 * 1e9,
    Retries: 3,
    StartPeriod: 2 * 3600 * 1e9,
  };
}

/**
 * Resolve the Docker reference for a server: its stored container_id when one
 * exists, else the configured/derived name. container_id is only written once
 * a container has actually been created (createServer/recreateServerImpl) and
 * only changes when a NEW container is created - unlike container_name, which
 * a config-save (PATCH /api/servers/:id) can update immediately while the real
 * container still exists, unrenamed, under the old name until the pending
 * recreate actually runs. Resolving by ID keeps every lookup pointed at the
 * real container through that window instead of 404ing against a name that
 * isn't real yet.
 */
function containerRef(serverId) {
  const row = db.get('SELECT container_id, container_name FROM servers WHERE id = ?', serverId);
  if (row && row.container_id) return row.container_id;
  return (row && row.container_name) || containerName(serverId);
}

function getContainer(serverId) {
  return getDocker().getContainer(containerRef(serverId));
}

/**
 * Remove a container by NAME if - and only if - it carries our msm.id label
 * for this exact serverId. Used to self-heal a 409 name conflict on create:
 * if the panel process crashes between a recreate's createContainer
 * succeeding and its DB write landing, the DB is left pointing at the
 * removed old container_id while Docker still holds the just-created
 * container under the target name - the next recreate attempt would
 * otherwise hit a permanent 409 on that name with no automatic recovery.
 * Verifying the label first means this can never remove an unrelated
 * container that happens to occupy the same name.
 */
async function removeStaleNameConflict(name, serverId) {
  const docker = getDocker();
  try {
    const info = await docker.getContainer(name).inspect();
    const labels = (info.Config && info.Config.Labels) || {};
    if (labels[LABEL] !== serverId) return false;
    await docker.getContainer(name).remove({ force: true });
    return true;
  } catch (err) {
    if (err.statusCode === 404) return false;
    throw err;
  }
}

/** Inspect → panel status. Returns { status, health, exitCode, startedAt, pid }. */
async function inspectStatus(serverId) {
  try {
    const info = await getContainer(serverId).inspect();
    const s = info.State;
    const health = s.Health ? s.Health.Status : null; // starting | healthy | unhealthy
    let status;
    if (s.Running) {
      if (health === 'starting') status = 'starting';
      else if (health === 'unhealthy') status = 'unhealthy';
      else status = 'running';
    } else if (s.Status === 'created') {
      status = 'stopped';
    } else {
      status = s.ExitCode === 0 ? 'stopped' : 'crashed';
    }
    return {
      exists: true,
      status,
      health,
      exitCode: s.Running ? null : s.ExitCode,
      startedAt: s.Running ? s.StartedAt : null,
      finishedAt: s.FinishedAt,
      oomKilled: Boolean(s.OOMKilled),
      containerId: info.Id,
      imageId: info.Image,
    };
  } catch (err) {
    if (err.statusCode === 404) return { exists: false, status: 'stopped' };
    throw err;
  }
}

async function startContainer(serverId) {
  await getContainer(serverId).start();
}

/**
 * Graceful stop: send `stop` over rcon-cli inside the container (no password
 * needed via exec), then wait; fall back to docker stop with a generous grace
 * period so the world always saves.
 */
async function stopContainer(serverId, { graceSeconds = 90 } = {}) {
  const container = getContainer(serverId);
  try {
    // Send the in-game `stop` (saves the world). execCapture reads + destroys the
    // exec stream and has a timeout, so we don't leak a hijacked connection here.
    await execCapture(serverId, ['rcon-cli', 'stop'], { timeoutMs: 15000 }).catch(() => {});
    // Wait for the container to exit on its own after the stop command.
    await Promise.race([container.wait(), new Promise((resolve) => setTimeout(resolve, graceSeconds * 1000).unref())]);
  } catch {
    // rcon unavailable (early boot, crashed loop) - fall through to docker stop
  }
  const info = await inspectStatus(serverId);
  if (info.exists && (info.status === 'running' || info.status === 'starting' || info.status === 'unhealthy')) {
    try {
      await container.stop({ t: graceSeconds });
    } catch (err) {
      // 304 = already stopped between the inspect above and here; 404 = gone.
      if (err.statusCode !== 304 && err.statusCode !== 404) throw err;
    }
  }
  // Never report a stop as done without confirming it: a wedged daemon can let
  // `stop` return/throw without the container actually exiting, and callers
  // (stopServerImpl) would then record "stopped gracefully" over a live world.
  const final = await inspectStatus(serverId).catch(() => ({ exists: false }));
  if (final.exists && ['running', 'starting', 'unhealthy'].includes(final.status)) {
    throw new Error(`container for ${serverId} did not stop (still ${final.status})`);
  }
}

async function killContainer(serverId) {
  try {
    await getContainer(serverId).kill();
  } catch (err) {
    if (err.statusCode !== 404 && err.statusCode !== 409) throw err; // 409 = not running
  }
}

async function removeContainer(serverId) {
  try {
    await getContainer(serverId).remove({ force: true });
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }
}

/**
 * Run a command via docker exec and capture its raw output (+ exit code on
 * request). A timeout guards against a hung exec (unresponsive/deadlocked JVM)
 * leaving the hijacked stream + connection open forever - critical because
 * liveCache fires this on an interval and hung calls would otherwise stack
 * without bound.
 */
async function execRaw(serverId, cmd, { timeoutMs = 15000, wantExitCode = false } = {}) {
  const container = getContainer(serverId);
  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start({});
  const stdout = await new Promise((resolve, reject) => {
    const chunks = [];
    // Demux the Docker stream framing (8-byte headers).
    const out = { write: (b) => chunks.push(b) };
    getDocker().modem.demuxStream(stream, out, out);
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        stream.destroy();
      } catch {
        /* already gone */
      }
      fn(arg);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`exec timed out after ${timeoutMs}ms: ${cmd.join(' ')}`)),
      timeoutMs
    );
    timer.unref?.();
    stream.on('end', () => finish(resolve, Buffer.concat(chunks).toString('utf8')));
    stream.on('error', (err) => finish(reject, err));
  });
  // The inspect is a second daemon round trip, opted into by the one caller
  // that reads the code - everyone else skips both its cost and its failure
  // modes. It must never hang past the timeout contract above, and it must
  // never fail a command whose output was already captured: the exit code is
  // best-effort, and null means "unknown" (callers already treat non-zero and
  // unknown the same, as "not a confirmed success").
  let exitCode = null;
  if (wantExitCode) {
    try {
      const inspected = await Promise.race([
        exec.inspect(),
        new Promise((resolve) => setTimeout(resolve, timeoutMs, null).unref?.()),
      ]);
      if (inspected && typeof inspected.ExitCode === 'number') exitCode = inspected.ExitCode;
    } catch {
      /* exit code stays unknown */
    }
  }
  return { stdout, exitCode };
}

/** Run a command via docker exec and capture its output (used for rcon-cli). */
async function execCapture(serverId, cmd, opts = {}) {
  const { stdout } = await execRaw(serverId, cmd, opts);
  return stdout;
}

/**
 * Like execCapture, but also resolves the command's exit code so callers can
 * tell "ran successfully but printed something unexpected" apart from "the
 * command itself failed" (e.g. rcon-cli exits non-zero and prints a connection
 * error to stderr when RCON isn't listening yet - docker exec itself still
 * succeeds since the container process is running, so execCapture alone can't
 * distinguish that from a genuine, parseable response). The code is best-effort:
 * `exitCode` is null when the daemon didn't answer the inspect in time, which
 * callers must treat as "not a confirmed success", never as an error.
 */
async function execCaptureChecked(serverId, cmd, opts = {}) {
  return execRaw(serverId, cmd, { ...opts, wantExitCode: true });
}

/**
 * Delete a server's data directory using a throwaway root container.
 *
 * The itzg image writes world/mod files as its own UID (default 1000). When the
 * panel process runs as a different host user it can't remove them - `rm` fails
 * with EACCES. Root inside a container can delete files of any UID, so we mount
 * the PARENT directory and remove the target by name. `Cmd: []` is required so
 * the image's default CMD isn't appended as extra arguments to our entrypoint.
 */
async function removeDataDir(dir, image) {
  const docker = getDocker();
  const parent = path.dirname(dir);
  const base = path.basename(dir);
  const container = await docker.createContainer({
    Image: image,
    Entrypoint: ['rm', '-rf', `/work/${base}`],
    Cmd: [],
    User: '0:0',
    Labels: { 'msm.managed': 'true', 'msm.role': 'cleanup' },
    HostConfig: { Binds: [`${toHostPath(parent)}:/work`], AutoRemove: false, NetworkMode: 'none' },
  });
  try {
    await container.start();
    const res = await container.wait(); // rm exits 0 on success
    if (res && res.StatusCode !== 0) {
      throw new Error(`cleanup container exited ${res.StatusCode} while removing ${base}`);
    }
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}

/**
 * Chown a server's data directory to uid:gid using a throwaway root container.
 * Migrates servers whose files the container wrote under its old default uid so
 * the panel (running as uid:gid) can manage them. Mounts the PARENT and chowns
 * the target by name; `Cmd: []` clears the image's default CMD (see removeDataDir).
 */
async function chownDataDir(dir, image, uid, gid) {
  const docker = getDocker();
  const parent = path.dirname(dir);
  const base = path.basename(dir);
  const container = await docker.createContainer({
    Image: image,
    Entrypoint: ['chown', '-R', `${uid}:${gid}`, `/work/${base}`],
    Cmd: [],
    User: '0:0',
    Labels: { 'msm.managed': 'true', 'msm.role': 'chown' },
    HostConfig: { Binds: [`${toHostPath(parent)}:/work`], AutoRemove: false, NetworkMode: 'none' },
  });
  try {
    await container.start();
    const res = await container.wait();
    if (res && res.StatusCode !== 0) {
      throw new Error(`chown container exited ${res.StatusCode} for ${base}`);
    }
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}

module.exports = {
  LABEL,
  containerName,
  containerRef,
  createContainer,
  getContainer,
  removeStaleNameConflict,
  inspectStatus,
  startContainer,
  stopContainer,
  killContainer,
  removeContainer,
  removeDataDir,
  chownDataDir,
  execCapture,
  execCaptureChecked,
};
