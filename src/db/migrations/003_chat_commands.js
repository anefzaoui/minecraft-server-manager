'use strict';

// Custom chat commands: owner-defined triggers (e.g. !rtp2) detected in the
// live log stream and executed as the player who typed them, plus a per-server
// prefix setting. "trigger" is a reserved word in SQLite — always quoted.

function up(db) {
  db.exec(`
    CREATE TABLE chat_commands (
      id           TEXT PRIMARY KEY,             -- ccmd_xxxx
      server_id    TEXT NOT NULL,
      "trigger"    TEXT NOT NULL,                -- stored lowercase, no prefix
      description  TEXT NOT NULL DEFAULT '',
      action       TEXT NOT NULL CHECK (action IN ('rtp','structure','biome','console')),
      params       TEXT NOT NULL DEFAULT '{}',   -- JSON per-action parameters
      permission   TEXT NOT NULL DEFAULT 'everyone' CHECK (permission IN ('everyone','whitelist','ops')),
      cooldown_sec INTEGER NOT NULL DEFAULT 30,  -- per player, 0 = none
      enabled      INTEGER NOT NULL DEFAULT 1,
      uses         INTEGER NOT NULL DEFAULT 0,
      last_used_at TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (server_id, "trigger")
    );
    CREATE INDEX idx_chatcmd_server ON chat_commands(server_id);

    -- Per-server chat-command settings (just the prefix for now).
    CREATE TABLE chat_command_settings (
      server_id TEXT PRIMARY KEY,
      prefix    TEXT NOT NULL DEFAULT '!'
    );
  `);
}

module.exports = { up };
