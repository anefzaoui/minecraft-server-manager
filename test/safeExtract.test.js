'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { extractZip, safeEntryName } = require('../src/utils/zip');

// Raw STORE-method zip builder - `archiver` sanitizes `../` out of names, so a
// zip-slip / bomb fixture has to be assembled byte by byte (yauzl reads the
// central directory).
function crc32(buf) {
  return typeof zlib.crc32 === 'function' ? zlib.crc32(buf) >>> 0 : 0;
}
function makeRawZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data, deflate } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(data);
    const crc = crc32(raw);
    const body = deflate ? zlib.deflateRawSync(raw) : raw;
    const method = deflate ? 8 : 0;
    const csize = body.length;
    const usize = raw.length;
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(csize, 18);
    lfh.writeUInt32LE(usize, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    const localOffset = offset;
    local.push(lfh, nameBuf, body);
    offset += lfh.length + nameBuf.length + body.length;

    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(csize, 20);
    cdh.writeUInt32LE(usize, 24);
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-safeextract-'));
  const zip = path.join(dir, 'a.zip');
  fs.writeFileSync(zip, makeRawZip(entries));
  const dest = path.join(dir, 'out');
  fs.mkdirSync(dest, { recursive: true });
  return { dir, zip, dest };
}

test('safeEntryName rejects traversal, absolute, backslash, NUL and drive-letter paths', () => {
  for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'a\\b', 'C:\\x', 'a\0b', '']) {
    assert.equal(safeEntryName(bad), false, `${JSON.stringify(bad)} must be rejected`);
  }
  for (const ok of ['world/level.dat', 'config/a.txt', 'a.b.c', 'nested/deep/ok']) {
    assert.equal(safeEntryName(ok), true, `${JSON.stringify(ok)} must be allowed`);
  }
});

test('extractZip writes a well-formed archive under destDir', async () => {
  const { dir, zip, dest } = await tmpZip([
    { name: 'world/level.dat', data: 'hello' },
    { name: 'config/a.txt', data: 'world' },
  ]);
  await extractZip(zip, dest);
  assert.equal(fs.readFileSync(path.join(dest, 'world/level.dat'), 'utf8'), 'hello');
  assert.equal(fs.readFileSync(path.join(dest, 'config/a.txt'), 'utf8'), 'world');
  await fsp.rm(dir, { recursive: true, force: true });
});

test('extractZip rejects a zip-slip entry and writes nothing outside destDir', async () => {
  const { dir, zip, dest } = await tmpZip([{ name: '../evil.txt', data: 'pwned' }]);
  await assert.rejects(() => extractZip(zip, dest), /escapes destination|invalid relative path/i);
  assert.equal(fs.existsSync(path.join(dir, 'evil.txt')), false);
  await fsp.rm(dir, { recursive: true, force: true });
});

test('extractZip enforces the entry-count ceiling', async () => {
  const { dir, zip, dest } = await tmpZip(Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.txt`, data: 'x' })));
  await assert.rejects(
    () => extractZip(zip, dest, { maxEntries: 3 }),
    (e) => e.status === 413
  );
  await fsp.rm(dir, { recursive: true, force: true });
});

test('extractZip enforces the uncompressed-size ceiling on a genuinely compressed entry (bomb)', async () => {
  // 200 KB of one byte -> a few hundred bytes deflated. The `entry` handler sees
  // uncompressedSize = 200000 from the central directory and rejects before a
  // single byte is inflated to disk.
  const { dir, zip, dest } = await tmpZip([{ name: 'bomb.bin', data: 'A'.repeat(200_000), deflate: true }]);
  await assert.rejects(
    () => extractZip(zip, dest, { maxBytes: 4096 }),
    (e) => e.status === 413
  );
  assert.equal(fs.existsSync(path.join(dest, 'bomb.bin')), false);
  await fsp.rm(dir, { recursive: true, force: true });
});

test('extractZip allows that same compressed entry when it fits under the ceiling', async () => {
  const { dir, zip, dest } = await tmpZip([{ name: 'ok.bin', data: 'A'.repeat(200_000), deflate: true }]);
  await extractZip(zip, dest, { maxBytes: 1024 ** 2 });
  assert.equal(fs.statSync(path.join(dest, 'ok.bin')).size, 200_000);
  await fsp.rm(dir, { recursive: true, force: true });
});
