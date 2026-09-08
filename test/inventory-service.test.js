'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const inventory = require('../src/services/inventory');
const { dataPath } = require('../src/storage/pathGuard');

// ---------------------------------------------------------------------------
// Raw prismarine-nbt tree builders
// ---------------------------------------------------------------------------

function item(id, count, slot) {
  const v = { id: { type: 'string', value: id }, count: { type: 'int', value: count } };
  if (slot !== undefined) v.Slot = { type: 'byte', value: slot };
  return v;
}

function listRoot(entries) {
  return {
    Inventory: { type: 'list', value: { type: 'compound', value: entries } },
    EnderItems: { type: 'list', value: { type: 'compound', value: [] } },
    health: { type: 'float', value: 20 },
    Pos: { type: 'list', value: { type: 'double', value: [0, 64, 0] } },
    Dimension: { type: 'string', value: 'minecraft:overworld' },
  };
}

function equipmentRoot(overrides = {}) {
  return {
    DataVersion: { type: 'int', value: 4326 },
    equipment: { type: 'compound', value: {} },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveSlot
// ---------------------------------------------------------------------------

test('resolveSlot maps every container to nbt + rcon addressing', () => {
  assert.deepEqual(inventory.resolveSlot('hotbar', 0).rconSlot, 'hotbar.0');
  assert.equal(inventory.resolveSlot('hotbar', 0).nbtSlot, 0);
  assert.equal(inventory.resolveSlot('inventory', 0).nbtSlot, 9);
  assert.equal(inventory.resolveSlot('inventory', 0).rconSlot, 'inventory.0');
  assert.equal(inventory.resolveSlot('enderchest', 5).rconSlot, 'enderchest.5');
  assert.equal(inventory.resolveSlot('armor', 0).piece, 'head');
  assert.equal(inventory.resolveSlot('armor', 0).rconSlot, 'armor.head');
  assert.equal(inventory.resolveSlot('armor', 0).nbtSlot, 103);
  assert.equal(inventory.resolveSlot('offhand', 0).rconSlot, 'weapon.offhand');
  assert.equal(inventory.resolveSlot('offhand', 0).nbtSlot, -106);
});

test('resolveSlot rejects unknown containers and out-of-range slots', () => {
  assert.throws(
    () => inventory.resolveSlot('bogus', 0),
    (e) => e.status === 400
  );
  assert.throws(
    () => inventory.resolveSlot('hotbar', 9),
    (e) => e.status === 400
  );
  assert.throws(
    () => inventory.resolveSlot('hotbar', -1),
    (e) => e.status === 400
  );
  assert.throws(
    () => inventory.resolveSlot('hotbar', 'x'),
    (e) => e.status === 400
  );
});

// ---------------------------------------------------------------------------
// applyOfflineSlotEdit - list layout (pre-1.21.5)
// ---------------------------------------------------------------------------

test('applyOfflineSlotEdit set places an item into the Inventory list', () => {
  const root = listRoot([]);
  const meta = inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('inventory', 0), {
    op: 'set',
    item: 'minecraft:diamond',
    count: 3,
  });
  assert.deepEqual(meta, { item: 'minecraft:diamond', count: 3 });
  const list = root.Inventory.value.value;
  assert.equal(list.length, 1);
  assert.equal(list[0].Slot.value, 9);
  assert.equal(list[0].id.value, 'minecraft:diamond');
  assert.equal(list[0].count.value, 3);
});

test('applyOfflineSlotEdit set overwrites an existing slot', () => {
  const root = listRoot([item('minecraft:stone', 1, 9)]);
  inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('inventory', 0), {
    op: 'set',
    item: 'minecraft:iron_ingot',
    count: 2,
  });
  const list = root.Inventory.value.value;
  assert.equal(list.length, 1);
  assert.equal(list[0].id.value, 'minecraft:iron_ingot');
});

test('applyOfflineSlotEdit delete removes the item and reports meta', () => {
  const root = listRoot([item('minecraft:stone', 7, 9)]);
  const meta = inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('inventory', 0), { op: 'delete' });
  assert.deepEqual(meta, { item: 'minecraft:stone', count: 7 });
  assert.equal(root.Inventory.value.value.length, 0);
});

test('applyOfflineSlotEdit delete/count on an empty slot throws 404', () => {
  const root = listRoot([]);
  assert.throws(
    () => inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('inventory', 0), { op: 'delete' }),
    (e) => e.status === 404
  );
  assert.throws(
    () => inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('inventory', 0), { op: 'count', count: 2 }),
    (e) => e.status === 404
  );
});

test('applyOfflineSlotEdit count updates the count, preserving legacy Count flavor', () => {
  const root = listRoot([item('minecraft:gold_ingot', 5, 9)]);
  root.Inventory.value.value[0].Count = root.Inventory.value.value[0].count;
  delete root.Inventory.value.value[0].count;
  const meta = inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('inventory', 0), {
    op: 'count',
    count: 12,
  });
  assert.equal(meta.item, 'minecraft:gold_ingot');
  assert.equal(meta.count, 12);
  assert.equal(root.Inventory.value.value[0].Count.value, 12);
});

// ---------------------------------------------------------------------------
// applyOfflineSlotEdit - equipment compound (1.21.5+)
// ---------------------------------------------------------------------------

test('applyOfflineSlotEdit addresses equipment compound by piece', () => {
  const root = equipmentRoot();
  const meta = inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('armor', 0), {
    op: 'set',
    item: 'minecraft:netherite_helmet',
    count: 1,
  });
  assert.deepEqual(meta, { item: 'minecraft:netherite_helmet', count: 1 });
  const helmet = root.equipment.value.head;
  assert.equal(helmet.value.id.value, 'minecraft:netherite_helmet');
  assert.equal(helmet.value.Slot, undefined); // equipment entries carry no Slot
});

test('applyOfflineSlotEdit delete on equipment compound', () => {
  const root = equipmentRoot({
    equipment: {
      type: 'compound',
      value: { head: { type: 'compound', value: item('minecraft:diamond_helmet', 1) } },
    },
  });
  const meta = inventory.applyOfflineSlotEdit(root, inventory.resolveSlot('armor', 0), { op: 'delete' });
  assert.equal(meta.item, 'minecraft:diamond_helmet');
  assert.equal(root.equipment.value.head, undefined);
});

// ---------------------------------------------------------------------------
// applyOfflineMove
// ---------------------------------------------------------------------------

test('applyOfflineMove moves an item and stamps the destination Slot', () => {
  const root = listRoot([item('minecraft:diamond', 4, 9)]);
  const meta = inventory.applyOfflineMove(
    root,
    inventory.resolveSlot('inventory', 0),
    inventory.resolveSlot('enderchest', 0)
  );
  assert.deepEqual(meta, { item: 'minecraft:diamond', count: 4, swapped: false });
  assert.equal(root.Inventory.value.value.length, 0);
  assert.equal(root.EnderItems.value.value.length, 1);
  assert.equal(root.EnderItems.value.value[0].Slot.value, 0);
});

test('applyOfflineMove swaps items when the destination is occupied', () => {
  const root = listRoot([item('minecraft:diamond', 4, 9), item('minecraft:stone', 1, 10)]);
  const meta = inventory.applyOfflineMove(
    root,
    inventory.resolveSlot('inventory', 0),
    inventory.resolveSlot('inventory', 1)
  );
  assert.equal(meta.swapped, true);
  const list = root.Inventory.value.value;
  assert.equal(list[0].id.value, 'minecraft:diamond'); // moved to dest slot, slot 10
  assert.equal(list[0].Slot.value, 10);
  assert.equal(list[1].id.value, 'minecraft:stone'); // swap returns source slot, slot 9
  assert.equal(list[1].Slot.value, 9);
});

test('applyOfflineMove from an empty slot throws 404', () => {
  const root = listRoot([]);
  assert.throws(
    () => inventory.applyOfflineMove(root, inventory.resolveSlot('inventory', 0), { container: 'hotbar', slot: 0 }),
    (e) => e.status === 404
  );
});

// ---------------------------------------------------------------------------
// applyOfflineNestedEdit
// ---------------------------------------------------------------------------

test('applyOfflineNestedEdit set places a wrapped item into a backpack slot', () => {
  const shulker = {
    id: { type: 'string', value: 'minecraft:shulker_box' },
    count: { type: 'int', value: 1 },
    Slot: { type: 'byte', value: 9 },
    nested: {
      type: 'list',
      value: {
        type: 'compound',
        value: [{ Slot: { type: 'byte', value: 0 }, item: { type: 'compound', value: item('§:inner', 0) } }],
      },
    },
  };
  const root = listRoot([shulker]);
  const spec = inventory.resolveSlot('inventory', 0);
  const meta = inventory.applyOfflineNestedEdit(root, spec, {
    path: ['nested'],
    index: 0,
    op: 'set',
    item: 'minecraft:emerald',
    count: 5,
  });
  assert.deepEqual(meta, { item: 'minecraft:emerald', count: 5 });
  const slotEl = root.Inventory.value.value[0].nested.value.value[0];
  assert.equal(slotEl.item.value.id.value, 'minecraft:emerald');
  assert.equal(slotEl.item.value.count.value, 5);
  assert.equal(slotEl.Slot.value, 0);
});

test('applyOfflineNestedEdit validates the path', () => {
  const root = listRoot([]);
  const spec = inventory.resolveSlot('inventory', 0);
  assert.throws(
    () => inventory.applyOfflineNestedEdit(root, spec, { path: [], index: 0, op: 'set', item: 'x', count: 1 }),
    (e) => e.status === 400
  );
  assert.throws(
    () => inventory.applyOfflineNestedEdit(root, spec, { path: [''], index: 0, op: 'set', item: 'x', count: 1 }),
    (e) => e.status === 400
  );
});

test('applyOfflineNestedEdit 404s on a missing backpack and out-of-range index', () => {
  const root = listRoot([item('minecraft:diamond', 5, 9)]);
  const spec = inventory.resolveSlot('inventory', 0);
  assert.throws(
    () => inventory.applyOfflineNestedEdit(root, spec, { path: ['missing'], index: 0, op: 'set', item: 'x', count: 1 }),
    (e) => e.status === 404
  );
});

// ---------------------------------------------------------------------------
// getSnapshot / diffSnapshots
// ---------------------------------------------------------------------------

const SNAP_UUID = '00000000-0000-0000-0000-0000000000aa';

function writeSnapshot(ts, reason, data) {
  const dir = dataPath('logs', 'srv_snap01', 'inventories', SNAP_UUID);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${ts}-${reason}.json`;
  fs.writeFileSync(path.join(dir, name), JSON.stringify({ ts, reason, serverId: 'srv_snap01', data }));
  return `logs/srv_snap01/inventories/${SNAP_UUID}/${name}`;
}

function snapData(items) {
  return { uuid: SNAP_UUID, name: 'Steve', inventory: items, armor: [], offhand: null, enderChest: [] };
}

test('getSnapshot rejects invalid paths and missing files', () => {
  assert.throws(
    () => inventory.getSnapshot('srv_snap01', '../escape.json'),
    (e) => e.status === 400
  );
  assert.throws(
    () => inventory.getSnapshot('srv_snap01', 'logs/a/b/inventories/notauuid/1-x.json'),
    (e) => e.status === 400
  );
  assert.throws(
    () =>
      inventory.getSnapshot('srv_snap01', 'logs/srv_snap01/inventories/00000000-0000-0000-0000-0000000000aa/1-x.json'),
    (e) => e.status === 400
  );
  assert.throws(
    () =>
      inventory.getSnapshot(
        'srv_snap01',
        'logs/srv_snap01/inventories/00000000-0000-0000-0000-0000000000aa/1234567890-x.json'
      ),
    (e) => e.status === 404
  );
});

test('getSnapshot rejects a snapshot belonging to another server', () => {
  const rel = writeSnapshot(1234567890, 'manual', snapData([{ id: 'minecraft:stick', count: 2 }]));
  assert.throws(
    () => inventory.getSnapshot('srv_other', rel),
    (e) => e.status === 400
  );
});

test('getSnapshot parses a written snapshot', () => {
  const rel = writeSnapshot(1234567890, 'manual', snapData([{ id: 'minecraft:stick', count: 2 }]));
  const snap = inventory.getSnapshot('srv_snap01', rel);
  assert.equal(snap.ts, 1234567890);
  assert.equal(snap.reason, 'manual');
  assert.equal(snap.uuid, SNAP_UUID);
  assert.equal(snap.data.inventory[0].id, 'minecraft:stick');
});

test('diffSnapshots reports added, removed and changed items', () => {
  const a = writeSnapshot(1700000000000, 'manual', {
    ...snapData([
      { id: 'minecraft:stone', displayName: null, count: 5 },
      { id: 'minecraft:iron_ingot', displayName: null, count: 2 },
    ]),
  });
  const b = writeSnapshot(1700000000001, 'manual', {
    ...snapData([
      { id: 'minecraft:stone', displayName: null, count: 8 },
      { id: 'minecraft:diamond', displayName: null, count: 1 },
    ]),
  });
  const diff = inventory.diffSnapshots('srv_snap01', a, b);
  assert.equal(diff.b.ts, 1700000000001);
  const added = diff.added.map((i) => i.id);
  const removed = diff.removed.map((i) => i.id);
  const changed = diff.changed.map((i) => [i.id, i.from, i.to]);
  assert.deepEqual(added, ['minecraft:diamond']);
  assert.deepEqual(removed, ['minecraft:iron_ingot']);
  assert.deepEqual(changed, [['minecraft:stone', 5, 8]]);
});

test('snapshot round-trips listSnapshots/latest-file listing (no .dat needed for listing)', async () => {
  const rel = writeSnapshot(1700000000002, 'join', snapData([{ id: 'minecraft:apple', count: 1 }]));
  const listed = await inventory.listSnapshots('srv_snap01', SNAP_UUID);
  assert.ok(listed.some((s) => s.file === rel && s.ts === 1700000000002));
});
