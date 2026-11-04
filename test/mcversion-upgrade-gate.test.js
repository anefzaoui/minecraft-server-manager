'use strict';

// #53: the upgrade apply paths refuse a loader-unsupported Minecraft target on
// a plugin-family server unless explicitly forced - mirroring the compat 409
// contract that the Updates page already renders as a friendly error toast.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;
let port = 26700;

function seedPaper(id, envJson = '{}') {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, 'PAPER', '26.2', ?, ?, 'x', 1024, 1536, 'stopped', 'notify', ?)`,
    id,
    id,
    port,
    port + 1,
    envJson
  );
  return id;
}

function seedProbe(mc, builds) {
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'loader:paper3:' + mc,
    JSON.stringify(builds)
  );
}

// Registry-down simulation for the probe: only loader-registry URLs fail (and
// only when `outage` is set); every other fetch - including app.req's own HTTP
// calls against the in-process server - must keep working.
const realFetch = globalThis.fetch;
let outage = false;
test.before(() => {
  globalThis.fetch = async (input, init) => {
    if (outage && /papermc\.io|purpurmc\.org|launchermeta\.mojang\.com/.test(String(input))) {
      throw new Error('registry unreachable');
    }
    return realFetch(input, init);
  };
});
test.after(() => {
  globalThis.fetch = realFetch;
});

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('a default-channel Paper server cannot upgrade to a version Paper has not built', async () => {
  const id = seedPaper('srv_u_hold');
  seedProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'ALPHA' }]);
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '26.3' },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.ok, false);
  assert.match(r.json.error, /Paper has not published a Minecraft 26\.3 build/);
  assert.match(r.json.error, /experimental channel/);
  assert.equal(db.get('SELECT mc_version FROM servers WHERE id = ?', id).mc_version, '26.2');
});

test('force is the explicit override past the loader gate', async () => {
  const id = seedPaper('srv_u_force');
  seedProbe('26.3', []);
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '26.3', force: true },
  });
  assert.equal(r.status, 202);
  assert.ok(r.json.taskId);
});

test('the experimental channel is a legitimate path to a pre-release build', async () => {
  const id = seedPaper('srv_u_alpha', JSON.stringify({ PAPER_CHANNEL: 'experimental' }));
  seedProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'ALPHA' }]);
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '26.3' },
  });
  assert.equal(r.status, 202);
});

test('an upgrade to a version Paper already ships passes the gate', async () => {
  const id = seedPaper('srv_u_shipped');
  seedProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'STABLE' }]);
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '26.3' },
  });
  assert.equal(r.status, 202);
});

test('a loader-build update is never gated', async () => {
  const id = seedPaper('srv_u_build');
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetLoaderBuild: '137', envKey: 'PAPER_BUILD' },
  });
  assert.equal(r.status, 202);
});

test('a registry outage does not invent a hold on the upgrade route', async () => {
  const id = seedPaper('srv_u_outage');
  // No probe cache AND the registry fetch fails = no data at all: must pass
  // through, not look like a hold.
  db.run("DELETE FROM api_cache WHERE key = 'loader:paper3:26.3'");
  outage = true;
  try {
    const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
      cookie,
      body: { targetVersion: '26.3' },
    });
    assert.equal(r.status, 202, 'no data at all must pass through, not look like a hold');
  } finally {
    outage = false;
  }
});

test('the Settings PATCH refuses an unsupported mcVersion the same way', async () => {
  const id = seedPaper('srv_u_patch');
  seedProbe('26.3', []);
  const r = await app.req('PATCH', `/api/servers/${id}`, { cookie, body: { mcVersion: '26.3' } });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /has not published a Minecraft 26\.3 build/);
  assert.equal(db.get('SELECT mc_version FROM servers WHERE id = ?', id).mc_version, '26.2');
});

test('the Settings PATCH passes an mcVersion change through when the registry is down', async () => {
  const id = seedPaper('srv_u_patch_outage');
  db.run("DELETE FROM api_cache WHERE key = 'loader:paper3:26.3'");
  outage = true;
  try {
    const r = await app.req('PATCH', `/api/servers/${id}`, { cookie, body: { mcVersion: '26.3' } });
    assert.equal(r.status, 200, 'no data at all must pass through, not look like a hold');
  } finally {
    outage = false;
  }
});

test('vanilla servers keep Mojang-latest behaviour on PATCH (no probe, no gate)', async () => {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, 'VANILLA', '26.2', ?, ?, 'x', 1024, 1536, 'stopped', 'notify', '{}')`,
    'srv_u_vanilla',
    'srv_u_vanilla',
    port,
    port + 1
  );
  const r = await app.req('PATCH', '/api/servers/srv_u_vanilla', { cookie, body: { mcVersion: '26.3' } });
  assert.equal(r.status, 200, 'the loader family is the only thing gated');
});
