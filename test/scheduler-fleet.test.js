'use strict';

// Fleet schedules ("Back up all servers", "Restart all running servers"): they
// visit every eligible server in turn, isolate per-server failures, report the
// failures at the end, and are admin-only to create.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const scheduler = require('../src/services/scheduler');
const servers = require('../src/services/servers');
const backups = require('../src/services/backups');
const authService = require('../src/services/auth');

const calls = [];
let backupFails = new Set();
let restartFails = new Set();
let redundant = new Set();

servers.restartServer = async (id, opts) => {
  calls.push(['restart', id, opts.actor]);
  if (restartFails.has(id)) throw new Error('boom');
};
backups.isScheduledBackupRedundant = async (id) => redundant.has(id);
backups.createBackup = async (id, opts) => {
  calls.push(['backup', id, opts.reason, opts.shrinkAfter]);
  if (backupFails.has(id)) throw new Error('disk full');
  return { id: `bk_${id}` };
};
backups.verifyBackup = async (backupId) => {
  calls.push(['verify', backupId]);
};

function setStatuses(map) {
  for (const [id, status] of Object.entries(map)) db.run('UPDATE servers SET status = ? WHERE id = ?', status, id);
}

test.before(async () => {
  await app.start();
  for (const id of ['srv_fa', 'srv_fb', 'srv_fc', 'srv_fd', 'srv_fe']) app.seedServer(id);
});

test.after(async () => {
  await app.stop();
});

test.beforeEach(() => {
  calls.length = 0;
  backupFails = new Set();
  restartFails = new Set();
  redundant = new Set();
});

const run = (task_type, payload = {}) =>
  scheduler.runTask({ task_type, server_id: null, payload_json: JSON.stringify(payload) });

test('backup-all backs up and verifies each server, skipping redundant ones', async () => {
  setStatuses({ srv_fa: 'running', srv_fb: 'stopped', srv_fc: 'stopped', srv_fd: 'stopped', srv_fe: 'stopped' });
  redundant = new Set(['srv_fb', 'srv_fc', 'srv_fd', 'srv_fe']);
  await run('backup-all');
  assert.deepEqual(calls, [
    ['backup', 'srv_fa', 'scheduled', false],
    ['verify', 'bk_srv_fa'],
  ]);
});

test('backup-all passes the shrink option through', async () => {
  redundant = new Set(['srv_fb', 'srv_fc', 'srv_fd', 'srv_fe']);
  await run('backup-all', { shrink: true });
  assert.deepEqual(calls[0], ['backup', 'srv_fa', 'scheduled', true]);
});

test('backup-all keeps going after one server fails, then fails the run naming it', async () => {
  redundant = new Set(['srv_fd', 'srv_fe']);
  backupFails = new Set(['srv_fa']);
  await assert.rejects(
    () => run('backup-all'),
    (err) => /Backing up failed for 1 of 5 servers: Test Server\./.test(err.message)
  );
  const backedUp = calls.filter((c) => c[0] === 'backup').map((c) => c[1]);
  assert.deepEqual(backedUp, ['srv_fa', 'srv_fb', 'srv_fc']);
  // The failed server was never verified; the others were.
  assert.deepEqual(
    calls.filter((c) => c[0] === 'verify').map((c) => c[1]),
    ['bk_srv_fb', 'bk_srv_fc']
  );
});

test('restart-all restarts only running and unhealthy servers', async () => {
  setStatuses({
    srv_fa: 'running',
    srv_fb: 'unhealthy',
    srv_fc: 'starting',
    srv_fd: 'stalled',
    srv_fe: 'stopped',
  });
  await run('restart-all');
  assert.deepEqual(calls, [
    ['restart', 'srv_fa', 'scheduler'],
    ['restart', 'srv_fb', 'scheduler'],
  ]);
});

test('restart-all isolates a failing server and reports it at the end', async () => {
  setStatuses({ srv_fa: 'running', srv_fb: 'running', srv_fc: 'running', srv_fd: 'stopped', srv_fe: 'stopped' });
  restartFails = new Set(['srv_fa']);
  await assert.rejects(
    () => run('restart-all'),
    (err) => /Restarting failed for 1 of 3 servers/.test(err.message)
  );
  assert.deepEqual(
    calls.map((c) => c[1]),
    ['srv_fa', 'srv_fb', 'srv_fc']
  );
});

test('restart-all with nothing running is a quiet no-op', async () => {
  setStatuses({ srv_fa: 'stopped', srv_fb: 'stopped', srv_fc: 'stopped', srv_fd: 'stopped', srv_fe: 'stopped' });
  await run('restart-all');
  assert.deepEqual(calls, []);
});

test('fleet task types are registered as admin-only and panel-wide', () => {
  for (const type of ['backup-all', 'restart-all']) {
    assert.equal(scheduler.TASK_TYPES[type].adminOnly, true, type);
    assert.equal(scheduler.TASK_TYPES[type].serverScoped, false, type);
  }
});

test('only an admin can create a fleet schedule; others get 403, and the form hides them', async () => {
  const adminCookie = await app.adminCookie();
  await authService.createUser(
    { username: 'fleetop', password: 'operatorpass123', role: 'operator' },
    { actor: 'test' }
  );
  const lr = await app.req('POST', '/login', { body: { username: 'fleetop', password: 'operatorpass123' } });
  const opCookie = (lr.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  const body = { taskType: 'backup-all', cron: '0 4 * * *' };
  const denied = await app.req('POST', '/api/schedules', { cookie: opCookie, body });
  assert.equal(denied.status, 403);
  assert.match(denied.json.error, /Only an admin/);
  assert.equal(
    (await app.req('POST', '/api/schedules', { cookie: opCookie, body: { ...body, taskType: 'restart-all' } })).status,
    403
  );

  const ok = await app.req('POST', '/api/schedules', { cookie: adminCookie, body });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  assert.equal(ok.json.schedule.taskType, 'backup-all');
  assert.equal(ok.json.schedule.serverId, null);

  // The operator cannot toggle or delete it either.
  const id = ok.json.schedule.id;
  assert.equal(
    (await app.req('POST', `/api/schedules/${id}/toggle`, { cookie: opCookie, body: { enabled: false } })).status,
    403
  );
  assert.equal((await app.req('DELETE', `/api/schedules/${id}`, { cookie: opCookie })).status, 403);

  assert.equal((await app.req('DELETE', `/api/schedules/${id}`, { cookie: adminCookie })).status, 200);

  // The new-task form only offers fleet tasks to an admin. Checked after the
  // delete so the label cannot come from the schedule list rows.
  const adminPage = await app.req('GET', '/schedules', { cookie: adminCookie, headers: { Accept: 'text/html' } });
  const opPage = await app.req('GET', '/schedules', { cookie: opCookie, headers: { Accept: 'text/html' } });
  assert.match(adminPage.text, /Back up all servers/);
  assert.doesNotMatch(opPage.text, /Back up all servers/);
});
