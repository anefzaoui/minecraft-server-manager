'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { extractZip } = require('../src/services/backups');

// Build a raw STORE-method zip with exact control over entry names. `archiver`
// sanitizes `../` out of names, so it can't produce a zip-slip fixture — we
// construct the bytes directly (yauzl enumerates entries from the central dir).
function crc32(buf) {
  return typeof zlib.crc32 === 'function' ? zlib.crc32(buf) >>> 0 : 0;
}
function makeRawZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const body = Buffer.from(data);
    const crc = crc32(body);
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(body.length, 18);
    lfh.writeUInt32LE(body.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    const localOffset = offset;
    local.push(lfh, nameBuf, body);
    offset += lfh.length + nameBuf.length + body.length;

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(body.length, 20);
    cdh.writeUInt32LE(body.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt32LE(localOffset, 42);
    central.push(cdh, nameBuf);
  }
  const cdStart = offset;
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  return Buffer.concat([...local, ...central, eocd]);
}

async function tmpZip(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-zip-'));
  const zip = path.join(dir, 'a.zip');
  fs.writeFileSync(zip, makeRawZip(entries));
  return { dir, zip, dest: path.join(dir, 'out') };
}

test('extractZip extracts a well-formed archive', async () => {
  const { dir, zip, dest } = await tmpZip([
    { name: 'world/level.dat', data: 'hello' },
    { name: 'config/a.txt', data: 'world' },
  ]);
  await extractZip(zip, dest);
  assert.equal(fs.readFileSync(path.join(dest, 'world/level.dat'), 'utf8'), 'hello');
  assert.equal(fs.readFileSync(path.join(dest, 'config/a.txt'), 'utf8'), 'world');
  await fsp.rm(dir, { recursive: true, force: true });
});

test('extractZip rejects a zip-slip entry that escapes the destination', async () => {
  const { dir, zip, dest } = await tmpZip([
    { name: '../evil.txt', data: 'pwned' },
    { name: 'ok.txt', data: 'fine' },
  ]);
  // Two layers stop this: yauzl's own filename validation ("invalid relative
  // path") and extractZip's explicit containment check ("escapes destination").
  // Either one rejecting is a pass — what matters is nothing escapes.
  await assert.rejects(() => extractZip(zip, dest), /escapes destination|invalid relative path/i);
  assert.equal(fs.existsSync(path.join(dir, 'evil.txt')), false, 'traversal target not written');
  await fsp.rm(dir, { recursive: true, force: true });
});
