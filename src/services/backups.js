// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Backups: consistent snapshots of a server dir into ./data/backups/<id>/,
// with the save-off/save-all/save-on dance when the server is running,
// retention pruning, and restore.

const httpError = require('../utils/httpError');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const yauzl = require('yauzl');
const { nanoid } = require('nanoid');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const { execCapture, inspectStatus } = require('../docker/containers');
const indexer = require('../storage/indexer');
const { withSaveLock } = require('./serverLocks');
const { guardOp } = require('./opLock');

// Retention caps, per server, per reason. Every bucket is bounded now - the
// old rule ("manual + pre-update are never auto-pruned") let a long-lived
// server accumulate backups until the free-space preflight started failing
// every new backup. 'manual' also holds restore safety backups.
const KEEP_SCHEDULED = 10;
const KEEP_PRE_UPDATE = 10;
const KEEP_MANUAL = 20;

async function createBackup(serverId, { reason = 'manual', actor = 'system', note = '', task = null } = {}) {
  const server = db.get('SELECT * FROM servers WHERE id = ? AND deleted_at IS NULL', serverId);
  if (!server) throw httpError(404, 'Server not found');

  // Free-space preflight: need roughly the server dir size.
  const needed = indexer.sizeOf(`servers/${serverId}`) || 0;
  const { free } = await indexer.diskFree();
  if (needed && free < needed * 1.1) {
    throw httpError(507, `Not enough disk space for a backup (~${(needed / 1024 ** 3).toFixed(1)} GB needed)`);
  }

  const info = await inspectStatus(serverId).catch(() => ({ exists: false }));
  const running = info.exists && ['running', 'starting', 'unhealthy'].includes(info.status);

  // Seconds-resolution stamp + a nanoid suffix: two backups in the same minute
  // (or even second) can never collide on filename/rel_path.
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const filename = `${serverId}-${reason}-${stamp}-${nanoid(4)}.zip`;
  const relPath = `backups/${serverId}/${filename}`;
  const absPath = dataPath(relPath);
  await fsp.mkdir(path.dirname(absPath), { recursive: true });

  const archive = async () => {
    if (task) task.step('Compressing server files');
    await zipDirectory(dataPath('servers', serverId), absPath, {
      onProgress: task ? (processedBytes) => task.progress(processedBytes, needed) : null,
    });
  };

  let inconsistent = false;
  // Reserve the space this archive is expected to need for the duration of
  // the write, so a second backup/restore/install starting around the same
  // time sees it subtracted from diskFree() instead of independently passing
  // its own preflight check against the same real free bytes.
  const releaseReservation = indexer.reserveDiskSpace(needed);
  try {
    if (running) {
      // Serialize the pause-saves/copy/resume-saves section per server so a
      // concurrent backup or world export can't re-enable writes mid-copy.
      await withSaveLock(serverId, async () => {
        if (task) task.step('Pausing world saves');
        const paused = await execCapture(serverId, ['rcon-cli', 'save-off'])
          .then(() => true)
          .catch((err) => {
            console.warn(
              `[backup] save-off failed for ${serverId}: ${err.message} - archive may be slightly inconsistent`
            );
            return false;
          });
        inconsistent = !paused;
        await execCapture(serverId, ['rcon-cli', 'save-all', 'flush']).catch(() => {});
        await sleep(2000); // let region writes settle
        try {
          await archive();
        } finally {
          await execCapture(serverId, ['rcon-cli', 'save-on']).catch(() => {});
        }
      });
    } else {
      await archive();
    }
  } finally {
    releaseReservation();
  }

  const size = (await fsp.stat(absPath)).size;

  // Post-write integrity check. A torn archive (disk filled mid-write despite
  // the preflight, an archiver fault, a filesystem hiccup) has to be caught
  // HERE - not months later when a restore is the only thing between the
  // operator and data loss. Reading the central directory is cheap (no
  // decompression) and proves the zip is at least structurally sound.
  let entryCount;
  try {
    entryCount = await zipEntryCount(absPath);
  } catch (err) {
    await fsp.rm(absPath, { force: true }).catch(() => {});
    throw httpError(500, `Backup archive failed its integrity check and was discarded: ${err.message}`);
  }
  const empty = entryCount === 0; // e.g. a server that has never started - nothing on disk yet

  const id = `bk_${nanoid(8)}`;
  db.run(
    'INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    serverId,
    filename,
    relPath,
    size,
    reason,
    note
  );
  const warnings = [
    inconsistent ? 'world saves could not be paused, archive may be slightly inconsistent' : null,
    empty ? 'archive contains no files - the server has nothing on disk yet' : null,
  ].filter(Boolean);
  recordEvent({
    serverId,
    actor,
    type: 'backup-created',
    summary:
      `Backup created (${reason}, ${(size / 1024 ** 3).toFixed(2)} GB)` +
      (warnings.length ? ` - WARNING: ${warnings.join('; ')}` : ''),
    details: { id, filename, reason, inconsistent, empty, entryCount },
  });
  // The backup above already succeeded and is already recorded - a retention
  // problem must never surface as this call failing.
  await pruneRetention(serverId, { actor }).catch((err) => {
    console.error(`[backup] retention query failed for ${serverId}: ${err.message}`);
  });
  indexer.scheduleScan();
  return db.get('SELECT * FROM backups WHERE id = ?', id);
}

/**
 * Restore = stop server, extract archive into a staging dir, then swap it
 * into place. Safety backup first unless told not to.
 *
 * The whole operation runs under the shared per-server op lock (see
 * module.exports below) so a concurrent start/stop/recreate/delete/another
 * restore/world-install can never interleave with it - without that, a
 * request landing right after this function's own stop-and-verify step would
 * see a "stopped" server, start a fresh container, and race the live
 * Minecraft process against this function's directory swap.
 *
 * Extraction is staged into a tmp directory and only swapped into place with
 * two fast renames once it fully succeeds, instead of wiping the live world
 * dir first: if extraction fails or the process crashes mid-extraction, the
 * original world is untouched, and the only at-risk window is the two rename
 * syscalls themselves (near-instant, not proportional to world size).
 */
async function restoreBackupImpl(serverId, backupId, { actor = 'system', skipSafety = false, task = null } = {}) {
  const backup = db.get('SELECT * FROM backups WHERE id = ? AND server_id = ?', backupId, serverId);
  if (!backup) throw httpError(404, 'Backup not found');

  // Disk preflight: safety backup (~current world size) + extracted content
  // (its real uncompressed size, not a guess from the compressed zip size -
  // Minecraft region files can compress well past 2x, which would otherwise
  // let this check pass right before the extraction fills the disk).
  const zipPath = dataPath(backup.rel_path);
  const zipStat = await fsp.stat(zipPath).catch(() => null);
  if (!zipStat) throw httpError(404, `Backup archive is missing on disk: ${backup.filename}`);
  const uncompressedBytes = await zipUncompressedSize(zipPath).catch(() => zipStat.size * 4);
  const safetyBytes = skipSafety ? 0 : indexer.sizeOf(`servers/${serverId}`) || 0;
  const needed = uncompressedBytes + safetyBytes;
  const { free } = await indexer.diskFree();
  if (free < needed * 1.1) {
    throw httpError(507, `Not enough disk space to restore (~${(needed / 1024 ** 3).toFixed(1)} GB needed)`);
  }

  if (task) task.step('Stopping server');
  // Guarded stopServer would deadlock here (this function already holds the
  // shared op lock under 'restore' - see module.exports) - use the raw impl.
  const { stopServerUnguarded } = require('./servers');
  await stopServerUnguarded(serverId, { actor }).catch(() => {});
  // NEVER rm -rf under a live container: verify the container really stopped.
  const info = await inspectStatus(serverId).catch(() => ({ exists: false }));
  if (info.exists && ['running', 'starting', 'unhealthy'].includes(info.status)) {
    throw httpError(
      409,
      'The server did not stop, so the restore was cancelled to avoid corrupting the live world. Stop it manually and try again.'
    );
  }

  if (!skipSafety) {
    if (task) task.step('Creating safety backup');
    // createBackup makes its own reservation for safetyBytes - not duplicated
    // here, which only reserves the extraction's own uncompressedBytes below.
    await createBackup(serverId, {
      reason: 'manual',
      actor,
      note: `Safety backup before restoring ${backup.filename}`,
      task: null,
    });
  }

  if (task) task.step('Extracting backup');
  const serverDir = dataPath('servers', serverId);
  const stagingDir = dataPath('tmp', `restore-${serverId}-${nanoid(6)}`);
  await fsp.mkdir(stagingDir, { recursive: true });
  const releaseReservation = indexer.reserveDiskSpace(uncompressedBytes);
  try {
    try {
      await extractZip(zipPath, stagingDir);
    } catch (err) {
      await fsp.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      throw err; // original serverDir was never touched
    }

    const oldDir = dataPath('tmp', `restore-old-${serverId}-${nanoid(6)}`);
    let hadOldDir = false;
    try {
      await renameDir(serverDir, oldDir);
      hadOldDir = true;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // anything but "no dir yet" is a real failure
    }
    try {
      await renameDir(stagingDir, serverDir);
    } catch (err) {
      // Extraction succeeded but the swap itself failed - put the original back
      // rather than leaving the server dir missing.
      if (hadOldDir) await renameDir(oldDir, serverDir).catch(() => {});
      throw err;
    }
    if (hadOldDir) await fsp.rm(oldDir, { recursive: true, force: true }).catch(() => {});
  } finally {
    releaseReservation();
  }

  recordEvent({ serverId, actor, type: 'backup-restored', summary: `Restored backup ${backup.filename}` });
  indexer.scheduleScan();
  return { ok: true };
}

const restoreBackup = guardOp('restore', restoreBackupImpl);

async function deleteBackup(backupId, { actor = 'system' } = {}) {
  const backup = db.get('SELECT * FROM backups WHERE id = ?', backupId);
  if (!backup) return { freedBytes: 0 };
  await fsp.rm(dataPath(backup.rel_path), { force: true });
  db.run('DELETE FROM backups WHERE id = ?', backupId);
  recordEvent({
    serverId: backup.server_id,
    actor,
    type: 'backup-deleted',
    summary: `Backup deleted: ${backup.filename} (${(backup.size_bytes / 1024 ** 3).toFixed(2)} GB freed)`,
  });
  return { freedBytes: backup.size_bytes };
}

/**
 * Keep the newest KEEP_* per reason (see the constants at the top); older ones
 * in each bucket are pruned. 'manual' is bounded too now - it also holds the
 * restore safety backups, which otherwise pile up one-per-restore forever.
 *
 * Delete backups past the retention limit. Each deletion is isolated (one
 * failure - a transient DB busy error, an EACCES on the file - must not stop
 * the rest from being pruned) and the whole function never throws: it's
 * always called right after a backup has already been successfully created
 * and recorded, so a pruning failure here must not surface as "backup
 * failed" (misleading the operator) or silently abort retention entirely
 * (letting old backups accumulate and eventually cause a REAL failure via
 * the free-space preflight).
 */
async function pruneRetention(serverId, { actor = 'system' } = {}) {
  const buckets = [
    ['scheduled', KEEP_SCHEDULED],
    ['pre-update', KEEP_PRE_UPDATE],
    ['manual', KEEP_MANUAL], // includes restore safety backups
  ];
  let deleted = 0;
  for (const [reason, keep] of buckets) {
    const stale = db.all(
      `SELECT id FROM backups WHERE server_id = ? AND reason = ?
       ORDER BY created_at DESC LIMIT -1 OFFSET ?`,
      serverId,
      reason,
      keep
    );
    for (const b of stale) {
      try {
        await deleteBackup(b.id, { actor });
        deleted++;
      } catch (err) {
        console.error(`[backup] retention: could not delete ${b.id} for ${serverId}: ${err.message}`);
      }
    }
  }
  return deleted;
}

// Compression runs in a worker thread (src/services/backupZipWorker.js) so the
// deflate CPU + archiver framing for a multi-GB world don't stall every other
// request. The worker deletes its own half-written .zip on failure.
function zipDirectory(sourceDir, outFile, { onProgress = null } = {}) {
  /** @type {Promise<void>} */
  const p = new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'backupZipWorker.js'), {
      workerData: { sourceDir, outFile },
    });
    let settled = false;
    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      worker.terminate().finally(() => fn(arg));
    };
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        if (onProgress) onProgress(msg.processedBytes);
      } else if (msg.type === 'done') {
        done(resolve);
      } else if (msg.type === 'error') {
        done(reject, new Error(msg.message));
      }
    });
    worker.on('error', (err) => done(reject, err));
    worker.on('exit', (code) => {
      if (!settled)
        done(code === 0 ? resolve : reject, code === 0 ? undefined : new Error(`backup zip worker exited ${code}`));
    });
  });
  return p;
}

// Zip-slip-safe extraction + decompression-bomb ceiling: the one shared
// implementation (src/utils/safeExtract.js), re-exported here because the
// restore path and its tests have always reached for `backups.extractZip`.
const { extractZip } = require('../utils/safeExtract');

/** Sum of uncompressedSize across every entry in a zip - cheap (reads the
 *  central directory only, no decompression) - used for an accurate restore
 *  disk-space preflight instead of guessing from the compressed archive size. */
function zipUncompressedSize(zipFile) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let total = 0;
      zip.on('error', reject);
      zip.on('end', () => resolve(total));
      zip.on('entry', (entry) => {
        total += entry.uncompressedSize || 0;
        zip.readEntry();
      });
      zip.readEntry();
    });
  });
}

/** Open a finished archive and count its entries. Cheap (reads the central
 *  directory only, no decompression); rejects if the zip won't open at all.
 *  Used as a post-write integrity check in createBackup. */
function zipEntryCount(zipFile) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let n = 0;
      zip.on('error', reject);
      zip.on('end', () => resolve(n));
      zip.on('entry', () => {
        n += 1;
        zip.readEntry();
      });
      zip.readEntry();
    });
  });
}

/** Rename a directory, falling back to copy+remove across devices (EXDEV). */
async function renameDir(from, to) {
  try {
    await fsp.rename(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fsp.cp(from, to, { recursive: true });
    await fsp.rm(from, { recursive: true, force: true });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms).unref());
}

module.exports = { createBackup, restoreBackup, deleteBackup, pruneRetention, extractZip, zipDirectory };
