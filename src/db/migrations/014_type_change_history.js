'use strict';

// One-step rollback for a server-type change (e.g. Paper -> Fabric) needs to
// know what the server's type/env/Java tag were immediately before the
// change, the same way server_packs.previous_version_id lets a pack upgrade
// roll back - but TYPE isn't pack-scoped, so it gets its own columns rather
// than overloading that table. Populated right before a type change is
// applied; only meaningful immediately after a failed change offers rollback.

function up(db) {
  db.exec(`
    ALTER TABLE servers ADD COLUMN previous_type TEXT;
    ALTER TABLE servers ADD COLUMN previous_env_json TEXT;
    ALTER TABLE servers ADD COLUMN previous_java_tag TEXT;
  `);
}

module.exports = { up };
