'use strict';

// Size indexer: walks ./data in the background, caches per-directory sizes in
// SQLite so every size shown in the UI is an instant lookup, and records
// growth snapshots. Never blocks a request on a disk walk.

const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');
const db = require('../db');

let scanning = false;
let timer = null;

/** Directories whose sizes we track individually (top-level categories + per-server/per-library-kind). */
async function scan() {
  if (scanning) return { skipped: true };
  scanning = true;
  const started = Date.now();
  try {
    const root = config.dataDir;
    const results = new Map(); // relPath -> {size, files}

    async function walk(abs, rel) {
      let size = 0;
      let files = 0;
      let entries;
      try {
        entries = await fs.readdir(abs, { withFileTypes: true });
      } catch {
        return { size: 0, files: 0 };
      }
      for (const entry of entries) {
        const childAbs = path.join(abs, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          const sub = await walk(childAbs, rel ? `${rel}/${entry.name}` : entry.name);
          size += sub.size;
          files += sub.files;
        } else if (entry.isFile()) {
          try {
            const st = await fs.stat(childAbs);
            size += st.size;
            files += 1;
          } catch {
            /* transient */
          }
        }
      }
      if (rel) results.set(rel, { size, files });
      return { size, files };
    }

    const total = await walk(root, '');
    results.set('', total);

    db.transaction(() => {
      db.run('DELETE FROM storage_index');
      const insert = db
        .open()
        .prepare(
          "INSERT INTO storage_index (rel_path, size_bytes, file_count, scanned_at) VALUES (?, ?, ?, datetime('now'))"
        );
      for (const [rel, v] of results) {
        // Cache depth ≤ 3 to keep the table small; deeper paths are summed live.
        if (rel.split('/').length <= 3) insert.run(rel, v.size, v.files);
      }
    });

    const perServer = {};
    for (const [rel, v] of results) {
      const m = /^servers\/([^/]+)$/.exec(rel);
      if (m) perServer[m[1]] = v.size;
    }
    db.run(
      'INSERT INTO storage_snapshots (total_bytes, per_server_json) VALUES (?, ?)',
      total.size,
      JSON.stringify(perServer)
    );
    // Retention: keep the last 500 snapshots.
    db.run(
      'DELETE FROM storage_snapshots WHERE id NOT IN (SELECT id FROM storage_snapshots ORDER BY id DESC LIMIT 500)'
    );

    return { totalBytes: total.size, dirs: results.size, ms: Date.now() - started };
  } finally {
    scanning = false;
  }
}

function startIndexer({ intervalMs = 15 * 60 * 1000 } = {}) {
  scan().catch((err) => console.error('[indexer]', err.message));
  timer = setInterval(() => scan().catch((err) => console.error('[indexer]', err.message)), intervalMs);
  timer.unref();
}

/** Instant size lookup from cache; 0 when not yet scanned. */
function sizeOf(relPath) {
  const row = db.get('SELECT size_bytes FROM storage_index WHERE rel_path = ?', relPath);
  return row ? row.size_bytes : 0;
}

function lastScan() {
  const row = db.get('SELECT MAX(scanned_at) AS t FROM storage_index');
  return row ? row.t : null;
}

async function diskFree() {
  const st = await fs.statfs(config.dataDir);
  return { free: st.bavail * st.bsize, total: st.blocks * st.bsize };
}

/** Quota check used before disk-growing operations. Throws a friendly 409. */
function assertUnderQuota(server, aboutToAddBytes = 0) {
  if (!server.disk_quota_bytes) return;
  const used = sizeOf(`servers/${server.id}`);
  if (used + aboutToAddBytes > server.disk_quota_bytes) {
    const err = new Error(
      `${server.display_name} is over its disk quota — free space or raise the limit in Settings → Resources`
    );
    err.status = 409;
    throw err;
  }
}

/** Strict-mode sweep: auto-stop servers >10% over quota. Called after scans. */
async function enforceStrictQuotas() {
  const servers = db.all(
    'SELECT * FROM servers WHERE deleted_at IS NULL AND quota_strict = 1 AND disk_quota_bytes > 0'
  );
  for (const s of servers) {
    const used = sizeOf(`servers/${s.id}`);
    if (used > s.disk_quota_bytes * 1.1 && ['running', 'starting', 'unhealthy'].includes(s.status)) {
      const { stopServer } = require('../services/servers');
      const { recordEvent } = require('../events');
      recordEvent({
        serverId: s.id,
        type: 'quota-exceeded',
        summary: `Strict quota: usage ${(used / 1024 ** 3).toFixed(1)} GB exceeds quota by >10% — stopping server`,
      });
      await stopServer(s.id, { actor: 'system' }).catch(() => {});
    }
  }
}

module.exports = { scan, startIndexer, sizeOf, lastScan, diskFree, assertUnderQuota, enforceStrictQuotas };
