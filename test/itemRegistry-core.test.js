'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const reg = require('../src/services/itemRegistry');
const app = require('./helpers/app');
const { dataPath } = require('../src/storage/pathGuard');

test('parseModsToml reads modId/displayName pairs per [[mods]] block', () => {
  const names = reg.parseModsToml(`
[loader]
version = "x"
[[mods]]
modId = "jei"
displayName = "Just Enough Items"
[[mods]]
modId = "quark"
[[notmods]]
modId = "ignored"
`);
  assert.equal(names.get('jei'), 'Just Enough Items');
  assert.equal(names.get('quark'), null);
  assert.equal(names.has('ignored'), false);
});

test('parseLang extracts 3-segment item/block keys and skips sub-entries', () => {
  const out = reg.parseLang(
    JSON.stringify({
      'item.minecraft.diamond_sword': 'Diamond Sword',
      'block.minecraft.stone': 'Stone',
      'item.mymod.thing.desc': 'A description (4 segments - skipped)',
      'other.minecraft.x': 'Not item/block',
      'item.minecraft.blank': '   ',
    })
  );
  const ids = out.map((x) => x.id).sort();
  assert.deepEqual(ids, ['minecraft:diamond_sword', 'minecraft:stone']);
  const sword = out.find((x) => x.id === 'minecraft:diamond_sword');
  assert.equal(sword.kind, 'item');
  assert.equal(sword.name, 'Diamond Sword');
  const block = out.find((x) => x.id === 'minecraft:stone');
  assert.equal(block.kind, 'block');

  assert.deepEqual(reg.parseLang('not json'), []);
});

test('nearestVersion returns exact, newest-below, oldest, or null', () => {
  const available = ['1.20.4', '1.21', '1.21.1', '1.18.2'];
  assert.equal(reg.nearestVersion('1.21', available), '1.21'); // exact
  assert.equal(reg.nearestVersion('1.20.5', available), '1.20.4'); // newest below
  assert.equal(reg.nearestVersion('1.22', available), '1.21.1'); // newest below (1.22 > all)
  assert.equal(reg.nearestVersion('1.17', available), '1.18.2'); // older than all -> oldest
  assert.equal(reg.nearestVersion('', available), '1.21.1'); // newest
  assert.equal(reg.nearestVersion('LATEST', available), '1.21.1'); // newest
  assert.equal(reg.nearestVersion('1.21', []), null); // nothing available
});

test('iconBaseUrl returns the bundled icons base', () => {
  assert.equal(reg.iconBaseUrl(), '/icons/mc-items');
});

test('computeFingerprint counts mod jars and reflects mc_version', async () => {
  const sid = app.seedServer('iregfp');
  const mods = dataPath('servers', sid, 'mods');
  fs.mkdirSync(mods, { recursive: true });
  fs.writeFileSync(path.join(mods, 'a.jar'), Buffer.alloc(100));
  fs.writeFileSync(path.join(mods, 'b.jar'), Buffer.alloc(200));
  fs.writeFileSync(path.join(mods, 'notes.txt'), 'not a jar');

  const fp = await reg.computeFingerprint(sid);
  // v2|count|totalSize|mtime|vanilla|mc_version
  assert.match(fp, /^v2\|2\|300\|/);
});
