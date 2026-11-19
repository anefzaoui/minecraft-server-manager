'use strict';

// Docker connection management. Auto-detects the right endpoint per platform:
//   Windows  → \\.\pipe\docker_engine (Docker Desktop named pipe)
//   Unix     → /var/run/docker.sock, falling back to rootless / newer Docker
//              Desktop socket locations under the user's home.
//   DOCKER_HOST env var wins when set.
// Exposes availability state the UI uses for the setup wizard.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Docker = require('dockerode');

let client = null;

function detectOptions() {
  if (process.env.DOCKER_HOST) return {}; // dockerode reads DOCKER_HOST itself
  if (process.platform === 'win32') return { socketPath: '//./pipe/docker_engine' };
  // Prefer the classic system socket, but recent Docker Desktop (macOS) and
  // rootless Docker/Podman only expose a per-user socket - probe those too so a
  // stranger with a default install isn't told "daemon unavailable".
  // Podman's Docker-compatible socket lives under $XDG_RUNTIME_DIR/podman.
  const candidates = [
    '/var/run/docker.sock',
    path.join(os.homedir(), '.docker', 'run', 'docker.sock'),
    process.env.XDG_RUNTIME_DIR ? path.join(process.env.XDG_RUNTIME_DIR, 'docker.sock') : null,
    process.env.XDG_RUNTIME_DIR ? path.join(process.env.XDG_RUNTIME_DIR, 'podman', 'podman.sock') : null,
    process.env.PODMAN_HOST,
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

let podmanCache = null;
/**
 * Whether the daemon behind the socket is Podman. Queried once and cached.
 * Under Podman + SELinux enforcing, sibling containers need `:Z`-labeled bind
 * mounts (the panel's own container already runs with label=disable, but the
 * servers it creates are separate containers subject to their own policy).
 */
async function isPodmanDaemon() {
  if (podmanCache === null) {
    try {
      const v = await getDocker().version();
      podmanCache = Array.isArray(v.Components) && v.Components.some((c) => /podman/i.test(c.Name || ''));
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
    // Podman reports itself in the version components (e.g. "Podman Engine").
    status.isPodman = Array.isArray(version.Components)
      && version.Components.some((c) => /podman/i.test(c.Name || ''));
  } catch (err) {
    status.error = err.code || err.message;
    if (process.platform === 'win32') {
      status.installed = fs.existsSync(process.env.ProgramFiles + '\\Docker\\Docker\\Docker Desktop.exe');
    }
  }
  return status;
}

module.exports = { getDocker, checkDocker, isPodmanDaemon };
