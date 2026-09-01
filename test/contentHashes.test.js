'use strict';

// Download integrity: registry-published checksums are verified against the
// streamed bytes (utils/contentHashes + library.downloadToLibrary).

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const env = require('./helpers/env');
const { migrate } = require('../src/db/migrate');
migrate();
fs.mkdirSync(path.join(env.dir, 'tmp'), { recursive: true }); // server.js creates this at boot
const db = require('../src/db');
const contentHashes = require('../src/utils/contentHashes');
const library = require('../src/services/library');

// ---- pure helpers -----------------------------------------------------------

test('fromCurseforge maps algo codes (1=sha1, 2=md5) and drops junk', () => {
  const out = contentHashes.fromCurseforge([
    { value: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01', algo: 1 },
    { value: 'ABCDEF0123456789ABCDEF0123456789', algo: 2 },
    { value: 'ignored', algo: 9 },
    null,
  ]);
  assert.equal(out.sha1, 'abcdef0123456789abcdef0123456789abcdef01');
  assert.equal(out.md5, 'abcdef0123456789abcdef0123456789');
  assert.equal(Object.keys(out).length, 2);
});

test('strongest prefers sha512 > sha256 > sha1 > md5 and rejects non-hex', () => {
  const hexes = {
    md5: 'a'.repeat(32),
    sha1: 'b'.repeat(40),
    sha256: 'c'.repeat(64),
    sha512: 'd'.repeat(128),
  };
  assert.deepEqual(contentHashes.strongest(hexes), { algo: 'sha512', hex: 'd'.repeat(128) });
  assert.deepEqual(contentHashes.strongest({ sha1: 'B'.repeat(40), md5: 'a'.repeat(32) }), {
    algo: 'sha1',
    hex: 'b'.repeat(40),
  });
  assert.equal(contentHashes.strongest({ sha512: 'not hex!' }), null);
  assert.equal(contentHashes.strongest({}), null);
  assert.equal(contentHashes.strongest(undefined), null);
});

// ---- streamed verification in downloadToLibrary -----------------------------

const BYTES = Buffer.from('definitely a mod jar');
const digest = (algo) => crypto.createHash(algo).update(BYTES).digest('hex');

// A public IP literal skips DNS in the SSRF guard; fetch itself is stubbed.
const URL_BASE = 'http://203.0.113.10';
const realFetch = globalThis.fetch;
function stubDownload() {
  globalThis.fetch = async () => new Response(BYTES, { status: 200 });
}
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('a download matching the published sha512 installs normally', async () => {
  stubDownload();
  const row = await library.downloadToLibrary(
    `${URL_BASE}/ok-sha512.jar`,
    { category: 'mod', filename: 'ok.jar', expectedHashes: { sha512: digest('sha512'), sha1: 'f'.repeat(40) } } // sha1 wrong but sha512 (stronger) wins
  );
  assert.equal(row.sha256, digest('sha256'));
  assert.ok(fs.existsSync(path.join(env.dir, row.rel_path)));
});

test('a published sha256 is compared against the dedupe hash directly', async () => {
  stubDownload();
  db.run('DELETE FROM library_files');
  const row = await library.downloadToLibrary(`${URL_BASE}/ok-sha256.jar`, {
    category: 'mod',
    filename: 'ok2.jar',
    expectedHashes: { sha256: digest('sha256') },
  });
  assert.equal(row.sha256, digest('sha256'));
});

test('a hash mismatch aborts the install and leaves nothing behind', async () => {
  stubDownload();
  db.run('DELETE FROM library_files');
  await assert.rejects(
    library.downloadToLibrary(`${URL_BASE}/bad.jar`, {
      category: 'mod',
      filename: 'bad.jar',
      expectedHashes: { sha1: '0'.repeat(40) },
    }),
    /integrity check/
  );
  assert.equal(db.get('SELECT COUNT(*) AS n FROM library_files').n, 0);
  const leftovers = fs.readdirSync(path.join(env.dir, 'tmp')).filter((f) => f.startsWith('dl-'));
  assert.deepEqual(leftovers, []);
});

test('no published hashes means no verification (unchanged behavior)', async () => {
  stubDownload();
  db.run('DELETE FROM library_files');
  const row = await library.downloadToLibrary(`${URL_BASE}/plain.jar`, { category: 'mod', filename: 'plain.jar' });
  assert.equal(row.sha256, digest('sha256'));
});
