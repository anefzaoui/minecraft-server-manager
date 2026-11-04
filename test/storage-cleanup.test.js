'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const { runCleanup, largestFiles } = require('../src/web/routes/storageCleanup');

const DAY = 86_400_000;
function put(rel, bytes, ageMs = 0) {
  const abs = dataPath(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, 'x'.repeat(bytes));
  const t = new Date(Date.now() - ageMs);
  fs.utimesSync(abs, t, t);
  return abs;
}

test('tmp: only entries older than an hour go; dry run changes nothing', async () => {
  put('tmp/old.bin', 100, 2 * 3600_000);
  put('tmp/fresh.bin', 100, 0);
  const oldDir = put('tmp/olddir/inner.bin', 50, 0);
  fs.utimesSync(path.dirname(oldDir), new Date(Date.now() - 2 * 3600_000), new Date(Date.now() - 2 * 3600_000));

  assert.deepEqual(await runCleanup('tmp', { dryRun: true }), { freedBytes: 150, removed: 2 });
  assert.ok(fs.existsSync(dataPath('tmp/old.bin')));
  assert.deepEqual(await runCleanup('tmp', { actor: 'tester' }), { freedBytes: 150, removed: 2 });
  assert.ok(!fs.existsSync(dataPath('tmp/old.bin')));
  assert.ok(fs.existsSync(dataPath('tmp/fresh.bin')));
});

test('orphans: unreferenced library files and stray backup zips', async () => {
  put('library/mods/orphan.jar', 30);
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes)
     VALUES ('lib_orph', 'mod', 'Orphan', 'orphan.jar', 'library/mods/orphan.jar', 'abc', 30)`
  );
  put('backups/srv_x/stray.zip', 70, 2 * 3600_000);
  put('backups/srv_x/recent.zip', 70, 0);
  put('backups/srv_x/known.zip', 70, 2 * 3600_000);
  put('backups/srv_x/notes.txt', 5, 2 * 3600_000);
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES ('srv_x', 'X', 'PAPER', 25980, 26980, 'x', 1024, 1536)`
  );
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason) VALUES ('bk_1', 'srv_x', 'known.zip', 'backups/srv_x/known.zip', 70, 'manual')`
  );

  const dry = await runCleanup('orphans', { dryRun: true });
  assert.deepEqual(dry, { freedBytes: 100, removed: 2 });
  const real = await runCleanup('orphans', { actor: 'tester' });
  assert.equal(real.removed, 2);
  assert.ok(!fs.existsSync(dataPath('backups/srv_x/stray.zip')));
  assert.ok(fs.existsSync(dataPath('backups/srv_x/known.zip')));
  assert.ok(fs.existsSync(dataPath('backups/srv_x/recent.zip')));
  assert.equal(db.get("SELECT 1 x FROM library_files WHERE id = 'lib_orph'"), undefined);
});

test('old-logs honours olderThanDays for server logs and event logs', async () => {
  put('logs/srv_x/old.log', 40, 60 * DAY);
  put('logs/srv_x/new.log', 40, 1 * DAY);
  put('logs/srv_x/events/old-events.jsonl', 60, 60 * DAY);
  assert.deepEqual(await runCleanup('old-logs', { dryRun: true }), { freedBytes: 100, removed: 2 });
  assert.deepEqual(await runCleanup('old-logs', { olderThanDays: 45 }), { freedBytes: 100, removed: 2 });
  assert.ok(fs.existsSync(dataPath('logs/srv_x/new.log')));
  assert.deepEqual(await runCleanup('old-logs', { olderThanDays: 0.5 }), { freedBytes: 40, removed: 1 });
});

test('old-crashes removes old crash reports (dry run counts them first)', async () => {
  const old = new Date(Date.now() - 90 * DAY).toISOString();
  put('servers/srv_x/crash-reports/crash-old.txt', 25);
  db.run(
    `INSERT INTO crash_reports (id, server_id, filename, file_mtime, size_bytes) VALUES ('cr_1', 'srv_x', 'crash-old.txt', ?, 25)`,
    old
  );
  assert.deepEqual(await runCleanup('old-crashes', { dryRun: true }), { freedBytes: 25, removed: 1 });
  assert.deepEqual(await runCleanup('old-crashes'), { freedBytes: 25, removed: 1 });
  assert.equal(db.get("SELECT 1 x FROM crash_reports WHERE id = 'cr_1'"), undefined);
});

test('unknown actions are rejected with 400', async () => {
  await assert.rejects(runCleanup('bogus'), { status: 400 });
});

test('largestFiles ranks by size and honours top and maxScan', async () => {
  put('big/a.bin', 5000);
  put('big/b.bin', 3000);
  put('big/deep/c.bin', 4000);
  const top = (await largestFiles({ top: 50 })).filter((f) => f.path.startsWith('big/'));
  assert.deepEqual(
    top.map((f) => f.path),
    ['big/a.bin', 'big/deep/c.bin', 'big/b.bin']
  );
  assert.equal((await largestFiles({ top: 2 })).length, 2);
  assert.equal((await largestFiles({ maxScan: 1 })).length, 1);
});
