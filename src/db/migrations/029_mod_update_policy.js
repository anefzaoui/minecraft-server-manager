'use strict';

// Splitting the update policy in two: update_policy keeps governing
// game/server-level updates (Minecraft version, loader builds, the container
// image, managed packs), while the new mod_update_policy governs overlay
// content (mods, plugins, datapacks, resource packs). Existing servers keep
// behaving exactly as before by inheriting their current policy for mods;
// new servers default to manual for both, like update_policy always has.

function up(db) {
  db.exec(`
    ALTER TABLE servers ADD COLUMN mod_update_policy TEXT NOT NULL DEFAULT 'manual'
      CHECK (mod_update_policy IN ('manual','notify','auto'));
  `);
  db.exec(`UPDATE servers SET mod_update_policy = update_policy;`);
}

module.exports = { up };
