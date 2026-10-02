'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const authService = require('../src/services/auth');

let cookie;
let tokAll;
let tokScoped;
let tokAllId;

const auth = (t) => ({ headers: { Authorization: `Bearer ${t}` } });

async function mint(body) {
  const r = await app.req('POST', '/api/api-tokens', { cookie, body });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json.token;
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  app.seedServer('srv_v1a');
  app.seedServer('srv_v1b');
  // Deliberately do NOT enable the API here - creating the first token must.
  const first = await app.req('POST', '/api/api-tokens', { cookie, body: { label: 'all', scopeAll: true } });
  assert.equal(first.status, 201);
  assert.equal(first.json.enabled, true, 'creating the first token must enable the API');
  tokAll = first.json.token.token;
  tokAllId = first.json.token.id;
  tokScoped = (await mint({ label: 'scoped', serverIds: ['srv_v1a'] })).token;
});

test.after(async () => {
  await app.stop();
});

test('the API is already serving after the first token was created (no manual toggle)', async () => {
  const r = await app.req('GET', '/api/v1/servers', auth(tokAll));
  assert.equal(r.status, 200);
  const state = await app.req('GET', '/api/api-tokens', { cookie });
  assert.equal(state.json.enabled, true);
});

test('disabled => 404 even with a valid token; re-enabling restores it', async () => {
  await app.req('POST', '/api/settings/public-api', { cookie, body: { enabled: false } });
  const off = await app.req('GET', '/api/v1/servers', auth(tokAll));
  assert.equal(off.status, 404);
  await app.req('POST', '/api/settings/public-api', { cookie, body: { enabled: true } });
  const on = await app.req('GET', '/api/v1/servers', auth(tokAll));
  assert.equal(on.status, 200);
});

test('auth matrix on GET /api/v1/servers', async () => {
  assert.equal((await app.req('GET', '/api/v1/servers')).status, 401);
  assert.equal((await app.req('GET', '/api/v1/servers', auth('msm_nope'))).status, 401);

  const good = await app.req('GET', '/api/v1/servers', auth(tokAll));
  assert.equal(good.status, 200);
  assert.equal(good.json.ok, true);
  assert.equal(good.json.total, 2);
  assert.equal(good.json.online, 0); // seeded, never started
  assert.equal(good.json.servers.length, 2);
});

test('a signed-out request is a Bearer 401, not a login redirect (public zone)', async () => {
  const r = await app.req('GET', '/api/v1/servers');
  assert.equal(r.status, 401);
  assert.match(r.json.error, /Authorization/);
});

test('server view is the lean shape only - no ports/env/rcon leak', async () => {
  const r = await app.req('GET', '/api/v1/servers', auth(tokAll));
  const s = r.json.servers.find((x) => x.id === 'srv_v1a');
  assert.deepEqual(Object.keys(s).sort(), [
    'cpuPct',
    'id',
    'memoryLimitMb',
    'memoryMb',
    'name',
    'players',
    'state',
    'type',
    'uptimeSeconds',
  ]);
  // Seeded, never started.
  assert.equal(s.state, 'stopped');
  assert.equal(s.cpuPct, null);
  assert.equal(s.memoryMb, null);
  assert.equal(s.uptimeSeconds, null);
  assert.equal(s.players, null);
  const flat = JSON.stringify(r.json);
  assert.equal(/rcon|env_json|port_game|password/i.test(flat), false);
});

test('online counts running servers and tracks live state', async () => {
  const list = async (t) => (await app.req('GET', '/api/v1/servers', auth(t))).json;

  db.run("UPDATE servers SET status = 'stopped' WHERE id IN ('srv_v1a','srv_v1b')");
  assert.equal((await list(tokAll)).online, 0);
  assert.equal((await list(tokAll)).total, 2);

  db.run("UPDATE servers SET status = 'running' WHERE id = 'srv_v1a'");
  assert.equal((await list(tokAll)).online, 1);

  db.run("UPDATE servers SET status = 'running' WHERE id = 'srv_v1b'");
  assert.equal((await list(tokAll)).online, 2);

  // A scoped token only ever sees srv_v1a - its online is capped by scope too.
  assert.equal((await list(tokScoped)).total, 1);
  assert.equal((await list(tokScoped)).online, 1);

  db.run("UPDATE servers SET status = 'stopped' WHERE id IN ('srv_v1a','srv_v1b')");
});

test('scope filtering: a scoped token sees only its server', async () => {
  const list = await app.req('GET', '/api/v1/servers', auth(tokScoped));
  assert.equal(list.status, 200);
  assert.equal(list.json.total, 1);
  assert.deepEqual(
    list.json.servers.map((s) => s.id),
    ['srv_v1a']
  );

  assert.equal((await app.req('GET', '/api/v1/servers/srv_v1a', auth(tokScoped))).status, 200);
  assert.equal((await app.req('GET', '/api/v1/servers/srv_v1b', auth(tokScoped))).status, 404); // out of scope
  assert.equal((await app.req('GET', '/api/v1/servers/srv_v1b', auth(tokAll))).status, 200);
  assert.equal((await app.req('GET', '/api/v1/servers/not-an-id', auth(tokAll))).status, 400);
  assert.equal((await app.req('GET', '/api/v1/servers/srv_missing', auth(tokAll))).status, 404);
});

test('GET /api/v1/metrics serves Prometheus text, scoped and token-authed', async () => {
  db.run("UPDATE servers SET status = 'stopped' WHERE id IN ('srv_v1a','srv_v1b')");
  assert.equal((await app.req('GET', '/api/v1/metrics')).status, 401);

  const all = await app.req('GET', '/api/v1/metrics', auth(tokAll));
  assert.equal(all.status, 200);
  assert.match(all.headers.get('content-type'), /^text\/plain;.*version=0\.0\.4/);
  assert.match(all.text, /^msm_servers 2$/m);
  assert.match(all.text, /^msm_server_up\{server_id="srv_v1a",name="Test Server"\} 0$/m);
  assert.match(all.text, /^msm_server_up\{server_id="srv_v1b",name="Test Server"\} 0$/m);
  // Seeded 1536 MB limit is exported in bytes; unknown live readings are absent.
  assert.match(all.text, /^msm_server_memory_limit_bytes\{server_id="srv_v1a",[^}]*\} 1610612736$/m);
  assert.doesNotMatch(all.text, /msm_server_cpu_percent|msm_server_players_online|msm_server_tps/);

  db.run("UPDATE servers SET status = 'running' WHERE id = 'srv_v1a'");
  const up = await app.req('GET', '/api/v1/metrics', auth(tokAll));
  assert.match(up.text, /^msm_server_up\{server_id="srv_v1a",[^}]*\} 1$/m);

  const scoped = await app.req('GET', '/api/v1/metrics', auth(tokScoped));
  assert.match(scoped.text, /^msm_servers 1$/m);
  assert.doesNotMatch(scoped.text, /srv_v1b/);
  assert.equal((await app.req('POST', '/api/v1/metrics', auth(tokAll))).status, 405);
  db.run("UPDATE servers SET status = 'stopped' WHERE id = 'srv_v1a'");
});

test('GET /api/v1/servers/:id/backups lists history newest first without file paths', async () => {
  for (const [id, at, reason] of [
    ['bk_old', '2026-01-01 00:00:00', 'scheduled'],
    ['bk_new', '2026-02-01 00:00:00', 'manual'],
  ]) {
    db.run(
      `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, note, created_at)
       VALUES (?, 'srv_v1a', ?, ?, 2048, ?, 'n', ?)`,
      id,
      `${id}.zip`,
      `backups/srv_v1a/${id}.zip`,
      reason,
      at
    );
  }
  const r = await app.req('GET', '/api/v1/servers/srv_v1a/backups', auth(tokAll));
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.json.backups.map((b) => b.id),
    ['bk_new', 'bk_old']
  );
  assert.deepEqual(Object.keys(r.json.backups[0]).sort(), [
    'createdAt',
    'filename',
    'id',
    'note',
    'reason',
    'sizeBytes',
  ]);
  assert.equal(/rel_path|backups\/srv_v1a/.test(r.text), false);

  const one = await app.req('GET', '/api/v1/servers/srv_v1a/backups?limit=1', auth(tokAll));
  assert.deepEqual(
    one.json.backups.map((b) => b.id),
    ['bk_new']
  );
  assert.equal((await app.req('GET', '/api/v1/servers/srv_v1a/backups?limit=0', auth(tokAll))).status, 400);
  assert.equal((await app.req('GET', '/api/v1/servers/srv_v1a/backups?limit=999', auth(tokAll))).status, 400);
});

test('GET /api/v1/servers/:id/players reports sessions, and null live data when unknown', async () => {
  db.run(
    `INSERT INTO player_sessions (server_id, player, started_at, ended_at) VALUES
       ('srv_v1a', 'Alex', '2026-03-01T10:00:00.000Z', '2026-03-01T11:00:00.000Z'),
       ('srv_v1a', 'Steve', '2026-03-02T10:00:00.000Z', NULL)`
  );
  const r = await app.req('GET', '/api/v1/servers/srv_v1a/players', auth(tokAll));
  assert.equal(r.status, 200);
  // Never started in this test process, so the live cache has no player list.
  assert.equal(r.json.online, null);
  assert.equal(r.json.max, null);
  assert.equal(r.json.names, null);
  assert.deepEqual(r.json.sessions, [
    { player: 'Steve', startedAt: '2026-03-02T10:00:00.000Z', endedAt: null, open: true },
    { player: 'Alex', startedAt: '2026-03-01T10:00:00.000Z', endedAt: '2026-03-01T11:00:00.000Z', open: false },
  ]);
  const one = await app.req('GET', '/api/v1/servers/srv_v1a/players?limit=1', auth(tokAll));
  assert.equal(one.json.sessions.length, 1);
});

test('the per-server sub-routes honour token scope and id validation', async () => {
  for (const sub of ['players', 'backups']) {
    assert.equal((await app.req('GET', `/api/v1/servers/srv_v1a/${sub}`)).status, 401);
    assert.equal((await app.req('GET', `/api/v1/servers/srv_v1a/${sub}`, auth(tokScoped))).status, 200);
    assert.equal((await app.req('GET', `/api/v1/servers/srv_v1b/${sub}`, auth(tokScoped))).status, 404);
    assert.equal((await app.req('GET', `/api/v1/servers/srv_missing/${sub}`, auth(tokAll))).status, 404);
    assert.equal((await app.req('GET', `/api/v1/servers/not-an-id/${sub}`, auth(tokAll))).status, 400);
  }
});

test('the API is read-only: non-GET is 405 with Allow: GET', async () => {
  const post = await app.req('POST', '/api/v1/servers', { ...auth(tokAll), body: {} });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET');
  const del = await app.req('DELETE', '/api/v1/servers/srv_v1a', auth(tokAll));
  assert.equal(del.status, 405);
});

test('revoking a token immediately locks it out', async () => {
  const throwaway = await mint({ label: 'throwaway', scopeAll: true });
  assert.equal((await app.req('GET', '/api/v1/servers', auth(throwaway.token))).status, 200);
  const del = await app.req('DELETE', `/api/api-tokens/${throwaway.id}`, { cookie });
  assert.equal(del.status, 200);
  assert.equal((await app.req('GET', '/api/v1/servers', auth(throwaway.token))).status, 401);
});

test('an expired token is rejected', async () => {
  const exp = await mint({ label: 'exp', scopeAll: true });
  db.run("UPDATE api_tokens SET expires_at = '2000-01-01 00:00:00' WHERE id = ?", exp.id);
  assert.equal((await app.req('GET', '/api/v1/servers', auth(exp.token))).status, 401);
});

test('token management is admin-only', async () => {
  // no session
  assert.equal((await app.req('POST', '/api/api-tokens', { body: { label: 'x', scopeAll: true } })).status, 401);

  // viewer role
  await authService.createUser({ username: 'v1viewer', password: 'viewerpass123', role: 'viewer' }, { actor: 'test' });
  const lr = await app.req('POST', '/login', { body: { username: 'v1viewer', password: 'viewerpass123' } });
  const viewerCookie = (lr.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  assert.equal((await app.req('GET', '/api/api-tokens', { cookie: viewerCookie })).status, 403);
  assert.equal(
    (await app.req('POST', '/api/api-tokens', { cookie: viewerCookie, body: { label: 'x', scopeAll: true } })).status,
    403
  );
  assert.equal(
    (await app.req('POST', '/api/settings/public-api', { cookie: viewerCookie, body: { enabled: false } })).status,
    403
  );
});

test('GET /api/api-tokens returns public shapes only, never the secret', async () => {
  const r = await app.req('GET', '/api/api-tokens', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.enabled, true);
  assert.ok(r.json.tokens.length >= 2);
  for (const t of r.json.tokens) {
    assert.ok(t.tokenPrefix);
    assert.equal('token' in t, false);
    assert.equal('token_hash' in t, false);
  }
  assert.ok(r.json.tokens.some((t) => t.id === tokAllId));
});
