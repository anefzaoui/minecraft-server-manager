'use strict';

// A game port change is now applied immediately (the container is rebuilt on
// the new port right away, and a running server restarted on it), so nothing
// is left "pending" or "paused" any more. The columns from 029 and 030 stay
// (029 shipped); this only clears values an earlier build could have left, so
// no stale move is shown or applied.

function up(db) {
  db.exec('UPDATE servers SET port_game_pending = NULL, port_rcon_pending = NULL, port_move_paused = NULL');
}

module.exports = { up };
