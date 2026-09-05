'use strict';

// Sticky moderator notes per player - context ("reported for griefing 3x")
// that should survive a pardon, unlike a ban reason which disappears with it.

function up(db) {
  db.exec(`
    CREATE TABLE player_notes (
      id         TEXT PRIMARY KEY,
      server_id  TEXT NOT NULL,
      uuid       TEXT NOT NULL,
      name       TEXT NOT NULL,
      note       TEXT NOT NULL,
      author     TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_player_notes_lookup ON player_notes(server_id, uuid);
  `);
}

module.exports = { up };
