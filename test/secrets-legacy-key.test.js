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
const { encrypt, decrypt, reEncryptIfLegacy, hasLegacyFallback } = require('../src/services/secrets');

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

test('reEncryptIfLegacy rewrites a legacy ciphertext under the dedicated key', () => {
  assert.ok(hasLegacyFallback(), 'both a dedicated and a legacy key exist in this test env');

  const legacy = legacyEncrypt('rotate-me', process.env.SESSION_SECRET);
  const fresh = reEncryptIfLegacy(legacy);
  assert.ok(fresh && fresh !== legacy, 'a fresh ciphertext was produced');
  assert.equal(decrypt(fresh), 'rotate-me');

  // Now it opens under the dedicated key alone - re-running is a no-op.
  assert.equal(reEncryptIfLegacy(fresh), null);
});

test('reEncryptIfLegacy leaves current, empty, and tampered values alone', () => {
  assert.equal(reEncryptIfLegacy(encrypt('already-current')), null);
  assert.equal(reEncryptIfLegacy(''), null);
  assert.equal(reEncryptIfLegacy('a.b.c'), null);
  assert.equal(reEncryptIfLegacy('garbage'), null);
});

test('a corrupt .secret-key is a hard error, not a silent regenerate', () => {
  // A separate throwaway DATA_DIR so we don't disturb this process's loaded key.
  const os = require('node:os');
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-badkey-'));
  fs.writeFileSync(path.join(bad, '.secret-key'), 'not-valid-hex\n');

  const { execFileSync } = require('node:child_process');
  const script =
    "try { require('./src/services/secrets'); console.log('NO_THROW'); } catch (e) { console.error('CODE:' + e.code); process.exit(3); }";
  assert.throws(
    () =>
      execFileSync(process.execPath, ['-e', script], {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, DATA_DIR: bad, LOG_LEVEL: 'silent', LOG_PRETTY: 'false' },
        stdio: 'pipe',
      }),
    (err) => /CODE:SECRET_KEY_CORRUPT/.test(String(err.stderr))
  );
  // The corrupt file is preserved for the operator to restore.
  assert.equal(fs.readFileSync(path.join(bad, '.secret-key'), 'utf8'), 'not-valid-hex\n');
  fs.rmSync(bad, { recursive: true, force: true });
});
