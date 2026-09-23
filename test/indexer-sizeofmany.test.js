'use strict';

// The batched size lookup must preserve the root `''` row the index scan stores
// (results.set('', total)); dropping it made the Storage page total always 0 B.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const indexer = require('../src/storage/indexer');

test.before(async () => {
  await app.start();
  await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('sizeOfMany keeps the root total row alongside category rows', async () => {
  db.run('DELETE FROM storage_index');
  db.run("INSERT INTO storage_index (rel_path, size_bytes, file_count) VALUES ('', 1000000, 12)");
  db.run("INSERT INTO storage_index (rel_path, size_bytes, file_count) VALUES ('servers', 600000, 4)");
  db.run("INSERT INTO storage_index (rel_path, size_bytes, file_count) VALUES ('library', 250000, 3)");

  const sizes = indexer.sizeOfMany(['servers', '', 'library']);
  assert.equal(sizes.get(''), 1000000, 'root total must be present');
  assert.equal(sizes.get('servers'), 600000);
  assert.equal(sizes.get('library'), 250000);
  assert.equal(indexer.sizeOf(''), 1000000, 'sizeOf matches the batched read');
});

test('sizeOfMany with no paths resolves to an empty map', () => {
  assert.deepEqual(indexer.sizeOfMany([]), new Map());
});
