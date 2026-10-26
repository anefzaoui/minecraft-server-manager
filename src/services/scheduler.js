'use strict';

// Cron scheduler (croner): per-server tasks (restart/backup/rcon/stop/start)
// and global maintenance (update check, storage rescan, tmp cleanup, backup
// pruning). Every firing is a history event; next-run times come from croner.

const path = require('node:path');
const httpError = require('../utils/httpError');
const { Cron } = require('croner');
const { nanoid } = require('nanoid');
const db = require('../db');
const { recordEvent, lifecycleActionSince } = require('../events');
const { getTimezone } = require('./settings');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

const jobs = new Map(); // schedule id -> Cron

// `capability` is the per-server permission a server-scoped task needs
// (services/permissions.js); panel-global tasks follow the global role.
const TASK_TYPES = {
  restart: { label: 'Restart server', serverScoped: true, capability: 'power' },
  backup: { label: 'Backup', serverScoped: true, capability: 'backups' },
  stop: { label: 'Stop server', serverScoped: true, capability: 'power' },
  start: { label: 'Start server', serverScoped: true, capability: 'power' },
  rcon: { label: 'Run command', serverScoped: true, capability: 'console' },
  'update-check': { label: 'Update check', serverScoped: false },
  'storage-scan': { label: 'Storage re-scan', serverScoped: false },
  'tmp-clean': { label: 'Clear temporary files', serverScoped: false },
  'ban-expiry-sweep': { label: 'Ban expiry sweep', serverScoped: false },
  'content-meta-backfill': { label: 'Content metadata backfill', serverScoped: false },
};

// A scheduled backup or start refused only because another action holds its
// server (a restore, a backup cleanup, a port change) tries again every minute
// until that action is done, for up to 30 minutes, instead of losing this run.
// Both are safe to repeat. Restart and stop are not retried: a restart that
// collided with someone's restart has in effect happened and repeating it would
// kick players twice, and a stop or restart that met a backup or restore should
// not land unannounced minutes later. They run again at their next time.
// Before each retry the schedule must still exist and be on.
// Any other failure fails at once, as before.
const RETRY_WHEN_BUSY = new Set(['backup', 'start']);
// Schedules whose last firing is still waiting to retry. A new firing of the
// same schedule (or one re-armed meanwhile, e.g. after a time zone change) is
// skipped, so one schedule never runs twice in parallel.
/** @type {Set<string>} */
const waitingToRetry = new Set();
const BUSY_RETRY_MS = 60_000;
const BUSY_MAX_WAIT_MS = 30 * 60_000;

/**
 * @param {{ id: string, task_type: string, server_id?: string | null, payload_json?: string }} job a schedules row
 * @param {{ retryMs?: number, maxWaitMs?: number }} [opts]
 */
async function runTaskWithRetry(job, { retryMs = BUSY_RETRY_MS, maxWaitMs = BUSY_MAX_WAIT_MS } = {}) {
  const firedAt = Date.now();
  const giveUpAt = firedAt + maxWaitMs;
  let current = job; // re-read before each retry: the schedule may have been edited
  let marked = false; // only the run that marked the schedule as waiting clears it
  try {
    return await retryLoop();
  } finally {
    if (marked) waitingToRetry.delete(job.id);
  }
  async function retryLoop() {
    for (let attempt = 0; ; attempt++) {
      try {
        return await runTask(current);
      } catch (err) {
        const busy = err && err.code === 'BUSY';
        if (!busy || !RETRY_WHEN_BUSY.has(current.task_type) || Date.now() + retryMs > giveUpAt) throw err;
        if (attempt === 0) {
          logger.info('A scheduled task found its server busy and will retry.', {
            scheduleId: job.id,
            taskType: job.task_type,
            serverId: job.server_id || undefined,
          });
        }
        waitingToRetry.add(job.id);
        marked = true;
        await new Promise((resolve) => setTimeout(resolve, retryMs).unref());
        const still = db.get('SELECT * FROM schedules WHERE id = ?', job.id);
        if (!still || !still.enabled) return; // turned off or deleted while waiting
        current = still;
        // A start that waited must not undo what a person did meanwhile (a Stop
        // pressed while the backup that blocked it was running, say).
        if (current.task_type === 'start' && current.server_id && lifecycleActionSince(current.server_id, firedAt)) {
          logger.debug('Dropped a scheduled start because the server was stopped or started meanwhile.', {
            scheduleId: job.id,
            serverId: current.server_id,
          });
          return;
        }
      }
    }
  }
}

/**
 * One firing of a schedule: record it, run it (with busy retries), record a failure.
 * @param {{ id: string, task_type: string, server_id?: string | null, payload_json?: string }} job a schedules row
 * @param {{ retryMs?: number, maxWaitMs?: number }} [retry] for tests
 */
async function fireJob(job, retry) {
  if (waitingToRetry.has(job.id)) {
    logger.debug('Skipped a scheduled task because its previous run is still waiting to retry.', {
      scheduleId: job.id,
    });
    return;
  }
  db.run("UPDATE schedules SET last_run_at = datetime('now') WHERE id = ?", job.id);
  recordEvent({
    serverId: job.server_id || null,
    actor: 'scheduler',
    type: 'schedule-fired',
    summary: `Scheduled task fired: ${TASK_TYPES[job.task_type]?.label || job.task_type}.`,
  });
  logger.info('A scheduled task fired.', {
    scheduleId: job.id,
    taskType: job.task_type,
    serverId: job.server_id || undefined,
  });
  try {
    await runTaskWithRetry(job, retry);
  } catch (err) {
    recordEvent({
      serverId: job.server_id || null,
      actor: 'scheduler',
      type: 'schedule-failed',
      summary: `Scheduled ${job.task_type} failed: ${err.message}.`,
    });
    logger.error('A scheduled task failed.', {
      scheduleId: job.id,
      taskType: job.task_type,
      serverId: job.server_id || undefined,
      err: serializeError(err),
    });
  }
}

async function runTask(schedule) {
  const payload = JSON.parse(schedule.payload_json || '{}');
  const actor = 'scheduler';
  const servers = require('./servers');
  switch (schedule.task_type) {
    case 'restart':
      await servers.restartServer(schedule.server_id, { actor });
      break;
    case 'stop':
      await servers.stopServer(schedule.server_id, { actor });
      break;
    case 'start':
      await servers.startServer(schedule.server_id, { actor });
      break;
    case 'backup':
      await require('./backups').createBackup(schedule.server_id, {
        reason: 'scheduled',
        actor,
        // Opt-in per schedule: trim rarely-visited chunks after the archive is
        // written. Only runs when the server is stopped (see createBackupImpl).
        shrinkAfter: Boolean(payload.shrink),
      });
      break;
    case 'rcon': {
      const { execCapture } = require('../docker/containers');
      // '--' stops rcon-cli parsing command words that start with '-' as flags.
      const out = await execCapture(schedule.server_id, [
        'rcon-cli',
        '--',
        ...String(payload.command || 'list').split(/\s+/),
      ]);
      recordEvent({
        serverId: schedule.server_id,
        actor,
        type: 'rcon',
        summary: `Scheduled RCON: ${payload.command}.`,
        details: { output: out.slice(0, 1000) },
      });
      break;
    }
    case 'update-check':
      await require('../updates/checker').checkAll({ actor });
      // Only the scheduled daily check triggers auto-updates - the manual
      // "check now" buttons never apply anything (#24; the settings-page
      // policy label promises exactly this).
      await require('../updates/upgrade').runAutoUpgrades({ actor });
      break;
    case 'storage-scan':
      await require('../storage/indexer').scan();
      await require('../storage/indexer').enforceStrictQuotas();
      break;
    case 'tmp-clean':
      // Scheduled path only clears entries older than 24h so in-flight
      // downloads/uploads survive the 04:30 sweep (boot still wipes fully).
      require('../storage/dataRoot').cleanTmp({ olderThanMs: 24 * 60 * 60 * 1000 });
      require('./auth').pruneExpiredSessions();
      break;
    case 'ban-expiry-sweep':
      await require('./players').sweepExpiredBans();
      break;
    case 'content-meta-backfill':
      await require('./contentIcons').backfillContentMeta();
      break;
    default:
      throw new Error(`Unknown task type ${schedule.task_type}`);
  }
}

function schedule(job) {
  stopJob(job.id);
  if (!job.enabled) return;
  try {
    // protect: true - a still-running invocation blocks the next firing
    // instead of overlapping it (e.g. hour-long backups on a 5-min cron).
    // timezone: without it croner evaluates the expression in the SYSTEM
    // timezone (UTC in most containers), not the operator's configured one -
    // "0 3 * * *" would then fire at 3am UTC, not 3am in Settings.
    const cron = new Cron(job.cron, { catch: true, protect: true, timezone: getTimezone() }, () => fireJob(job));
    jobs.set(job.id, cron);
  } catch (err) {
    logger.error('A schedule has an invalid cron expression and was not armed.', {
      scheduleId: job.id,
      cron: job.cron,
      err: serializeError(err, { includeStack: false }),
    });
  }
}

function stopJob(id) {
  const existing = jobs.get(id);
  if (existing) {
    existing.stop();
    jobs.delete(id);
  }
}

/** Re-arm every schedule against the CURRENT timezone - call after it changes
 *  in Settings, or already-running jobs keep firing on the old one until the
 *  panel restarts. */
function rearmAll() {
  for (const job of db.all('SELECT * FROM schedules')) schedule(job);
}

function startScheduler() {
  seedGlobalDefaults();
  for (const job of db.all('SELECT * FROM schedules')) schedule(job);
  logger.info('Armed the scheduler.', { jobs: jobs.size });
}

/** Global maintenance tasks exist from first boot; user can disable/edit. */
function seedGlobalDefaults() {
  const defaults = [
    { task_type: 'update-check', cron: '0 3 * * *' },
    { task_type: 'storage-scan', cron: '0 */6 * * *' },
    { task_type: 'tmp-clean', cron: '30 4 * * *' },
    { task_type: 'ban-expiry-sweep', cron: '*/15 * * * *' },
    { task_type: 'content-meta-backfill', cron: '20 3 * * *' },
  ];
  for (const d of defaults) {
    const exists = db.get('SELECT 1 AS x FROM schedules WHERE task_type = ? AND server_id IS NULL', d.task_type);
    if (!exists) {
      db.run(
        'INSERT INTO schedules (id, server_id, task_type, cron, payload_json, enabled) VALUES (?, NULL, ?, ?, ?, 1)',
        `sch_${nanoid(8)}`,
        d.task_type,
        d.cron,
        '{}'
      );
    }
  }
}

function createSchedule({ serverId = null, taskType, cron, payload = {}, enabled = true }, { actor = 'system' } = {}) {
  if (!TASK_TYPES[taskType]) throw httpError(400, `Unknown task type ${taskType}`);
  try {
    new Cron(cron, { timezone: getTimezone() }); // validates; throws on a bad expression
  } catch {
    // croner's error is a plain Error, which the JSON error handler would
    // report as a generic 500 - this is user input, so say what is wrong.
    throw httpError(
      400,
      `"${cron}" is not a valid schedule. Use five cron fields such as "0 4 * * *" (minute hour day month weekday).`
    );
  }
  const id = `sch_${nanoid(8)}`;
  db.run(
    'INSERT INTO schedules (id, server_id, task_type, cron, payload_json, enabled) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    serverId,
    taskType,
    cron,
    JSON.stringify(payload),
    enabled ? 1 : 0
  );
  const job = db.get('SELECT * FROM schedules WHERE id = ?', id);
  schedule(job);
  recordEvent({
    serverId,
    actor,
    type: 'schedule-created',
    summary: `Schedule created: ${TASK_TYPES[taskType].label} (${cron}).`,
  });
  return listSchedules().find((s) => s.id === id);
}

function setEnabled(id, enabled, { actor = 'system' } = {}) {
  db.run('UPDATE schedules SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id);
  const job = db.get('SELECT * FROM schedules WHERE id = ?', id);
  if (job) schedule(job);
  recordEvent({
    serverId: job?.server_id || null,
    actor,
    type: 'schedule-toggled',
    summary: `Schedule ${enabled ? 'enabled' : 'disabled'}: ${job?.task_type}.`,
  });
}

function deleteSchedule(id, { actor = 'system' } = {}) {
  const job = db.get('SELECT * FROM schedules WHERE id = ?', id);
  stopJob(id);
  db.run('DELETE FROM schedules WHERE id = ?', id);
  if (job)
    recordEvent({
      serverId: job.server_id,
      actor,
      type: 'schedule-deleted',
      summary: `Schedule deleted: ${job.task_type}.`,
    });
}

function listSchedules() {
  return db.all('SELECT * FROM schedules ORDER BY server_id IS NULL, server_id, task_type').map((s) => {
    let next = null;
    let nextMs = null;
    try {
      const nextRun = new Cron(s.cron, { timezone: getTimezone() }).nextRun();
      if (nextRun) {
        next = nextRun.toISOString().replace('T', ' ').slice(0, 16);
        nextMs = nextRun.getTime();
      }
    } catch {
      /* invalid cron stays null */
    }
    // last_run_at is SQLite datetime('now') - UTC without a zone marker.
    const lastRunMs = s.last_run_at ? Date.parse(s.last_run_at.replace(' ', 'T') + 'Z') : null;
    const server = s.server_id ? db.get('SELECT display_name FROM servers WHERE id = ?', s.server_id) : null;
    return {
      id: s.id,
      serverId: s.server_id,
      server: server ? server.display_name : '- global -',
      task: TASK_TYPES[s.task_type]?.label || s.task_type,
      taskType: s.task_type,
      cron: s.cron,
      payload: JSON.parse(s.payload_json || '{}'),
      enabled: Boolean(s.enabled),
      lastRun: s.last_run_at,
      lastRunMs: Number.isFinite(lastRunMs) ? lastRunMs : null,
      next,
      nextMs,
    };
  });
}

module.exports = {
  startScheduler,
  createSchedule,
  setEnabled,
  deleteSchedule,
  listSchedules,
  rearmAll,
  runTaskWithRetry,
  fireJob,
  TASK_TYPES,
};
