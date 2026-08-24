'use strict';

// Sessions previously had no way to look up "every session belonging to user
// X" - only a raw sid. That meant changing a password or disabling/rotating
// 2FA never revoked a stolen-but-still-valid session on another device; the
// victim's only recourse was waiting out the cookie's maxAge (up to 30 days
// with "remember me"). This column lets credential/2FA changes revoke every
// OTHER session for that user immediately.

function up(db) {
  db.exec(`
    ALTER TABLE sessions ADD COLUMN user_id TEXT;
    CREATE INDEX idx_sessions_user ON sessions(user_id);
  `);
}

module.exports = { up };
