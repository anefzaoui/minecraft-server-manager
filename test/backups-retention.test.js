'use strict';

// pruneRetention must now cap EVERY reason bucket, not just 'scheduled' - the
// old behaviour let 'manual' (which also holds restore safety backups) and
// 'pre-update' grow without bound until the free-space preflight started
// failing every new backup. See src/services/backups.js KEEP_* constants.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { pruneRetention } = require('../src/services/backups');

function seedServer(id) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, ?, 'PAPER', 25601, 26601, 'x', 1024, 1536, 'stopped')`,
    id,
    'Retention Test'
  );
}

// created_at grows with i, so higher i == newer == kept.
function seedBackups(serverId, reason, count) {
  for (let i = 0; i < count; i++) {
    const n = String(i).padStart(3, '0');
    db.run(
      `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('2026-01-01 00:00:00', '+' || ? || ' minutes'))`,
      `bk_${reason}_${n}`,
      serverId,
      `${serverId}-${reason}-${n}.zip`,
      `backups/${serverId}/${serverId}-${reason}-${n}.zip`,
      1024,
      reason,
      i
    );
  }
}

function countByReason(serverId, reason) {
  return db.get('SELECT COUNT(*) AS n FROM backups WHERE server_id = ? AND reason = ?', serverId, reason).n;
}
const exists = (id) => Boolean(db.get('SELECT 1 AS x FROM backups WHERE id = ?', id));

test('pruneRetention caps every reason bucket (scheduled 10, pre-update 10, manual 20, pre-restore 5), keeping the newest', async () => {
  const id = 'srv_ret';
  seedServer(id);
  seedBackups(id, 'scheduled', 15);
  seedBackups(id, 'pre-update', 13);
  seedBackups(id, 'manual', 25);
  seedBackups(id, 'pre-restore', 9);

  const deleted = await pruneRetention(id, { actor: 'test' });

  assert.equal(countByReason(id, 'scheduled'), 10);
  assert.equal(countByReason(id, 'pre-update'), 10);
  assert.equal(countByReason(id, 'manual'), 20);
  assert.equal(countByReason(id, 'pre-restore'), 5);
  assert.equal(deleted, 5 + 3 + 5 + 4);

  // manual: i=0..24, newest 20 kept -> i=5..24 survive, i=0..4 pruned.
  assert.equal(exists('bk_manual_004'), false);
  assert.equal(exists('bk_manual_005'), true);
  assert.equal(exists('bk_manual_024'), true);

  // pre-restore safety snapshots have their own bucket - they never touch the
  // manual count, which is exactly why this bucket exists.
  assert.equal(exists('bk_pre-restore_003'), false);
  assert.equal(exists('bk_pre-restore_004'), true);
});

test('pruneRetention is a no-op when every bucket is under its cap', async () => {
  const id = 'srv_ret_small';
  seedServer(id);
  seedBackups(id, 'manual', 3);
  seedBackups(id, 'scheduled', 3);

  const deleted = await pruneRetention(id, { actor: 'test' });

  assert.equal(deleted, 0);
  assert.equal(countByReason(id, 'manual'), 3);
  assert.equal(countByReason(id, 'scheduled'), 3);
});
