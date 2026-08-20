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

// realpath(base) is stable at runtime (the data roots don't move), and safeJoin
// is on the hot path for nearly every filesystem op — so resolve each base once
// and reuse it, instead of a realpath syscall per call. A base that doesn't yet
// exist caches nothing and is retried next time.
const realBaseCache = new Map();
function realBaseOf(base) {
  const cached = realBaseCache.get(base);
  if (cached !== undefined) return cached;
  let real = null;
  try {
    real = fs.realpathSync.native(base);
  } catch {
    return null; // base doesn't exist yet — don't cache, retry later
  }
  realBaseCache.set(base, real);
  return real;
}

/**
 * Reject a symlink escape the lexical check above can't see: find the deepest
 * component of `resolved` that exists on disk, resolve it through any symlinks,
 * and confirm it's still inside `base`. A symlink planted under `base` (e.g. by
 * a mod/plugin running inside the Minecraft container) pointing at an absolute
 * host path would otherwise let a read — or, via a dangling link, a write —
 * follow it straight out.
 */
function assertRealContainment(base, resolved, attempted) {
  const realBase = realBaseOf(base);
  if (realBase === null) return; // base doesn't exist yet — nothing to escape

  // Walk up to the deepest component that exists AS A FILESYSTEM ENTRY, using
  // lstat (which does NOT follow symlinks). existsSync follows links, so it
  // returns false for a BROKEN symlink and would skip right past it — letting a
  // write through `base/link` (link -> /outside/newfile, not yet created)
  // escape base. lstat sees the link itself, so the dangling tail is caught.
  let dir = resolved;
  for (;;) {
    try {
      fs.lstatSync(dir);
      break;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) return; // reached filesystem root without an anchor
      dir = parent;
    }
  }

  // Resolve that entry to its true location. realpath follows the whole symlink
  // chain, catching an existing link out of base. If the deepest entry is a
  // BROKEN symlink, realpath throws — resolve its target textually against the
  // (real) parent instead, so an escape through a dangling link is still caught.
  let realDir;
  try {
    realDir = fs.realpathSync.native(dir);
  } catch {
    try {
      const parentReal = fs.realpathSync.native(path.dirname(dir));
      realDir = path.resolve(parentReal, fs.readlinkSync(dir));
    } catch {
      return; // vanished between checks — the caller's own op will fail
    }
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
