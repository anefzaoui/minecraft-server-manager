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
  const real = { resolveUrl: modrinthApi.resolveUrl, getVersions: modrinthApi.getVersions };
  modrinthApi.resolveUrl = async () => ({ projectId: 'P1', slug: 'testpack', title: 'Test Pack', iconUrl: null });
  modrinthApi.getVersions = async () => VERSIONS;
  return () => Object.assign(modrinthApi, real);
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
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES (?, 'modrinth', 'testpack', 'Test Pack', 'v3', '3.1.0')`,
    id
  );
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
