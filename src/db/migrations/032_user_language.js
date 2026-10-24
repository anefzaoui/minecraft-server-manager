'use strict';

// Add user-based language preference. NULL or 'auto' defaults to browser language.

function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN language TEXT;
  `);
}

module.exports = { up };
