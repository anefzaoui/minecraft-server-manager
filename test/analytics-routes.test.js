'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();

  app.seedServer('srv_an07');

  db.run(
    `INSERT INTO player_events (server_id, ts, type, player, target, message) VALUES
       ('srv_an07', '2026-09-01 10:00:00', 'join', 'Steve', '', ''),
       ('srv_an07', '2026-09-01 10:05:00', 'chat', 'Steve', '', 'hello world'),
       ('srv_an07', '2026-09-01 10:10:00', 'death', 'Steve', 'creeper', ''),
       ('srv_an07', '2026-09-01 10:15:00', 'join', '[Server]', '', '')`
  );

  db.run(
    `INSERT INTO player_sessions (server_id, player, started_at, ended_at) VALUES
       ('srv_an07', 'Steve', '2026-09-01 09:00:00', '2026-09-01 10:00:00'),
       ('srv_an07', 'Steve', '2026-09-01 11:00:00', NULL)`
  );

  const uuid = '00000000-0000-0000-0000-000000000001';
  db.run(
    `INSERT INTO player_stat_snapshots (server_id, uuid, name, stats_json) VALUES
       (?, ?, 'Steve', '{"playtimeTicks":12000,"deaths":2,"mobKills":7,"diamondsMined":3,"stoneMined":100,"distanceCm":5000}')`,
    'srv_an07',
    uuid
  );
});

test.after(async () => {
  await app.stop();
});

test('analytics /timeline lists events newest-first', async () => {
  const r = await app.req('GET', '/api/servers/srv_an07/analytics/timeline', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.ok(Array.isArray(r.json.events));
  assert.ok(r.json.events.some((e) => e.message === 'hello world'));
  assert.equal(r.json.nextBefore, null);
});

test('analytics /timeline supports filters', async () => {
  const filtered = await app.req('GET', '/api/servers/srv_an07/analytics/timeline?type=chat,death&player=Steve', {
    cookie,
  });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.json.events.length >= 2);
  assert.ok(filtered.json.events.every((e) => e.player === 'Steve' && (e.type === 'chat' || e.type === 'death')));

  const q = await app.req('GET', '/api/servers/srv_an07/analytics/timeline?q=hello&limit=1', { cookie });
  assert.equal(q.status, 200);
  assert.equal(q.json.events.length, 1);
  assert.match(q.json.events[0].message, /hello/);

  const wild = await app.req('GET', '/api/servers/srv_an07/analytics/timeline?q=%25%5F', { cookie });
  assert.equal(wild.status, 200);
  assert.equal(wild.json.events.length, 0);

  const bad = await app.req('GET', '/api/servers/srv_an07/analytics/timeline?limit=0', { cookie });
  assert.equal(bad.status, 400);
});

test('analytics /timeline 404s unknown server and rejects bad player regex', async () => {
  const missing = await app.req('GET', '/api/servers/nope/analytics/timeline', { cookie });
  assert.equal(missing.status, 404);

  const badPlayer = await app.req('GET', '/api/servers/srv_an07/analytics/timeline?player=%2F%2Fbad', { cookie });
  assert.equal(badPlayer.status, 400);
});

test('analytics /sessions returns computed durations', async () => {
  const r = await app.req('GET', '/api/servers/srv_an07/analytics/sessions', { cookie });
  assert.equal(r.status, 200);
  const sessions = r.json.sessions;
  assert.ok(Array.isArray(sessions));
  const closed = sessions.find((s) => s.endedAt);
  assert.ok(closed);
  assert.equal(closed.open, false);
  assert.equal(closed.durationSec, 3600);
  assert.ok(sessions.some((s) => s.open === true));

  const byPlayer = await app.req('GET', '/api/servers/srv_an07/analytics/sessions?player=Steve', { cookie });
  assert.equal(byPlayer.status, 200);
  assert.ok(byPlayer.json.sessions.every((s) => s.player === 'Steve'));
});

test('analytics /scoreboard ranks players by metric', async () => {
  const r = await app.req('GET', '/api/servers/srv_an07/analytics/scoreboard', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.metric, 'playtimeTicks');
  assert.ok(Array.isArray(r.json.rows));

  const windowed = await app.req('GET', '/api/servers/srv_an07/analytics/scoreboard?metric=deaths&window=7d', {
    cookie,
  });
  assert.equal(windowed.status, 200);
  assert.equal(windowed.json.metric, 'deaths');

  const bad = await app.req('GET', '/api/servers/srv_an07/analytics/scoreboard?metric=bogus', { cookie });
  assert.equal(bad.status, 400);
});

test('analytics /profile/:uuid returns stats or 404', async () => {
  const ok = await app.req('GET', '/api/servers/srv_an07/analytics/profile/00000000000000000000000000000001', {
    cookie,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.profile.name, 'Steve');
  assert.equal(ok.json.profile.playtimeSeconds, 600);
  assert.equal(ok.json.profile.deltas['24h'].playtimeTicks, 0);
  assert.equal(ok.json.profile.deltas['7d'].deaths, 0);

  const missing = await app.req('GET', '/api/servers/srv_an07/analytics/profile/ffffffffffffffffffffffffffffffff', {
    cookie,
  });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.ok, false);
});

test('analytics /players rolls events + snapshots into a distinct roster', async () => {
  const r = await app.req('GET', '/api/servers/srv_an07/analytics/players', { cookie });
  assert.equal(r.status, 200);
  assert.ok(r.json.players.some((p) => p.name === 'Steve'));
  // [Server]-only events are excluded from the roster.
  assert.ok(!r.json.players.some((p) => p.name === '[Server]'));
});

test('analytics /xray returns a report', async () => {
  const r = await app.req('GET', '/api/servers/srv_an07/analytics/xray', { cookie });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.report.players));
});

test('analytics /ingest-now hydrates events and stats gracefully', async () => {
  const r = await app.req('POST', '/api/servers/srv_an07/analytics/ingest-now', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(typeof r.json.events, 'number');
  assert.equal(typeof r.json.players, 'number');
  assert.equal(typeof r.json.snapshots, 'number');
});
