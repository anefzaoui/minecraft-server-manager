'use strict';

// Native Bedrock uses a different port contract from Java and Geyser: its
// NetherNet signaling endpoint is TCP while gameplay occupies a UDP range.
// Keep these fields separate from the legacy port_bedrock Geyser column.
function up(db) {
  db.exec(`
    ALTER TABLE servers ADD COLUMN bedrock_transport TEXT NOT NULL DEFAULT 'nethernet'
      CHECK (bedrock_transport IN ('nethernet', 'raknet'));
    ALTER TABLE servers ADD COLUMN nethernet_udp_start INTEGER;
    ALTER TABLE servers ADD COLUMN nethernet_udp_end INTEGER;
  `);
}

module.exports = { up };
