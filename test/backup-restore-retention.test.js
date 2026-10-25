'use strict';

// A restore takes a safety backup first, and every new backup runs retention.
// The archive being restored is usually an old one - exactly what retention
// removes - so it must be protected until the restore has read it, under every
// limit: the per-reason count, the age ceiling and the size ceiling.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const containers = require('../src/docker/containers');
const servers = require('../src/services/servers');
const settings = require('../src/services/settings');
const { dataPath } = require('../src/storage/pathGuard');
const backups = require('../src/services/backups');
const backupRetention = require('../src/services/backupRetention');

// No Docker: the server is "stopped" and stays so.
containers.inspectStatus = async () => ({ exists: false });
servers.stopServerUnguarded = async () => {};

const SID = 'srv_restore';

async function seed({ count = 6, sizeBytes = 100 } = {}) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, 'Restore', 'PAPER', 47500, 48500, 'x', 1024, 1536)`,
    SID
  );
  fs.mkdirSync(dataPath('backups', SID), { recursive: true });
  for (let i = 0; i < count; i++) {
    // Each archive holds a distinct world so the restore's result is checkable.
    fs.rmSync(dataPath('servers', SID), { recursive: true, force: true });
    fs.mkdirSync(dataPath('servers', SID), { recursive: true });
    fs.writeFileSync(dataPath('servers', SID, 'level.dat'), `world-${i}`);
    const rel = `backups/${SID}/${SID}-scheduled-${i}.zip`;
    await backups.zipDirectory(dataPath('servers', SID), dataPath(rel));
    db.run(
      `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, created_at)
       VALUES (?, ?, ?, ?, ?, 'scheduled', datetime('now', ?))`,
      `bk_${i}`,
      SID,
      `${SID}-scheduled-${i}.zip`,
      rel,
      typeof sizeBytes === 'function' ? sizeBytes(i) : sizeBytes,
      `-${(count - i) * 2} days`
    );
  }
  fs.writeFileSync(dataPath('servers', SID, 'level.dat'), 'world-live');
}

const ids = () => db.all('SELECT id FROM backups WHERE server_id = ?', SID).map((r) => r.id);
const world = () => fs.readFileSync(dataPath('servers', SID, 'level.dat'), 'utf8');

test.afterEach(() => {
  settings.remove('backup_retention');
  db.run('DELETE FROM backups');
  db.run('DELETE FROM servers');
  fs.rmSync(dataPath('servers'), { recursive: true, force: true });
  fs.rmSync(dataPath('backups'), { recursive: true, force: true });
});

const total = () => db.get('SELECT SUM(size_bytes) AS n FROM backups WHERE server_id = ?', SID).n;

// afterwards: what the next prune does once the restore no longer holds the archive.
for (const [name, policy, sizeBytes, afterwards] of [
  ['a lowered count limit', { keepScheduled: 2 }, 100, () => assert.ok(!ids().includes('bk_0'))],
  ['the age limit', { maxAgeDays: 3 }, 100, () => assert.ok(!ids().includes('bk_0'))],
  [
    'the size limit',
    { maxTotalGb: 1 },
    0.4 * 1024 ** 3,
    () => assert.ok(!ids().includes('bk_0') && total() <= 1024 ** 3),
  ],
]) {
  test(`restoring an old backup over ${name} restores it, and keeps it until the restore is done`, async () => {
    await seed({ sizeBytes });
    backupRetention.setGlobal(policy);
    await backups.restoreBackup(SID, 'bk_0', { actor: 'admin' });
    assert.equal(world(), 'world-0');
    assert.ok(ids().includes('bk_0'), 'the restored backup survived its own restore');
    // Protection ends with the restore: the next prune treats it like any other.
    await backups.pruneRetention(SID);
    afterwards();
  });
}

test('the size pass never deletes other backups to make room around the archive being restored', async () => {
  // One big old archive and five small newer ones, 13 GB against a 10 GB cap.
  await seed({ sizeBytes: (i) => (i === 0 ? 8 : 1) * 1024 ** 3 });
  backupRetention.setGlobal({ maxTotalGb: 10 });
  await backups.restoreBackup(SID, 'bk_0', { actor: 'admin' });
  assert.equal(world(), 'world-0');
  // bk_0 counts as on its way out, so nothing else had to go.
  for (const id of ['bk_0', 'bk_1', 'bk_2', 'bk_3', 'bk_4', 'bk_5']) assert.ok(ids().includes(id), id);
  // Once the restore is done, the next prune removes the big archive and only it.
  await backups.pruneRetention(SID);
  assert.ok(!ids().includes('bk_0'));
  for (const id of ['bk_1', 'bk_2', 'bk_3', 'bk_4', 'bk_5']) assert.ok(ids().includes(id), id);
});

test('deleting a backup by hand is refused while it is being restored', async () => {
  await seed({ count: 3 });
  // Hold the restore at its stop step: the archive is protected from here on.
  let release;
  const gate = new Promise((r) => (release = r));
  let reached;
  const atStop = new Promise((r) => (reached = r));
  const realStop = servers.stopServerUnguarded;
  servers.stopServerUnguarded = async () => {
    reached();
    await gate;
  };
  try {
    const restoring = backups.restoreBackup(SID, 'bk_0', { actor: 'admin' });
    await atStop;
    await assert.rejects(backups.deleteBackupByUser('bk_0', { actor: 'admin' }), (err) => err.status === 409);
    await backups.deleteBackupByUser('bk_1', { actor: 'admin' }); // any other backup still goes
    assert.ok(!ids().includes('bk_1'));
    release();
    await restoring;
    assert.equal(world(), 'world-0');
    await backups.deleteBackupByUser('bk_0', { actor: 'admin' }); // allowed once the restore is done
    assert.ok(!ids().includes('bk_0'));
  } finally {
    servers.stopServerUnguarded = realStop;
  }
});
