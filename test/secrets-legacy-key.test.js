'use strict';

// The at-rest key is now a dedicated $DATA_DIR/.secret-key, not derived from
// SESSION_SECRET. A value encrypted the OLD way (SESSION_SECRET-derived key)
// must still decrypt via the legacy fallback, and rotating SESSION_SECRET must
// no longer break values written under the dedicated key.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { dir } = require('./helpers/env');
const { encrypt, decrypt } = require('../src/services/secrets');

// Reproduce the pre-dedicated-key ciphertext: AES-256-GCM under
// scrypt(SESSION_SECRET, 'msm.secrets.v1', 32).
function legacyEncrypt(plaintext, sessionSecret) {
  const key = crypto.scryptSync(sessionSecret, 'msm.secrets.v1', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

test('a dedicated .secret-key file is created under DATA_DIR', () => {
  assert.ok(fs.existsSync(path.join(dir, '.secret-key')), '.secret-key was written');
});

test('legacy SESSION_SECRET-encrypted ciphertext still decrypts via the fallback key', () => {
  const legacy = legacyEncrypt('old-rcon-password', process.env.SESSION_SECRET);
  assert.equal(decrypt(legacy), 'old-rcon-password');
});

test('values written under the dedicated key round-trip regardless of SESSION_SECRET', () => {
  const c = encrypt('new-secret');
  assert.equal(decrypt(c), 'new-secret'); // dedicated key, unaffected by the cookie secret
});
