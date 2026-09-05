'use strict';

// Restore and world-reset safety snapshots used to be tagged reason 'manual',
// sharing a retention bucket with backups a user deliberately created - so once
// a server had >20 'manual' rows, an automatic safety backup would silently
// evict a kept one (and vice versa). They now get their own reason,
// 'pre-restore', with its own small cap. Widen the CHECK constraint to allow it.
//
// SQLite can't ALTER a CHECK constraint, so rebuild the table. Nothing
// references backups, so a straight create/copy/drop/rename is safe.

function up(db) {
  db.exec(`
    CREATE TABLE backups_new (
      id         TEXT PRIMARY KEY,
      server_id  TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      filename   TEXT NOT NULL,
      rel_path   TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256     TEXT,
      reason     TEXT NOT NULL CHECK (reason IN ('manual','scheduled','pre-update','pre-restore')),
      note       TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO backups_new (id, server_id, filename, rel_path, size_bytes, sha256, reason, note, created_at)
      SELECT id, server_id, filename, rel_path, size_bytes, sha256, reason, note, created_at FROM backups;

    DROP TABLE backups;
    ALTER TABLE backups_new RENAME TO backups;
    CREATE INDEX idx_backups_server ON backups(server_id, created_at DESC);
  `);
}

module.exports = { up };
