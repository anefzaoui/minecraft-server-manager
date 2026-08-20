'use strict';

// Path containment guard. EVERY filesystem operation on user-influenced paths
// must resolve through one of these helpers — nothing may escape DATA_DIR.

const fs = require('node:fs');
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
 * Reject a symlink escape the lexical check above can't see: walk up from
 * `resolved` to the nearest ancestor that actually exists, realpath it, and
 * confirm it's still inside `base`. A symlink planted under `base` (e.g. by a
 * mod/plugin running inside the Minecraft container) pointing at an absolute
 * host path would otherwise let the file manager follow it straight out.
 * The non-existent tail (if any) can't itself be a symlink, so checking the
 * deepest existing ancestor is sufficient.
 */
function assertRealContainment(base, resolved, attempted) {
  let realBase;
  try {
    realBase = fs.realpathSync.native(base);
  } catch {
    return; // base doesn't exist yet — nothing to escape
  }
  let dir = resolved;
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir);
    if (parent === dir) return; // reached filesystem root without an anchor
    dir = parent;
  }
  let realDir;
  try {
    realDir = fs.realpathSync.native(dir);
  } catch {
    return; // vanished between checks — the caller's own stat will 404
  }
  const rel = path.relative(realBase, realDir);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new PathEscapeError(attempted);
  }
}

/**
 * Resolve `parts` under `base` (absolute) and throw unless the result stays
 * within `base`. Rejects NUL bytes and Windows alternate data streams, and
 * rejects symlinks that resolve outside `base`.
 */
function safeJoin(base, ...parts) {
  const joined = parts.join('/');
  if (joined.includes('\0') || /(^|[\\/])[^\\/]*:[^\\/]*$/.test(joined.replace(/^[a-zA-Z]:/, ''))) {
    throw new PathEscapeError(joined);
  }
  const resolved = path.resolve(base, joined);
  const rel = path.relative(base, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new PathEscapeError(joined);
  assertRealContainment(base, resolved, joined);
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
