'use strict';

// Path containment guard. EVERY filesystem operation on user-influenced paths
// must resolve through one of these helpers — nothing may escape DATA_DIR.

const path = require('node:path');
const config = require('../config');

class PathEscapeError extends Error {
  constructor(attempted) {
    super('Path escapes the panel data directory');
    this.name = 'PathEscapeError';
    this.attempted = attempted;
    this.status = 400;
  }
}

/**
 * Resolve `parts` under `base` (absolute) and throw unless the result stays
 * within `base`. Rejects NUL bytes and Windows alternate data streams.
 */
function safeJoin(base, ...parts) {
  const joined = parts.join('/');
  if (joined.includes('\0') || /(^|[\\/])[^\\/]*:[^\\/]*$/.test(joined.replace(/^[a-zA-Z]:/, ''))) {
    throw new PathEscapeError(joined);
  }
  const resolved = path.resolve(base, joined);
  const rel = path.relative(base, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new PathEscapeError(joined);
  return resolved;
}

/** Resolve a path under the panel data root. */
function dataPath(...parts) {
  return safeJoin(config.dataDir, ...parts);
}

/** True when `candidate` (absolute) lies inside the data root. */
function isInsideDataDir(candidate) {
  const rel = path.relative(config.dataDir, path.resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

module.exports = { safeJoin, dataPath, isInsideDataDir, PathEscapeError };
