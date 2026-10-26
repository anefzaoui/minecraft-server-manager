'use strict';

// A game port change is now applied immediately (the container is rebuilt on
// the new port right away, and a running server restarted on it), so nothing
// is left "pending" any more. The columns from 029 stay (029 shipped on main).
// A server that had a pending move from an earlier build gets a history line
// saying the move was dropped, so nobody waits for a move that won't happen.

function up(db) {
  const rows = db.all('SELECT id, port_game, port_game_pending FROM servers WHERE port_game_pending IS NOT NULL');
  for (const r of rows) {
    db.run(
      "INSERT INTO events (server_id, actor, type, summary) VALUES (?, 'system', 'config-changed', ?)",
      r.id,
      `A pending move to port ${r.port_game_pending} was dropped by a panel update, so the server stays on ${r.port_game}. Change the port again if you still want it.`
    );
  }
  db.run('UPDATE servers SET port_game_pending = NULL, port_rcon_pending = NULL');
}

module.exports = { up };
