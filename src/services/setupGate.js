'use strict';

// First-run hardening for panels that bind to a non-loopback address. Until the
// admin account exists, /setup is reachable by anyone who can hit the port, and
// the first caller claims admin. When the bind is exposed, gate /setup behind a
// 6-digit PIN printed ONLY to the server console at boot - so whoever holds the
// terminal (the operator) is the one who finishes setup. On a loopback bind
// (the default) there is no PIN: being on the box is already the proof.
//
// Per-account lockout: after MAX_ATTEMPTS consecutive wrong PINs the gate locks
// for an exponentially growing window (reset on any correct check). The counter
// is per-process (like the PIN itself); a process restart clears it. This makes
// a multi-IP brute-force infeasible without also flooding the console with
// lockout warnings.

const crypto = require('node:crypto');
const config = require('../config');
const logger = require('../logger')('setup-gate');

let pin = null;

const MAX_ATTEMPTS = 10;
const BASE_LOCKOUT_MS = 15_000;
const MAX_LOCKOUT_MS = 10 * 60_000;
let wrongAttempts = 0;
let lockedUntil = 0;

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

/** Constant-time PIN check. Always true when no PIN is required. */
function check(candidate) {
  if (!required()) return true;
  const now = Date.now();
  if (now < lockedUntil) return false;
  lockedUntil = 0; // window expired — allow this attempt
  const want = ensurePin();
  const got = String(candidate == null ? '' : candidate);
  if (got.length !== want.length) {
    recordFailure(now);
    return false;
  }
  if (crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got))) {
    wrongAttempts = 0; // reset on success
    return true;
  }
  recordFailure(now);
  return false;
}

function recordFailure(now) {
  wrongAttempts++;
  if (wrongAttempts >= MAX_ATTEMPTS) {
    const backoff = Math.min(MAX_LOCKOUT_MS, BASE_LOCKOUT_MS * 2 ** (wrongAttempts - MAX_ATTEMPTS));
    lockedUntil = (now || Date.now()) + backoff;
    logger.error(
      `LOCKED for ${Math.round(backoff / 1000)}s after ${wrongAttempts} wrong PIN attempts on the first-run setup gate. ` +
        'Restart the panel to unlock early. If this is you, the PIN is above in the boot output.',
      { wrongAttempts, backoffMs: backoff }
    );
  }
}

function isLocked() {
  if (Date.now() >= lockedUntil) {
    lockedUntil = 0;
    return false;
  }
  return true;
}

module.exports = { required, ensurePin, check, isLocked };
