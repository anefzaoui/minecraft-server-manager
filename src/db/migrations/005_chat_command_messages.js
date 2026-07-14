'use strict';

// Custom per-command feedback whispered to the player in three states:
//   msg_pending — sent immediately when the command starts (e.g. slow /locate)
//   msg_success — sent after it succeeds (supports {player} {x} {z} … placeholders)
//   msg_failure — sent if it fails
// All optional; NULL means "use the built-in default message".

function up(db) {
  db.exec(`
    ALTER TABLE chat_commands ADD COLUMN msg_pending TEXT;
    ALTER TABLE chat_commands ADD COLUMN msg_success TEXT;
    ALTER TABLE chat_commands ADD COLUMN msg_failure TEXT;
  `);
}

module.exports = { up };
