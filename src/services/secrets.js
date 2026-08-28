'use strict';

// At-rest encryption for RCON passwords, third-party API keys, TOTP secrets and
// the Discord webhook URL: AES-256-GCM.
// Ciphertext format: base64(iv).base64(tag).base64(data)
//
// The key is a dedicated 32-byte random value persisted at $DATA_DIR/.secret-key
// (mode 0600), independent of SESSION_SECRET - so rotating the cookie-signing
// secret no longer destroys every stored credential. Values written before this
// key existed were encrypted with a SESSION_SECRET-derived key; that key is kept
// as a DECRYPT-ONLY fallback, and anything it opens is re-encrypted under the
// dedicated key the next time it's saved.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

/** Load the dedicated data key, creating+persisting it on first run. */
function loadOrCreateDataKey() {
  const keyFile = path.join(config.dataDir, '.secret-key');
  try {
    const buf = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
    if (buf.length === 32) return buf;
  } catch {
    /* not created yet - fall through and generate */
  }
  const key = crypto.randomBytes(32);
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(keyFile, key.toString('hex') + '\n', { mode: 0o600 });
    logger.info(
      'Generated a dedicated at-rest encryption key. Keep it with your backups; losing it means re-entering stored API keys and RCON passwords.',
      { keyFile }
    );
    return key;
  } catch (err) {
    logger.warn(
      'Could not persist the at-rest encryption key; falling back to the legacy SESSION_SECRET-derived key for this run.',
      { keyFile, err: serializeError(err, { includeStack: false }) }
    );
    return null;
  }
}

const DATA_KEY = loadOrCreateDataKey();

// Legacy key: how secrets were encrypted before the dedicated key existed.
// Decrypt-only. Null when SESSION_SECRET is unset.
const LEGACY_KEY = config.sessionSecret ? crypto.scryptSync(config.sessionSecret, 'msm.secrets.v1', 32) : null;

const ENCRYPT_KEY = DATA_KEY || LEGACY_KEY;
if (!ENCRYPT_KEY) {
  logger.warn(
    'No at-rest encryption key is available. Set SESSION_SECRET or make DATA_DIR writable before storing credentials.'
  );
}

// Keys to try when decrypting, newest first. A wrong key fails the GCM auth tag
// check cleanly (final() throws), so trying in order never yields garbage.
const DECRYPT_KEYS = [DATA_KEY, LEGACY_KEY].filter(Boolean);

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPT_KEY, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function decrypt(ciphertext) {
  const [iv, tag, data] = String(ciphertext)
    .split('.')
    .map((s) => Buffer.from(s, 'base64'));
  for (const key of DECRYPT_KEYS) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      /* try the next key */
    }
  }
  // No key opened it: tampered value, or SESSION_SECRET changed on a value that
  // predates the dedicated key and was never re-saved.
  const err = new Error(
    'A stored secret could not be decrypted. If you recently changed SESSION_SECRET, restore the old value ' +
      'or re-enter the affected credential (API key / RCON password). Otherwise restore $DATA_DIR/.secret-key ' +
      'from a backup.'
  );
  err.status = 409;
  err.code = 'SECRET_KEY_MISMATCH';
  throw err;
}

/** decrypt() that returns null instead of throwing - for callers with a fallback. */
function tryDecrypt(ciphertext) {
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

function generatePassword(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

module.exports = { encrypt, decrypt, tryDecrypt, generatePassword };
