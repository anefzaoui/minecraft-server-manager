'use strict';

// Account recovery: reset a user's password from the server. There is no
// self-service password reset in the web UI (the panel has no email/SMTP
// dependency by design), so use this if you get locked out.
//
// Usage:
//   node scripts/reset-password.js <username> [newPassword]
//
// If newPassword is omitted, a strong random one is generated and printed.
// Changes take effect immediately; no panel restart is needed.

const crypto = require('node:crypto');
const db = require('../src/db');
const auth = require('../src/services/auth');

const username = process.argv[2];
let password = process.argv[3];

if (!username) {
  console.error('Usage: node scripts/reset-password.js <username> [newPassword]');
  process.exit(1);
}

const user = db.get('SELECT id, username FROM users WHERE username = ?', username);
if (!user) {
  const names = db.all('SELECT username FROM users').map((u) => u.username);
  console.error(`No user named "${username}".`);
  console.error(
    names.length
      ? `Existing users: ${names.join(', ')}`
      : 'There are no users yet — start the panel and complete first-run setup.'
  );
  process.exit(1);
}

const generated = !password;
if (generated) password = crypto.randomBytes(9).toString('base64url'); // 12 chars

try {
  auth.setPassword(user.id, password, { actor: 'cli:reset-password' });
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
}

console.log(`Password updated for "${username}".`);
if (generated) console.log(`New password: ${password}`);
