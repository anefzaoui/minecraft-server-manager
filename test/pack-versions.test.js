'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const packs = require('../src/services/packs');
const modrinthApi = require('../src/services/modrinthApi');

// Newest first, the order the Modrinth API returns.
const VERSIONS = [
  { id: 'v4', version_number: '4.0.0', version_type: 'release', game_versions: ['1.21.1'], loaders: ['fabric'] },
  { id: 'v3', version_number: '3.1.0', version_type: 'release', game_versions: ['1.20.1'], loaders: ['fabric'] },
  { id: 'v2', version_number: '3.0.0', version_type: 'beta', game_versions: ['1.20.1'], loaders: ['fabric'] },
  { id: 'v1', version_number: '2.0.0', version_type: 'release', game_versions: ['1.19.2'], loaders: ['fabric'] },
].map((v) => ({ ...v, date_published: '2026-01-01T00:00:00Z' }));

function stubModrinth() {
  const real = {
    resolveUrl: modrinthApi.resolveUrl,
    getVersions: modrinthApi.getVersions,
    getVersion: modrinthApi.getVersion,
  };
  modrinthApi.resolveUrl = async () => ({ projectId: 'P1', slug: 'testpack', title: 'Test Pack', iconUrl: null });
  modrinthApi.getVersions = async () => VERSIONS;
  modrinthApi.getVersion = async (id) => VERSIONS.find((v) => v.id === id);
  return () => Object.assign(modrinthApi, real);
}

function recordPin(serverId, versionId, versionName) {
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES (?, 'modrinth', 'testpack', 'Test Pack', ?, ?)`,
    serverId,
    versionId,
    versionName
  );
}

function seedModrinthServer(id, env, mcVersion = '1.20.1') {
  app.seedServer(id);
  db.run(
    "UPDATE servers SET type = 'MODRINTH', env_json = ?, mc_version = ? WHERE id = ?",
    JSON.stringify(env),
    mcVersion,
    id
  );
  return id;
}

test('compareMcVersions orders releases and gives up on non-releases', () => {
  assert.equal(packs.compareMcVersions('1.20.1', '1.21'), -1);
  assert.equal(packs.compareMcVersions('1.21.1', '1.21'), 1);
  assert.equal(packs.compareMcVersions('1.20', '1.20.0'), 0);
  assert.equal(packs.compareMcVersions('LATEST', '1.20.1'), null);
  assert.equal(packs.compareMcVersions('1.20.1', null), null);
});

test('listPackVersions tags each version against the server and marks the pin', async (t) => {
  t.after(stubModrinth());
  const id = seedModrinthServer('srv_pvlist', { MODRINTH_MODPACK: 'testpack', MODRINTH_VERSION: 'v3' });
  recordPin(id, 'v3', '3.1.0');
  const list = await packs.listPackVersions(id);
  assert.equal(list.recorded, true);
  assert.equal(list.mcVersion, '1.20.1');
  assert.deepEqual(list.current, { id: 'v3', name: '3.1.0' });
  assert.deepEqual(
    list.versions.map((v) => [v.id, v.mcRelation, v.current]),
    [
      ['v4', 'newer', false],
      ['v3', 'same', true],
      ['v2', 'same', false],
      ['v1', 'older', false],
    ]
  );
});

test('listPackVersions works from the env alone when no pin is recorded', async (t) => {
  t.after(stubModrinth());
  const id = seedModrinthServer('srv_pvnorow', { MODRINTH_MODPACK: 'testpack' });
  const list = await packs.listPackVersions(id);
  assert.equal(list.recorded, false);
  assert.equal(list.current, null);
  assert.equal(list.projectName, 'Test Pack');
  assert.equal(list.versions.length, 4);
  assert.ok(list.versions.every((v) => !v.current));
});

test('listPackVersions refuses servers with no listable pack', async () => {
  const plain = app.seedServer('srv_pvplain');
  await assert.rejects(packs.listPackVersions(plain), { status: 400 });
  const ftb = app.seedServer('srv_pvftb');
  db.run("UPDATE servers SET type = 'FTBA', env_json = ? WHERE id = ?", JSON.stringify({ FTB_MODPACK_ID: '126' }), ftb);
  await assert.rejects(packs.listPackVersions(ftb), { status: 400 });
});

// /setup only answers once, so the route tests share one admin session.
let session;
async function adminSession() {
  await app.start();
  session ||= await app.adminCookie();
  return session;
}

// upgradePack decides all of these before any backup, stop or Docker call.
const upgrade = require('../src/updates/upgrade');

test('a pack version on an older Minecraft version is refused outright', async (t) => {
  t.after(stubModrinth());
  const id = seedModrinthServer('srv_pvolder', { MODRINTH_MODPACK: 'testpack', MODRINTH_VERSION: 'v3' });
  recordPin(id, 'v3', '3.1.0');
  await assert.rejects(upgrade.upgradePack(id, { versionId: 'v1', allowVersionChange: true }), (err) => {
    assert.equal(err.status, 409);
    assert.equal(err.olderMinecraft, true);
    assert.match(err.message, /older than this world \(1\.20\.1\)/);
    return true;
  });
});

test('a newer Minecraft version needs confirmation, the same version does not re-apply', async (t) => {
  t.after(stubModrinth());
  const id = seedModrinthServer('srv_pvnewer', { MODRINTH_MODPACK: 'testpack', MODRINTH_VERSION: 'v3' });
  recordPin(id, 'v3', '3.1.0');
  await assert.rejects(upgrade.upgradePack(id, { versionId: 'v4' }), (err) => {
    assert.equal(err.status, 409);
    assert.equal(err.requiresVersionConfirm, true);
    assert.equal(err.fromMcVersion, '1.20.1');
    assert.equal(err.toMcVersion, '1.21.1');
    return true;
  });
  await assert.rejects(upgrade.upgradePack(id, { versionId: 'v3' }), { status: 400 });
});

test('a server with no recorded pin reaches the version checks through its env', async (t) => {
  t.after(stubModrinth());
  const id = seedModrinthServer('srv_pvenv', { MODRINTH_MODPACK: 'testpack' });
  await assert.rejects(upgrade.upgradePack(id, { versionId: 'v1' }), { status: 409, olderMinecraft: true });
  const plain = app.seedServer('srv_pvnone');
  await assert.rejects(upgrade.upgradePack(plain, { versionId: 'v1' }), { status: 400 });
});

test('the versions route lists for Content holders and refuses viewers', async (t) => {
  t.after(stubModrinth());
  const cookie = await adminSession();
  const id = seedModrinthServer('srv_pvroute', { MODRINTH_MODPACK: 'testpack', MODRINTH_VERSION: 'v3' });
  recordPin(id, 'v3', '3.1.0');

  const ok = await app.req('GET', `/api/servers/${id}/pack/versions`, { cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.versions.length, 4);
  assert.equal(ok.json.mcVersion, '1.20.1');

  const authService = require('../src/services/auth');
  await authService.createUser({ username: 'pv_viewer', password: 'viewerpass123', role: 'viewer' }, { actor: 'test' });
  const login = await app.req('POST', '/login', { body: { username: 'pv_viewer', password: 'viewerpass123' } });
  const viewer = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  assert.equal((await app.req('GET', `/api/servers/${id}/pack/versions`, { cookie: viewer })).status, 403);
});

test('the upgrade route returns a newer-Minecraft target as a confirm request', async (t) => {
  t.after(stubModrinth());
  const cookie = await adminSession();
  const id = seedModrinthServer('srv_pvconfirm', { MODRINTH_MODPACK: 'testpack', MODRINTH_VERSION: 'v3' });
  recordPin(id, 'v3', '3.1.0');

  // Consent has to be a real boolean: the string "false" must not slip through as true.
  const bad = await app.req('POST', `/api/servers/${id}/pack/upgrade`, {
    cookie,
    body: { versionId: 'v4', allowVersionChange: 'false' },
  });
  assert.equal(bad.status, 400);

  const started = await app.req('POST', `/api/servers/${id}/pack/upgrade`, { cookie, body: { versionId: 'v4' } });
  assert.equal(started.status, 202);
  let task;
  for (let i = 0; i < 100; i++) {
    task = (await app.req('GET', `/api/tasks/${started.json.taskId}`, { cookie })).json.task;
    if (task.state !== 'running') break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(task.state, 'done', task.error || '');
  assert.equal(task.result.ok, false);
  assert.equal(task.result.requiresVersionConfirm, true);
  assert.equal(task.result.toMcVersion, '1.21.1');
});

test.after(async () => {
  await app.stop();
});
