'use strict';

// Cron scheduler (croner): per-server tasks (restart/backup/rcon/stop/start)
// and global maintenance (update check, storage rescan, tmp cleanup, backup
// pruning). Every firing is a history event; next-run times come from croner.

const httpError = require('../utils/httpError');
const { Cron } = require('croner');
const { nanoid } = require('nanoid');
const db = require('../db');
const { recordEvent } = require('../events');

const jobs = new Map(); // schedule id -> Cron

const TASK_TYPES = {
  restart: { label: 'Restart server', serverScoped: true },
  backup: { label: 'Backup', serverScoped: true },
  stop: { label: 'Stop server', serverScoped: true },
  start: { label: 'Start server', serverScoped: true },
  rcon: { label: 'Run command', serverScoped: true },
  'update-check': { label: 'Update check', serverScoped: false },
  'storage-scan': { label: 'Storage re-scan', serverScoped: false },
  'tmp-clean': { label: 'Purge tmp', serverScoped: false },
};

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
      await require('./backups').createBackup(schedule.server_id, { reason: 'scheduled', actor });
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
        summary: `Scheduled RCON: ${payload.command}`,
        details: { output: out.slice(0, 1000) },
      });
      break;
    }
    case 'update-check':
      await require('../updates/checker').checkAll({ actor });
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
    default:
      throw new Error(`Unknown task type ${schedule.task_type}`);
  }
}

function schedule(job) {
  stopJob(job.id);
  if (!job.enabled) return;
  try {
    // protect: true — a still-running invocation blocks the next firing
    // instead of overlapping it (e.g. hour-long backups on a 5-min cron).
    const cron = new Cron(job.cron, { catch: true, protect: true }, async () => {
      db.run("UPDATE schedules SET last_run_at = datetime('now') WHERE id = ?", job.id);
      recordEvent({
        serverId: job.server_id || null,
        actor: 'scheduler',
        type: 'schedule-fired',
        summary: `Scheduled task fired: ${TASK_TYPES[job.task_type]?.label || job.task_type}`,
      });
      try {
        await runTask(job);
      } catch (err) {
        recordEvent({
          serverId: job.server_id || null,
          actor: 'scheduler',
          type: 'schedule-failed',
          summary: `Scheduled ${job.task_type} failed: ${err.message}`,
        });
      }
    });
    jobs.set(job.id, cron);
  } catch (err) {
    console.error(`[scheduler] invalid cron "${job.cron}" for ${job.id}: ${err.message}`);
  }
}

function stopJob(id) {
  const existing = jobs.get(id);
  if (existing) {
    existing.stop();
    jobs.delete(id);
  }
}

function startScheduler() {
  seedGlobalDefaults();
  for (const job of db.all('SELECT * FROM schedules')) schedule(job);
  console.log(`[scheduler] ${jobs.size} job(s) armed`);
}

/** Global maintenance tasks exist from first boot; user can disable/edit. */
function seedGlobalDefaults() {
  const defaults = [
    { task_type: 'update-check', cron: '0 3 * * *' },
    { task_type: 'storage-scan', cron: '0 */6 * * *' },
    { task_type: 'tmp-clean', cron: '30 4 * * *' },
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
  new Cron(cron); // validates; throws on bad expression
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
    summary: `Schedule created: ${TASK_TYPES[taskType].label} (${cron})`,
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
    summary: `Schedule ${enabled ? 'enabled' : 'disabled'}: ${job?.task_type}`,
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
      summary: `Schedule deleted: ${job.task_type}`,
    });
}

function listSchedules() {
  return db.all('SELECT * FROM schedules ORDER BY server_id IS NULL, server_id, task_type').map((s) => {
    let next = null;
    let nextMs = null;
    try {
      const nextRun = new Cron(s.cron).nextRun();
      if (nextRun) {
        next = nextRun.toISOString().replace('T', ' ').slice(0, 16);
        nextMs = nextRun.getTime();
      }
    } catch {
      /* invalid cron stays null */
    }
    // last_run_at is SQLite datetime('now') — UTC without a zone marker.
    const lastRunMs = s.last_run_at ? Date.parse(s.last_run_at.replace(' ', 'T') + 'Z') : null;
    const server = s.server_id ? db.get('SELECT display_name FROM servers WHERE id = ?', s.server_id) : null;
    return {
      id: s.id,
      serverId: s.server_id,
      server: server ? server.display_name : '— global —',
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

module.exports = { startScheduler, createSchedule, setEnabled, deleteSchedule, listSchedules, TASK_TYPES };
