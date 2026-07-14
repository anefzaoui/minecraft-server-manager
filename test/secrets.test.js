'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt, tryDecrypt, generatePassword } = require('../src/services/secrets');

test('encrypt → decrypt round-trips arbitrary strings', () => {
  for (const plain of ['', 'hunter2', 'a$b$c with spaces', 'unicode ☃ 日本語', 'x'.repeat(4096)]) {
    assert.equal(decrypt(encrypt(plain)), plain);
  }
});

test('ciphertext format is iv.tag.data (three base64 parts)', () => {
  const c = encrypt('secret');
  assert.equal(c.split('.').length, 3);
});

test('each encryption uses a fresh IV (ciphertexts differ)', () => {
  assert.notEqual(encrypt('same'), encrypt('same'));
});

test('tampered ciphertext throws SECRET_KEY_MISMATCH (409)', () => {
  const c = encrypt('secret');
  const parts = c.split('.');
  const data = Buffer.from(parts[2], 'base64');
  data[0] ^= 0xff; // flip a bit in the ciphertext body
  parts[2] = data.toString('base64');
  assert.throws(
    () => decrypt(parts.join('.')),
    (err) => err.code === 'SECRET_KEY_MISMATCH' && err.status === 409
  );
});

test('tryDecrypt returns null instead of throwing on bad input', () => {
  assert.equal(tryDecrypt('not-a-valid-ciphertext'), null);
  assert.equal(tryDecrypt('a.b.c'), null);
});

test('generatePassword yields distinct URL-safe strings of the expected length', () => {
  const a = generatePassword();
  const b = generatePassword();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  // 18 bytes → 24 base64url chars
  assert.equal(generatePassword(18).length, 24);
});
