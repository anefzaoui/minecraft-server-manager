'use strict';

// A scheduled task refused only because its server is busy with another
// action retries instead of losing the run; any other failure is final.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const backups = require('../src/services/backups');
const httpError = require('../src/utils/httpError');
const { runTaskWithRetry } = require('../src/services/scheduler');

const job = { id: 'sch_test', server_id: 'srv_x', task_type: 'backup', payload_json: '{}' };
const busy = () => httpError(409, 'Cannot backup: a backup cleanup operation is already in progress for this server');

test('a task refused because the server is busy retries, then runs', async (t) => {
  let calls = 0;
  t.mock.method(backups, 'createBackup', async () => {
    calls++;
    if (calls < 3) throw busy();
  });
  await runTaskWithRetry(job, { retryMs: 1 });
  assert.equal(calls, 3);
});

test('a server that stays busy fails after the last retry', async (t) => {
  const spy = t.mock.method(backups, 'createBackup', async () => {
    throw busy();
  });
  await assert.rejects(runTaskWithRetry(job, { retryMs: 1 }), /already in progress/);
  assert.equal(spy.mock.callCount(), 4); // the run and 3 retries
});

test('any other failure is final at once', async (t) => {
  const spy = t.mock.method(backups, 'createBackup', async () => {
    throw httpError(507, 'Not enough disk space');
  });
  await assert.rejects(runTaskWithRetry(job, { retryMs: 1 }), /disk space/);
  assert.equal(spy.mock.callCount(), 1);
});
