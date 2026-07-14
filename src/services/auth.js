'use strict';

// Users + credentials. bcryptjs hashes; roles admin/operator/viewer.

const httpError = require('../utils/httpError');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { recordEvent } = require('../events');

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
  return { id: u.id, username: u.username, role: u.role, createdAt: u.created_at };
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
};
