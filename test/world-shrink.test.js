'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const nbt = require('prismarine-nbt');
const { parseHeader, chunkInhabitedTime, repack, SECTOR } = require('../src/utils/mcaRegion');

// Build a chunk payload block (4-byte length + 1-byte comp type + zlib NBT),
// padded up to a whole number of 4 KiB sectors. Long value is [high, low].
function chunkBlock(inhabitedTicks) {
  const body = nbt.writeUncompressed(nbt.comp({ InhabitedTime: { type: 'long', value: [0, inhabitedTicks] } }));
  const comp = zlib.deflateSync(body);
  const head = Buffer.alloc(5);
  head.writeUInt32BE(comp.length + 1, 0);
  head.writeUInt8(2, 4); // zlib
  const raw = Buffer.concat([head, comp]);
  const sectors = Math.ceil(raw.length / SECTOR);
  const padded = Buffer.alloc(sectors * SECTOR);
  raw.copy(padded);
  return { padded, sectors };
}

// Assemble a region file from { headerIndex -> inhabitedTicks }.
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

test('parseHeader lists only present chunks with their coords', () => {
  const buf = makeRegion({ 0: 10, 33: 5000 }); // slot 0 => (0,0); slot 33 => (1,1)
  const entries = parseHeader(buf);
  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((e) => [e.x, e.z]),
    [
      [0, 0],
      [1, 1],
    ]
  );
});

test('chunkInhabitedTime decodes the Long', async () => {
  const buf = makeRegion({ 5: 42, 6: 123456 });
  const entries = parseHeader(buf);
  assert.equal(await chunkInhabitedTime(buf, entries[0]), 42);
  assert.equal(await chunkInhabitedTime(buf, entries[1]), 123456);
});

test('chunkInhabitedTime decodes a realistic InhabitedTime (regression: [high, low] word order)', async () => {
  // A chunk a player stood in for ~5 minutes: 6000 ticks. The old [low, high]
  // read returned 6000 * 2^32 here, so nothing ever counted as "rarely visited".
  const buf = makeRegion({ 0: 6000 });
  assert.equal(await chunkInhabitedTime(buf, parseHeader(buf)[0]), 6000);
});

test('repack drops the flagged slots and keeps the rest, shrinking the file', () => {
  const buf = makeRegion({ 0: 10, 1: 20, 2: 9999 });
  assert.equal(parseHeader(buf).length, 3);
  const packed = repack(buf, (idx) => idx === 2); // keep only slot 2
  assert.ok(packed);
  assert.equal(packed.kept, 1);
  assert.equal(packed.dropped, 2);
  assert.ok(packed.buffer.length < buf.length);
  const after = parseHeader(packed.buffer);
  assert.equal(after.length, 1);
  assert.equal(after[0].index, 2);
});

test('repack returns null when nothing would be dropped', () => {
  const buf = makeRegion({ 0: 10, 1: 20 });
  assert.equal(
    repack(buf, () => true),
    null
  );
});

test('a repacked region still decodes to the same InhabitedTime values', async () => {
  const buf = makeRegion({ 0: 100, 7: 700, 40: 4000 });
  const packed = repack(buf, (idx) => idx !== 0); // drop slot 0
  const entries = parseHeader(packed.buffer);
  const times = [];
  for (const e of entries) times.push(await chunkInhabitedTime(packed.buffer, e));
  assert.deepEqual(
    entries.map((e) => e.index),
    [7, 40]
  );
  assert.deepEqual(times, [700, 4000]);
});
