'use strict';

// Keep the invocation name on the retained per-server wizard configuration so
// transcript labels still resolve after a Minecraft server is soft-deleted.

function up(db) {
  db.exec(`
    ALTER TABLE wizard_configs
      ADD COLUMN invocation_name TEXT NOT NULL DEFAULT 'wizard'
      CHECK (length(invocation_name) BETWEEN 1 AND 32);
  `);
}

module.exports = { up };
