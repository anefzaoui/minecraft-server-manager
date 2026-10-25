// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Backups: consistent snapshots of a server dir into ./data/backups/<id>/,
// with the save-off/save-all/save-on dance when the server is running,
// retention pruning, and restore.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
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
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

// Retention caps live in services/backupRetention.js now (panel-wide defaults +
// optional per-server overrides, plus age and total-size ceilings). Every bucket
// is still bounded by default - the old rule ("manual + pre-update are never
// auto-pruned") let a long-lived server accumulate backups until the free-space
// preflight started failing every new backup. Restore/world-reset safety
// snapshots get their OWN bucket ('pre-restore') so they can't silently evict
// backups a user deliberately created and kept (reason 'manual').
const backupRetention = require('./backupRetention');

async function createBackupImpl(
  serverId,
  { reason = 'manual', actor = 'system', note = '', task = null, shrinkAfter = false, shrinkMinTicks } = {}
) {
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
    if (task) task.step('Compressing server files…');
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
        if (task) task.step('Pausing world saves…');
        const paused = await execCapture(serverId, ['rcon-cli', 'save-off'])
          .then(() => true)
          .catch((err) => {
            logger.warn('Pausing world saves before a backup failed; the archive may be slightly inconsistent.', {
              serverId,
              err: serializeError(err, { includeStack: false }),
            });
            return false;
          });
        inconsistent = !paused;
        await execCapture(serverId, ['rcon-cli', 'save-all', 'flush']).catch((err) => {
          logger.warn('Flushing world saves before a backup failed; the archive may be slightly inconsistent.', {
            serverId,
            err: serializeError(err, { includeStack: false }),
          });
          inconsistent = true;
        });
        await sleep(2000); // let region writes settle
        try {
          await archive();
        } finally {
          // save-on MUST succeed - if it is swallowed here the server would be
          // left with world saves disabled and nobody told. Surface it loudly.
          try {
            await execCapture(serverId, ['rcon-cli', 'save-on']);
          } catch (err) {
            logger.error('Re-enabling world saves after a backup failed: the server may still have saves paused.', {
              serverId,
              err: serializeError(err, { includeStack: false }),
            });
            recordEvent({
              serverId,
              actor,
              type: 'backup-warning',
              summary:
                'World saves were not re-enabled after this backup. Check the server console and run save-on again.',
            });
            inconsistent = true;
          }
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
    empty ? 'the archive contains no files because the server has nothing on disk yet' : null,
  ].filter(Boolean);
  recordEvent({
    serverId,
    actor,
    type: 'backup-created',
    summary:
      `Backup created (${reason}, ${(size / 1024 ** 3).toFixed(2)} GB)` +
      (warnings.length ? `. Warning: ${warnings.join('; ')}.` : '.'),
    details: { id, filename, reason, inconsistent, empty, entryCount },
  });
  logger.info('Created a backup.', { serverId, backupId: id, reason, sizeBytes: size, inconsistent, empty });

  // Optional: after the archive is safely written (it is the undo), trim
  // rarely-visited chunks from the active world. Only ever on a stopped server -
  // shrinking edits region files directly.
  if (shrinkAfter) {
    if (running) {
      if (task) task.step('Shrink skipped because the server was running.');
      logger.info('Skipped the post-backup world shrink because the server was running.', { serverId });
    } else {
      try {
        if (task) task.step('Removing rarely-visited chunks from the world…');
        // shrinkWorldImpl (not the guardOp-wrapped shrinkWorld): this runs
        // inside the guardOp('backup') critical section, which already excludes
        // lifecycle ops - a nested 'shrink' guard would 409 against its own backup.
        const r = await require('./worldShrink').shrinkWorldImpl(serverId, {
          actor,
          minInhabitedTicks: Number.isFinite(shrinkMinTicks) ? shrinkMinTicks : undefined,
        });
        logger.info('Post-backup world shrink finished.', { serverId, ...r });
      } catch (err) {
        // The backup succeeded - a shrink failure must not fail the whole op.
        logger.error('The post-backup world shrink failed.', { serverId, err: serializeError(err) });
      }
    }
  }

  // The backup above already succeeded and is already recorded - a retention
  // problem must never surface as this call failing.
  await pruneRetention(serverId, { actor }).catch((err) => {
    logger.error('Pruning old backups after a new backup failed.', {
      serverId,
      err: serializeError(err),
    });
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
async function restoreBackupCore(serverId, backupId, { actor = 'system', skipSafety = false, task = null } = {}) {
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

  if (task) task.step('Stopping server…');
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
    if (task) task.step('Creating safety backup…');
    // createBackup makes its own reservation for safetyBytes - not duplicated
    // here, which only reserves the extraction's own uncompressedBytes below.
    // The safety backup is best-effort insurance: if it can't be made (e.g. its
    // own integrity check trips on a transient fault) that must NOT cancel the
    // restore the user explicitly asked for - warn loudly and carry on.
    try {
      // The raw impl: we're already inside the 'restore' op lock, and the
      // guarded createBackup would 409 against our own lock.
      await createBackupImpl(serverId, {
        reason: 'pre-restore',
        actor,
        note: `Safety backup before restoring ${backup.filename}`,
        task: null,
      });
    } catch (err) {
      logger.warn('The pre-restore safety backup could not be created; continuing with the restore.', {
        serverId,
        backupId,
        err: serializeError(err),
      });
      recordEvent({
        serverId,
        actor,
        type: 'backup-warning',
        summary: `Restore proceeded without a safety backup because it could not be created.`,
      });
    }
  }

  if (task) task.step('Extracting backup…');
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

    // The displaced world stays a SIBLING of serverDir (same filesystem, so the
    // rename is atomic) rather than under data/tmp: boot wipes all of tmp/, so a
    // crash between the two swap renames would have destroyed the only copy of
    // the live world along with its recovery path. Under data/servers/ a crashed
    // swap leaves ".restore-displaced-*" on disk for manual recovery instead.
    // Server enumeration is DB-driven, so the extra directory is inert.
    // Dash-free suffix (base36 time) so boot recovery can split serverId from
    // suffix unambiguously even when the serverId itself contains dashes.
    const oldDir = dataPath('servers', `.restore-displaced-${serverId}-${Date.now().toString(36)}`);
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

  recordEvent({ serverId, actor, type: 'backup-restored', summary: `Restored backup ${backup.filename}.` });
  indexer.scheduleScan();
  return { ok: true };
}

// Backups that retention must not delete because they are in use (see planPrune).
// Today that is the archive a restore is reading: the restore's own safety
// backup runs a retention pass before the archive is extracted, and an old
// backup - the usual thing to restore - is exactly what retention removes.
/** @type {Set<string>} */
const protectedFromPrune = new Set();

async function restoreBackupImpl(serverId, backupId, opts = {}) {
  protectedFromPrune.add(backupId);
  try {
    return await restoreBackupCore(serverId, backupId, opts);
  } finally {
    protectedFromPrune.delete(backupId);
  }
}

const restoreBackup = guardOp('restore', restoreBackupImpl);

// Backups read the live server dir; a concurrent recreate/delete/restore could
// reshuffle files mid-archive and record a structurally-valid but incomplete
// zip. External callers (scheduler, the manual/pre-update routes) go through
// the op lock like every other lifecycle mutation. Callers that are ALREADY
// inside a guarded op (restore's safety backup, world install/reset) use
// createBackupUnguarded, or the lock would 409 against itself.
const createBackup = guardOp('backup', createBackupImpl);

async function deleteBackup(backupId, { actor = 'system' } = {}) {
  const backup = db.get('SELECT * FROM backups WHERE id = ?', backupId);
  if (!backup) return { freedBytes: 0 };
  db.run('DELETE FROM backups WHERE id = ?', backupId);
  await fsp.rm(dataPath(backup.rel_path), { force: true });
  recordEvent({
    serverId: backup.server_id,
    actor,
    type: 'backup-deleted',
    summary: `Backup deleted: ${backup.filename} (${(backup.size_bytes / 1024 ** 3).toFixed(2)} GB freed).`,
  });
  return { freedBytes: backup.size_bytes };
}

/**
 * A person deleting a backup by hand: refused while it is being restored (the
 * restore would fail at extraction). Retention never plans such a backup.
 */
async function deleteBackupByUser(backupId, opts = {}) {
  if (protectedFromPrune.has(backupId)) {
    throw httpError(409, 'This backup is being restored. Delete it after the restore finishes.');
  }
  return deleteBackup(backupId, opts);
}

/** Accept a friendly display name - flat filename only, no path tricks. */
function cleanBackupName(raw) {
  const name = String(raw || '').trim();
  if (!name || name.length > 120) {
    throw httpError(400, 'Use a name between 1 and 120 characters.');
  }
  if (/[\\/]/.test(name)) throw httpError(400, 'Backup names cannot contain path separators.');
  if (name === '.' || name === '..' || /[\u0000-\u001f\u007f]/.test(name)) {
    throw httpError(400, 'That backup name is not allowed.');
  }
  return name;
}

/**
 * Rename a backup's archive: the on-disk file AND its filename/rel_path DB
 * row move together, so restore/download/retention keep working untouched.
 * Returns the updated row (id, filename, size_bytes, reason, created_at, …).
 */
async function renameBackup(backupId, newName, { actor = 'system' } = {}) {
  const backup = db.get('SELECT * FROM backups WHERE id = ?', backupId);
  if (!backup) throw httpError(404, 'Backup not found');
  const name = cleanBackupName(newName);
  if (name === backup.filename) return backup;

  const abs = dataPath(backup.rel_path);
  if (!fs.existsSync(abs)) throw httpError(404, 'Backup archive is missing on disk');
  const targetRel = `backups/${backup.server_id}/${name}`;
  const target = dataPath(targetRel);
  if (fs.existsSync(target)) throw httpError(409, `A backup named "${name}" already exists here`);

  await fsp.rename(abs, target);
  try {
    db.run('UPDATE backups SET filename = ?, rel_path = ? WHERE id = ?', name, targetRel, backupId);
  } catch (err) {
    // Keep the row and the file in agreement: undo the move rather than leave a
    // row that points at a name that no longer exists.
    await fsp.rename(target, abs).catch(() => {});
    throw err;
  }
  const updated = db.get('SELECT * FROM backups WHERE id = ?', backupId);
  recordEvent({
    serverId: backup.server_id,
    actor,
    type: 'backup-renamed',
    summary: `Backup renamed: ${backup.filename} → ${name}.`,
    details: { from: backup.filename, to: name },
  });
  return updated;
}

/**
 * Which backups retention would delete for one server under `cfg`, in order,
 * without deleting anything. Keeps the newest N per reason; 'pre-restore'
 * (restore/world-reset safety snapshots) has its own small bucket so it can't
 * evict user-created 'manual' backups. The three passes run against an
 * in-memory copy of the server's rows so each pass sees what the previous one
 * removed. A planned row counts as gone even if its delete later fails (the
 * failure is logged), so one stuck file never makes a pass delete extra
 * backups to compensate. deleteBackup drops the row before the file, so a file
 * left behind that way is an orphan for the storage cleanup, not a retry. Backups in use (protectedFromPrune)
 * are never planned. The settings preview and pruneRetention both use this, so
 * a preview can't drift from what happens.
 * @param {string} serverId
 * @param {{ keepScheduled: number, keepPreUpdate: number, keepManual: number, keepPreRestore: number, maxAgeDays: number, maxTotalGb: number }} cfg
 * @returns {{ id: string, sizeBytes: number, reason: string, createdAt: string }[]}
 */
function planPrune(serverId, cfg) {
  // id DESC as a tiebreaker: created_at has 1-second resolution and a safety
  // backup often lands in the same second as another, so "the Nth oldest" must
  // not be left to insertion-order luck. `old` is computed by SQLite so the age
  // pass compares timestamps exactly as it always has.
  let rows = db.all(
    `SELECT id, reason, size_bytes, created_at, (created_at < datetime('now', ?)) AS old
       FROM backups WHERE server_id = ? ORDER BY created_at DESC, id DESC`,
    `-${cfg.maxAgeDays || 0} days`,
    serverId
  );
  const doomed = [];
  const drop = (r) => {
    if (protectedFromPrune.has(r.id)) return; // in use - stays, and keeps counting
    doomed.push({ id: r.id, sizeBytes: r.size_bytes || 0, reason: r.reason, createdAt: r.created_at });
    rows = rows.filter((x) => x.id !== r.id);
  };

  // 1) Per-reason count caps.
  const buckets = [
    ['scheduled', cfg.keepScheduled],
    ['pre-update', cfg.keepPreUpdate],
    ['manual', cfg.keepManual],
    ['pre-restore', cfg.keepPreRestore], // restore / world-reset safety snapshots
  ];
  for (const [reason, keep] of buckets) {
    for (const r of rows.filter((x) => x.reason === reason).slice(keep)) drop(r);
  }

  // The newest backup overall is never removed by the age or size passes below -
  // a server must not be left with zero backups just because it went quiet or
  // its worlds grew.
  const keepId = rows[0]?.id;

  // 2) Age ceiling (opt-in; 0 = off).
  if (cfg.maxAgeDays > 0) {
    for (const r of rows.filter((x) => x.id !== keepId && x.old)) drop(r);
  }

  // 3) Total-size ceiling (opt-in; 0 = off). Delete oldest-first until under the
  // cap, but sacrifice the automatic safety snapshots ('pre-restore') before any
  // backup a person asked for.
  if (cfg.maxTotalGb > 0) {
    const capBytes = cfg.maxTotalGb * 1024 ** 3;
    let total = rows.reduce((sum, r) => sum + (r.size_bytes || 0), 0);
    const rank = (r) => (r.reason === 'pre-restore' ? 0 : r.reason === 'scheduled' ? 1 : 2);
    // Oldest first, then stable-sorted by rank (keeps oldest-first within a rank).
    const order = [...rows].reverse().sort((a, b) => rank(a) - rank(b));
    for (const r of order) {
      if (total <= capBytes) break;
      if (r.id === keepId) continue;
      if (protectedFromPrune.has(r.id)) {
        // In use, so it stays for now - but count it as on its way out. Deleting
        // other backups to make room around it would lose them for an archive
        // the next prune removes anyway.
        total -= r.size_bytes || 0;
        continue;
      }
      drop(r);
      total -= r.size_bytes || 0;
    }
  }

  return doomed;
}

/**
 * Delete backups past the retention limit. Each deletion is isolated (one
 * failure - a transient DB busy error, an EACCES on the file - must not stop
 * the rest from being pruned) and the whole function never throws: it's
 * usually called right after a backup has already been successfully created
 * and recorded, so a pruning failure here must not surface as "backup
 * failed" (misleading the operator) or silently abort retention entirely
 * (letting old backups accumulate and eventually cause a REAL failure via
 * the free-space preflight).
 */
async function pruneRetention(serverId, { actor = 'system', onlyIds = null } = {}) {
  let deleted = 0;
  for (const b of planPrune(serverId, backupRetention.effective(serverId))) {
    if (onlyIds && !onlyIds.has(b.id)) continue; // never more than a preview showed
    try {
      await deleteBackup(b.id, { actor });
      deleted++;
    } catch (err) {
      logger.error('Retention could not delete an old backup.', { serverId, backupId: b.id, err: serializeError(err) });
    }
  }
  return deleted;
}

/**
 * What a retention change would remove right now, across `serverIds`, if each
 * server ran under `cfgFor(serverId)`. Nothing is deleted.
 * @param {string[]} serverIds
 * @param {(serverId: string) => Parameters<typeof planPrune>[1]} cfgFor
 */
function previewRetention(serverIds, cfgFor) {
  let backups = 0;
  let bytes = 0;
  const ids = [];
  const byServer = [];
  for (const id of serverIds) {
    const plan = planPrune(id, cfgFor(id));
    if (!plan.length) continue;
    const serverBytes = plan.reduce((sum, b) => sum + b.sizeBytes, 0);
    const byReason = {};
    for (const b of plan) byReason[b.reason] = (byReason[b.reason] || 0) + 1;
    byServer.push({
      id,
      name: db.get('SELECT display_name FROM servers WHERE id = ?', id)?.display_name || id,
      backups: plan.length,
      bytes: serverBytes,
      byReason,
      oldest: plan.reduce((min, b) => (b.createdAt < min ? b.createdAt : min), plan[0].createdAt),
      // Over its limits already under the SAVED policy: an earlier "from the
      // next backup" left these, and this change isn't what removes them.
      alreadyOver: planPrune(id, backupRetention.effective(id)).length > 0,
    });
    backups += plan.length;
    bytes += serverBytes;
    for (const b of plan) ids.push(b.id);
  }
  // ids go back with "Remove now", which then deletes nothing outside them.
  return { backups, bytes, servers: byServer.length, ids, byServer };
}

// "Remove now" from the retention settings runs under the per-server op lock,
// so it never deletes an archive a restore, world reset or backup is using.
// The op name shows in the 409 another action gets meanwhile ("a backup cleanup
// operation is already in progress"), so it is worded for people.
const pruneRetentionGuarded = guardOp('backup cleanup', pruneRetention);

/**
 * Apply each server's current retention policy now instead of after its next
 * backup. A server busy with another action is skipped (it prunes after its
 * next backup as usual) and reported, never waited on or failed.
 * With `onlyIds` (the ids a preview showed), deletes only backups that are
 * both in that list and still over the limit - never more than was shown.
 * @param {string[]} serverIds
 * @param {{ actor?: string, onlyIds?: Set<string> | null }} [opts]
 * @returns {Promise<{ deleted: number, skipped: string[] }>}
 */
async function applyRetention(serverIds, { actor = 'system', onlyIds = null } = {}) {
  let deleted = 0;
  const skipped = [];
  for (const id of serverIds) {
    // Only servers with something to delete take the lock, so a panel-wide apply
    // never makes an idle server's scheduled backup or Start answer 409.
    const plan = planPrune(id, backupRetention.effective(id)).filter((b) => !onlyIds || onlyIds.has(b.id));
    if (!plan.length) continue;
    try {
      deleted += await pruneRetentionGuarded(id, { actor, onlyIds });
    } catch (err) {
      if (err && err.status === 409) skipped.push(id);
      else throw err;
    }
  }
  if (deleted || skipped.length)
    logger.info('Applied backup retention now.', { actor, deleted, skipped: skipped.length });
  return { deleted, skipped };
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
// implementation (src/utils/zip.js), re-exported here because the
// restore path and its tests have always reached for `backups.extractZip`.
const { extractZip } = require('../utils/zip');

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

module.exports = {
  createBackup,
  createBackupUnguarded: createBackupImpl,
  restoreBackup,
  deleteBackup,
  deleteBackupByUser,
  renameBackup,
  pruneRetention,
  planPrune,
  previewRetention,
  applyRetention,
  extractZip,
  zipDirectory,
};
