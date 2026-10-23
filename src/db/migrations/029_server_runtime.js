'use strict';

// Existing rows are Java servers. The DEFAULT is applied to every pre-runtime
// row by SQLite while preserving all existing Java fields, including the
// Geyser UDP port stored in port_bedrock.

function up(db) {
  db.exec(`
    ALTER TABLE servers ADD COLUMN runtime TEXT NOT NULL DEFAULT 'java'
      CHECK (runtime IN ('java', 'bedrock'));
  `);
}

module.exports = { up };
