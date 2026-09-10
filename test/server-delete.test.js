'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/app'); // migrate() + throwaway DATA_DIR via env.js (no Docker)
const db = require('../src/db');
const servers = require('../src/services/servers');
const containers = require('../src/docker/containers');

function seedServer(id) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, ?, 'PAPER', 25599, 26599, 'x', 1024, 1536)`,
    id,
    'Test Server'
  );
  return id;
}

function seedBackup(id, serverId, sizeBytes = 1234) {
  db.run(
    "INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason) VALUES (?, ?, ?, ?, ?, 'manual')",
    id,
    serverId,
    'world.tar.gz',
    `backups/${serverId}/world.tar.gz`,
    sizeBytes
  );
}

test('deleteServer keeps files and backups by default (no action needed to preserve them)', async (t) => {
  t.mock.method(containers, 'stopContainer', async () => {});
  t.mock.method(containers, 'removeContainer', async () => {});
  const id = seedServer('srv_delkeep');
  seedBackup('bk_keep', id, 777);

  const { freedBytes } = await servers.deleteServer(id);
  assert.ok(db.get('SELECT id FROM backups WHERE id = ?', 'bk_keep'), 'backup row survives a default delete');
  const kept = db.get('SELECT id FROM servers WHERE id = ? AND deleted_at IS NOT NULL', id);
  assert.ok(kept, 'server row is soft-deleted, not removed');
  assert.equal(freedBytes, 0);
});

test('deleteServer removes files and backups when explicitly requested', async (t) => {
  t.mock.method(containers, 'stopContainer', async () => {});
  t.mock.method(containers, 'removeContainer', async () => {});
  const id = seedServer('srv_deldrop');
  seedBackup('bk_drop', id, 5000);

  const { freedBytes } = await servers.deleteServer(id, { keepWorld: false, keepBackups: false });
  assert.equal(
    db.get('SELECT id FROM backups WHERE id = ?', 'bk_drop'),
    undefined,
    'backup row removed when explicitly deleted'
  );
  assert.equal(freedBytes, 5000);
});
