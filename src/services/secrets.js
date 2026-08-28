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

  let raw;
  try {
    raw = fs.readFileSync(keyFile, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return createDataKey(keyFile);
    // The file is there but unreadable (permissions, I/O error). Generating a
    // replacement over the top would strand every value encrypted under the real
    // key, so DON'T - run on the legacy key for this process and let the
    // operator fix the mount.
    logger.warn(
      'Could not read the at-rest encryption key; using the legacy SESSION_SECRET-derived key for this run.',
      { keyFile, err: serializeError(err, { includeStack: false }) }
    );
    return null;
  }

  const buf = Buffer.from(raw.trim(), 'hex');
  if (buf.length === 32) return buf;

  // The file exists but doesn't hold a 32-byte hex key - a torn write, a manual
  // edit, the wrong file. Regenerating here would silently destroy every stored
  // credential, so fail loud and let a human decide.
  const err = new Error(
    `${keyFile} exists but is not a valid 32-byte hex key (parsed ${buf.length} bytes). ` +
      'Restore it from a backup, or delete it to start over - every stored API key, RCON password, and TOTP ' +
      'secret will then need re-entering.'
  );
  err.code = 'SECRET_KEY_CORRUPT';
  throw err;
}

/** Generate a fresh data key and persist it atomically (temp file + rename). */
function createDataKey(keyFile) {
  const key = crypto.randomBytes(32);
  const tmp = `${keyFile}.tmp-${process.pid}`;
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(tmp, key.toString('hex') + '\n', { mode: 0o600 });
    fs.renameSync(tmp, keyFile);
    try {
      fs.chmodSync(keyFile, 0o600);
    } catch {
      /* platforms without POSIX modes - best effort */
    }
    logger.info(
      'Generated a dedicated at-rest encryption key. Keep it with your backups; losing it means re-entering stored API keys and RCON passwords.',
      { keyFile }
    );
    return key;
  } catch (err) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
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

/** Attempt one AES-256-GCM open. Returns the plaintext, or null on any failure. */
function tryKey(key, iv, tag, data) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Split the "iv.tag.data" wire form into three buffers, or null if malformed. */
function splitCipher(ciphertext) {
  const parts = String(ciphertext)
    .split('.')
    .map((s) => Buffer.from(s, 'base64'));
  const [iv, tag, data] = parts;
  return parts.length === 3 && iv && tag && data ? { iv, tag, data } : null;
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPT_KEY, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function decrypt(ciphertext) {
  const parts = splitCipher(ciphertext);
  if (parts) {
    for (const key of DECRYPT_KEYS) {
      const plain = tryKey(key, parts.iv, parts.tag, parts.data);
      if (plain !== null) return plain;
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

/** True when both a dedicated key and a legacy key exist - i.e. there may be
 * ciphertext still bound to SESSION_SECRET that should be migrated. */
function hasLegacyFallback() {
  return Boolean(DATA_KEY && LEGACY_KEY);
}

/**
 * If `ciphertext` opens only under the legacy SESSION_SECRET-derived key, return
 * a fresh ciphertext under the dedicated key so it survives a SESSION_SECRET
 * rotation. Returns null when there is nothing to do - already current, empty,
 * malformed, or undecryptable (tampered / unknown key). Never throws.
 * @param {string} ciphertext
 * @returns {string|null}
 */
function reEncryptIfLegacy(ciphertext) {
  if (!ciphertext || !hasLegacyFallback()) return null;
  const parts = splitCipher(ciphertext);
  if (!parts) return null;
  if (tryKey(DATA_KEY, parts.iv, parts.tag, parts.data) !== null) return null; // already current
  const legacyPlain = tryKey(LEGACY_KEY, parts.iv, parts.tag, parts.data);
  if (legacyPlain === null) return null; // tampered / unknown key - leave it alone
  return encrypt(legacyPlain);
}

module.exports = { encrypt, decrypt, tryDecrypt, generatePassword, hasLegacyFallback, reEncryptIfLegacy };
