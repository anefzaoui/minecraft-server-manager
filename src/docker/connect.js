'use strict';

// Docker connection management. Auto-detects the right endpoint per platform:
//   Windows  → \\.\pipe\docker_engine (Docker Desktop named pipe)
//   Unix     → /var/run/docker.sock, falling back to rootless / newer Docker
//              Desktop socket locations under the user's home.
//   DOCKER_HOST env var wins when set; PODMAN_HOST (unix:// URL or bare path)
//   wins over the default socket probes when it points at an existing socket.
// Exposes availability state the UI uses for the setup wizard.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Docker = require('dockerode');

let client = null;

/**
 * PODMAN_HOST as a filesystem path, or null. It is usually set to a URL
 * (`unix:///run/user/1000/podman/podman.sock`), which an existence probe can
 * never match - strip the scheme first. Non-unix URLs (tcp://) have no local
 * path to probe, so they are ignored here rather than guessed at.
 */
function podmanHostPath() {
  const raw = process.env.PODMAN_HOST;
  if (!raw) return null;
  const stripped = raw.replace(/^unix:\/\//, '');
  return stripped.startsWith('/') ? stripped : null;
}

function detectOptions() {
  if (process.env.DOCKER_HOST) return {}; // dockerode reads DOCKER_HOST itself
  if (process.platform === 'win32') return { socketPath: '//./pipe/docker_engine' };
  // Prefer the classic system socket, but recent Docker Desktop (macOS) and
  // rootless Docker/Podman only expose a per-user socket - probe those too so a
  // stranger with a default install isn't told "daemon unavailable".
  // Podman's Docker-compatible socket lives under $XDG_RUNTIME_DIR/podman.
  // An explicit PODMAN_HOST wins over the default probes, like DOCKER_HOST.
  const candidates = [
    podmanHostPath(),
    '/var/run/docker.sock',
    path.join(os.homedir(), '.docker', 'run', 'docker.sock'),
    process.env.XDG_RUNTIME_DIR ? path.join(process.env.XDG_RUNTIME_DIR, 'docker.sock') : null,
    process.env.XDG_RUNTIME_DIR ? path.join(process.env.XDG_RUNTIME_DIR, 'podman', 'podman.sock') : null,
  ].filter(Boolean);
  const found = candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
  return { socketPath: found || '/var/run/docker.sock' };
}

function getDocker() {
  if (!client) client = new Docker(detectOptions());
  return client;
}

/** Podman reports itself in the version components (e.g. "Podman Engine"). */
function versionIsPodman(version) {
  return Boolean(
    version && Array.isArray(version.Components) && version.Components.some((c) => /podman/i.test(c.Name || ''))
  );
}

let podmanCache = null;
/**
 * Whether the daemon behind the socket is Podman. Queried once and cached.
 * Under Podman + SELinux enforcing, sibling containers need SELinux-labeled
 * bind mounts (the panel's own container already runs with label=disable, but
 * the servers it creates are separate containers subject to their own policy).
 * The container layer applies the shared `:z` label - see serverBinds there.
 */
async function isPodmanDaemon() {
  if (podmanCache === null) {
    try {
      podmanCache = versionIsPodman(await getDocker().version());
    } catch {
      podmanCache = false;
    }
  }
  return podmanCache;
}

/**
 * Probe the daemon. Never throws - returns a status object the setup wizard
 * renders directly.
 */
async function checkDocker() {
  const status = {
    available: false,
    installed: null, // best-effort; null = unknown
    version: null,
    os: null,
    ncpu: null,
    memTotal: null,
    isDockerDesktop: false,
    isPodman: false,
    error: null,
  };
  try {
    const docker = getDocker();
    const [version, info] = await Promise.all([docker.version(), docker.info()]);
    status.available = true;
    status.installed = true;
    status.version = version.Version;
    status.os = info.OperatingSystem || '';
    status.ncpu = info.NCPU;
    status.memTotal = info.MemTotal;
    status.isDockerDesktop = /docker desktop/i.test(status.os);
    status.isPodman = versionIsPodman(version);
  } catch (err) {
    status.error = err.code || err.message;
    if (process.platform === 'win32') {
      status.installed = fs.existsSync(process.env.ProgramFiles + '\\Docker\\Docker\\Docker Desktop.exe');
    }
  }
  return status;
}

module.exports = { getDocker, checkDocker, isPodmanDaemon, detectOptions, versionIsPodman };
