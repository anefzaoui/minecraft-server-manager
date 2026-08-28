'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { zipDirectory, extractZip } = require('../src/services/backups');

test('zipDirectory (worker thread) archives a tree, reports progress, and round-trips through extractZip', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-bkzip-'));
  const src = path.join(dir, 'world');
  fs.mkdirSync(path.join(src, 'region'), { recursive: true });
  fs.writeFileSync(path.join(src, 'level.dat'), 'X'.repeat(50_000));
  fs.writeFileSync(path.join(src, 'region', 'r.0.0.mca'), 'Y'.repeat(120_000));

  const out = path.join(dir, 'backup.zip');
  let progressSeen = 0;
  await zipDirectory(src, out, { onProgress: (bytes) => (progressSeen = bytes) });

  assert.ok(fs.statSync(out).size > 0, 'archive was written');
  assert.ok(progressSeen > 0, 'progress callback fired');

  const back = path.join(dir, 'restored');
  fs.mkdirSync(back, { recursive: true });
  await extractZip(out, back);
  assert.equal(fs.readFileSync(path.join(back, 'level.dat'), 'utf8').length, 50_000);
  assert.equal(fs.readFileSync(path.join(back, 'region', 'r.0.0.mca'), 'utf8').length, 120_000);

  await fsp.rm(dir, { recursive: true, force: true });
});

test('zipDirectory produces a valid, empty archive for an empty source (the "server never started" case)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-bkzip-'));
  const src = path.join(dir, 'empty');
  fs.mkdirSync(src, { recursive: true });
  const out = path.join(dir, 'backup.zip');

  await zipDirectory(src, out);
  assert.ok(fs.existsSync(out), 'archive still written');

  const back = path.join(dir, 'restored');
  fs.mkdirSync(back, { recursive: true });
  await extractZip(out, back); // must not throw on a zero-entry archive
  assert.deepEqual(fs.readdirSync(back), []);

  await fsp.rm(dir, { recursive: true, force: true });
});
