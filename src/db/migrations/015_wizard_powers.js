'use strict';

// Optional, tightly-scoped gameplay powers for the conversational wizard.
// The master switch is off and dry-run is on for every existing server.

function up(db) {
  db.exec(`
    ALTER TABLE wizard_configs ADD COLUMN powers_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE wizard_configs ADD COLUMN powers_dry_run INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE wizard_configs ADD COLUMN power_testers_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE wizard_configs ADD COLUMN power_flags_json TEXT NOT NULL
      DEFAULT '{"heal":true,"feed":true,"spawn":true,"time":true,"weather":true,"gift":true}';
    ALTER TABLE wizard_configs ADD COLUMN gift_items_json TEXT NOT NULL
      DEFAULT '["minecraft:bread","minecraft:torch","minecraft:arrow"]';
    ALTER TABLE wizard_configs ADD COLUMN gift_max_count INTEGER NOT NULL DEFAULT 16
      CHECK (gift_max_count BETWEEN 1 AND 16);
    ALTER TABLE wizard_configs ADD COLUMN power_cooldown_sec INTEGER NOT NULL DEFAULT 30
      CHECK (power_cooldown_sec BETWEEN 3 AND 3600);
  `);
}

module.exports = { up };
