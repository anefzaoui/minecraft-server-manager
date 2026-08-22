'use strict';

// Per-user profile picture. NULL = default (initial-letter avatar). Otherwise
// 'preset:<key>' (one of the built-in Minecraft icon choices, config/avatars.js)
// or 'custom:<filename>' (an uploaded image, served from
// data/library/icons/users/ — see web/routes/account.js).

function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN avatar TEXT;
  `);
}

module.exports = { up };
