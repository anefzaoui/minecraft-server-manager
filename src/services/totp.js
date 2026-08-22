'use strict';

// TOTP (RFC 6238) two-factor codes, hand-rolled on node:crypto rather than pulling in
// a third-party auth library - the algorithm is small and well-specified (HMAC-SHA1
// truncation over a 30s time step), and this is the security-critical half of 2FA, so
// keeping it in a reviewable ~100 lines beats trusting an opaque dependency for it.
// Secrets are base32 (RFC 4648) because that's what every authenticator app expects
// pasted/scanned in.

const crypto = require('node:crypto');

const STEP_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20; // 160 bits, the RFC 6238 recommendation for HMAC-SHA1
const BACKUP_CODE_COUNT = 10;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh random base32 secret, ready to embed in an otpauth:// URI. */
function generateSecret() {
  return base32Encode(crypto.randomBytes(SECRET_BYTES));
}

/** otpauth:// URI for QR/manual enrollment - issuer + account label, standard params. */
function buildOtpauthUrl(secret, { issuer = 'Minecraft Server Manager', account }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  // Build the query with encodeURIComponent, NOT URLSearchParams: the latter
  // form-encodes a space as '+', but per RFC 3986 a '+' in a URI query is a
  // literal plus, so apps that don't apply x-www-form-urlencoded decoding
  // (Google Authenticator among them) show the issuer as "Minecraft+Server+
  // Manager" and see it as conflicting with the %20-encoded label prefix.
  const params = [
    ['secret', secret],
    ['issuer', issuer],
    ['algorithm', 'SHA1'],
    ['digits', String(DIGITS)],
    ['period', String(STEP_SECONDS)],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `otpauth://totp/${label}?${params}`;
}

function hotp(secretBytes, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

function currentStep(atMs = Date.now()) {
  return Math.floor(atMs / 1000 / STEP_SECONDS);
}

/**
 * Verify a 6-digit code against `secret` (base32), allowing ±1 step (30s) of clock
 * drift. `lastStep` (if given) blocks replaying a code already accepted for that step
 * or an earlier one - without it, a code intercepted once (shoulder-surf, log leak)
 * stays valid for the rest of its 30s window even after legitimate use.
 * Returns the matched step on success (persist as the new lastStep), or null.
 */
function verify(secret, code, { lastStep = null, window = 1, atMs = Date.now() } = {}) {
  const cleanCode = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return null;
  const secretBytes = base32Decode(secret);
  if (!secretBytes.length) return null;
  const step = currentStep(atMs);
  // Ignore a stored lastStep that sits in the future beyond the drift window:
  // that means the clock ran fast at last login and has since been corrected
  // backward (NTP). Left active, every candidate in the current window is
  // `<= lastStep` and gets skipped as a replay, locking the user out until wall
  // time catches back up. It can only ever legitimately be within [step-window,
  // step+window]; anything past that is stale, not a real prior use.
  const replayFloor = lastStep != null && lastStep <= step + window ? lastStep : null;
  for (let delta = -window; delta <= window; delta++) {
    const candidateStep = step + delta;
    if (replayFloor != null && candidateStep <= replayFloor) continue; // replay
    const expected = hotp(secretBytes, candidateStep);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanCode))) return candidateStep;
  }
  return null;
}

/** The current 6-digit code for `secret` - exported for tests; never used at runtime. */
function codeAt(secret, atMs = Date.now()) {
  return hotp(base32Decode(secret), currentStep(atMs));
}

/** `n` random backup codes, formatted xxxx-xxxx for readability. */
function generateBackupCodes(n = BACKUP_CODE_COUNT) {
  const codes = [];
  for (let i = 0; i < n; i++) {
    const raw = crypto.randomBytes(5).toString('hex'); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

module.exports = {
  STEP_SECONDS,
  generateSecret,
  buildOtpauthUrl,
  verify,
  generateBackupCodes,
  codeAt,
  base32Encode, // exported for tests (RFC 6238's published vectors give a raw-byte secret, not base32)
  base32Decode,
};
