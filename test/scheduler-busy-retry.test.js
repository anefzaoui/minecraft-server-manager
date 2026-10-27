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

// What guardOp throws when the server is busy: a 409 with code BUSY.
const busyErr = (message) => Object.assign(httpError(409, message), { code: 'BUSY' });
const busy = () => busyErr('Cannot backup: a backup cleanup operation is already in progress for this server');

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
    if (calls < 2) throw busyErr('Cannot start: a backup cleanup operation is already in progress for this server');
  });
  await runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 });
  assert.equal(calls, 2);
});

test('a scheduled restart that collides does not run again later', async (t) => {
  const job = schedule('restart');
  const spy = t.mock.method(servers, 'restartServer', async () => {
    throw busyErr('Cannot restart: a restart operation is already in progress for this server');
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

test('a schedule whose last run is still waiting to retry skips its next firing', async (t) => {
  const { fireJob } = require('../src/services/scheduler');
  const job = schedule('backup');
  let calls = 0;
  let firstWaiting;
  const waiting = new Promise((r) => (firstWaiting = r));
  t.mock.method(backups, 'createBackup', async () => {
    calls++;
    if (calls === 1) {
      firstWaiting();
      throw busy(); // the first firing now waits to retry
    }
  });
  const first = fireJob(job, { retryMs: 30, maxWaitMs: 500 });
  await waiting;
  await new Promise((r) => setImmediate(r));
  await fireJob(job, { retryMs: 30, maxWaitMs: 500 }); // fired again (or re-armed) while the first waits
  assert.equal(calls, 1, 'the second firing did not run');
  await first;
});

test("another run finishing does not clear a waiting run's flag", async (t) => {
  const { fireJob } = require('../src/services/scheduler');
  const job = schedule('backup');
  let calls = 0;
  let waitingNow;
  const waiting = new Promise((r) => (waitingNow = r));
  t.mock.method(backups, 'createBackup', async () => {
    calls++;
    if (calls === 1) {
      waitingNow();
      throw busy(); // run B waits to retry
    }
  });
  const b = fireJob(job, { retryMs: 60, maxWaitMs: 600 });
  await waiting;
  await new Promise((r) => setImmediate(r));
  await runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 }); // run A (e.g. an old re-armed loop) finishes
  const before = calls;
  await fireJob(job, { retryMs: 60, maxWaitMs: 600 }); // B still waits: this firing must skip
  assert.equal(calls, before, 'skipped');
  await b;
});

test('a scheduled start that waited is dropped if someone stopped the server meanwhile', async (t) => {
  db.run('DELETE FROM schedules');
  db.run(
    "INSERT OR IGNORE INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb) VALUES ('srv_sched', 's', 'PAPER', 47900, 48900, 'x', 1024, 1536)"
  );
  db.run(
    "INSERT INTO schedules (id, server_id, task_type, cron, payload_json, enabled) VALUES ('sch_start', 'srv_sched', 'start', '0 3 * * *', '{}', 1)"
  );
  const job = { id: 'sch_start', server_id: 'srv_sched', task_type: 'start', payload_json: '{}' };
  let calls = 0;
  t.mock.method(servers, 'startServer', async () => {
    calls++;
    // A person presses Stop while the backup that blocks this start runs.
    require('../src/events').recordEvent({
      serverId: 'srv_sched',
      type: 'stop-requested',
      summary: 'Graceful stop requested.',
    });
    throw busyErr('Cannot start: a backup operation is already in progress for this server');
  });
  await runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 });
  assert.equal(calls, 1, 'not retried after the Stop');
});

test('a Stop pressed just before a scheduled start fires still counts', async (t) => {
  db.run('DELETE FROM schedules');
  db.run(
    "INSERT OR IGNORE INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb) VALUES ('srv_sched2', 's', 'PAPER', 47910, 48910, 'x', 1024, 1536)"
  );
  db.run(
    "INSERT INTO schedules (id, server_id, task_type, cron, payload_json, enabled) VALUES ('sch_start2', 'srv_sched2', 'start', '0 3 * * *', '{}', 1)"
  );
  // Stop pressed 2 s before the firing; its graceful stop is still running.
  db.run(
    "INSERT INTO events (server_id, actor, type, summary, created_at) VALUES ('srv_sched2', 'admin', 'stop-requested', 'Graceful stop requested.', datetime('now', '-2 seconds'))"
  );
  const job = { id: 'sch_start2', server_id: 'srv_sched2', task_type: 'start', payload_json: '{}' };
  let calls = 0;
  t.mock.method(servers, 'startServer', async () => {
    calls++;
    // The stop finishes after the firing.
    require('../src/events').recordEvent({
      serverId: 'srv_sched2',
      type: 'stopped',
      summary: 'Server stopped gracefully.',
    });
    throw busyErr('Cannot start: a stop operation is already in progress for this server');
  });
  await runTaskWithRetry(job, { retryMs: 1, maxWaitMs: 50 });
  assert.equal(calls, 1, 'not started again after the Stop');
});
