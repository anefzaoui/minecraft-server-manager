'use strict';

// applyPack keeps the user's pack tuning (disabled pack mods, force-includes,
// install knobs) when only the version of the same pack changes, and starts
// clean when the pack itself changes.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const packs = require('../src/services/packs');

const envOf = (id) => JSON.parse(db.get('SELECT env_json FROM servers WHERE id = ?', id).env_json);
const setEnv = (id, env) => db.run('UPDATE servers SET env_json = ? WHERE id = ?', JSON.stringify(env), id);

const modrinth = (projectRef, versionId) => ({
  platform: 'modrinth',
  projectRef,
  projectName: projectRef,
  versionId,
  versionName: versionId,
  mcVersion: '1.20.1',
  loaders: ['fabric'],
});

test('a Modrinth version change keeps disabled pack mods and the other tuning', async () => {
  const id = app.seedServer('srv_tunemr');
  await packs.applyPack(id, modrinth('adrenaserver', 'v1'), { actor: 'test', force: true });
  setEnv(id, {
    ...envOf(id),
    MODRINTH_EXCLUDE_FILES: 'sodium\nlithium',
    MODRINTH_FORCE_INCLUDE_FILES: 'iris',
    MODRINTH_FORCE_SYNCHRONIZE: 'true',
    MODRINTH_PROJECTS: 'chunky',
    VIEW_DISTANCE: '10',
  });

  await packs.applyPack(id, modrinth('Adrenaserver', 'v2'), { actor: 'test', force: true });
  const env = envOf(id);
  assert.equal(env.MODRINTH_VERSION, 'v2');
  assert.equal(env.MODRINTH_EXCLUDE_FILES, 'sodium\nlithium');
  assert.equal(env.MODRINTH_FORCE_INCLUDE_FILES, 'iris');
  assert.equal(env.MODRINTH_FORCE_SYNCHRONIZE, 'true');
  assert.equal(env.MODRINTH_PROJECTS, 'chunky');
  assert.equal(env.VIEW_DISTANCE, '10');
});

test('switching to a different Modrinth pack drops the old pack tuning', async () => {
  const id = app.seedServer('srv_tunemr2');
  await packs.applyPack(id, modrinth('adrenaserver', 'v1'), { actor: 'test', force: true });
  setEnv(id, { ...envOf(id), MODRINTH_EXCLUDE_FILES: 'sodium', VIEW_DISTANCE: '10' });

  await packs.applyPack(id, modrinth('fabulously-optimized', 'f1'), { actor: 'test', force: true });
  const env = envOf(id);
  assert.equal(env.MODRINTH_MODPACK, 'fabulously-optimized');
  assert.equal(env.MODRINTH_EXCLUDE_FILES, undefined);
  assert.equal(env.VIEW_DISTANCE, '10');
});

test('a CurseForge version change on a server with no pack record keeps exclusions, drops the loader override', async () => {
  const id = app.seedServer('srv_tunecf');
  setEnv(id, {
    CF_SLUG: 'all-the-mods-10',
    CF_FILE_ID: '111',
    CF_MOD_LOADER_VERSION: '47.4.0',
    CF_EXCLUDE_MODS: 'jei',
    CF_IGNORE_MISSING_FILES: 'mods/x.jar',
  });

  await packs.applyPack(
    id,
    {
      platform: 'curseforge',
      projectRef: 'all-the-mods-10',
      projectName: 'All the Mods 10',
      versionId: '222',
      versionName: '2.0',
    },
    { actor: 'test', force: true }
  );
  const env = envOf(id);
  assert.equal(env.CF_FILE_ID, '222');
  assert.equal(env.CF_EXCLUDE_MODS, 'jei');
  assert.equal(env.CF_IGNORE_MISSING_FILES, 'mods/x.jar');
  assert.equal(env.CF_MOD_LOADER_VERSION, undefined);
});

test('a GTNH version change keeps GTNH_DELETE_BACKUPS but never SKIP_GTNH_UPDATE_CHECK', async () => {
  const id = app.seedServer('srv_tunegt');
  const gtnh = (v) => ({
    platform: 'gtnh',
    projectRef: 'gtnh',
    projectName: 'GT New Horizons',
    versionId: v,
    versionName: v,
  });
  await packs.applyPack(id, gtnh('2.7.4'), { actor: 'test', force: true });
  setEnv(id, { ...envOf(id), GTNH_DELETE_BACKUPS: 'true', SKIP_GTNH_UPDATE_CHECK: 'true' });

  await packs.applyPack(id, gtnh('2.8.4'), { actor: 'test', force: true });
  const env = envOf(id);
  assert.equal(env.GTNH_PACK_VERSION, '2.8.4');
  assert.equal(env.GTNH_DELETE_BACKUPS, 'true');
  assert.equal(env.SKIP_GTNH_UPDATE_CHECK, undefined);
});
