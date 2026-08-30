'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseLang, parseModsToml, nearestVersion, iconBaseUrl } = require('../src/services/itemRegistry');

test('parseLang keeps exact item/block keys, skips sub-entries and non-strings', () => {
  const buf = Buffer.from(
    JSON.stringify({
      'item.minecraft.diamond_sword': 'Diamond Sword',
      'block.minecraft.stone': 'Stone',
      'item.minecraft.diamond_sword.tooltip': 'A sharp sword', // 4-segment, skipped
      'itemGroup.combat': 'Combat', // not item./block., skipped
      'item.minecraft.empty': '',
      'item.minecraft.weird': 5,
    })
  );
  const out = parseLang(buf);
  assert.deepEqual(out.map((e) => e.id).sort(), ['minecraft:diamond_sword', 'minecraft:stone']);
  assert.equal(out.find((e) => e.id === 'minecraft:diamond_sword').kind, 'item');
  assert.equal(out.find((e) => e.id === 'minecraft:stone').kind, 'block');
});

test('parseLang tolerates malformed JSON', () => {
  assert.deepEqual(parseLang(Buffer.from('not json')), []);
});

test('parseModsToml reads modId/displayName pairs', () => {
  const toml = `
[[mods]]
modId = "examplemod"
displayName = "Example Mod"
version = "1.0"

[[mods]]
modId = "other"
`;
  const names = parseModsToml(toml);
  assert.equal(names.get('examplemod'), 'Example Mod');
  assert.equal(names.get('other'), null);
});

test('nearestVersion picks exact match, else the newest available at or below the request, else the oldest', () => {
  const available = ['1.20.1', '1.20.4', '1.21.1', '1.21.4'];
  assert.equal(nearestVersion('1.21.1', available), '1.21.1');
  assert.equal(nearestVersion('1.21.3', available), '1.21.1'); // between 1.21.1 and 1.21.4
  assert.equal(nearestVersion('1.22.0', available), '1.21.4'); // newer than everything
  assert.equal(nearestVersion('1.0.0', available), '1.20.1'); // older than everything -> oldest available
  assert.equal(nearestVersion('', available), '1.21.4'); // unparsable request -> newest
  assert.equal(nearestVersion('1.21.1', []), null);
});

test('iconBaseUrl points at the locally-bundled icon set, not an external CDN', () => {
  const base = iconBaseUrl();
  assert.equal(base, '/icons/mc-items');
  // Sanity-check the bundle itself is actually present (see scripts/fetch-wiki-icons.js).
  const dir = path.join(__dirname, '..', 'public', base);
  assert.ok(fs.existsSync(path.join(dir, 'diamond_sword.png')), 'bundled icon set is missing - run the fetch script');
});
