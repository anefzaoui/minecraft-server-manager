'use strict';

// Per-server player outreach plus one durable marker per play session. The
// markers prevent panel restarts or watcher overlap from greeting/checking in
// with the same player more than once during a session.

function up(db) {
  db.exec(`
    ALTER TABLE wizard_configs ADD COLUMN welcome_enabled INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE wizard_configs ADD COLUMN welcome_message TEXT NOT NULL DEFAULT
      'Welcome, {player}! I am {wizard}, this server''s resident guide and conversational companion. Ask me for help—or just chat—by writing {mention} followed by your message.';
    ALTER TABLE wizard_configs ADD COLUMN checkin_minutes INTEGER NOT NULL DEFAULT 15
      CHECK (checkin_minutes BETWEEN 0 AND 1440);
    ALTER TABLE wizard_configs ADD COLUMN checkin_message TEXT NOT NULL DEFAULT
      '{player}, you have been exploring for a while. How are you doing? If you need help or company, say {mention} followed by your message.';
    ALTER TABLE wizard_configs ADD COLUMN conversation_minutes INTEGER NOT NULL DEFAULT 5
      CHECK (conversation_minutes BETWEEN 0 AND 60);

    CREATE TABLE wizard_outreach (
      server_id         TEXT NOT NULL,
      player            TEXT NOT NULL,
      session_started_at TEXT NOT NULL,
      welcomed_at       TEXT,
      checked_in_at     TEXT,
      PRIMARY KEY (server_id, player, session_started_at)
    );
    CREATE INDEX idx_wizard_outreach_session
      ON wizard_outreach(server_id, session_started_at DESC);
  `);
}

module.exports = { up };
