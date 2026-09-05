'use strict';

// Per-mod "ignore this update": records the version name the user chose not to
// install for an overlay content row. While update_checks.latest_name still
// equals this value the mods tab / Updates page / sidebar badge stay quiet
// about it; a genuinely newer build (different latest_name) re-surfaces on its
// own. Cleared to NULL by "un-ignore". Name-to-name, same as every other
// version comparison in the panel.

function up(db) {
  db.exec(`ALTER TABLE server_content ADD COLUMN ignored_update_version TEXT`);
}

module.exports = { up };
