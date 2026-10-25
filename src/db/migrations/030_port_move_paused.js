'use strict';

// A pending game port move that could not go live (its port was taken, or the
// server would not start on it) is paused rather than retried on every start:
// retrying turns each start, crash restart and scheduled restart into a failed
// rebuild. It stays paused until someone saves a port again. The column holds
// a short reason for the UI; NULL means not paused.

function up(db) {
  db.exec(`ALTER TABLE servers ADD COLUMN port_move_paused TEXT`);
}

module.exports = { up };
