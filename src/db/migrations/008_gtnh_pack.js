'use strict';

// GTNH pins carry two facts the other pack platforms don't have: the highest
// Java the pinned pack version supports (which decides the container image tag)
// and the release channel it came from (which stops the update checker from
// offering a beta to a server that deliberately tracks stable). NULL for
// CurseForge/Modrinth/FTB pins, which have neither concept.

function up(db) {
  db.exec(`
    ALTER TABLE server_packs ADD COLUMN max_java_version INTEGER;
    ALTER TABLE server_packs ADD COLUMN channel TEXT;
  `);
}

module.exports = { up };
