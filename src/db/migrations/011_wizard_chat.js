'use strict';

// Per-server local/OpenAI-compatible wizard configuration plus an audit-grade
// transcript archive. Deliberately no FK on server_id: deleting a Minecraft
// server soft-deletes its row, and wizard transcripts/config remain available
// until their own retention policy expires.

function up(db) {
  db.exec(`
    CREATE TABLE wizard_configs (
      server_id       TEXT PRIMARY KEY,
      enabled         INTEGER NOT NULL DEFAULT 0,
      base_url        TEXT NOT NULL DEFAULT 'http://127.0.0.1:11434',
      model           TEXT NOT NULL DEFAULT '',
      api_key_cipher  TEXT,
      system_prompt   TEXT NOT NULL DEFAULT '',
      retention_days  INTEGER NOT NULL DEFAULT 7 CHECK (retention_days BETWEEN 0 AND 3650),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE wizard_transcripts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id    TEXT NOT NULL,
      server_name  TEXT NOT NULL,
      player       TEXT NOT NULL,
      role         TEXT NOT NULL CHECK (role IN ('user','assistant','error')),
      content      TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_wizard_transcript_server_player
      ON wizard_transcripts(server_id, player, created_at DESC);
    CREATE INDEX idx_wizard_transcript_created
      ON wizard_transcripts(created_at DESC);
  `);
}

module.exports = { up };
