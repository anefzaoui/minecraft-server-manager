// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Container lifecycle for managed Minecraft servers. All containers are
// labeled msm.id=<serverId> and named msm-<serverId>.

const path = require('node:path');
const { getDocker } = require('./connect');

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
 * @param {string} spec.dataDirHost      absolute host path bind-mounted to /data
 * @param {object} spec.ports            { game, rcon, bedrock? } host ports
 * @param {object} spec.resources        { memoryMb, swapMb, cpus }
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
  // Feature ports (e.g. BlueMap's web server) — [{container: '8100/tcp', host: 8123}]
  for (const extra of spec.extraPorts || []) {
    exposed[extra.container] = {};
    bindings[extra.container] = [{ HostPort: String(extra.host) }];
  }

  const memoryBytes = Math.round(spec.resources.memoryMb * 1024 * 1024);
  const swapBytes = memoryBytes + Math.round((spec.resources.swapMb || 0) * 1024 * 1024);

  const container = await docker.createContainer({
    name: containerName(spec.serverId),
    Image: spec.image,
    Env: Object.entries(spec.env).map(([k, v]) => `${k}=${v}`),
    Labels: { [LABEL]: spec.serverId, 'msm.managed': 'true' },
    ExposedPorts: exposed,
    Tty: false,
    OpenStdin: false,
    HostConfig: {
      Binds: [`${spec.dataDirHost}:/data`],
      PortBindings: bindings,
      Memory: memoryBytes,
      MemorySwap: swapBytes,
      NanoCpus: spec.resources.cpus ? Math.round(spec.resources.cpus * 1e9) : 0,
      RestartPolicy: { Name: 'no' }, // the panel owns restarts (crash backoff, quota stops)
    },
  });
  return container.id;
}

function getContainer(serverId) {
  return getDocker().getContainer(containerName(serverId));
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
    // rcon unavailable (early boot, crashed loop) — fall through to docker stop
  }
  const info = await inspectStatus(serverId);
  if (info.exists && (info.status === 'running' || info.status === 'starting' || info.status === 'unhealthy')) {
    await container.stop({ t: graceSeconds });
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
 * Run a command via docker exec and capture its output (used for rcon-cli).
 * A timeout guards against a hung exec (unresponsive/deadlocked JVM) leaving the
 * hijacked stream + connection open forever — critical because liveCache fires
 * this on an interval and hung calls would otherwise stack without bound.
 */
async function execCapture(serverId, cmd, { timeoutMs = 15000 } = {}) {
  const container = getContainer(serverId);
  const exec = await container.exec({ Cmd: cmd, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start({});
  return new Promise((resolve, reject) => {
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
}

/**
 * Delete a server's data directory using a throwaway root container.
 *
 * The itzg image writes world/mod files as its own UID (default 1000). When the
 * panel process runs as a different host user it can't remove them — `rm` fails
 * with EACCES. Root inside a container can delete files of any UID, so we mount
 * the PARENT directory and remove the target by name. `Cmd: []` is required so
 * the image's default CMD isn't appended as extra arguments to our entrypoint.
 */
async function removeDataDir(hostDir, image) {
  const docker = getDocker();
  const parent = path.dirname(hostDir);
  const base = path.basename(hostDir);
  const container = await docker.createContainer({
    Image: image,
    Entrypoint: ['rm', '-rf', `/work/${base}`],
    Cmd: [],
    User: '0:0',
    Labels: { 'msm.managed': 'true', 'msm.role': 'cleanup' },
    HostConfig: { Binds: [`${parent}:/work`], AutoRemove: false, NetworkMode: 'none' },
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
async function chownDataDir(hostDir, image, uid, gid) {
  const docker = getDocker();
  const parent = path.dirname(hostDir);
  const base = path.basename(hostDir);
  const container = await docker.createContainer({
    Image: image,
    Entrypoint: ['chown', '-R', `${uid}:${gid}`, `/work/${base}`],
    Cmd: [],
    User: '0:0',
    Labels: { 'msm.managed': 'true', 'msm.role': 'chown' },
    HostConfig: { Binds: [`${parent}:/work`], AutoRemove: false, NetworkMode: 'none' },
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
  createContainer,
  getContainer,
  inspectStatus,
  startContainer,
  stopContainer,
  killContainer,
  removeContainer,
  removeDataDir,
  chownDataDir,
  execCapture,
};
