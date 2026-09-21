'use strict';

// The HTTP surface of version compatibility (#52): the report and its per
// version lists, and the gate that refuses a Minecraft version the installed
// mods cannot follow. The gate is what the Updates page hits, so its 409 has
// to carry the blocking mods, and `force` has to be the only way past it.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

let cookie;
let port = 26500;

function seedForgeServer(id, { mods = ['jei.jar'], mcVersion = '1.20.1' } = {}) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, 'FORGE', ?, ?, ?, 'x', 1024, 1536, 'stopped', 'notify', '{}')`,
    id,
    id,
    mcVersion,
    port,
    port + 1
  );
  const dir = dataPath('servers', id, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  for (const m of mods) fs.writeFileSync(path.join(dir, m), 'not-a-real-jar');
  return id;
}

const REPORT = {
  loader: 'forge',
  mcVersion: '1.20.1',
  modCount: 2,
  knownCount: 2,
  unknownCount: 0,
  unknown: [],
  highestCompatible: '1.20.4',
  partial: false,
  versions: [
    {
      version: '1.20.4',
      readyCount: 2,
      missingCount: 0,
      unknownCount: 0,
      status: 'ready',
      ready: [
        { file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' },
        { file: 'sodium.jar', name: 'Sodium', platform: 'modrinth', projectId: 'AANobbMI' },
      ],
      missing: [],
    },
    {
      version: '1.21.1',
      readyCount: 1,
      missingCount: 1,
      unknownCount: 0,
      status: 'blocked',
      ready: [{ file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' }],
      missing: [{ file: 'sodium.jar', name: 'Sodium', platform: 'modrinth', projectId: 'AANobbMI' }],
    },
  ],
};

function storeReport(serverId, report = REPORT) {
  db.run(
    `INSERT INTO version_compat (server_id, loader, mc_version, mods_signature, status, done, total, payload_json, started_at, updated_at, completed_at)
     VALUES (?, 'forge', '1.20.1', ?, 'done', 2, 2, ?, datetime('now'), datetime('now'), datetime('now'))
     ON CONFLICT(server_id) DO UPDATE SET payload_json = excluded.payload_json, status = 'done'`,
    serverId,
    require('../src/services/compat').modsSignature(serverId),
    JSON.stringify(report)
  );
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('the report ships summaries only, never every mod of every version', async () => {
  const id = seedForgeServer('srv_r_summary');
  storeReport(id);
  const r = await app.req('GET', `/api/servers/${id}/compat`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.report.highestCompatible, '1.20.4');
  assert.equal(r.json.report.versions.length, 2);
  for (const v of r.json.report.versions) {
    assert.equal(v.ready, undefined, 'per-version mod lists must not ride along');
    assert.equal(v.missing, undefined);
    assert.equal(typeof v.readyCount, 'number');
  }
});

test('one version at a time carries its own lists', async () => {
  const id = seedForgeServer('srv_r_one');
  storeReport(id);
  const r = await app.req('GET', `/api/servers/${id}/compat/versions/1.21.1`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.version.status, 'blocked');
  assert.deepEqual(
    r.json.version.missing.map((m) => m.name),
    ['Sodium']
  );
  assert.deepEqual(
    r.json.version.ready.map((m) => m.name),
    ['JEI']
  );
});

test('a version the scan never covered is a clean 404, not an empty page', async () => {
  const id = seedForgeServer('srv_r_404');
  storeReport(id);
  const r = await app.req('GET', `/api/servers/${id}/compat/versions/9.9.9`, { cookie });
  assert.equal(r.status, 404);
  assert.match(r.json.error, /version check/i);
});

test('an unscanned server reports honestly instead of guessing', async () => {
  const id = seedForgeServer('srv_r_unscanned');
  const r = await app.req('GET', `/api/servers/${id}/compat`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'idle');
  assert.equal(r.json.report, null);
});

test('a version update the mods cannot follow is refused, with the mods named', async () => {
  const id = seedForgeServer('srv_r_blocked');
  storeReport(id);
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '1.21.1' },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.ok, false);
  assert.equal(r.json.compat.reason, 'blocked');
  assert.equal(r.json.compat.targetVersion, '1.21.1');
  assert.deepEqual(
    r.json.compat.missing.map((m) => m.name),
    ['Sodium']
  );
  assert.match(r.json.error, /1\.21\.1/);
  // Refused before anything happened: the pin is untouched.
  assert.equal(db.get('SELECT mc_version FROM servers WHERE id = ?', id).mc_version, '1.20.1');
});

test('an unscanned modded server is refused too, and told what to do', async () => {
  const id = seedForgeServer('srv_r_noscan');
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '1.20.4' },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.compat.reason, 'no-scan');
  assert.match(r.json.error, /version check/i);
});

test('force is the deliberate way past the gate', async () => {
  const id = seedForgeServer('srv_r_force');
  storeReport(id);
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '1.21.1', force: true },
  });
  // Accepted as a task (it fails later without Docker - what matters is that
  // the compatibility gate let it through).
  assert.equal(r.status, 202);
  assert.ok(r.json.taskId);
});

test('a version every mod supports passes the gate untouched', async () => {
  const id = seedForgeServer('srv_r_allowed');
  storeReport(id);
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '1.20.4' },
  });
  assert.equal(r.status, 202);
});

test('a loader-build update is not a version change and is never gated', async () => {
  const id = seedForgeServer('srv_r_loader');
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetLoaderBuild: '47.3.0', envKey: 'FORGE_VERSION' },
  });
  assert.equal(r.status, 202);
});

test('a scan cannot be started for a server that follows the newest version', async () => {
  const id = seedForgeServer('srv_r_latest', { mcVersion: 'LATEST' });
  const r = await app.req('POST', `/api/servers/${id}/compat/scan`, { cookie, body: {} });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /newest Minecraft version/);
});

test('the Versions tab renders for a server with a stored report', async () => {
  const id = seedForgeServer('srv_r_page');
  storeReport(id);
  const r = await app.req('GET', `/servers/${id}/updates`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /Minecraft Version Compatibility/);
  assert.match(r.text, /Check Future Versions/);
  assert.match(r.text, /data-compat-version="1\.21\.1"/);
  // The mod lists are fetched per version - they must not be in the HTML.
  assert.ok(!/Sodium/.test(r.text), 'per-version mod names must not be server-rendered');
});
