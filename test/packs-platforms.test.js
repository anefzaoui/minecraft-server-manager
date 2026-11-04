'use strict';

// Pack resolution for CurseForge / Modrinth / FTB, the pinned env each produces,
// the world-version guard on applyPack, and latestFor for non-GTNH packs.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate();
const db = require('../src/db');
const curseforge = require('../src/services/curseforgeApi');
const modrinth = require('../src/services/modrinthApi');
const worlds = require('../src/services/worlds');
const modsService = require('../src/services/mods');
const packs = require('../src/services/packs');

const seen = [];
curseforge.resolveUrl = async (ref) => {
  seen.push(ref);
  return { modId: 555, slug: 'atm10', name: 'ATM 10', iconUrl: 'i' };
};
const cfFiles = [
  { fileId: 3, name: 'v3-beta', releaseType: 'beta', gameVersions: ['NeoForge', '1.21.1'] },
  { fileId: 2, name: 'v2', releaseType: 'release', gameVersions: ['1.21.1', 'Java 21'], fileDate: 'd' },
  { fileId: 1, name: 'v1', releaseType: 'release', gameVersions: ['1.20.1'] },
];
curseforge.getFiles = async () => cfFiles;
curseforge.getFile = async (modId, fileId) => cfFiles.find((f) => f.fileId === fileId);
modrinth.resolveUrl = async () => ({ projectId: 'P1', slug: 'fabulous', title: 'Fabulous', iconUrl: 'm' });
const mrVersions = [
  { id: 'b', version_number: '2.0-beta', version_type: 'beta', game_versions: ['1.21', '1.21.1'], loaders: ['fabric'] },
  { id: 'a', version_number: '1.0', version_type: 'release', game_versions: ['1.20.1'], loaders: ['quilt', 'fabric'] },
];
modrinth.getVersions = async () => mrVersions;
modrinth.getVersion = async (id) => mrVersions.find((v) => v.id === id);

test('CurseForge: a bare slug is spelled out as a modpacks URL; ids and URLs pass through', async () => {
  seen.length = 0;
  await packs.resolvePack('curseforge', 'all-the-mods-10');
  await packs.resolvePack('curseforge', ' 555 ');
  await packs.resolvePack('curseforge', 'https://www.curseforge.com/minecraft/modpacks/x');
  assert.deepEqual(seen, [
    'https://www.curseforge.com/minecraft/modpacks/all-the-mods-10',
    '555',
    'https://www.curseforge.com/minecraft/modpacks/x',
  ]);
});

test('CurseForge: latest prefers the newest release over a newer beta, and reports the MC version', async () => {
  const r = await packs.resolvePack('curseforge', 'atm10');
  assert.equal(r.versionId, '2');
  assert.equal(r.mcVersion, '1.21.1');
  assert.equal(r.projectId, '555');
  assert.equal(r.allVersions.length, 3);
  assert.deepEqual(r.allVersions[1], { id: '2', name: 'v2', type: 'release', date: 'd' });
});

test('CurseForge: an explicit file wins, and no files at all is a 404', async () => {
  assert.equal((await packs.resolvePack('curseforge', 'atm10', { versionId: '1' })).mcVersion, '1.20.1');
  const saved = cfFiles.splice(0);
  await assert.rejects(
    () => packs.resolvePack('curseforge', 'atm10'),
    (e) => e.status === 404
  );
  cfFiles.push(...saved);
});

test('Modrinth: latest release, explicit version, loaders, and MC version from the last game version', async () => {
  const latest = await packs.resolvePack('modrinth', 'fabulous');
  assert.equal(latest.versionId, 'a');
  assert.equal(latest.mcVersion, '1.20.1');
  const pinned = await packs.resolvePack('modrinth', 'fabulous', { versionId: 'b' });
  assert.equal(pinned.mcVersion, '1.21.1');
  assert.deepEqual(pinned.loaders, ['fabric']);
  const saved = mrVersions.splice(0);
  await assert.rejects(
    () => packs.resolvePack('modrinth', 'fabulous'),
    (e) => e.status === 404
  );
  mrVersions.push(...saved);
});

test('FTB needs a numeric id and an explicit version, and an unknown platform is a 400', async () => {
  await assert.rejects(
    () => packs.resolvePack('ftb', 'no-digits', { versionId: '1' }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => packs.resolvePack('ftb', '123'),
    (e) => e.status === 400 && /explicit version/.test(e.message)
  );
  const r = await packs.resolvePack('ftb', 'pack/123', { versionId: 77 });
  assert.deepEqual([r.projectRef, r.versionId, r.mcVersion], ['123', '77', null]);
  await assert.rejects(
    () => packs.resolvePack('bogus', 'x'),
    (e) => e.status === 400
  );
});

test('packEnv pins each platform; Modrinth records only a known loader', () => {
  assert.deepEqual(packs.packEnv({ platform: 'curseforge', projectRef: 's', versionId: '9' }), {
    TYPE: 'AUTO_CURSEFORGE',
    CF_SLUG: 's',
    CF_FILE_ID: '9',
  });
  assert.equal(
    packs.packEnv({ platform: 'modrinth', projectRef: 's', versionId: 'v', loaders: ['datapack', 'quilt'] })
      .MODRINTH_LOADER,
    'quilt'
  );
  assert.ok(!('MODRINTH_LOADER' in packs.packEnv({ platform: 'modrinth', projectRef: 's', versionId: 'v' })));
  assert.deepEqual(packs.packEnv({ platform: 'ftb', projectRef: '1', versionId: '2' }), {
    TYPE: 'FTBA',
    FTB_MODPACK_ID: '1',
    FTB_MODPACK_VERSION_ID: '2',
  });
});

let port = 28100;
function seed(id, env = {}) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, env_json)
     VALUES (?, ?, 'PAPER', '1.20.1', ?, ?, 'x', 1024, 1536, ?)`,
    id,
    id,
    port,
    port + 1,
    JSON.stringify(env)
  );
}
const resolved = (over = {}) => ({
  platform: 'curseforge',
  projectRef: 'atm10',
  projectName: 'ATM 10',
  versionId: '2',
  versionName: 'v2',
  mcVersion: '1.21.1',
  ...over,
});

test('applyPack: unknown server is 404', async () => {
  await assert.rejects(
    () => packs.applyPack('srv_none', resolved()),
    (e) => e.status === 404
  );
});

test('applyPack: a world on another MC version needs force; upgrade vs downgrade are worded differently', async () => {
  seed('srv_pk_guard');
  worlds.readLevelVersion = () => '1.20.1';
  await assert.rejects(
    () => packs.applyPack('srv_pk_guard', resolved({ mcVersion: '1.21.1' })),
    (e) => e.status === 409 && e.requiresForce && /permanently upgrade the world/.test(e.message)
  );
  worlds.readLevelVersion = () => '1.21.4';
  await assert.rejects(
    () => packs.applyPack('srv_pk_guard', resolved({ mcVersion: '1.20.1' })),
    (e) => e.status === 409 && /cannot load newer worlds/.test(e.message)
  );
  assert.equal(db.get('SELECT type FROM servers WHERE id = ?', 'srv_pk_guard').type, 'PAPER', 'nothing was written');
});

test('applyPack: matching world, unreadable level.dat, or force all proceed', async () => {
  seed('srv_pk_ok');
  worlds.readLevelVersion = () => '1.21.1';
  await packs.applyPack('srv_pk_ok', resolved());
  seed('srv_pk_unreadable');
  worlds.readLevelVersion = () => {
    throw new Error('corrupt');
  };
  await packs.applyPack('srv_pk_unreadable', resolved());
  seed('srv_pk_force');
  worlds.readLevelVersion = () => '1.19.2';
  await packs.applyPack('srv_pk_force', resolved(), { force: true });
  assert.equal(db.get('SELECT mc_version FROM servers WHERE id = ?', 'srv_pk_force').mc_version, '1.21.1');
});

test('applyPack: first apply is "applied", a change is "updated" and remembers the previous pin', async () => {
  seed('srv_pk_hist', { CF_SLUG: 'stale', CF_EXCLUDE_MODS: 'x', KEEP_ME: 'yes' });
  worlds.readLevelVersion = () => null;
  const first = await packs.applyPack('srv_pk_hist', resolved());
  assert.equal(first.previous, null);
  const second = await packs.applyPack('srv_pk_hist', resolved({ versionId: '3', versionName: 'v3' }));
  assert.equal(second.previous.pinned_version_id, '2');
  const pack = packs.getPack('srv_pk_hist');
  assert.deepEqual([pack.pinned_version_id, pack.previous_version_id, pack.previous_version_name], ['3', '2', 'v2']);
  const row = db.get('SELECT type, env_json, pending_recreate FROM servers WHERE id = ?', 'srv_pk_hist');
  assert.equal(row.type, 'AUTO_CURSEFORGE');
  assert.equal(row.pending_recreate, 1);
  const env = JSON.parse(row.env_json);
  assert.equal(env.KEEP_ME, 'yes', 'unrelated env survives');
  assert.ok(!('CF_EXCLUDE_MODS' in env), 'stale pack env is stripped');
  assert.equal(env.CF_SLUG, 'atm10');
  const kinds = db.all("SELECT type FROM events WHERE server_id = 'srv_pk_hist'").map((e) => e.type);
  assert.deepEqual(kinds.sort(), ['modpack-applied', 'modpack-updated']);
});

test('applyPack: a pack with no MC version leaves the server mc_version alone', async () => {
  seed('srv_pk_nomc');
  worlds.readLevelVersion = () => null;
  await packs.applyPack('srv_pk_nomc', resolved({ platform: 'ftb', projectRef: '9', mcVersion: null }));
  assert.equal(db.get('SELECT mc_version FROM servers WHERE id = ?', 'srv_pk_nomc').mc_version, '1.20.1');
});

test('latestFor: no pack and FTB packs are null; CurseForge reports an available update', async () => {
  assert.equal(await packs.latestFor('srv_pk_none'), null);
  seed('srv_pk_ftb');
  worlds.readLevelVersion = () => null;
  await packs.applyPack('srv_pk_ftb', resolved({ platform: 'ftb', projectRef: '9', mcVersion: null }));
  assert.equal(await packs.latestFor('srv_pk_ftb'), null);

  seed('srv_pk_lf');
  await packs.applyPack('srv_pk_lf', resolved({ versionId: '1', versionName: 'v1', mcVersion: '1.21.1' }));
  const r = await packs.latestFor('srv_pk_lf');
  assert.equal(r.updateAvailable, true);
  assert.deepEqual(r.latest, { id: '2', name: 'v2' });
  assert.deepEqual(r.current, { id: '1', name: 'v1' });
  await packs.applyPack('srv_pk_lf', resolved());
  assert.equal((await packs.latestFor('srv_pk_lf')).updateAvailable, false);
});

test('afterPackOperation re-applies the custom mod overlay', async () => {
  let called;
  modsService.reapplyOverlay = async (id, o) => {
    called = [id, o];
    return 'done';
  };
  assert.equal(await packs.afterPackOperation('srv_x', { actor: 'a' }), 'done');
  assert.deepEqual(called, ['srv_x', { actor: 'a' }]);
});
