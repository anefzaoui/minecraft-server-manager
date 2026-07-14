// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Scoped file manager. serverId scopes every operation to
// ./data/servers/<id>; serverId = null is the global (admin) manager rooted at
// DATA_DIR itself. Every path resolves through the path guard — nothing can
// escape ./data, and server-scoped calls can't escape their server dir.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');
const db = require('../db');
const { safeJoin } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const indexer = require('../storage/indexer');

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // editor cap
// Global scope: panel-internal files at the DATA_DIR root that must never be read,
// written, listed, or downloaded from the UI — the database (password hashes + the
// at-rest secret cipher) and the session secret (that cipher's key + the cookie
// signing key). Any other top-level dotfile is treated the same, defensively.
const PROTECTED_GLOBAL = new Set(['panel.db', 'panel.db-wal', 'panel.db-shm', 'panel.db-journal', '.session-secret']);

/** True for a DATA_DIR-root path that must be hidden/blocked in the global manager. */
function isProtectedGlobal(rel) {
  return PROTECTED_GLOBAL.has(rel) || /^\.[^/\\]+$/.test(rel);
}

/** Resolve a scope-relative path to {base, abs, rel}. Throws 400 on escape. */
function resolvePath(serverId, relPath = '') {
  const base = serverId ? safeJoin(config.dataDir, 'servers', serverId) : config.dataDir;
  const abs = safeJoin(base, String(relPath || '') || '.');
  const rel = path.relative(base, abs).split(path.sep).join('/');
  return { base, abs, rel };
}

function guardProtected(serverId, rel) {
  if (!serverId && isProtectedGlobal(rel)) {
    // Applies to read/download AND write — the DB holds password hashes and the
    // at-rest secret cipher, and .session-secret is that cipher's key, so neither
    // must ever leave (or change) via the file manager.
    throw httpError(403, 'That panel file is not accessible from the file manager');
  }
}

/** List a directory: entries {name, dir, size, mtime, mtimeMs, path}, dirs first. */
async function list(serverId, relPath = '') {
  const { abs, rel } = resolvePath(serverId, relPath);
  const st = await fsp.stat(abs).catch(() => null);
  if (!st) throw httpError(404, 'Folder not found');
  if (!st.isDirectory()) throw httpError(400, 'Not a folder');

  const dirents = await fsp.readdir(abs, { withFileTypes: true });
  const entries = [];
  for (const e of dirents) {
    // Never surface panel-internal files (DB, session secret) in the global manager.
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (!serverId && isProtectedGlobal(childRel)) continue;
    const childAbs = path.join(abs, e.name);
    const isDir = e.isDirectory();
    let size = 0;
    let mtimeMs = 0;
    try {
      if (isDir) {
        // Use the background indexer's cached size instead of a live recursive
        // walk per folder on every listing — opening a folder with a multi-GB
        // world used to stat tens of thousands of files. Deep/not-yet-indexed
        // dirs read 0 until the next scan; that's the instant-lookup trade-off.
        const dataRel = path.relative(config.dataDir, childAbs).split(path.sep).join('/');
        size = indexer.sizeOf(dataRel);
        mtimeMs = (await fsp.stat(childAbs)).mtimeMs;
      } else {
        const cst = await fsp.stat(childAbs);
        size = cst.size;
        mtimeMs = cst.mtimeMs;
      }
    } catch {
      /* transient */
    }
    entries.push({
      name: e.name,
      dir: isDir,
      size,
      mtimeMs,
      mtime: formatWhen(mtimeMs),
      path: rel ? `${rel}/${e.name}` : e.name,
    });
  }
  entries.sort((a, b) => b.dir - a.dir || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { path: rel, entries };
}

/** Read a text file (≤ 2 MB; binary rejected by null-byte sniff). */
async function readText(serverId, relPath) {
  const { abs, rel } = resolvePath(serverId, relPath);
  guardProtected(serverId, rel);
  const st = await fsp.stat(abs).catch(() => null);
  if (!st || !st.isFile()) throw httpError(404, 'File not found');
  if (st.size > MAX_TEXT_BYTES) {
    throw httpError(
      413,
      `File is too large for the editor (${humanBytes(st.size)} — limit is 2 MB). Download it instead.`
    );
  }
  const buf = await fsp.readFile(abs);
  if (buf.subarray(0, 8192).includes(0)) {
    throw httpError(415, 'This looks like a binary file — download it instead of editing');
  }
  return { content: buf.toString('utf8'), size: st.size };
}

/** Write a text file atomically (tmp + rename). Creates the file when missing. */
async function writeText(serverId, relPath, content, { actor = 'system' } = {}) {
  const { abs, rel } = resolvePath(serverId, relPath);
  guardProtected(serverId, rel);
  if (!rel) throw httpError(400, 'Cannot write the root');
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > MAX_TEXT_BYTES) throw httpError(413, 'Content exceeds the 2 MB editor limit');
  assertRoom(serverId, bytes);

  const parent = path.dirname(abs);
  const pst = await fsp.stat(parent).catch(() => null);
  if (!pst || !pst.isDirectory()) throw httpError(404, 'Parent folder not found');
  const existing = await fsp.stat(abs).catch(() => null);
  if (existing && existing.isDirectory()) throw httpError(400, 'That path is a folder');

  const tmp = path.join(parent, `.msm-write-${Date.now()}.tmp`);
  await fsp.writeFile(tmp, content, 'utf8');
  await fsp.rename(tmp, abs);

  recordEvent({
    serverId: serverId || null,
    actor,
    type: 'file-written',
    summary: `File ${existing ? 'saved' : 'created'}: ${rel} (${humanBytes(bytes)})`,
    details: { path: rel, sizeBytes: bytes, created: !existing },
  });
  return { path: rel, size: bytes };
}

async function mkdir(serverId, relPath, { actor = 'system' } = {}) {
  const { abs, rel } = resolvePath(serverId, relPath);
  if (!rel) throw httpError(400, 'Folder name cannot be empty');
  if (fs.existsSync(abs)) throw httpError(409, 'That name already exists');
  await fsp.mkdir(abs, { recursive: true });
  recordEvent({
    serverId: serverId || null,
    actor,
    type: 'file-mkdir',
    summary: `Folder created: ${rel}`,
    details: { path: rel },
  });
  return { path: rel };
}

/** Rename in place (newName must not contain path separators). */
async function rename(serverId, relPath, newName, { actor = 'system' } = {}) {
  const { abs, rel } = resolvePath(serverId, relPath);
  guardProtected(serverId, rel);
  if (!rel) throw httpError(400, 'Cannot rename the root');
  const clean = sanitizeName(newName);
  if (!fs.existsSync(abs)) throw httpError(404, 'Not found');
  const target = path.join(path.dirname(abs), clean);
  // Re-check containment (sanitizeName guarantees it, but stay paranoid).
  resolvePath(serverId, path.posix.join(path.posix.dirname(rel), clean));
  if (fs.existsSync(target) && path.resolve(target) !== path.resolve(abs)) {
    throw httpError(409, `"${clean}" already exists here`);
  }
  await fsp.rename(abs, target);
  recordEvent({
    serverId: serverId || null,
    actor,
    type: 'file-renamed',
    summary: `Renamed: ${rel} → ${clean}`,
    details: { from: rel, to: clean },
  });
  return { path: rel.includes('/') ? `${rel.slice(0, rel.lastIndexOf('/'))}/${clean}` : clean };
}

/** Move into a destination directory (keeps the base name). */
async function move(serverId, relPath, destRel, { actor = 'system' } = {}) {
  const { abs, rel } = resolvePath(serverId, relPath);
  guardProtected(serverId, rel);
  if (!rel) throw httpError(400, 'Cannot move the root');
  const dest = resolvePath(serverId, destRel);
  const dst = await fsp.stat(dest.abs).catch(() => null);
  if (!fs.existsSync(abs)) throw httpError(404, 'Not found');
  if (!dst || !dst.isDirectory()) throw httpError(400, 'Destination folder not found');
  if ((dest.abs + path.sep).startsWith(abs + path.sep)) throw httpError(400, 'Cannot move a folder into itself');

  const target = path.join(dest.abs, path.basename(abs));
  if (fs.existsSync(target)) throw httpError(409, `"${path.basename(abs)}" already exists in the destination`);
  await moveEntry(abs, target);
  const toRel = dest.rel ? `${dest.rel}/${path.basename(abs)}` : path.basename(abs);
  recordEvent({
    serverId: serverId || null,
    actor,
    type: 'file-moved',
    summary: `Moved: ${rel} → ${toRel}`,
    details: { from: rel, to: toRel },
  });
  return { path: toRel };
}

/** Copy into a destination directory (recursive; quota-checked). */
async function copy(serverId, relPath, destRel, { actor = 'system' } = {}) {
  const { abs, rel } = resolvePath(serverId, relPath);
  if (!rel) throw httpError(400, 'Cannot copy the root');
  const dest = resolvePath(serverId, destRel);
  const st = await fsp.stat(abs).catch(() => null);
  const dst = await fsp.stat(dest.abs).catch(() => null);
  if (!st) throw httpError(404, 'Not found');
  if (!dst || !dst.isDirectory()) throw httpError(400, 'Destination folder not found');
  if ((dest.abs + path.sep).startsWith(abs + path.sep)) throw httpError(400, 'Cannot copy a folder into itself');

  const bytes = st.isDirectory() ? await dirSize(abs) : st.size;
  assertRoom(serverId, bytes);
  await assertDiskFree(bytes);

  const target = path.join(dest.abs, path.basename(abs));
  if (fs.existsSync(target)) throw httpError(409, `"${path.basename(abs)}" already exists in the destination`);
  await fsp.cp(abs, target, { recursive: true });
  const toRel = dest.rel ? `${dest.rel}/${path.basename(abs)}` : path.basename(abs);
  recordEvent({
    serverId: serverId || null,
    actor,
    type: 'file-copied',
    summary: `Copied: ${rel} → ${toRel} (${humanBytes(bytes)})`,
    details: { from: rel, to: toRel, sizeBytes: bytes },
  });
  indexer.scan().catch(() => {});
  return { path: toRel, sizeBytes: bytes };
}

/** Delete a file or folder (recursive). Returns freed bytes. */
async function remove(serverId, relPath, { actor = 'system' } = {}) {
  const { abs, rel } = resolvePath(serverId, relPath);
  guardProtected(serverId, rel);
  if (!rel) throw httpError(400, 'Cannot delete the root folder');
  const st = await fsp.stat(abs).catch(() => null);
  if (!st) throw httpError(404, 'Not found');
  const freedBytes = st.isDirectory() ? await dirSize(abs) : st.size;
  await fsp.rm(abs, { recursive: true, force: true });
  recordEvent({
    serverId: serverId || null,
    actor,
    type: 'file-deleted',
    summary: `Deleted: ${rel} (${humanBytes(freedBytes)} freed)`,
    details: { path: rel, freedBytes },
  });
  indexer.scan().catch(() => {});
  return { freedBytes };
}

/** Move an uploaded tmp file into a target directory (used by the upload routes). */
async function acceptUpload(serverId, destRel, tmpAbs, originalName, { actor = 'system' } = {}) {
  const dest = resolvePath(serverId, destRel);
  const dst = await fsp.stat(dest.abs).catch(() => null);
  if (!dst || !dst.isDirectory()) throw httpError(400, 'Destination folder not found');
  const filename = sanitizeName(originalName || 'upload.bin');
  const size = (await fsp.stat(tmpAbs)).size;
  assertRoom(serverId, size);

  const target = path.join(dest.abs, filename);
  await moveEntry(tmpAbs, target);
  const rel = dest.rel ? `${dest.rel}/${filename}` : filename;
  recordEvent({
    serverId: serverId || null,
    actor,
    type: 'file-uploaded',
    summary: `Uploaded: ${rel} (${humanBytes(size)})`,
    details: { path: rel, sizeBytes: size },
  });
  indexer.scan().catch(() => {});
  return { path: rel, name: filename, size };
}

/** Absolute path + stat for downloads (files only). */
async function statFile(serverId, relPath) {
  const { abs, rel } = resolvePath(serverId, relPath);
  guardProtected(serverId, rel); // no downloading panel.db either
  const st = await fsp.stat(abs).catch(() => null);
  if (!st || !st.isFile()) throw httpError(404, 'File not found');
  return { abs, rel, size: st.size, name: path.basename(abs) };
}

// ---------------------------------------------------------------------------

function assertRoom(serverId, aboutToAddBytes) {
  if (!serverId) return;
  const server = db.get('SELECT * FROM servers WHERE id = ? AND deleted_at IS NULL', serverId);
  if (server) indexer.assertUnderQuota(server, aboutToAddBytes);
}

async function assertDiskFree(bytes) {
  const { free } = await indexer.diskFree().catch(() => ({ free: Infinity }));
  if (free < bytes * 1.1) throw httpError(507, `Not enough disk space (~${humanBytes(bytes)} needed)`);
}

async function dirSize(abs) {
  let total = 0;
  let entries;
  try {
    entries = await fsp.readdir(abs, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const child = path.join(abs, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) total += await dirSize(child);
    else if (e.isFile()) {
      try {
        total += (await fsp.stat(child)).size;
      } catch {
        /* transient */
      }
    }
  }
  return total;
}

async function moveEntry(from, to) {
  try {
    await fsp.rename(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fsp.cp(from, to, { recursive: true });
    await fsp.rm(from, { recursive: true, force: true });
  }
}

function sanitizeName(name) {
  const clean = String(name || '')
    .replace(/[\\/:*?"<>|\0]/g, '_')
    .replace(/^\.+$/, '')
    .trim()
    .slice(0, 180);
  if (!clean || clean === '.' || clean === '..') throw httpError(400, 'Invalid name');
  return clean;
}

function formatWhen(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function humanBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

module.exports = {
  list,
  readText,
  writeText,
  mkdir,
  rename,
  move,
  copy,
  remove,
  acceptUpload,
  statFile,
  resolvePath,
  assertRoom,
  assertDiskFree,
};
