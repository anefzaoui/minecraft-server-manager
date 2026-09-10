'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Cron } = require('croner');
const settings = require('../src/services/settings');
const scheduler = require('../src/services/scheduler');
const app = require('./helpers/app'); // migrates the DB itself

// Etc/GMT-5 is a fixed UTC+5 offset with no DST (IANA's Etc/GMT zones invert
// the sign) - deterministic, unlike a real "America/..." zone whose offset
// depends on the calendar date the test happens to run on.
const FIXED_TZ = 'Etc/GMT-5';
const CRON = '0 3 * * *'; // "3am" - meaningless without a zone attached

let cookie;
test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});
test.after(async () => {
  await app.stop();
});

test("a schedule's computed next-run time uses the configured panel timezone, not the system default", () => {
  settings.setTimezone(FIXED_TZ);
  const created = scheduler.createSchedule({ taskType: 'update-check', cron: CRON });
  try {
    const expected = new Cron(CRON, { timezone: FIXED_TZ }).nextRun().getTime();
    const ifIgnoredZone = new Cron(CRON, { timezone: 'UTC' }).nextRun().getTime();

    assert.equal(created.nextMs, expected);
    assert.notEqual(created.nextMs, ifIgnoredZone); // proves the zone was actually applied, not silently UTC
  } finally {
    scheduler.deleteSchedule(created.id);
    settings.setTimezone('auto');
  }
});

test('GET /api/schedules/preview honors the configured timezone, not UTC', async () => {
  settings.setTimezone(FIXED_TZ);
  try {
    const r = await app.req('GET', `/api/schedules/preview?cron=${encodeURIComponent(CRON)}`, { cookie });
    assert.equal(r.status, 200);
    const expected = new Cron(CRON, { timezone: FIXED_TZ }).nextRuns(3).map((d) => d.toISOString());
    assert.deepEqual(r.json.runs, expected);
  } finally {
    settings.setTimezone('auto');
  }
});

test('POST /api/settings/localization re-arms existing schedules onto the new timezone', async () => {
  settings.setTimezone('UTC');
  const created = scheduler.createSchedule({ taskType: 'update-check', cron: CRON });
  try {
    const r = await app.req('POST', '/api/settings/localization', { cookie, body: { timezone: FIXED_TZ } });
    assert.equal(r.status, 200);

    const after = scheduler.listSchedules().find((s) => s.id === created.id);
    const expected = new Cron(CRON, { timezone: FIXED_TZ }).nextRun().getTime();
    assert.equal(after.nextMs, expected);
  } finally {
    scheduler.deleteSchedule(created.id);
    settings.setTimezone('auto');
  }
});

test('rearmAll() re-applies a timezone change to already-created schedules', () => {
  settings.setTimezone('UTC');
  const created = scheduler.createSchedule({ taskType: 'update-check', cron: CRON });
  try {
    settings.setTimezone(FIXED_TZ);
    scheduler.rearmAll();

    const after = scheduler.listSchedules().find((s) => s.id === created.id);
    const expected = new Cron(CRON, { timezone: FIXED_TZ }).nextRun().getTime();
    assert.equal(after.nextMs, expected);
  } finally {
    scheduler.deleteSchedule(created.id);
    settings.setTimezone('auto');
  }
});

test('createSchedule rejects an unknown task type', () => {
  assert.throws(() => scheduler.createSchedule({ taskType: 'not-a-thing', cron: CRON }), /Unknown task type/);
});

test('createSchedule rejects an invalid cron expression with a 400, not a generic error', () => {
  assert.throws(
    () => scheduler.createSchedule({ taskType: 'update-check', cron: 'not a cron' }),
    (err) => err.status === 400 && /not a valid schedule/.test(err.message)
  );
});

test('createSchedule persists a server-scoped schedule and lists it with a label', () => {
  const sid = app.seedServer('sched_srv1');
  const created = scheduler.createSchedule({
    serverId: sid,
    taskType: 'restart',
    cron: CRON,
    payload: { shrink: true },
  });
  try {
    assert.ok(created.id.startsWith('sch_'));
    assert.equal(created.serverId, sid);
    assert.equal(created.task, 'Restart server');
    assert.deepEqual(created.payload, { shrink: true });
    assert.equal(created.lastRun, null);
  } finally {
    scheduler.deleteSchedule(created.id);
  }
});

test('setEnabled toggles a schedule on and off', () => {
  const created = scheduler.createSchedule({ taskType: 'update-check', cron: CRON, enabled: true });
  try {
    scheduler.setEnabled(created.id, false);
    assert.equal(scheduler.listSchedules().find((s) => s.id === created.id).enabled, false);
    scheduler.setEnabled(created.id, true);
    assert.equal(scheduler.listSchedules().find((s) => s.id === created.id).enabled, true);
  } finally {
    scheduler.deleteSchedule(created.id);
  }
});

test('startScheduler seeds the global maintenance defaults exactly once', () => {
  scheduler.startScheduler();
  const globals = scheduler.listSchedules().filter((s) => s.serverId === null);
  const types = globals.map((s) => s.taskType).sort();
  assert.deepEqual(types, ['ban-expiry-sweep', 'content-meta-backfill', 'storage-scan', 'tmp-clean', 'update-check']);
  scheduler.startScheduler(); // idempotent
  const after = scheduler.listSchedules().filter((s) => s.serverId === null);
  assert.equal(after.length, globals.length);
  globals.forEach((s) => scheduler.deleteSchedule(s.id)); // disarm before process exit
});
