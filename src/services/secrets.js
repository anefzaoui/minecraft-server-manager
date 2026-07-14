'use strict';

// At-rest encryption for RCON passwords and API keys: AES-256-GCM with a key
// derived from SESSION_SECRET. Ciphertext format: base64(iv).base64(tag).base64(data)

const crypto = require('node:crypto');
const config = require('../config');

if (!config.sessionSecret) {
  console.warn('[secrets] SESSION_SECRET is empty — set it in .env before storing real credentials');
}
const KEY = crypto.scryptSync(config.sessionSecret, 'msm.secrets.v1', 32);

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function decrypt(ciphertext) {
  try {
    const [iv, tag, data] = ciphertext.split('.').map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Almost always: SESSION_SECRET changed since this value was stored.
    const err = new Error(
      'A stored secret could not be decrypted — SESSION_SECRET has changed since it was saved. ' +
        'Re-enter the affected credential (API key / RCON password), or restore the old SESSION_SECRET in .env.'
    );
    err.status = 409;
    err.code = 'SECRET_KEY_MISMATCH';
    throw err;
  }
}

/** decrypt() that returns null instead of throwing — for callers with a fallback. */
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
