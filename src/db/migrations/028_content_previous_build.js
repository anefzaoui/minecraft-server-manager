'use strict';

// Remembering the build a mod was updated FROM, so a bad update is reversible.
//
// Updating an overlay mod removes the installed file and installs the new one,
// which loses every trace of what was there before - yet the old build's row in
// library_files (and its file in the library store) survives, because library
// rows are only ever deleted explicitly. These three columns keep the pointer:
// previous_library_id is what "revert" reinstalls, previous_version is the name
// shown on the button, previous_at dates it. All NULL until the first update,
// and cleared when the user installs a different build by hand (that build is
// then the one to revert to).

function up(db) {
  db.exec(`
    ALTER TABLE server_content ADD COLUMN previous_library_id TEXT REFERENCES library_files(id);
  `);
  db.exec(`ALTER TABLE server_content ADD COLUMN previous_version TEXT`);
  db.exec(`ALTER TABLE server_content ADD COLUMN previous_at TEXT`);
}

module.exports = { up };
