'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const apiKeys = require('../src/services/apiKeys');
const app = require('./helpers/app');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

test('setKey/getKey round-trip stores the key encrypted at rest', () => {
  apiKeys.setKey('modrinth', 'sk_test_12345');
  assert.equal(apiKeys.getKey('modrinth'), 'sk_test_12345');
  const row = db.get('SELECT key_cipher FROM api_keys WHERE provider = ?', 'modrinth');
  assert.notEqual(row.key_cipher, 'sk_test_12345'); // not stored in cleartext
  assert.ok(row.key_cipher.split('.').length >= 3); // iv.tag.data format
});

test('getKey returns null when nothing is stored', () => {
  assert.equal(apiKeys.getKey('does-not-exist'), null);
});

test('getKey returns null on an undecryptable ciphertext (SESSION_SECRET changed)', () => {
  db.run('INSERT INTO api_keys (provider, key_cipher) VALUES (?, ?)', 'broken', 'x');
  assert.equal(apiKeys.getKey('broken'), null);
});

test('setKey upserts an existing provider rather than duplicating', () => {
  apiKeys.setKey('modrinth', 'first');
  apiKeys.setKey('modrinth', 'second');
  const rows = db.all('SELECT * FROM api_keys WHERE provider = ?', 'modrinth');
  assert.equal(rows.length, 1);
  assert.equal(apiKeys.getKey('modrinth'), 'second');
});

test('setKey curseforge flags matching servers for recreate but not others', () => {
  app.seedServer('key_cf1');
  db.run("UPDATE servers SET type = 'AUTO_CURSEFORGE' WHERE id = 'key_cf1'");
  const plain = app.seedServer('key_plain2');
  apiKeys.setKey('curseforge', 'cf-key-abcdef');
  assert.equal(db.get('SELECT pending_recreate FROM servers WHERE id = ?', 'key_cf1').pending_recreate, 1);
  assert.equal(db.get('SELECT pending_recreate FROM servers WHERE id = ?', plain).pending_recreate, 0);
});

test('deleteKey removes the stored key', () => {
  apiKeys.setKey('tmp', 'abc');
  assert.equal(apiKeys.getKey('tmp'), 'abc');
  apiKeys.deleteKey('tmp');
  assert.equal(apiKeys.getKey('tmp'), null);
});

test('maskedKey masks long keys and short keys', () => {
  apiKeys.setKey('mask1', '1234567890abcdef');
  assert.equal(apiKeys.maskedKey('mask1'), '1234…cdef');
  apiKeys.setKey('mask2', 'short');
  assert.equal(apiKeys.maskedKey('mask2'), '••••');
  assert.equal(apiKeys.maskedKey('mask-missing'), null);
});

test('testCurseForgeKey returns friendly error when no key is stored', async () => {
  apiKeys.deleteKey('curseforge');
  const res = await apiKeys.testCurseForgeKey();
  assert.deepEqual(res, { ok: false, error: 'No key stored' });
});

test('importFromEnvOnce is a no-op when no seed key is configured', () => {
  assert.doesNotThrow(() => apiKeys.importFromEnvOnce());
});
