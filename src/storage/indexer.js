'use strict';

// Size indexer: walks ./data in the background, caches per-directory sizes in
// SQLite so every size shown in the UI is an instant lookup, and records
// growth snapshots. Never blocks a request on a disk walk.

const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');
const db = require('../db');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');
const { makeFailureThrottle } = require('../logger');

let scanning = false;
let timer = null;
// When the last scan STARTED; the interval skip uses it to avoid re-walking the
// whole tree minutes after a mutation-driven scheduleScan() already did.
let lastScanAt = 0;
const scanThrottle = makeFailureThrottle();
const onScanFailed = (err) =>
  scanThrottle.fail(logger.warn, 'A storage index scan failed.', { err: serializeError(err, { includeStack: false }) });

/** Directories whose sizes we track individually (top-level categories + per-server/per-library-kind). */
async function scan() {
  if (scanning) return { skipped: true };
  scanning = true;
  lastScanAt = Date.now();
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
        return { size: 0, files: 0 }; // intentional: directory not present or unreadable
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
            // intentional: file vanished between readdir and stat
          }
        }
      }
      if (rel) results.set(rel, { size, files });
      return { size, files };
    }

    const total = await walk(root, '');
    results.set('', total);

    // Skip the DB rewrite when the walk produced exactly what the table already
    // holds. In-place file rewrites that leave sizes unchanged (a rewritten
    // config, an overwritten log) otherwise churn the whole DELETE+reinsert AND
    // a storage_snapshot row every 15 minutes for zero information.
    if (cachedEqual(results)) {
      // Still stamp the scan time (the Storage page shows "last scanned") and
      // keep the usage-history series continuous - one cheap row, not a rewrite.
      db.run("UPDATE storage_index SET scanned_at = datetime('now')");
      recordSnapshot(results, total);
      scanThrottle.ok(logger.info, 'The storage index scan recovered.');
      return { totalBytes: total.size, dirs: results.size, ms: Date.now() - started, unchanged: true };
    }

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

    recordSnapshot(results, total);

    scanThrottle.ok(logger.info, 'The storage index scan recovered.');
    return { totalBytes: total.size, dirs: results.size, ms: Date.now() - started };
  } finally {
    scanning = false;
  }
}

/** Append one usage-history point (total + per-server sizes), keeping the last 500. */
function recordSnapshot(results, total) {
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
  db.run('DELETE FROM storage_snapshots WHERE id NOT IN (SELECT id FROM storage_snapshots ORDER BY id DESC LIMIT 500)');
}

/** True when the scanned depth ≤ 3 rows exactly match the cache table's. */
function cachedEqual(results) {
  const rows = db.all('SELECT rel_path, size_bytes, file_count FROM storage_index');
  if (rows.length === 0) return false;
  if (rows.length !== countCachedEntries(results)) return false;
  for (const r of rows) {
    const v = results.get(r.rel_path);
    if (!v || v.size !== r.size_bytes || v.files !== r.file_count) return false;
  }
  return true;
}

function countCachedEntries(results) {
  let n = 0;
  for (const rel of results.keys()) {
    if (rel.split('/').length <= 3) n += 1;
  }
  return n;
}

function startIndexer({ intervalMs = 15 * 60 * 1000 } = {}) {
  scan().catch(onScanFailed);
  // Mutation-driven scheduleScan() calls frequently land near an interval tick;
  // re-walking the whole tree again minutes after one finished is pure waste,
  // so skip a tick that follows a scan by less than half the interval.
  timer = setInterval(() => {
    if (Date.now() - lastScanAt < intervalMs / 2) return;
    scan().catch(onScanFailed);
  }, intervalMs);
  timer.unref();
}

// Coalesce the "rescan after a filesystem mutation" calls that fire from every
// upload / delete / copy / backup / restore. A burst of ops (e.g. deleting a
// dozen files, or a restore that also writes a safety backup) used to kick off a
// full recursive stat-walk of data/ per op; this collapses them into one walk a
// short while after the LAST mutation. Trailing debounce: every call pushes the
// timer out, so a walk never runs mid-restore. The 15-minute interval scan is
// the backstop if mutations never stop long enough for the timer to fire.
let debounceTimer = null;
function scheduleScan({ delayMs = 45_000 } = {}) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    scan().catch(onScanFailed);
  }, delayMs);
  debounceTimer.unref();
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

// In-flight disk-growing operations (backup, restore, world install/
// duplicate...) reserve the bytes they expect to need so diskFree() reflects
// what's ACTUALLY available once every concurrent operation's own preflight
// claim is accounted for - without this, two such operations starting close
// together (e.g. two servers' scheduled backups landing on the same cron
// tick) can each independently see enough real free space, both pass their
// own preflight check, and jointly overrun the disk. This is advisory
// bookkeeping in this process only, not a hard OS-level reservation.
let reservedBytes = 0;

/** Reserve `bytes` against diskFree() until the returned release() is called
 *  (call it in a finally so a thrown/rejected operation still releases it). */
function reserveDiskSpace(bytes) {
  reservedBytes += bytes;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    reservedBytes -= bytes;
  };
}

async function diskFree() {
  const st = await fs.statfs(config.dataDir);
  const free = st.bavail * st.bsize;
  return { free: Math.max(0, free - reservedBytes), total: st.blocks * st.bsize };
}

/** Quota check used before disk-growing operations. Throws a friendly 409. */
function assertUnderQuota(server, aboutToAddBytes = 0) {
  if (!server.disk_quota_bytes) return;
  const used = sizeOf(`servers/${server.id}`);
  if (used + aboutToAddBytes > server.disk_quota_bytes) {
    const err = new Error(
      `${server.display_name} is over its disk quota. Free some space or raise the limit in Settings → Resources.`
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
    if (used > s.disk_quota_bytes * 1.1 && ['running', 'starting', 'unhealthy', 'stalled'].includes(s.status)) {
      const { stopServer } = require('../services/servers');
      const { recordEvent } = require('../events');
      recordEvent({
        serverId: s.id,
        type: 'quota-exceeded',
        summary: `Strict quota: usage ${(used / 1024 ** 3).toFixed(1)} GB exceeds the quota by more than 10%. Stopping the server.`,
      });
      logger.warn('Stopping a server that is more than 10 percent over its strict disk quota.', {
        serverId: s.id,
        usedBytes: used,
        quotaBytes: s.disk_quota_bytes,
      });
      await stopServer(s.id, { actor: 'system' }).catch((err) => {
        logger.error('Could not stop a server that exceeded its strict disk quota.', {
          serverId: s.id,
          err: serializeError(err),
        });
      });
    }
  }
}

module.exports = {
  scan,
  scheduleScan,
  startIndexer,
  sizeOf,
  lastScan,
  diskFree,
  reserveDiskSpace,
  assertUnderQuota,
  enforceStrictQuotas,
};
