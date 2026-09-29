'use strict';

// Dashboard health alerts: per-user dismissal (one or all) over crash, OOM, and
// auto-restart events, with crash details attached and visibility respected.

const h = require('./helpers/app');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const healthAlerts = require('../src/services/healthAlerts');

const alice = { id: 'usr_alice', role: 'operator' };
const bob = { id: 'usr_bob', role: 'operator' };

let cookie;

test.before(async () => {
  await h.start();
  cookie = await h.adminCookie(); // first-run setup only works while no users exist
  for (const u of [alice, bob]) {
    db.run("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, 'x', 'operator')", u.id, u.id);
  }
  h.seedServer('srv_a');
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES ('srv_b', 'Other Server', 'PAPER', 25598, 26598, 'x', 1024, 1536)`
  );
});

test.after(async () => {
  await h.stop();
});

test.beforeEach(() => {
  db.run('DELETE FROM alert_dismissals');
  db.run('DELETE FROM crash_reports');
  db.run('DELETE FROM events');
});

function seedEvent(serverId, type, { at = "datetime('now')", details = '{}', excerpt = null } = {}) {
  const r = db.run(
    `INSERT INTO events (server_id, actor, type, summary, details_json, log_excerpt_path, created_at)
     VALUES (?, 'system', ?, 'Something happened.', ?, ?, ${at})`,
    serverId,
    type,
    details,
    excerpt
  );
  return Number(r.lastInsertRowid);
}

const ALL = new Set(['srv_a', 'srv_b']);

test('counts only health events from the last day', () => {
  seedEvent('srv_a', 'crashed');
  seedEvent('srv_a', 'oom');
  seedEvent('srv_a', 'auto-restarted');
  seedEvent('srv_a', 'crashed', { at: "datetime('now', '-2 days')" });
  seedEvent('srv_a', 'started');
  assert.deepEqual(healthAlerts.counts(alice, ALL), { crashes: 1, oom: 1, autoRestarted: 1, total: 3 });
});

test('a crash carries its exit code, restart plan, log flag, and matching crash report', () => {
  const id = seedEvent('srv_a', 'crashed', {
    details: JSON.stringify({ exitCode: 1, armedRestart: true }),
    excerpt: 'logs/srv_a/events/x.log',
  });
  db.run(
    `INSERT INTO crash_reports (id, server_id, filename, file_mtime, size_bytes, summary, exception, suspected_json)
     VALUES ('cr_1', 'srv_a', 'crash-1.txt', ?, 10, 'Ticking entity', 'java.lang.NullPointerException', '["create"]')`,
    new Date().toISOString()
  );
  db.run(
    `INSERT INTO crash_reports (id, server_id, filename, file_mtime, size_bytes, summary, exception, suspected_json)
     VALUES ('cr_old', 'srv_a', 'crash-0.txt', '2020-01-01T00:00:00.000Z', 10, 'Old', 'Old', '[]')`
  );
  const { alerts } = healthAlerts.list(alice, ALL);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, id);
  assert.equal(alerts[0].exitCode, 1);
  assert.equal(alerts[0].willRestart, true);
  assert.equal(alerts[0].hasLog, true);
  assert.equal(alerts[0].report.filename, 'crash-1.txt');
  assert.equal(alerts[0].report.exception, 'java.lang.NullPointerException');
  assert.deepEqual(alerts[0].report.suspects, ['create']);
});

test('a crash with no nearby report still lists, with report null', () => {
  seedEvent('srv_a', 'crashed');
  assert.equal(healthAlerts.list(alice, ALL).alerts[0].report, null);
});

test('dismissing hides one alert for that user only', () => {
  const first = seedEvent('srv_a', 'crashed');
  seedEvent('srv_a', 'oom');
  healthAlerts.dismiss(alice, ALL, first);
  assert.equal(healthAlerts.counts(alice, ALL).total, 1);
  assert.equal(healthAlerts.counts(bob, ALL).total, 2);
  healthAlerts.dismiss(alice, ALL, first); // idempotent
  assert.equal(healthAlerts.counts(alice, ALL).total, 1);
  // History is untouched.
  assert.equal(db.get('SELECT COUNT(*) AS n FROM events').n, 2);
});

test('clear all hides every visible alert for that user only', () => {
  seedEvent('srv_a', 'crashed');
  seedEvent('srv_b', 'oom');
  assert.equal(healthAlerts.clearAll(alice, ALL), 2);
  assert.equal(healthAlerts.counts(alice, ALL).total, 0);
  assert.equal(healthAlerts.counts(bob, ALL).total, 2);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM events').n, 2);
});

test('servers a user cannot see are neither counted, listed, dismissed, nor cleared', () => {
  seedEvent('srv_a', 'crashed');
  const hidden = seedEvent('srv_b', 'crashed');
  const onlyA = new Set(['srv_a']);
  assert.equal(healthAlerts.counts(alice, onlyA).total, 1);
  assert.equal(healthAlerts.list(alice, onlyA).alerts.length, 1);
  assert.throws(() => healthAlerts.dismiss(alice, onlyA, hidden), { status: 404 });
  healthAlerts.clearAll(alice, onlyA);
  assert.equal(healthAlerts.counts(alice, ALL).total, 1); // srv_b's alert is still there
});

test('only health events can be dismissed', () => {
  const id = seedEvent('srv_a', 'started');
  assert.throws(() => healthAlerts.dismiss(alice, ALL, id), { status: 404 });
  assert.throws(() => healthAlerts.dismiss(alice, ALL, 999999), { status: 404 });
});

test('dismissals go away when history pruning drops the event', () => {
  const id = seedEvent('srv_a', 'crashed');
  healthAlerts.dismiss(alice, ALL, id);
  db.run('DELETE FROM events WHERE id = ?', id);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM alert_dismissals').n, 0);
});

test('the health page lists alerts, and the API dismisses and clears for the signed-in user', async () => {
  const first = seedEvent('srv_a', 'crashed', { details: JSON.stringify({ exitCode: 137, armedRestart: false }) });
  seedEvent('srv_a', 'oom');

  let r = await h.req('GET', '/health', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /Health · 24h|HEALTH/);
  assert.match(r.text, new RegExp(`data-alert-id="${first}"`));
  assert.match(r.text, /Exit code/);
  assert.match(r.text, /It will not restart on its own\./);

  r = await h.req('POST', `/api/alerts/${first}/dismiss`, { cookie });
  assert.equal(r.status, 200);
  r = await h.req('GET', '/health', { cookie });
  assert.doesNotMatch(r.text, new RegExp(`data-alert-id="${first}"`));

  r = await h.req('POST', '/api/alerts/clear', { cookie });
  assert.equal(r.json.cleared, 1);
  r = await h.req('GET', '/health', { cookie });
  assert.match(r.text, /No Alerts/);

  r = await h.req('POST', '/api/alerts/999999/dismiss', { cookie });
  assert.equal(r.status, 404);
  r = await h.req('GET', '/health');
  assert.equal(r.status === 401 || r.status === 302, true);
});
