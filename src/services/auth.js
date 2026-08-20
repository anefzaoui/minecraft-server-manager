'use strict';

// Users + credentials. bcryptjs hashes; roles admin/operator/viewer.

const httpError = require('../utils/httpError');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { recordEvent } = require('../events');
const totp = require('./totp');
const secrets = require('./secrets');

function firstRunNeeded() {
  return !db.get('SELECT 1 AS x FROM users LIMIT 1');
}

function createUser({ username, password, role = 'admin' }, { actor = 'system' } = {}) {
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) throw httpError(400, 'Username: 2–32 letters, numbers, _ . -');
  if (typeof password !== 'string' || password.length < 8)
    throw httpError(400, 'Password must be at least 8 characters');
  if (db.get('SELECT 1 AS x FROM users WHERE username = ?', username)) throw httpError(409, 'Username already exists');
  const id = `usr_${nanoid(8)}`;
  db.run(
    'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
    id,
    username,
    bcrypt.hashSync(password, 11),
    role
  );
  recordEvent({ actor, type: 'user-created', summary: `User created: ${username} (${role})` });
  return getUser(id);
}

function verifyCredentials(username, password) {
  const user = db.get('SELECT * FROM users WHERE username = ?', username);
  if (!user) {
    bcrypt.compareSync(password, '$2a$11$invalidsaltinvalidsaltinvalidsaltuFakeHash1234567890ab'); // constant-time-ish
    return null;
  }
  return bcrypt.compareSync(password, user.password_hash) ? publicUser(user) : null;
}

function getUser(id) {
  const user = db.get('SELECT * FROM users WHERE id = ?', id);
  return user ? publicUser(user) : null;
}

function listUsers() {
  return db.all('SELECT * FROM users ORDER BY created_at').map(publicUser);
}

function setPassword(id, password, { actor = 'system' } = {}) {
  if (typeof password !== 'string' || password.length < 8)
    throw httpError(400, 'Password must be at least 8 characters');
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(password, 11), id);
  recordEvent({ actor, type: 'user-password-changed', summary: `Password changed for ${getUser(id)?.username}` });
}

function setRole(id, role, { actor = 'system' } = {}) {
  if (!['admin', 'operator', 'viewer'].includes(role)) throw httpError(400, 'Invalid role');
  const admins = db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").n;
  const user = db.get('SELECT * FROM users WHERE id = ?', id);
  if (user && user.role === 'admin' && role !== 'admin' && admins <= 1) {
    throw httpError(409, 'Cannot demote the last admin');
  }
  db.run('UPDATE users SET role = ? WHERE id = ?', role, id);
  recordEvent({ actor, type: 'user-role-changed', summary: `${user?.username} role → ${role}` });
}

function deleteUser(id, { actor = 'system' } = {}) {
  const user = db.get('SELECT * FROM users WHERE id = ?', id);
  if (!user) return;
  if (user.role === 'admin' && db.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").n <= 1) {
    throw httpError(409, 'Cannot delete the last admin');
  }
  db.run('DELETE FROM users WHERE id = ?', id);
  recordEvent({ actor, type: 'user-deleted', summary: `User deleted: ${user.username}` });
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.created_at,
    totpEnabled: Boolean(u.totp_enabled),
  };
}

// ---------------------------------------------------------------------------
// TOTP two-factor auth. Self-service (any role, acts on your own account) —
// see web/routes/account.js — plus one admin recovery path in web/routes/api.js.
// The secret is only ever written once a live code from it has been verified
// (confirmTotp), so a setup a user never finishes leaves nothing persisted.

/** Start enrollment: a fresh secret + otpauth URL, NOT persisted until confirmTotp(). */
function beginTotpEnrollment(id) {
  const user = db.get('SELECT username FROM users WHERE id = ?', id);
  if (!user) throw httpError(404, 'User not found');
  const secret = totp.generateSecret();
  return { secret, otpauthUrl: totp.buildOtpauthUrl(secret, { account: user.username }) };
}

/** Verify the first live code, then persist the secret + fresh backup codes. */
function confirmTotp(id, secret, code, { actor = 'system' } = {}) {
  const user = db.get('SELECT * FROM users WHERE id = ?', id);
  if (!user) throw httpError(404, 'User not found');
  // A session with no password re-check could otherwise silently swap an
  // already-configured secret out from under the account (the UI never offers
  // this path, but the API must not rely on that) — require disableTotp's
  // password check first, same as everywhere else 2FA state changes.
  if (user.totp_enabled) {
    throw httpError(409, 'Two-factor authentication is already enabled — disable it first to re-enroll.');
  }
  if (totp.verify(secret, code) == null) {
    throw httpError(400, 'That code is incorrect or expired — try the next one your app shows.');
  }
  const backupCodes = totp.generateBackupCodes();
  const hashed = backupCodes.map((c) => bcrypt.hashSync(c, 11));
  // totp_last_step deliberately stays NULL here rather than recording this
  // confirmation code's step: replay protection exists to stop a *login* code
  // being reused, not to block the very first login from landing in the same
  // 30s window as enrollment (a real code shown on-screen doesn't change until
  // the window rolls over, so that first login legitimately reuses it).
  db.run(
    'UPDATE users SET totp_secret = ?, totp_enabled = 1, totp_backup_codes_json = ? WHERE id = ?',
    secrets.encrypt(secret),
    JSON.stringify(hashed),
    id
  );
  recordEvent({ actor, type: 'user-2fa-enabled', summary: `Two-factor authentication enabled for ${user.username}` });
  return { backupCodes };
}

/** Self-service disable — re-checks the account's own current password first. */
function disableTotp(id, password, { actor = 'system' } = {}) {
  const user = db.get('SELECT * FROM users WHERE id = ?', id);
  if (!user) throw httpError(404, 'User not found');
  if (!bcrypt.compareSync(password, user.password_hash)) throw httpError(401, 'Wrong password');
  db.run(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes_json = NULL, totp_last_step = NULL WHERE id = ?',
    id
  );
  recordEvent({
    actor,
    type: 'user-2fa-disabled',
    summary: `Two-factor authentication disabled for ${user.username}`,
  });
}

/** Admin recovery path: force-disable another user's 2FA (lost phone + backup codes). */
function adminDisableTotp(id, { actor = 'system' } = {}) {
  const user = db.get('SELECT username, totp_enabled FROM users WHERE id = ?', id);
  if (!user) throw httpError(404, 'User not found');
  if (!user.totp_enabled) return;
  db.run(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes_json = NULL, totp_last_step = NULL WHERE id = ?',
    id
  );
  recordEvent({
    actor,
    type: 'user-2fa-disabled',
    summary: `Two-factor authentication reset for ${user.username} by an admin`,
  });
}

/** Re-check the password, then reissue backup codes (old ones stop working). */
function regenerateBackupCodes(id, password, { actor = 'system' } = {}) {
  const user = db.get('SELECT * FROM users WHERE id = ?', id);
  if (!user) throw httpError(404, 'User not found');
  if (!user.totp_enabled) throw httpError(400, 'Two-factor authentication is not enabled');
  if (!bcrypt.compareSync(password, user.password_hash)) throw httpError(401, 'Wrong password');
  const backupCodes = totp.generateBackupCodes();
  const hashed = backupCodes.map((c) => bcrypt.hashSync(c, 11));
  db.run('UPDATE users SET totp_backup_codes_json = ? WHERE id = ?', JSON.stringify(hashed), id);
  recordEvent({ actor, type: 'user-2fa-backup-codes', summary: `Backup codes regenerated for ${user.username}` });
  return { backupCodes };
}

/**
 * Verify a login-time TOTP or backup code for `id` (the pendingTotpUserId from
 * the first login step). Returns true/false; never throws on a bad code (the
 * route layer handles lockout/messaging same as a wrong password).
 */
function verifyTotpLogin(id, code) {
  const user = db.get('SELECT * FROM users WHERE id = ? AND totp_enabled = 1', id);
  if (!user || !user.totp_secret) return false;

  const secret = secrets.tryDecrypt(user.totp_secret);
  if (secret) {
    const step = totp.verify(secret, code, { lastStep: user.totp_last_step });
    if (step != null) {
      db.run('UPDATE users SET totp_last_step = ? WHERE id = ?', step, id);
      return true;
    }
  }

  // Fall back to a backup code — single use, removed once matched.
  let codes = [];
  try {
    codes = JSON.parse(user.totp_backup_codes_json || '[]');
  } catch {
    codes = [];
  }
  const cleanCode = String(code || '').trim();
  const idx = codes.findIndex((hash) => bcrypt.compareSync(cleanCode, hash));
  if (idx === -1) return false;
  codes.splice(idx, 1);
  db.run('UPDATE users SET totp_backup_codes_json = ? WHERE id = ?', JSON.stringify(codes), id);
  recordEvent({
    actor: user.username,
    type: 'user-2fa-backup-used',
    summary: `${user.username} signed in with a backup code (${codes.length} left)`,
  });
  return true;
}

/**
 * Delete expired session rows. Lives here (service layer) rather than in the
 * web-layer session store so the scheduler doesn't have to reach up into web/.
 * expires_at is ISO-8601 ('…T…Z'); compare against the same ISO shape (a naive
 * datetime('now') would always sort as less-than because 'T' > ' ').
 */
function pruneExpiredSessions() {
  return db.run("DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
}

module.exports = {
  firstRunNeeded,
  createUser,
  verifyCredentials,
  getUser,
  listUsers,
  setPassword,
  setRole,
  deleteUser,
  pruneExpiredSessions,
  beginTotpEnrollment,
  confirmTotp,
  disableTotp,
  adminDisableTotp,
  regenerateBackupCodes,
  verifyTotpLogin,
};
