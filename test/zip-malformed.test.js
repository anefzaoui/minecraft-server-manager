'use strict';

// A zip whose entries yauzl itself refuses (a "../" path, control characters)
// is a fact about the upload, not a panel fault: every reader must surface it
// as a 400 with a sentence, never as a generic 500.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readZipIndex, extractZipSafe, readEntryBuffers, forEachEntryBuffer } = require('../src/utils/zip');

// Minimal stored-method zip writer (no deps) so the entry name can be anything.
function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zipOf(entries) {
  const parts = [];
  const central = [];
  let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const data = Buffer.from(e.data);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(off, 42);
    parts.push(lh, name, data);
    central.push(ch, name);
    off += lh.length + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, eocd]);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-zip-'));
const evil = path.join(dir, 'evil.zip');
fs.writeFileSync(
  evil,
  zipOf([
    { name: '../../escape.txt', data: 'x' },
    { name: 'ok.txt', data: 'y' },
  ])
);

test('every zip reader turns a yauzl-rejected entry into a 400', async () => {
  const is400 = (err) => err.status === 400 && /malformed|escapes/i.test(err.message);
  await assert.rejects(() => readZipIndex(evil), is400);
  await assert.rejects(() => readEntryBuffers(evil, () => true), is400);
  await assert.rejects(
    () =>
      forEachEntryBuffer(
        evil,
        () => true,
        async () => {}
      ),
    is400
  );
  await assert.rejects(() => extractZipSafe(evil, path.join(dir, 'out')), is400);
  assert.equal(fs.existsSync(path.join(dir, 'escape.txt')), false);
});

test('a well-formed zip still reads', async () => {
  const good = path.join(dir, 'good.zip');
  fs.writeFileSync(good, zipOf([{ name: 'a/b.txt', data: 'hello' }]));
  const { entries } = await readZipIndex(good);
  assert.deepEqual(
    entries.map((e) => e.name),
    ['a/b.txt']
  );
});
