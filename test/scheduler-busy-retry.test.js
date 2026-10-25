'use strict';

// A scheduled backup refused only because its server is busy with another
// action retries instead of losing the run; lifecycle tasks don't retry (a
// collided restart has effectively happened); a schedule turned off while
// waiting stops retrying; any other failure is final.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const backups = require('../src/services/backups');
const servers = require('../src/services/servers');
const httpError = require('../src/utils/httpError');
const { runTaskWithRetry } = require('../src/services/scheduler');

const busy = () => httpError(409, 'Cannot backup: a backup cleanup operation is already in progress for this server');

function schedule(taskType) {
  db.run('DELETE FROM schedules');
  db.run(
    "INSERT INTO schedules (id, server_id, task_type, cron, payload_json, enabled) VALUES ('sch_test', NULL, ?, '0 3 * * *', '{}', 1)",
    taskType
  );
  return { id: 'sch_test', server_id: 'srv_x', task_type: taskType, payload_json: '{}' };
}

test('a backup refused because the server is busy retries, then runs', async (t) => {
  const job = schedule('backup');
  let calls = 0;
  t.mock.method(backups, 'createBackup', async () => {
    calls++;
    if (calls < 3) throw busy();
  });
  await runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 });
  assert.equal(calls, 3);
});

test('a server that stays busy fails once the wait runs out', async (t) => {
  const job = schedule('backup');
  const spy = t.mock.method(backups, 'createBackup', async () => {
    throw busy();
  });
  await assert.rejects(runTaskWithRetry(job, { retryMs: 5, maxWaitMs: 40 }), /already in progress/);
  assert.ok(spy.mock.callCount() > 1, `${spy.mock.callCount()} tries`); // retried, then gave up
});

test('a scheduled start that finds the server busy retries too (a start is safe to repeat)', async (t) => {
  const job = schedule('start');
  let calls = 0;
  t.mock.method(servers, 'startServer', async () => {
    calls++;
    if (calls < 2)
      throw httpError(409, 'Cannot start: a backup cleanup operation is already in progress for this server');
  });
  await runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 });
  assert.equal(calls, 2);
});

test('a scheduled restart that collides does not run again later', async (t) => {
  const job = schedule('restart');
  const spy = t.mock.method(servers, 'restartServer', async () => {
    throw httpError(409, 'Cannot restart: a restart operation is already in progress for this server');
  });
  await assert.rejects(runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 }), /already in progress/);
  assert.equal(spy.mock.callCount(), 1);
});

test('a schedule turned off while waiting stops retrying', async (t) => {
  const job = schedule('backup');
  const spy = t.mock.method(backups, 'createBackup', async () => {
    db.run("UPDATE schedules SET enabled = 0 WHERE id = 'sch_test'"); // someone disables it meanwhile
    throw busy();
  });
  await runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 });
  assert.equal(spy.mock.callCount(), 1);
});

test('any other failure is final at once', async (t) => {
  const job = schedule('backup');
  const spy = t.mock.method(backups, 'createBackup', async () => {
    throw httpError(507, 'Not enough disk space');
  });
  await assert.rejects(runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 }), /disk space/);
  assert.equal(spy.mock.callCount(), 1);
});
