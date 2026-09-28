'use strict';

// Offsite backup destinations (Nextcloud / Dropbox / Google Drive). Local
// backups stay the default: nothing leaves the machine unless a destination
// is connected and either its auto-upload switch is on or an archive is
// uploaded explicitly. Secrets live encrypted (see services/secrets.js).

function up(db) {
  db.exec(`
    CREATE TABLE remote_destinations (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      provider      TEXT NOT NULL CHECK (provider IN ('nextcloud','dropbox','gdrive')),
      config_json   TEXT NOT NULL DEFAULT '{}',
      secret_cipher TEXT,
      auto_upload   INTEGER NOT NULL DEFAULT 0,
      oauth_state   TEXT,
      oauth_state_expires_at TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE TABLE remote_backup_files (
      backup_id      TEXT NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
      destination_id TEXT NOT NULL REFERENCES remote_destinations(id) ON DELETE CASCADE,
      remote_path    TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','uploading','done','failed')),
      size_bytes     INTEGER NOT NULL DEFAULT 0,
      error          TEXT NOT NULL DEFAULT '',
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (backup_id, destination_id)
    );
  `);
}

module.exports = { up };
