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
