'use strict';

// 031: a pending port move left by an earlier build (PR #67's design) is
// dropped, and the server's history says so.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { up } = require('../src/db/migrations/031_port_change_immediate');

test('a pending move is dropped, with a history line; servers without one are untouched', () => {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, port_game_pending, port_rcon_pending, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES ('srv_mig', 'm', 'PAPER', 47700, 48700, 47750, 48750, 'x', 1024, 1536),
            ('srv_none', 'n', 'PAPER', 47800, 48800, NULL, NULL, 'x', 1024, 1536)`
  );
  up(db);
  assert.deepEqual(
    { ...db.get("SELECT port_game, port_game_pending, port_rcon_pending FROM servers WHERE id = 'srv_mig'") },
    { port_game: 47700, port_game_pending: null, port_rcon_pending: null }
  );
  assert.equal(
    db.get("SELECT summary FROM events WHERE server_id = 'srv_mig'").summary,
    'A pending move to port 47750 was dropped by a panel update, so the server stays on 47700. Change the port again if you still want it.'
  );
  assert.equal(db.get("SELECT COUNT(*) AS n FROM events WHERE server_id = 'srv_none'").n, 0);
});
