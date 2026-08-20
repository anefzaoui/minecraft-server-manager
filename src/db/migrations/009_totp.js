'use strict';

// Per-user TOTP two-factor auth. totp_secret is encrypted at rest (services/secrets.js,
// same as RCON passwords and API keys) and only ever set once a confirmation code has
// been verified — see services/totp.js. totp_backup_codes_json holds bcrypt hashes of
// one-time recovery codes, never plaintext. totp_last_step guards against replaying a
// captured code within its own 30s window.

function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN totp_secret TEXT;
    ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN totp_backup_codes_json TEXT;
    ALTER TABLE users ADD COLUMN totp_last_step INTEGER;
  `);
}

module.exports = { up };
