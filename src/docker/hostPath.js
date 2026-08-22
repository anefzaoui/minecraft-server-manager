'use strict';

// Re-roots panel-local paths into HOST paths for Docker bind mounts. The daemon
// resolves every bind against the host filesystem - when the panel itself runs
// inside a container (DATA_DIR_HOST set), its local view of the data directory
// (e.g. /data/servers/abc) does not exist on the host, so any path handed to
// the daemon must be rewritten under DATA_DIR_HOST first. Bare metal, where
// DATA_DIR_HOST is unset, this is the identity function.

const path = require('node:path');
const config = require('../config');

// DATA_DIR_HOST describes the host's filesystem, which may use a different
// separator than the panel's runtime (Linux container managing a Windows
// Docker Desktop host, or vice versa) - so the joined suffix must follow the
// host path's own convention, not path.sep.
const HOST_SEP = /^[A-Za-z]:/.test(config.dataDirHost) || config.dataDirHost.includes('\\') ? '\\' : '/';

/**
 * Translate an absolute panel-local path under DATA_DIR into the equivalent
 * host path under DATA_DIR_HOST. Throws on paths outside DATA_DIR - those have
 * no host equivalent and binding them would silently mount the wrong directory.
 */
function toHostPath(abs) {
  if (config.dataDirHost === config.dataDir) return abs;
  const rel = path.relative(config.dataDir, path.resolve(abs));
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Cannot bind ${abs}: it is outside DATA_DIR (${config.dataDir}), so it has no host-side equivalent under DATA_DIR_HOST.`
    );
  }
  if (rel === '') return config.dataDirHost;
  const suffix = rel.split(path.sep).join(HOST_SEP);
  const base = config.dataDirHost === '/' ? '' : config.dataDirHost;
  return `${base}${HOST_SEP}${suffix}`;
}

module.exports = { toHostPath };
