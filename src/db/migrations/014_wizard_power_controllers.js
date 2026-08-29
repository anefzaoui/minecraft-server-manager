'use strict';

// Cross-player powers are reserved for a second, explicit allowlist. Existing
// Existing Basic users (stored as power testers) retain self-only behavior until an admin names controllers.

function up(db) {
  db.exec(`
    ALTER TABLE wizard_configs ADD COLUMN power_controllers_json TEXT NOT NULL DEFAULT '[]';
  `);
}

module.exports = { up };
