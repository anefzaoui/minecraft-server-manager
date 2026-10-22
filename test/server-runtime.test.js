'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { migrate } = require('../src/db/migrate');
const runtime = require('../src/services/serverRuntime');

migrate();

test('existing server records default to the Java runtime without changing their Geyser UDP port', () => {
  const id = 'srv_runtime_legacy';
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, port_bedrock, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, 'Legacy Java server', 'PAPER', 25570, 25580, 19132, 'x', 1024, 1536)`,
    id
  );
  try {
    const server = db.get('SELECT type, runtime, port_bedrock FROM servers WHERE id = ?', id);
    assert.equal(server.type, 'PAPER');
    assert.equal(server.runtime, runtime.JAVA);
    assert.equal(server.port_bedrock, 19132);
  } finally {
    db.run('DELETE FROM servers WHERE id = ?', id);
  }
});

test('runtime capabilities distinguish Native Bedrock from Java server type', () => {
  assert.equal(runtime.resolve({ runtime: runtime.JAVA, type: 'PAPER' }).supports('rcon'), true);
  assert.equal(runtime.resolve({ runtime: runtime.JAVA, type: 'PAPER' }).supports('geyserUdpPort'), true);
  assert.equal(runtime.resolve({ runtime: runtime.BEDROCK, type: 'PAPER' }).supports('rcon'), false);
  assert.equal(runtime.resolve({ runtime: runtime.BEDROCK, type: 'PAPER' }).supports('nativeBedrock'), true);
  assert.equal(runtime.resolve({ runtime: runtime.BEDROCK, type: 'PAPER' }).supports('java'), false);
});
