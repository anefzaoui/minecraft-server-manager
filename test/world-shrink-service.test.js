'use strict';

// worldShrink.shrinkWorld orchestration: the spawn-keep radius and the
// InhabitedTime threshold are configurable, and a dry run never writes.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const nbt = require('prismarine-nbt');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const config = require('../src/config');
const { SECTOR } = require('../src/utils/mcaRegion');
const { shrinkWorld } = require('../src/services/worldShrink');

const SID = 'srv_shrink_svc';
const WORLD = 'world';

function chunkBlock(inhabitedTicks) {
  const body = nbt.writeUncompressed(nbt.comp({ InhabitedTime: { type: 'long', value: [0, inhabitedTicks] } }));
  const comp = zlib.deflateSync(body);
  const head = Buffer.alloc(5);
  head.writeUInt32BE(comp.length + 1, 0);
  head.writeUInt8(2, 4);
  const raw = Buffer.concat([head, comp]);
  const sectors = Math.ceil(raw.length / SECTOR);
  const padded = Buffer.alloc(sectors * SECTOR);
  raw.copy(padded);
  return { padded, sectors };
}

// chunks: { headerSlotIndex -> inhabitedTicks }
function makeRegion(chunks) {
  const header = Buffer.alloc(SECTOR * 2);
  const blocks = [];
  let sector = 2;
  for (const [index, ticks] of Object.entries(chunks)) {
    const { padded, sectors } = chunkBlock(ticks);
    header.writeUInt32BE(((sector << 8) | sectors) >>> 0, Number(index) * 4);
    header.writeUInt32BE(1700000000, SECTOR + Number(index) * 4);
    blocks.push(padded);
    sector += sectors;
  }
  return Buffer.concat([header, ...blocks]);
}

function seed() {
  db.run(
    `INSERT OR IGNORE INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, 'Shrink Svc', 'PAPER', 25680, 26680, 'x', 1024, 1536, 'stopped', '{}')`,
    SID
  );
  const regionDir = path.join(config.dataDir, 'servers', SID, WORLD, 'region');
  fs.mkdirSync(regionDir, { recursive: true });
  // slot 0 -> chunk (0,0), inside the default 8-chunk spawn keep.
  // slot 20 -> chunk (20,0), outside it. Both barely visited (1 tick).
  fs.writeFileSync(path.join(regionDir, 'r.0.0.mca'), makeRegion({ 0: 1, 20: 1 }));
}

test('default run keeps spawn chunks and only removes the far unvisited chunk', async () => {
  seed();
  const r = await shrinkWorld(SID, { worldName: WORLD, dryRun: true });
  assert.equal(r.chunksScanned, 2);
  assert.equal(r.chunksRemoved, 1); // slot 0 protected by the spawn-keep radius
  assert.equal(r.spawnKeepChunks, 8);
  assert.equal(r.minInhabitedTicks, 600);
});

test('spawnKeepChunks:0 lets the near-origin unvisited chunk be removed too', async () => {
  seed();
  const r = await shrinkWorld(SID, { worldName: WORLD, dryRun: true, spawnKeepChunks: 0 });
  assert.equal(r.chunksRemoved, 2);
});

test('a lower minInhabitedTicks spares chunks above the new threshold', async () => {
  seed();
  // Both chunks have InhabitedTime 1; threshold 1 means "remove if < 1" -> none.
  const r = await shrinkWorld(SID, { worldName: WORLD, dryRun: true, spawnKeepChunks: 0, minInhabitedTicks: 1 });
  assert.equal(r.chunksRemoved, 0);
});

test('the dry run does not modify the region file', async () => {
  seed();
  const abs = path.join(config.dataDir, 'servers', SID, WORLD, 'region', 'r.0.0.mca');
  const before = fs.readFileSync(abs);
  await shrinkWorld(SID, { worldName: WORLD, dryRun: true, spawnKeepChunks: 0 });
  assert.deepEqual(fs.readFileSync(abs), before);
});

// ---------------------------------------------------------------------------
// Companion stores, sub-dimensions, and the real spawn

const { SECTOR: SEC } = require('../src/utils/mcaRegion');

function levelDat(spawnX, spawnZ) {
  const root = nbt.comp({
    Data: nbt.comp({
      SpawnX: { type: 'int', value: spawnX },
      SpawnY: { type: 'int', value: 64 },
      SpawnZ: { type: 'int', value: spawnZ },
    }),
  });
  return zlib.gzipSync(nbt.writeUncompressed(root));
}

function presentSlots(file) {
  const buf = fs.readFileSync(file);
  const out = [];
  for (let i = 0; i < 1024; i++) if (buf.readUInt32BE(i * 4) !== 0) out.push(i);
  return out;
}

test('dropped chunks also leave the entities/ and poi/ region files', async () => {
  const world = path.join(config.dataDir, 'servers', SID, 'w_companion');
  for (const sub of ['region', 'entities', 'poi']) fs.mkdirSync(path.join(world, sub), { recursive: true });
  // slot 20 is far from spawn and unvisited -> dropped; slot 25 is visited -> kept
  fs.writeFileSync(path.join(world, 'region', 'r.0.0.mca'), makeRegion({ 20: 1, 25: 5000 }));
  fs.writeFileSync(path.join(world, 'entities', 'r.0.0.mca'), makeRegion({ 20: 1, 25: 1 }));
  fs.writeFileSync(path.join(world, 'poi', 'r.0.0.mca'), makeRegion({ 20: 1 }));
  const r = await shrinkWorld(SID, { worldName: 'w_companion' });
  assert.equal(r.chunksRemoved, 1);
  assert.deepEqual(presentSlots(path.join(world, 'region', 'r.0.0.mca')), [25]);
  assert.deepEqual(presentSlots(path.join(world, 'entities', 'r.0.0.mca')), [25], 'stale entities left with the chunk');
  assert.equal(fs.existsSync(path.join(world, 'poi', 'r.0.0.mca')), false, 'a poi file emptied by the drop is removed');
});

test('vanilla/Forge sub-dimensions (DIM-1, DIM1, dimensions/*) are shrunk too, without spawn protection', async () => {
  const world = path.join(config.dataDir, 'servers', SID, 'w_dims');
  fs.mkdirSync(path.join(world, 'region'), { recursive: true });
  fs.writeFileSync(path.join(world, 'region', 'r.0.0.mca'), makeRegion({ 0: 1 })); // spawn-protected in the overworld
  for (const sub of ['DIM-1', 'DIM1', path.join('dimensions', 'mymod', 'void')]) {
    fs.mkdirSync(path.join(world, sub, 'region'), { recursive: true });
    fs.writeFileSync(path.join(world, sub, 'region', 'r.0.0.mca'), makeRegion({ 0: 1 })); // same slot, no protection here
  }
  const r = await shrinkWorld(SID, { worldName: 'w_dims' });
  assert.deepEqual(r.dimensions.sort(), ['.', 'DIM-1', 'DIM1', path.join('dimensions', 'mymod', 'void')].sort());
  assert.equal(r.chunksRemoved, 3, 'the three sub-dimension chunks went, the overworld spawn chunk stayed');
  assert.equal(fs.existsSync(path.join(world, 'region', 'r.0.0.mca')), true);
  assert.equal(fs.existsSync(path.join(world, 'DIM-1', 'region', 'r.0.0.mca')), false);
});

test('spawn protection is centred on the level.dat spawn, not the world origin', async () => {
  const world = path.join(config.dataDir, 'servers', SID, 'w_spawn');
  fs.mkdirSync(path.join(world, 'region'), { recursive: true });
  fs.writeFileSync(path.join(world, 'level.dat'), levelDat(20 * 16 + 3, 0)); // spawn in chunk (20, 0)
  // slot 0 = chunk (0,0): far from the real spawn -> dropped. slot 20 = chunk (20,0): the spawn -> kept.
  fs.writeFileSync(path.join(world, 'region', 'r.0.0.mca'), makeRegion({ 0: 1, 20: 1 }));
  const r = await shrinkWorld(SID, { worldName: 'w_spawn' });
  assert.deepEqual(r.spawn, { cx: 20, cz: 0, source: 'level.dat' });
  assert.equal(r.chunksRemoved, 1);
  assert.deepEqual(presentSlots(path.join(world, 'region', 'r.0.0.mca')), [20]);
});

test('an unreadable chunk (unsupported compression) is kept and counted', async () => {
  const world = path.join(config.dataDir, 'servers', SID, 'w_lz4');
  fs.mkdirSync(path.join(world, 'region'), { recursive: true });
  const buf = makeRegion({ 20: 1 });
  buf.writeUInt8(4, 2 * SEC + 4); // flip slot 20's compression byte to 4 (LZ4)
  fs.writeFileSync(path.join(world, 'region', 'r.0.0.mca'), buf);
  const r = await shrinkWorld(SID, { worldName: 'w_lz4' });
  assert.equal(r.chunksRemoved, 0);
  assert.equal(r.chunksUnreadable, 1);
  assert.deepEqual(presentSlots(path.join(world, 'region', 'r.0.0.mca')), [20]);
});
