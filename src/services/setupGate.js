'use strict';

// First-run hardening for panels that bind to a non-loopback address. Until the
// admin account exists, /setup is reachable by anyone who can hit the port, and
// the first caller claims admin. When the bind is exposed, gate /setup behind a
// 6-digit PIN printed ONLY to the server console at boot - so whoever holds the
// terminal (the operator) is the one who finishes setup. On a loopback bind
// (the default) there is no PIN: being on the box is already the proof.
//
// Lockout: wrong PINs are counted both per client IP and globally.
//
//   - Per IP: after IP_MAX_ATTEMPTS wrong PINs from one address that address is
//     locked for an exponentially growing window. This is what actually stops a
//     brute force (6 digits, 1,000,000 combinations) and it cannot lock the
//     legitimate operator out from a different address.
//   - Global: after MAX_ATTEMPTS wrong PINs from anywhere the gate locks for
//     everyone for a bounded window - the backstop against a multi-IP attack.
//     When that window expires the attempt counter starts over, so an attacker
//     re-locking the gate needs MAX_ATTEMPTS fresh failures each time and the
//     operator always gets a fair opening. A quiet period (no failures for
//     DECAY_MS) resets every counter and the backoff level.
//
// Counters are per-process (like the PIN itself); a process restart clears them.

const crypto = require('node:crypto');
const config = require('../config');
const logger = require('../logger')('setup-gate');

let pin = null;

const MAX_ATTEMPTS = 10;
const IP_MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15_000;
const MAX_LOCKOUT_MS = 10 * 60_000;
const DECAY_MS = 30 * 60_000;
const IP_TABLE_MAX = 10_000;

let wrongAttempts = 0;
let lockLevel = 0; // how many global lockouts in the current streak (drives the backoff)
let lockedUntil = 0;
let lastFailureAt = 0;
/** @type {Map<string, { attempts: number, level: number, lockedUntil: number, lastFailureAt: number }>} */
const byIp = new Map();

/** True when a PIN should be demanded (exposed bind + no users yet). */
function required() {
  return Boolean(config.isExposedBind) && require('./auth').firstRunNeeded();
}

/** The PIN for this process, generated on first need; null when not required. */
function ensurePin() {
  if (!required()) return null;
  if (!pin) pin = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  return pin;
}

function decayIfQuiet(now) {
  if (lastFailureAt && now - lastFailureAt > DECAY_MS) {
    wrongAttempts = 0;
    lockLevel = 0;
  }
  for (const [ip, rec] of byIp) {
    if (now - rec.lastFailureAt > DECAY_MS && now >= rec.lockedUntil) byIp.delete(ip);
  }
}

function backoffFor(level) {
  return Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * 2 ** Math.max(0, level - 1));
}

/**
 * Constant-time PIN check. Always true when no PIN is required. `ip` is the
 * client address the attempt came from (for the per-IP counter); omit it only
 * in tests.
 */
function check(candidate, ip = null) {
  if (!required()) return true;
  const now = Date.now();
  if (isLocked(ip, now)) return false;
  const want = ensurePin();
  const got = String(candidate == null ? '' : candidate);
  if (got.length !== want.length) {
    recordFailure(ip, now);
    return false;
  }
  if (crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got))) {
    wrongAttempts = 0;
    lockLevel = 0;
    if (ip) byIp.delete(ip);
    return true;
  }
  recordFailure(ip, now);
  return false;
}

function recordFailure(ip, now) {
  decayIfQuiet(now);
  lastFailureAt = now;
  wrongAttempts++;
  if (wrongAttempts >= MAX_ATTEMPTS) {
    lockLevel++;
    const backoff = backoffFor(lockLevel);
    lockedUntil = now + backoff;
    wrongAttempts = 0; // a fresh MAX_ATTEMPTS is needed to lock again after this window
    logger.error(
      `LOCKED for ${Math.round(backoff / 1000)}s after ${MAX_ATTEMPTS} wrong PIN attempts on the first-run setup gate. ` +
        'Restart the panel to unlock early. If this is you, the PIN is above in the boot output.',
      { backoffMs: backoff, lockLevel, ip: ip || null }
    );
  }
  if (!ip) return;
  if (byIp.size >= IP_TABLE_MAX && !byIp.has(ip)) return; // bounded memory; the global counter still applies
  const rec = byIp.get(ip) || { attempts: 0, level: 0, lockedUntil: 0, lastFailureAt: 0 };
  rec.attempts++;
  rec.lastFailureAt = now;
  if (rec.attempts >= IP_MAX_ATTEMPTS) {
    rec.level++;
    rec.lockedUntil = now + backoffFor(rec.level);
    rec.attempts = 0;
    logger.warn('Locked one address out of the first-run setup gate after repeated wrong PINs.', {
      ip,
      backoffMs: backoffFor(rec.level),
    });
  }
  byIp.set(ip, rec);
}

/** True while the gate (globally, or for `ip`) is inside a lockout window. */
function isLocked(ip = null, now = Date.now()) {
  decayIfQuiet(now);
  if (now < lockedUntil) return true;
  lockedUntil = 0;
  if (ip) {
    const rec = byIp.get(ip);
    if (rec && now < rec.lockedUntil) return true;
  }
  return false;
}

/** Test hook: forget every counter and lockout. */
function resetForTests() {
  wrongAttempts = 0;
  lockLevel = 0;
  lockedUntil = 0;
  lastFailureAt = 0;
  byIp.clear();
}

module.exports = { required, ensurePin, check, isLocked, resetForTests };
