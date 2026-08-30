'use strict';

// First-run hardening for panels that bind to a non-loopback address. Until the
// admin account exists, /setup is reachable by anyone who can hit the port, and
// the first caller claims admin. When the bind is exposed, gate /setup behind a
// 6-digit PIN printed ONLY to the server console at boot - so whoever holds the
// terminal (the operator) is the one who finishes setup. On a loopback bind
// (the default) there is no PIN: being on the box is already the proof.

const crypto = require('node:crypto');
const config = require('../config');

let pin = null;

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
  const want = ensurePin();
  const got = String(candidate == null ? '' : candidate);
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

module.exports = { required, ensurePin, check };
