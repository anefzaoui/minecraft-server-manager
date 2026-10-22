'use strict';

// NetherNet needs the address clients can actually reach, which is often the
// Docker host's LAN or public IP rather than the container's bridge address.
function up(db) {
  db.exec("ALTER TABLE servers ADD COLUMN advertised_address TEXT NOT NULL DEFAULT '';");
}

module.exports = { up };
