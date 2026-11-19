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
const tasks = require('./tasks');
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
  // Fleet tasks: act on every server, so they are admin-only (a per-server
  // grant cannot cover "all"). Each server is handled on its own - one failure
  // does not stop the rest - and any failure fails the run at the end.
  'backup-all': { label: 'Back up all servers', serverScoped: false, adminOnly: true },
  'restart-all': { label: 'Restart all running servers', serverScoped: false, adminOnly: true },
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
 * @param {any} [task] the tray task this run reports to, if it is shown there
 */
async function runTaskWithRetry(job, { retryMs = BUSY_RETRY_MS, maxWaitMs = BUSY_MAX_WAIT_MS } = {}, task = null) {
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
        return await runTask(current, task);
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
        if (task) task.step('Waiting for the server to finish another action…');
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
    await runTracked(job, retry);
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

// Servers a fleet restart acts on. Mid-boot servers (starting, stalled) are left
// alone: restarting one only restarts the boot it is already in.
const FLEET_RESTART_STATUSES = new Set(['running', 'unhealthy']);

/**
 * Run `fn` for each server in turn (backups and restarts are heavy, so never in
 * parallel), isolating failures. Throws once at the end naming how many failed.
 * @param {string} verb  past-tense-free label for the error, e.g. "Backup"
 * @param {Array<{id: string, display_name: string}>} list
 * @param {(server: any) => Promise<void>} fn
 * @param {{ step: (label: string) => void } | null} task
 */
async function forEachServer(verb, list, fn, task) {
  const failed = [];
  for (const server of list) {
    if (task) task.step(`${verb} ${server.display_name}…`);
    try {
      await fn(server);
    } catch (err) {
      failed.push(server.display_name);
      logger.warn('A fleet task failed for one server.', {
        serverId: server.id,
        verb,
        err: serializeError(err, { includeStack: false }),
      });
    }
  }
  if (failed.length) {
    throw new Error(`${verb} failed for ${failed.length} of ${list.length} servers: ${failed.join(', ')}.`);
  }
}

async function backupAllServers({ actor, task, shrink = false }) {
  const servers = require('./servers');
  const backups = require('./backups');
  await forEachServer(
    'Backing up',
    servers.listServers(),
    async (server) => {
      if (await backups.isScheduledBackupRedundant(server.id)) return; // stopped and already backed up
      const backup = await backups.createBackup(server.id, { reason: 'scheduled', actor, task, shrinkAfter: shrink });
      await backups.verifyBackup(backup.id, { actor, task });
    },
    task
  );
}

async function restartRunningServers({ actor, task }) {
  const servers = require('./servers');
  await forEachServer(
    'Restarting',
    servers.listServers().filter((s) => FLEET_RESTART_STATUSES.has(s.status)),
    (server) => servers.restartServer(server.id, { actor }),
    task
  );
}

async function runTask(schedule, task = null) {
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
    case 'backup': {
      const backups = require('./backups');
      if (await backups.isScheduledBackupRedundant(schedule.server_id)) {
        logger.info('Skipped a scheduled backup because the server is stopped and already backed up.', {
          serverId: schedule.server_id,
        });
        break;
      }
      const backup = await backups.createBackup(schedule.server_id, {
        reason: 'scheduled',
        actor,
        task,
        // Opt-in per schedule: trim rarely-visited chunks after the archive is
        // written. Only runs when the server is stopped (see createBackupImpl).
        shrinkAfter: Boolean(payload.shrink),
      });
      // Read the fresh archive back end to end. A damaged one throws, so the
      // run is marked failed and the operator hears about it now, not at restore time.
      await backups.verifyBackup(backup.id, { actor, task });
      break;
    }
    case 'backup-all':
      await backupAllServers({ actor, task, shrink: Boolean(payload.shrink) });
      break;
    case 'restart-all':
      await restartRunningServers({ actor, task });
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
      if (task) task.step('Checking for updates…');
      await require('../updates/checker').checkAll({ actor });
      if (task) task.step('Applying automatic updates…');
      // Only the scheduled daily check triggers auto-updates - the manual
      // "check now" buttons never apply anything (#24; the settings-page
      // policy label promises exactly this).
      await require('../updates/upgrade').runAutoUpgrades({ actor });
      break;
    case 'storage-scan':
      if (task) task.step('Scanning storage…');
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

// Scheduled jobs a person would wonder about show in the top-bar task tray. The
// once-a-minute housekeeping jobs (temp files, ban sweep, metadata backfill,
// rcon) stay out of it so the tray does not flicker all day.
const TRAY_VERBS = { restart: 'Restarting', stop: 'Stopping', start: 'Starting', backup: 'Backing up' };
const TRAY_TITLES = {
  'update-check': 'Checking for updates…',
  'storage-scan': 'Scanning storage…',
  'backup-all': 'Backing up all servers (scheduled)…',
  'restart-all': 'Restarting all running servers (scheduled)…',
};

/**
 * @param {{ id: string, task_type: string, server_id?: string | null, payload_json?: string }} job a schedules row
 * @param {{ retryMs?: number, maxWaitMs?: number }} [retry]
 */
function runTracked(job, retry) {
  const server = job.server_id ? db.get('SELECT display_name FROM servers WHERE id = ?', job.server_id) : null;
  const verb = TRAY_VERBS[job.task_type];
  const title = verb && server ? `${verb} ${server.display_name} (scheduled)…` : TRAY_TITLES[job.task_type];
  if (!title) return runTaskWithRetry(job, retry);
  // One tray entry covers every busy retry, so waiting does not flash a failure.
  return tasks.track(title, { serverId: job.server_id || null, actor: 'scheduler' }, (task) =>
    runTaskWithRetry(job, retry, task)
  );
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
  const rows = db.all('SELECT * FROM schedules ORDER BY server_id IS NULL, server_id, task_type');
  const serverIds = [...new Set(rows.map((s) => s.server_id).filter(Boolean))];
  const serverNames = new Map();
  if (serverIds.length) {
    const ph = serverIds.map(() => '?').join(',');
    for (const r of db.all(`SELECT id, display_name FROM servers WHERE id IN (${ph})`, ...serverIds))
      serverNames.set(r.id, r.display_name);
  }
  return rows.map((s) => {
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
    const server = s.server_id ? (serverNames.get(s.server_id) ?? null) : null;
    return {
      id: s.id,
      serverId: s.server_id,
      // serverNames maps id -> display name. A schedule whose server row is gone
      // shows its id, not "global", so it is not mistaken for a panel-wide one.
      server: s.server_id ? (server ?? s.server_id) : '- global -',
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
  runTask,
  TASK_TYPES,
};
