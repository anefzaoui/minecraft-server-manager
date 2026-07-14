'use strict';

// Per-server label for panel-run console actions. When set, the panel announces
// "[label] <command>" in game chat (the vanilla "Rcon" sender can't be renamed).
// NULL = no announcement.

function up(db) {
  db.exec('ALTER TABLE servers ADD COLUMN console_label TEXT');
}

module.exports = { up };
