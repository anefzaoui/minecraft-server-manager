// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Storage maintenance helpers shared by the /api/storage/cleanup endpoint and
// the /storage page (which shows the same numbers as a dry-run preview).
// Route-layer only — services stay untouched.

const fsp = require('node:fs/promises');
const path = require('node:path');
const db = require('../../db');
const { dataPath } = require('../../storage/pathGuard');
const { recordEvent } = require('../../events');

const TMP_MIN_AGE_MS = 60 * 60 * 1000; // never touch in-flight transfers
const DEFAULT_DAYS = 30;

/** Recursive size of a file or directory (symlinks skipped). */
async function entrySize(abs) {
  const st = await fsp.lstat(abs).catch(() => null);
  if (!st || st.isSymbolicLink()) return 0;
  if (st.isFile()) return st.size;
  if (!st.isDirectory()) return 0;
  let total = 0;
  const entries = await fsp.readdir(abs, { withFileTypes: true }).catch(() => []);
  for (const e of entries) total += await entrySize(path.join(abs, e.name));
  return total;
}

/**
 * Run (or preview, with dryRun) one cleanup action.
 * Actions: 'tmp' | 'orphans' | 'old-logs' | 'old-crashes'.
 * Returns { freedBytes, removed }.
 */
async function runCleanup(action, { olderThanDays, dryRun = false, actor = 'system' } = {}) {
  const days = olderThanDays || DEFAULT_DAYS;
  let freedBytes = 0;
  let removed = 0;

  if (action === 'tmp') {
    const dir = dataPath('tmp');
    const entries = await fsp.readdir(dir).catch(() => []);
    for (const name of entries) {
      const abs = path.join(dir, name);
      const st = await fsp.lstat(abs).catch(() => null);
      if (!st || Date.now() - st.mtimeMs < TMP_MIN_AGE_MS) continue;
      freedBytes += st.isDirectory() ? await entrySize(abs) : st.size;
      removed += 1;
      if (!dryRun) await fsp.rm(abs, { recursive: true, force: true }).catch(() => {});
    }
  } else if (action === 'orphans') {
    const library = require('../../services/library');
    for (const row of library.orphans()) {
      freedBytes += row.size_bytes || 0;
      removed += 1;
      if (!dryRun) await library.deleteLibraryFile(row.id, { actor, force: true }).catch(() => {});
    }
  } else if (action === 'old-logs') {
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const logsRoot = dataPath('logs');
    const owners = await fsp.readdir(logsRoot, { withFileTypes: true }).catch(() => []);
    for (const owner of owners) {
      if (!owner.isDirectory()) continue;
      const candidates = [path.join(logsRoot, owner.name), path.join(logsRoot, owner.name, 'events')];
      for (const dir of candidates) {
        const files = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const f of files) {
          if (!f.isFile()) continue;
          const abs = path.join(dir, f.name);
          const st = await fsp.stat(abs).catch(() => null);
          if (!st || st.mtimeMs >= cutoffMs) continue;
          freedBytes += st.size;
          removed += 1;
          if (!dryRun) await fsp.rm(abs, { force: true }).catch(() => {});
        }
      }
    }
  } else if (action === 'old-crashes') {
    const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    if (dryRun) {
      const row = db.get(
        'SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS s FROM crash_reports WHERE file_mtime < ?',
        cutoffIso
      );
      removed = row.n;
      freedBytes = row.s;
    } else {
      const crashes = require('../../crashes');
      const owners = db.all('SELECT DISTINCT server_id FROM crash_reports WHERE file_mtime < ?', cutoffIso);
      for (const { server_id: sid } of owners) {
        const result = crashes.deleteOlderThan(sid, days, { actor });
        removed += result.deleted;
        freedBytes += result.freedBytes;
      }
    }
  } else {
    const err = new Error(`Unknown cleanup action "${action}"`);
    err.status = 400;
    throw err;
  }

  if (!dryRun && removed > 0) {
    recordEvent({
      actor,
      type: 'storage-cleanup',
      summary: `Storage cleanup (${action}): ${removed} item(s) removed, ${(freedBytes / 1024 ** 2).toFixed(1)} MB freed`,
      details: { action, removed, freedBytes, olderThanDays: days },
    });
    require('../../storage/indexer')
      .scan()
      .catch(() => {});
  }
  return { freedBytes, removed };
}

/**
 * Breadth-first walk of ./data collecting the largest files. Bounded by a
 * file-scan cap so a huge tree can never stall a page render.
 */
async function largestFiles({ top = 15, maxScan = 3000 } = {}) {
  const best = [];
  const queue = [''];
  let scanned = 0;
  while (queue.length && scanned < maxScan) {
    const rel = queue.shift();
    const entries = await fsp.readdir(dataPath(rel || '.'), { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        queue.push(childRel);
      } else if (e.isFile()) {
        scanned += 1;
        const st = await fsp.stat(dataPath(childRel)).catch(() => null);
        if (!st) continue;
        best.push({ path: childRel, size: st.size });
        if (best.length > top * 3) {
          best.sort((a, b) => b.size - a.size);
          best.length = top;
        }
        if (scanned >= maxScan) break;
      }
    }
  }
  best.sort((a, b) => b.size - a.size);
  return best.slice(0, top);
}

module.exports = { runCleanup, largestFiles, DEFAULT_DAYS };
