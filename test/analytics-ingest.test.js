'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const ingest = require('../src/analytics/ingest');
const app = require('./helpers/app');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

test('splitDockerTimestamp extracts ISO ts and the rest', () => {
  const { ts, rest } = ingest.splitDockerTimestamp('2026-03-15T12:30:45.123456789Z [Server thread/INFO]: hi');
  assert.equal(ts, '2026-03-15T12:30:45.123Z'); // ns trimmed to ms
  assert.equal(rest, '[Server thread/INFO]: hi');
});

test('splitDockerTimestamp tolerates a line without a Docker prefix', () => {
  const { ts, rest } = ingest.splitDockerTimestamp('[12:00:01] [Server thread/INFO]: hi');
  assert.equal(ts, null);
  assert.equal(rest, '[12:00:01] [Server thread/INFO]: hi');
});

test('buildTs builds today/UTC timestamps and rolls back an over-the-minute future time', () => {
  const now = new Date('2026-03-15T12:00:00Z');
  assert.equal(ingest.buildTs('11:30:45', now), '2026-03-15T11:30:45.000Z');
  // 23:59 is far in the future of 12:00 -> previous day
  assert.equal(ingest.buildTs('23:59:59', now), '2026-03-14T23:59:59.000Z');
  // no hms -> now
  assert.equal(ingest.buildTs(null, now), now.toISOString());
});

test('closeAllSessions closes every open session for a server', () => {
  const id = app.seedServer('ig_close');
  const ts = new Date().toISOString();
  db.run("INSERT INTO player_sessions (server_id, player, started_at) VALUES (?, 'A', ?)", id, ts);
  db.run("INSERT INTO player_sessions (server_id, player, started_at) VALUES (?, 'B', ?)", id, ts);
  ingest.closeAllSessions(id);
  const open = db.all('SELECT * FROM player_sessions WHERE server_id = ? AND ended_at IS NULL', id);
  assert.equal(open.length, 0);
  const all = db.all('SELECT * FROM player_sessions WHERE server_id = ?', id);
  assert.equal(all.length, 2);
});

test('pruneOlderThan removes old events and closed sessions but keeps fresh ones', () => {
  const id = app.seedServer('ig_prune');
  const old = '2020-01-01T00:00:00.000Z';
  const fresh = new Date().toISOString();
  db.run('INSERT INTO player_events (server_id, ts, type, player) VALUES (?, ?, ?, ?)', id, old, 'join', 'A');
  db.run('INSERT INTO player_events (server_id, ts, type, player) VALUES (?, ?, ?, ?)', id, fresh, 'join', 'B');
  db.run("INSERT INTO player_sessions (server_id, player, started_at, ended_at) VALUES (?, 'C', ?, ?)", id, old, old);
  db.run("INSERT INTO player_sessions (server_id, player, started_at) VALUES (?, 'D', ?)", id, fresh);

  const res = ingest.pruneOlderThan(30);
  assert.equal(res.events, 1); // only the old event removed
  assert.equal(res.sessions, 1); // only the old CLOSED session removed

  assert.equal(db.get('SELECT COUNT(*) n FROM player_events WHERE server_id = ?', id).n, 1);
  // The open 'D' session survives; the closed old 'C' one is gone.
  assert.equal(db.get("SELECT COUNT(*) n FROM player_sessions WHERE server_id = ? AND player = 'D'", id).n, 1);
  assert.equal(db.get("SELECT COUNT(*) n FROM player_sessions WHERE server_id = ? AND player = 'C'", id).n, 0);
});
