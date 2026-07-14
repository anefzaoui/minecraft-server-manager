// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Backups: consistent snapshots of a server dir into ./data/backups/<id>/,
// with the save-off/save-all/save-on dance when the server is running,
// retention pruning, and restore.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const archiver = require('archiver');
const yauzl = require('yauzl');
const { nanoid } = require('nanoid');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const { execCapture, inspectStatus } = require('../docker/containers');
const indexer = require('../storage/indexer');
const { withSaveLock } = require('./serverLocks');

const KEEP_SCHEDULED = 10; // retention: newest N scheduled backups per server

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
  if (running) {
    // Serialize the pause-saves/copy/resume-saves section per server so a
    // concurrent backup or world export can't re-enable writes mid-copy.
    await withSaveLock(serverId, async () => {
      if (task) task.step('Pausing world saves');
      const paused = await execCapture(serverId, ['rcon-cli', 'save-off'])
        .then(() => true)
        .catch((err) => {
          console.warn(
            `[backup] save-off failed for ${serverId}: ${err.message} — archive may be slightly inconsistent`
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

  const size = (await fsp.stat(absPath)).size;
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
  recordEvent({
    serverId,
    actor,
    type: 'backup-created',
    summary: `Backup created (${reason}, ${(size / 1024 ** 3).toFixed(2)} GB)${inconsistent ? ' — WARNING: world saves could not be paused, archive may be slightly inconsistent' : ''}`,
    details: { id, filename, reason, inconsistent },
  });
  await pruneRetention(serverId, { actor });
  indexer.scan().catch(() => {});
  return db.get('SELECT * FROM backups WHERE id = ?', id);
}

/** Restore = stop server, wipe dir, extract archive. Safety backup first unless told not to. */
async function restoreBackup(serverId, backupId, { actor = 'system', skipSafety = false, task = null } = {}) {
  const backup = db.get('SELECT * FROM backups WHERE id = ? AND server_id = ?', backupId, serverId);
  if (!backup) throw httpError(404, 'Backup not found');

  // Disk preflight: safety backup + extracted content ≈ zip size ×2.
  const zipStat = await fsp.stat(dataPath(backup.rel_path)).catch(() => null);
  if (!zipStat) throw httpError(404, `Backup archive is missing on disk: ${backup.filename}`);
  const { free } = await indexer.diskFree();
  if (free < zipStat.size * 2) {
    throw httpError(
      507,
      `Not enough disk space to restore (~${((zipStat.size * 2) / 1024 ** 3).toFixed(1)} GB needed)`
    );
  }

  if (task) task.step('Stopping server');
  const { stopServer } = require('./servers');
  await stopServer(serverId, { actor }).catch(() => {});
  // NEVER rm -rf under a live container: verify the container really stopped.
  const info = await inspectStatus(serverId).catch(() => ({ exists: false }));
  if (info.exists && ['running', 'starting', 'unhealthy'].includes(info.status)) {
    throw httpError(
      409,
      'The server did not stop — restore aborted to avoid corrupting the live world. Stop it manually and retry.'
    );
  }

  if (!skipSafety) {
    if (task) task.step('Creating safety backup');
    await createBackup(serverId, {
      reason: 'manual',
      actor,
      note: `Safety backup before restoring ${backup.filename}`,
      task: null,
    });
  }

  if (task) task.step('Extracting backup');
  const serverDir = dataPath('servers', serverId);
  await fsp.rm(serverDir, { recursive: true, force: true });
  await fsp.mkdir(serverDir, { recursive: true });
  await extractZip(dataPath(backup.rel_path), serverDir);

  recordEvent({ serverId, actor, type: 'backup-restored', summary: `Restored backup ${backup.filename}` });
  indexer.scan().catch(() => {});
  return { ok: true };
}

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

/** Keep newest N scheduled; manual + pre-update are never auto-pruned. */
async function pruneRetention(serverId, { actor = 'system' } = {}) {
  const stale = db.all(
    `SELECT * FROM backups WHERE server_id = ? AND reason = 'scheduled'
     ORDER BY created_at DESC LIMIT -1 OFFSET ?`,
    serverId,
    KEEP_SCHEDULED
  );
  for (const b of stale) await deleteBackup(b.id, { actor });
  return stale.length;
}

function zipDirectory(sourceDir, outFile, { onProgress = null } = {}) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 6 } });
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      // Destroy the write stream and remove the half-written .zip so a repeatedly
      // failing scheduled backup can't leak fds + orphan partial files.
      try {
        output.destroy();
      } catch {
        /* */
      }
      fs.rm(outFile, { force: true }, () => reject(err));
    };
    output.on('close', () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    });
    output.on('error', fail);
    archive.on('error', fail);
    if (onProgress) archive.on('progress', (d) => onProgress(d.fs.processedBytes));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Ceiling on total uncompressed restore size (decompression-bomb guard).
const MAX_EXTRACT_BYTES = 50 * 1024 ** 3;
const MAX_EXTRACT_ENTRIES = 200000;

/** Zip-slip-safe extraction with a decompression-bomb ceiling. */
function extractZip(zipFile, destDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let settled = false;
      let entryCount = 0;
      let writtenBytes = 0;
      let declaredBytes = 0;
      const fail = (e) => {
        if (settled) return;
        settled = true;
        try {
          zip.destroy();
        } catch {
          /* */
        }
        reject(e);
      };
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      zip.on('error', fail);
      zip.on('end', done);
      zip.on('entry', (entry) => {
        if (++entryCount > MAX_EXTRACT_ENTRIES)
          return fail(new Error(`Archive has too many entries (> ${MAX_EXTRACT_ENTRIES}).`));
        declaredBytes += entry.uncompressedSize || 0;
        if (declaredBytes > MAX_EXTRACT_BYTES)
          return fail(new Error(`Archive too large uncompressed (> ${Math.round(MAX_EXTRACT_BYTES / 1024 ** 3)} GB).`));
        const target = path.resolve(destDir, entry.fileName);
        if (!target.startsWith(path.resolve(destDir) + path.sep) && target !== path.resolve(destDir)) {
          return fail(new Error(`Archive entry escapes destination: ${entry.fileName}`));
        }
        if (/\/$/.test(entry.fileName)) {
          fs.mkdirSync(target, { recursive: true });
          zip.readEntry();
        } else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          zip.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return fail(streamErr);
            const out = fs.createWriteStream(target);
            readStream.on('data', (chunk) => {
              writtenBytes += chunk.length;
              if (writtenBytes > MAX_EXTRACT_BYTES) {
                readStream.destroy();
                out.destroy();
                fail(
                  new Error(
                    `Archive exceeds the ${Math.round(MAX_EXTRACT_BYTES / 1024 ** 3)} GB extraction limit — aborted.`
                  )
                );
              }
            });
            out.on('close', () => {
              if (!settled) zip.readEntry();
            });
            out.on('error', fail);
            readStream.pipe(out);
          });
        }
      });
      zip.readEntry();
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms).unref());
}

module.exports = { createBackup, restoreBackup, deleteBackup, pruneRetention, extractZip };
