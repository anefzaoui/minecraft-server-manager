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
const backupRetention = require('../src/services/backupRetention');
const settings = require('../src/services/settings');

test.afterEach(() => {
  settings.remove('backup_retention');
  db.run('DELETE FROM backups');
  db.run('DELETE FROM servers');
});

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

test("a per-server override changes that server's count caps", async () => {
  const id = 'srv_ret_override';
  seedServer(id);
  seedBackups(id, 'manual', 10);
  backupRetention.setServer(id, { keepManual: 3 });

  const deleted = await pruneRetention(id, { actor: 'test' });

  assert.equal(deleted, 7);
  assert.equal(countByReason(id, 'manual'), 3);
  assert.equal(exists('bk_manual_006'), false);
  assert.equal(exists('bk_manual_007'), true); // newest 3: i=7,8,9
  backupRetention.setServer(id, null); // clear the override
});

test('the age ceiling removes backups older than maxAgeDays but keeps the newest', async () => {
  const id = 'srv_ret_age';
  seedServer(id);
  // 4 backups, all well under the count caps; created_at is 2026-01-01 + i min,
  // which is far older than "30 days ago" relative to the test clock.
  seedBackups(id, 'manual', 4);
  backupRetention.setGlobal({ maxAgeDays: 30 });

  const deleted = await pruneRetention(id, { actor: 'test' });

  assert.equal(deleted, 3, 'the 3 stale ones go');
  assert.equal(countByReason(id, 'manual'), 1);
  assert.equal(exists('bk_manual_003'), true, 'the newest backup is always kept');
});

test('the total-size ceiling deletes oldest-first until under the cap, keeping the newest', async () => {
  const id = 'srv_ret_size';
  seedServer(id);
  // 5 manual backups @ 1 KiB each seeded by seedBackups (size_bytes = 1024).
  seedBackups(id, 'manual', 5);
  db.run('UPDATE backups SET size_bytes = ? WHERE server_id = ?', 1024 ** 3, id); // 1 GiB each
  backupRetention.setGlobal({ maxTotalGb: 2 }); // room for 2

  const deleted = await pruneRetention(id, { actor: 'test' });

  assert.equal(deleted, 3);
  assert.equal(countByReason(id, 'manual'), 2);
  assert.equal(exists('bk_manual_002'), false);
  assert.equal(exists('bk_manual_003'), true);
  assert.equal(exists('bk_manual_004'), true); // newest
});

test('the size ceiling sacrifices pre-restore safety snapshots before user backups', async () => {
  const id = 'srv_ret_size_pref';
  seedServer(id);
  // One pre-restore snapshot + two manual backups, each 1 GiB, cap = 2 GiB.
  // All three share the seed's 2026-01-01 base time; make the manual pair the
  // newest so "keep the newest overall" doesn't land on the pre-restore row.
  seedBackups(id, 'pre-restore', 1);
  seedBackups(id, 'manual', 2);
  db.run('UPDATE backups SET size_bytes = ? WHERE server_id = ?', 1024 ** 3, id);
  db.run("UPDATE backups SET created_at = '2026-02-01 00:00:00' WHERE id = 'bk_manual_000'");
  db.run("UPDATE backups SET created_at = '2026-02-01 00:01:00' WHERE id = 'bk_manual_001'");
  backupRetention.setGlobal({ maxTotalGb: 2, keepPreRestore: 5 });

  await pruneRetention(id, { actor: 'test' });

  // The pre-restore snapshot is dropped first; both user backups survive.
  assert.equal(countByReason(id, 'pre-restore'), 0);
  assert.equal(countByReason(id, 'manual'), 2);
});
