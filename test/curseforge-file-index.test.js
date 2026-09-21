'use strict';

// The CurseForge shape version compatibility is built from (#52).
// latestFilesIndexes is the only affordable source for "which (Minecraft
// version, loader) pairs does this project publish" - 200 projects per
// request - so its normalization has to be exact: the API sends numeric
// release types and numeric loader ids, and the compat service reads names.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const apiKeys = require('../src/services/apiKeys');
const curseforge = require('../src/services/curseforgeApi');
const compat = require('../src/services/compat');

apiKeys.setKey('curseforge', 'test-key', { actor: 'test' });

// One project, one entry per (version, loader), exactly as the live API sends
// it - captured from api.curseforge.com/v1/mods/238222 (JEI).
const LIVE_SHAPE = {
  data: [
    {
      id: 238222,
      name: 'Just Enough Items (JEI)',
      slug: 'jei',
      classId: 6,
      latestFiles: [],
      latestFilesIndexes: [
        { gameVersion: '1.20.1', fileId: 1, filename: 'jei-1.20.1-forge.jar', releaseType: 1, modLoader: 1 },
        { gameVersion: '26.3', fileId: 2, filename: 'jei-26.3-neoforge.jar', releaseType: 2, modLoader: 6 },
        { gameVersion: '26.3', fileId: 3, filename: 'jei-26.3-fabric.jar', releaseType: 3, modLoader: 4 },
        { gameVersion: '1.20.1', fileId: 4, filename: 'jei-1.20.1-any.jar', releaseType: 1, modLoader: 0 },
      ],
    },
  ],
};

test('normalization keeps every (version, loader) pair and names the release type', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(LIVE_SHAPE), { status: 200 });
  try {
    const [mod] = await curseforge.getModsBulk([238222]);
    assert.equal(mod.latestFilesIndexes.length, 4, 'no entry may be dropped');
    assert.deepEqual(mod.latestFilesIndexes[0], {
      gameVersion: '1.20.1',
      fileId: 1,
      filename: 'jei-1.20.1-forge.jar',
      releaseType: 'release',
      modLoader: 1,
    });
    assert.equal(mod.latestFilesIndexes[1].releaseType, 'beta');
    assert.equal(mod.latestFilesIndexes[2].releaseType, 'alpha');
    assert.equal(mod.latestFilesIndexes[3].modLoader, 0, '"Any" is a real value, not a missing one');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the support map built from it reads betas, skips alphas, and keeps loaders apart', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(LIVE_SHAPE), { status: 200 });
  try {
    const support = await compat.fetchSupport([
      { file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' },
    ]);
    const map = support.get('curseforge:238222');
    // 1.20.1: a Forge build plus an "Any" build (stored as null).
    assert.deepEqual(map.versions['1.20.1'].sort(), [null, 'forge'].sort());
    // 26.3: the NeoForge beta counts, the Fabric ALPHA does not.
    assert.deepEqual(map.versions['26.3'], ['neoforge']);
    assert.equal(compat.supportsVersion(map, '26.3', 'forge'), false, 'a NeoForge build is not a Forge build');
    assert.equal(compat.supportsVersion(map, '26.3', 'neoforge'), true);
    assert.equal(compat.supportsVersion(map, '1.20.1', 'forge'), true);
    assert.equal(compat.supportsVersion(map, '1.20.1', 'fabric'), true, 'an "Any" build runs anywhere');
  } finally {
    globalThis.fetch = realFetch;
  }
});
