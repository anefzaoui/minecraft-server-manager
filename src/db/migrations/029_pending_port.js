'use strict';

// A game port change that has not reached the container yet.
//
// Docker fixes a container's port bindings when it is created, so a new port
// only goes live when the container is rebuilt (the next start or restart).
// Until then port_game/port_rcon keep meaning "what players can reach right
// now", and the requested pair waits here. Both pairs are reserved against
// other servers while it waits; the rebuild promotes it and clears these. NULL
// when nothing is pending.

function up(db) {
  db.exec(`ALTER TABLE servers ADD COLUMN port_game_pending INTEGER`);
  db.exec(`ALTER TABLE servers ADD COLUMN port_rcon_pending INTEGER`);
}

module.exports = { up };
