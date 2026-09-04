'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { unpinnedPackSelectors, assertPinnedPackEnv } = require('../src/services/packPins');

test('pinned pack envs pass for every platform', () => {
  assert.deepEqual(unpinnedPackSelectors('AUTO_CURSEFORGE', { CF_SLUG: 'all-the-mods-10', CF_FILE_ID: '5891234' }), []);
  assert.deepEqual(
    unpinnedPackSelectors('MODRINTH', { MODRINTH_MODPACK: 'cobblemon', MODRINTH_VERSION: 'AbCd1234' }),
    []
  );
  assert.deepEqual(unpinnedPackSelectors('FTBA', { FTB_MODPACK_ID: '126', FTB_MODPACK_VERSION_ID: '11929' }), []);
  assert.deepEqual(unpinnedPackSelectors('GTNH', { GTNH_PACK_VERSION: '2.8.4' }), []);
  assert.doesNotThrow(() => assertPinnedPackEnv('AUTO_CURSEFORGE', { CF_SLUG: 'atm10', CF_FILE_ID: '1' }));
});

test('unpinned selectors are detected per platform', () => {
  assert.equal(unpinnedPackSelectors('AUTO_CURSEFORGE', { CF_SLUG: 'all-the-mods-10' })[0].pinKey, 'CF_FILE_ID');
  assert.equal(
    unpinnedPackSelectors('AUTO_CURSEFORGE', { CF_PAGE_URL: 'https://www.curseforge.com/minecraft/modpacks/atm10' })[0]
      .pinKey,
    'CF_FILE_ID'
  );
  assert.equal(unpinnedPackSelectors('MODRINTH', { MODRINTH_MODPACK: 'cobblemon' })[0].pinKey, 'MODRINTH_VERSION');
  assert.equal(unpinnedPackSelectors('FTBA', { FTB_MODPACK_ID: '126' })[0].pinKey, 'FTB_MODPACK_VERSION_ID');
  assert.equal(unpinnedPackSelectors('GTNH', {})[0].pinKey, 'GTNH_PACK_VERSION');
});

test('URL-embedded pins and fixed local zips count as pinned', () => {
  assert.deepEqual(
    unpinnedPackSelectors('AUTO_CURSEFORGE', {
      CF_PAGE_URL: 'https://www.curseforge.com/minecraft/modpacks/atm10/files/5891234',
    }),
    []
  );
  assert.deepEqual(
    unpinnedPackSelectors('MODRINTH', { MODRINTH_MODPACK: 'https://modrinth.com/modpack/cobblemon/version/1.6.1' }),
    []
  );
  assert.deepEqual(
    unpinnedPackSelectors('AUTO_CURSEFORGE', { CF_SLUG: 'atm10', CF_MODPACK_ZIP: '/packs/mine.zip' }),
    []
  );
});

test('empty-string pins do not count as pinned', () => {
  assert.equal(unpinnedPackSelectors('AUTO_CURSEFORGE', { CF_SLUG: 'atm10', CF_FILE_ID: '  ' }).length, 1);
});

test('non-pack servers and selector-less pack types are left alone', () => {
  assert.deepEqual(unpinnedPackSelectors('PAPER', { MEMORY: '4G' }), []);
  // AUTO_CURSEFORGE with no selector at all can't auto-update anything; the
  // container's own "no modpack given" failure is not this guard's business.
  assert.deepEqual(unpinnedPackSelectors('AUTO_CURSEFORGE', {}), []);
});

test('assertPinnedPackEnv throws a 400 naming the missing pin', () => {
  try {
    assertPinnedPackEnv('AUTO_CURSEFORGE', { CF_SLUG: 'all-the-mods-10' });
    assert.fail('expected a throw');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.match(err.message, /CF_FILE_ID/);
    assert.match(err.message, /every start/);
  }
});
