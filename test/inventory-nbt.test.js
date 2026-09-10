'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const nbt = require('../src/services/inventory/nbt');

test('assertUuid validates/derives lowercased dashed UUIDs and rejects junk', () => {
  assert.equal(nbt.assertUuid('3F5F7C2A-8A4E-4A1A-9C1B-000000000001'), '3f5f7c2a-8a4e-4a1a-9c1b-000000000001');
  assert.throws(() => nbt.assertUuid(''), /Invalid player UUID/);
  assert.throws(() => nbt.assertUuid('not-a-uuid'), /Invalid player UUID/);
  assert.throws(() => nbt.assertUuid('3f5f7c2a8a4e4a1a9c1b000000000001'), /Invalid player UUID/); // undashed rejected
});

test('assertName validates java-style player names and rejects bad ones', () => {
  assert.equal(nbt.assertName('Steve123'), 'Steve123');
  assert.equal(nbt.assertName('_Steve_'), '_Steve_');
  assert.throws(() => nbt.assertName(''), /Invalid player name/);
  assert.throws(() => nbt.assertName('hax; rm -rf'), /Invalid player name/);
  assert.throws(() => nbt.assertName('ThisNameIsWayTooLong012'), /Invalid player name/);
});

test('assertItemId lowercases, trims, and rejects unsafe ids', () => {
  assert.equal(nbt.assertItemId('  MINEcraft:Diamond_SWord '), 'minecraft:diamond_sword');
  assert.equal(nbt.assertItemId('diamond'), 'diamond');
  assert.throws(() => nbt.assertItemId(''), /Invalid item id/);
  assert.throws(() => nbt.assertItemId('minecraft:diamond; drop all'), /Invalid item id/);
  assert.throws(() => nbt.assertItemId('minecraft:diamond sword'), /Invalid item id/);
});

test('textComponentToString flattens plain, JSON, object and array components', () => {
  assert.equal(nbt.textComponentToString(null), null);
  assert.equal(nbt.textComponentToString('  plain  '), 'plain');
  assert.equal(nbt.textComponentToString('§cRed§r text'), 'Red text');
  assert.equal(nbt.textComponentToString('{"text":"Hello"}'), 'Hello');
  assert.equal(nbt.textComponentToString('["a","b"]'), 'ab');
  assert.equal(nbt.textComponentToString({ text: 'A', extra: ['B', { text: 'C', extra: ['D'] }] }), 'ABCD');
  assert.equal(nbt.textComponentToString(42), '42');
  assert.equal(nbt.textComponentToString('   '), null);
});

test('normalizeEnchants handles array and mapped shapes', () => {
  // via normalizeItem tag
  const item = nbt.normalizeItem({
    id: 'minecraft:sword',
    Count: 1,
    tag: { Enchantments: [{ id: 'minecraft:sharpness', lvl: 5 }], Damage: 3 },
  });
  assert.equal(item.id, 'minecraft:sword');
  assert.equal(item.count, 1);
  assert.deepEqual(item.enchants, [{ id: 'minecraft:sharpness', lvl: 5 }]);
  assert.equal(item.damage, 3);

  // components mapped shape
  const c = nbt.normalizeItem({
    id: 'minecraft:sword',
    count: 2,
    Slot: 4,
    components: {
      'minecraft:enchantments': { levels: { 'minecraft:sharpness': 5, 'minecraft:unbreaking': 3 } },
      'minecraft:custom_name': '{"text":"My Sword"}',
      'minecraft:damage': 2,
    },
  });
  assert.equal(c.slot, 4);
  assert.equal(c.count, 2);
  assert.equal(c.displayName, 'My Sword');
  assert.deepEqual(c.enchants, [
    { id: 'minecraft:sharpness', lvl: 5 },
    { id: 'minecraft:unbreaking', lvl: 3 },
  ]);
  assert.equal(c.damage, 2);
});

test('normalizeItem rejects non-objects and degrades unknown structures', () => {
  assert.equal(nbt.normalizeItem(null), null);
  assert.equal(nbt.normalizeItem('nope'), null);
  assert.equal(nbt.normalizeItem({ count: 5 }), null); // no id
  // corrupt structure -> id+count only, no throw
  const bad = nbt.normalizeItem({ id: 'x', tag: { display: 'not-object' } });
  assert.equal(bad.id, 'x');
});

test('detectNestedInventories finds direct and wrapped item lists with labels', () => {
  const raw = {
    id: 'minecraft:shulker_box',
    count: 1,
    components: {
      'minecraft:container': [
        { slot: 0, item: { id: 'minecraft:diamond', count: 64 } },
        { slot: 1, item: { id: 'minecraft:apple', count: 3 } },
      ],
    },
  };
  const nested = nbt.detectNestedInventories(raw);
  assert.equal(nested.length, 1);
  assert.equal(nested[0].label, 'Container');
  assert.deepEqual(nested[0].path, ['components', 'minecraft:container']);
  assert.equal(nested[0].items.length, 2);
  assert.equal(nested[0].items[0].wrapped, true);
  assert.equal(nested[0].items[0].slot, 0);
  assert.equal(nested[0].items[0].id, 'minecraft:diamond');
  assert.equal(nested[0].items[0].count, 64);
  assert.equal(nested[0].items[1].id, 'minecraft:apple');
});

test('detectNestedInventories descends into nested backpacks and bounds depth', () => {
  const raw = {
    id: 'mod:backpack',
    tag: {
      Items: [
        {
          id: 'mod:inner',
          count: 1,
          Items: [{ id: 'minecraft:stick', count: 1 }],
        },
      ],
    },
  };
  const nested = nbt.detectNestedInventories(raw);
  // outer + inner list
  assert.equal(nested.length, 2);
  assert.equal(nested[0].label, 'Items');
  assert.equal(nested[0].items[0].id, 'mod:inner');
  assert.equal(nested[1].items[0].id, 'minecraft:stick');
});

test('normalizeItemDeep adds nested sub-inventories', () => {
  const deep = nbt.normalizeItemDeep({
    id: 'minecraft:shulker_box',
    components: { 'minecraft:container': [{ slot: 0, item: { id: 'minecraft:diamond', count: 1 } }] },
  });
  assert.ok(deep.nested);
  assert.equal(deep.nested.length, 1);
});

test('detectNestedInventories returns empty for non-lists and missing roots', () => {
  assert.deepEqual(nbt.detectNestedInventories({ id: 'x', components: { 'minecraft:custom_name': 'hi' } }), []);
  assert.deepEqual(nbt.detectNestedInventories(null), []);
  assert.deepEqual(nbt.detectNestedInventories({}), []);
});
