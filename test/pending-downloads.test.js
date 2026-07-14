'use strict';

require('./helpers/env'); // sets DATA_DIR/SESSION_SECRET before any src/ module loads

const test = require('node:test');
const assert = require('node:assert');
const mods = require('../src/services/mods');

const SAMPLE = [
  'Mod                      Version Name                     Filename                             Download page',
  '=======================  ===============================  ===================================  ================',
  'unofficial cc:tweake...  cc-tweaked-1.21.1-forge-1.120.0  cc-tweaked-1.21.1-forge-1.120.0.jar  https://www.curseforge.com/minecraft/mc-mods/unofficial-cc-tweaked-v-1-120-1-cf/download/8273779',
].join('\n');

test('parseModsNeedDownload pulls filename, CF slug and file id from a data row', () => {
  const rows = mods.parseModsNeedDownload(SAMPLE);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.filename, 'cc-tweaked-1.21.1-forge-1.120.0.jar');
  assert.equal(r.slug, 'unofficial-cc-tweaked-v-1-120-1-cf'); // the exact slug CF_EXCLUDE_MODS needs
  assert.equal(r.fileId, '8273779');
  assert.match(r.name, /cc:tweake/);
});

test('parseModsNeedDownload ignores header, separator and blank lines', () => {
  assert.deepEqual(mods.parseModsNeedDownload(''), []);
  assert.deepEqual(mods.parseModsNeedDownload('Mod   Version   Filename   Download page\n===   ===   ===   ===\n'), []);
});

test('parseModsNeedDownload handles a page URL without a /download/<id> suffix', () => {
  const rows = mods.parseModsNeedDownload(
    'Some Mod  some-mod-1.0  some-mod-1.0.jar  https://www.curseforge.com/minecraft/mc-mods/some-mod'
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].slug, 'some-mod');
  assert.equal(rows[0].fileId, null);
});
