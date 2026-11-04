'use strict';

// What a scheduled firing actually does: every task type dispatches to the right
// service, each firing is a history event, a failing task is recorded (and does
// not kill the job), and the redundant-backup shortcut is honoured. Uses real
// every-second cron schedules against stubbed services.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate();
const db = require('../src/db');
const scheduler = require('../src/services/scheduler');

const servers = require('../src/services/servers');
const backups = require('../src/services/backups');
const containers = require('../src/docker/containers');
const checker = require('../src/updates/checker');
const upgrade = require('../src/updates/upgrade');
const indexer = require('../src/storage/indexer');
const dataRoot = require('../src/storage/dataRoot');
const authService = require('../src/services/auth');
const players = require('../src/services/players');
const contentIcons = require('../src/services/contentIcons');

const calls = [];
const rec =
  (name, ret) =>
  async (...args) => {
    calls.push([name, ...args]);
    return typeof ret === 'function' ? ret(...args) : ret;
  };

servers.restartServer = rec('restart');
servers.stopServer = rec('stop');
servers.startServer = rec('start');
backups.createBackup = rec('backup', { id: 'bk_sched' });
backups.verifyBackup = rec('verify', { ok: true });
let redundant = false;
backups.isScheduledBackupRedundant = rec('redundant?', () => redundant);
containers.execCapture = rec('rcon', 'There are 0 players');
checker.checkAll = rec('checkAll');
upgrade.runAutoUpgrades = rec('autoUpgrades');
indexer.scan = rec('scan');
indexer.enforceStrictQuotas = rec('quotas');
dataRoot.cleanTmp = (o) => calls.push(['cleanTmp', o]);
authService.pruneExpiredSessions = () => calls.push(['prune']);
players.sweepExpiredBans = rec('banSweep');
contentIcons.backfillContentMeta = rec('backfill');

const EVERY_SECOND = '* * * * * *';
const ids = [];
function seedServer(id) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, ?, 'PAPER', ?, ?, 'x', 1024, 1536)`,
    id,
    id,
    25700 + Math.floor(Math.random() * 500) * 2,
    26700 + Math.floor(Math.random() * 500) * 2
  );
}

test.after(() => {
  for (const id of ids) scheduler.deleteSchedule(id);
});

async function fireOnce(spec) {
  calls.length = 0;
  const s = scheduler.createSchedule({ cron: EVERY_SECOND, ...spec });
  ids.push(s.id);
  const t0 = Date.now();
  while (Date.now() - t0 < 3500) {
    await new Promise((r) => setTimeout(r, 50));
    if (calls.length) break;
  }
  scheduler.deleteSchedule(s.id);
  return s;
}

test('server tasks dispatch to the matching service with the scheduler as actor', async () => {
  seedServer('srv_sch_a');
  for (const [taskType, name] of [
    ['restart', 'restart'],
    ['stop', 'stop'],
    ['start', 'start'],
  ]) {
    await fireOnce({ serverId: 'srv_sch_a', taskType });
    assert.deepEqual(calls[0], [name, 'srv_sch_a', { actor: 'scheduler' }]);
  }
});

test('a backup task creates a scheduled backup and forwards the shrink option', async () => {
  redundant = false;
  await fireOnce({ serverId: 'srv_sch_a', taskType: 'backup', payload: { shrink: true } });
  const call = calls.find((c) => c[0] === 'backup');
  const { task, ...rest } = call[2];
  assert.deepEqual(rest, { reason: 'scheduled', actor: 'scheduler', shrinkAfter: true });
  assert.equal(typeof task.step, 'function', 'the backup reports progress into a tray task');
});

test('a scheduled backup is verified right after it is created', async () => {
  redundant = false;
  await fireOnce({ serverId: 'srv_sch_a', taskType: 'backup', payload: {} });
  const names = calls.map((c) => c[0]);
  assert.ok(names.indexOf('verify') > names.indexOf('backup'));
  assert.deepEqual(calls.find((c) => c[0] === 'verify').slice(0, 2), ['verify', 'bk_sched']);
  assert.equal(calls.find((c) => c[0] === 'verify')[2].actor, 'scheduler');
});

test('a scheduled backup is skipped when the server is stopped and already backed up', async () => {
  redundant = true;
  const s = scheduler.createSchedule({ serverId: 'srv_sch_a', taskType: 'backup', cron: EVERY_SECOND });
  ids.push(s.id);
  calls.length = 0;
  await new Promise((r) => setTimeout(r, 2200));
  scheduler.deleteSchedule(s.id);
  redundant = false;
  assert.ok(calls.some((c) => c[0] === 'redundant?'));
  assert.ok(!calls.some((c) => c[0] === 'backup'));
  assert.ok(!calls.some((c) => c[0] === 'verify'));
});

test('an rcon task runs rcon-cli with the words split, defaults to "list", and records the output', async () => {
  await fireOnce({ serverId: 'srv_sch_a', taskType: 'rcon', payload: { command: 'say hello world' } });
  assert.deepEqual(calls[0], ['rcon', 'srv_sch_a', ['rcon-cli', '--', 'say', 'hello', 'world']]);
  await fireOnce({ serverId: 'srv_sch_a', taskType: 'rcon' });
  assert.deepEqual(calls[0][2], ['rcon-cli', '--', 'list']);
  const ev = db.get("SELECT * FROM events WHERE server_id = 'srv_sch_a' AND type = 'rcon'");
  assert.ok(ev);
});

test('an rcon command that starts with a dash is not parsed as a flag', async () => {
  await fireOnce({ serverId: 'srv_sch_a', taskType: 'rcon', payload: { command: '-h' } });
  assert.deepEqual(calls[0][2], ['rcon-cli', '--', '-h']);
});

test('global maintenance tasks dispatch to their services', async () => {
  await fireOnce({ taskType: 'update-check' });
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['checkAll', 'autoUpgrades']
  );
  await fireOnce({ taskType: 'storage-scan' });
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['scan', 'quotas']
  );
  await fireOnce({ taskType: 'tmp-clean' });
  assert.deepEqual(calls, [['cleanTmp', { olderThanMs: 24 * 60 * 60 * 1000 }], ['prune']]);
  await fireOnce({ taskType: 'ban-expiry-sweep' });
  assert.equal(calls[0][0], 'banSweep');
  await fireOnce({ taskType: 'content-meta-backfill' });
  assert.equal(calls[0][0], 'backfill');
});

test('every firing is recorded, and last_run_at is stamped', async () => {
  calls.length = 0;
  const s = scheduler.createSchedule({ taskType: 'ban-expiry-sweep', cron: EVERY_SECOND });
  ids.push(s.id);
  const t0 = Date.now();
  while (!calls.length && Date.now() - t0 < 3500) await new Promise((r) => setTimeout(r, 50));
  const row = db.get('SELECT last_run_at FROM schedules WHERE id = ?', s.id);
  scheduler.deleteSchedule(s.id);
  assert.ok(row.last_run_at, 'last_run_at stamped');
  const fired = db.all("SELECT summary FROM events WHERE type = 'schedule-fired'");
  assert.ok(fired.some((e) => e.summary === 'Scheduled task fired: Ban expiry sweep.'));
});

test('a failing task is recorded as schedule-failed and does not throw out of the job', async () => {
  const real = players.sweepExpiredBans;
  players.sweepExpiredBans = async () => {
    calls.push(['banSweep']);
    throw new Error('db locked');
  };
  await fireOnce({ taskType: 'ban-expiry-sweep' });
  await new Promise((r) => setTimeout(r, 100));
  players.sweepExpiredBans = real;
  const failed = db.all("SELECT summary FROM events WHERE type = 'schedule-failed'");
  assert.ok(failed.some((e) => /ban-expiry-sweep failed/.test(e.summary)));
});
