'use strict';

// "Ignore this update" for the non-content update kinds (modpack, Docker image,
// Minecraft version, loader build). The overlay-mod equivalent lives on
// server_content.ignored_update_version; this is the same idea for the rows the
// checker tracks in update_checks, which have no server_content row. Holds the
// latest_version the user chose not to apply: while update_checks.latest_version
// still equals it the Updates page greys the row and the sidebar badge / digest
// stay quiet; a genuinely newer build (different latest_version) re-surfaces on
// its own. Cleared to NULL by "un-ignore".

function up(db) {
  db.exec(`ALTER TABLE update_checks ADD COLUMN ignored_version TEXT`);
}

module.exports = { up };
