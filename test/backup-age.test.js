'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { describeBackupAge, STALE_AFTER_DAYS } = require('../src/utils/backupAge');
const app = require('./helpers/app');
const db = require('../src/db');

const NOW = Date.parse('2026-06-15T12:00:00Z');
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
// SQLite datetime('now') format: UTC, space separator, no zone.
const sql = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
const ago = (ms) => sql(NOW - ms);
const describe = (at, opts = {}) => describeBackupAge(at, { now: NOW, ...opts });

test('wording scales from hours to days to months, with singular forms', () => {
  assert.equal(describe(ago(10 * 60 * 1000)).text, 'Less than an hour ago');
  assert.equal(describe(ago(HOUR)).text, '1 hour ago');
  assert.equal(describe(ago(5 * HOUR)).text, '5 hours ago');
  assert.equal(describe(ago(DAY)).text, '1 day ago');
  assert.equal(describe(ago(3 * DAY + HOUR)).text, '3 days ago');
  assert.equal(describe(ago(59 * DAY)).text, '59 days ago');
  assert.equal(describe(ago(60 * DAY)).text, '2 months ago');
  assert.equal(describe(ago(400 * DAY)).text, '13 months ago');
});

test('a backup is stale only once it is older than the threshold', () => {
  assert.equal(STALE_AFTER_DAYS, 7);
  assert.equal(describe(ago(7 * DAY)).stale, false, 'exactly 7 days is not yet stale');
  assert.equal(describe(ago(7 * DAY + HOUR)).stale, true);
  assert.equal(describe(ago(HOUR)).stale, false);
});

test('never backed up is stale, unless the server is brand new', () => {
  const old = describe(null, { createdAt: ago(3 * DAY) });
  assert.deepEqual(old, { text: 'Never', stale: true, never: true, at: null });
  assert.equal(describe(null, { createdAt: ago(2 * HOUR) }).stale, false, 'grace period for a new server');
  assert.equal(describe(null, { createdAt: ago(2 * HOUR) }).text, 'Never');
  // Unknown creation time: warn rather than hide a possible gap.
  assert.equal(describe(null).stale, true);
});

test('a future or unparseable timestamp never throws or goes negative', () => {
  assert.equal(describe(sql(NOW + DAY)).text, 'Less than an hour ago');
  assert.equal(describe('garbage').never, true);
});

test("the server card shows each server's own newest backup, batched", async () => {
  await app.start();
  const cookie = await app.adminCookie();
  for (const id of ['srv_bk1', 'srv_bk2', 'srv_bk3']) app.seedServer(id);
  // Make the servers old enough that "never" counts as stale.
  db.run("UPDATE servers SET created_at = datetime('now', '-30 days') WHERE id LIKE 'srv_bk%'");
  const insert = (id, server, daysAgo) =>
    db.run(
      `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, created_at)
       VALUES (?, ?, 'a.zip', 'backups/a.zip', 1, 'manual', datetime('now', ?))`,
      id,
      server,
      `-${daysAgo} days`
    );
  insert('bk_a_old', 'srv_bk1', 20);
  insert('bk_a_new', 'srv_bk1', 2); // the newest one wins
  insert('bk_b', 'srv_bk2', 10);
  // srv_bk3: never backed up.

  const page = await app.req('GET', '/servers', { cookie, headers: { Accept: 'text/html' } });
  assert.equal(page.status, 200);
  const rows = [...page.text.matchAll(/data-card-backup>([\s\S]*?)<\/div>/g)].map((m) => m[1]);
  assert.equal(rows.length, 3);
  const html = rows.join('\n');
  assert.match(html, /2 days ago/);
  assert.match(html, /10 days ago/);
  assert.match(html, /Never/);
  assert.doesNotMatch(html, /20 days ago/, 'an older backup is shadowed by the newest');
  // 2 days is fine; 10 days and never get the warning colour.
  assert.equal((html.match(/text-warn/g) || []).length, 2);
  assert.equal((html.match(/No backup in over 7 days\./g) || []).length, 2);
  await app.stop();
});
