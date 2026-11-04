'use strict';

// Backup create / restore / delete against a real (throwaway) data dir with real
// zips, and a stubbed Docker: the save-off/save-on dance, integrity and disk
// gates, the "never rm under a live container" rule, safety snapshots, and
// that a failed restore leaves the original world untouched.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
require('../src/db/migrate').migrate();
const db = require('../src/db');

// Stub Docker-facing calls BEFORE backups.js destructures them.
const containers = require('../src/docker/containers');
let status = { exists: false };
const rcon = [];
let rconFail = null;
containers.inspectStatus = async () => status;
containers.execCapture = async (id, args) => {
  const cmd = args.slice(1).join(' ');
  rcon.push(cmd);
  if (rconFail && rconFail.test(cmd)) throw new Error(`rcon ${cmd} failed`);
  return '';
};

const servers = require('../src/services/servers');
let stopCalls = 0;
servers.stopServerUnguarded = async () => {
  stopCalls += 1;
};

const indexer = require('../src/storage/indexer');
let free = 1e15;
indexer.diskFree = async () => ({ free });
indexer.scheduleScan = () => {};

const { dataPath } = require('../src/storage/pathGuard');
const backups = require('../src/services/backups');

let n = 0;
function seed({ files = { 'world/level.dat': 'LEVEL', 'server.properties': 'motd=hi' } } = {}) {
  n += 1;
  const id = `srv_bk${n}`;
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, ?, 'PAPER', ?, ?, 'x', 1024, 1536)`,
    id,
    id,
    25800 + n * 2,
    26800 + n * 2
  );
  for (const [rel, body] of Object.entries(files)) {
    const abs = dataPath('servers', id, rel);
    fs.mkdirSync(require('node:path').dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return id;
}
const read = (id, rel) => fs.readFileSync(dataPath('servers', id, rel), 'utf8');
const events = (id, type) => db.all('SELECT * FROM events WHERE server_id = ? AND type = ?', id, type);

test.beforeEach(() => {
  status = { exists: false };
  rcon.length = 0;
  rconFail = null;
  stopCalls = 0;
  free = 1e15;
});

test('creating a backup of a stopped server writes a valid zip, a row, and an event', async () => {
  const id = seed();
  const b = await backups.createBackup(id, { reason: 'manual', actor: 'tester', note: 'n' });
  assert.match(b.id, /^bk_/);
  assert.equal(b.server_id, id);
  assert.equal(b.reason, 'manual');
  assert.ok(b.size_bytes > 0);
  assert.ok(fs.existsSync(dataPath(b.rel_path)));
  assert.deepEqual(rcon, [], 'no rcon dance for a stopped server');
  assert.equal(events(id, 'backup-created').length, 1);
});

test('an unknown or soft-deleted server is a 404', async () => {
  await assert.rejects(
    () => backups.createBackup('srv_nope'),
    (e) => e.status === 404
  );
  const id = seed();
  db.run("UPDATE servers SET deleted_at = datetime('now') WHERE id = ?", id);
  await assert.rejects(
    () => backups.createBackup(id),
    (e) => e.status === 404
  );
});

test('a backup is refused (507) when there is not enough free disk', async () => {
  const id = seed();
  free = 1;
  const real = indexer.sizeOf;
  indexer.sizeOf = () => 1_000_000;
  try {
    await assert.rejects(
      () => backups.createBackup(id),
      (e) => e.status === 507
    );
  } finally {
    indexer.sizeOf = real;
  }
  assert.equal(db.all('SELECT 1 FROM backups WHERE server_id = ?', id).length, 0);
});

test('an empty server dir still backs up, with a warning in the event', async () => {
  const id = seed({ files: {} });
  await fsp.mkdir(dataPath('servers', id), { recursive: true });
  const b = await backups.createBackup(id);
  assert.ok(b.id);
  assert.match(events(id, 'backup-created')[0].summary, /no files/);
});

test('a running server is paused, flushed, archived, then saves are re-enabled, in that order', async () => {
  const id = seed();
  status = { exists: true, status: 'running' };
  await backups.createBackup(id);
  assert.deepEqual(rcon, ['save-off', 'save-all flush', 'save-on']);
  assert.ok(!/Warning/.test(events(id, 'backup-created')[0].summary));
});

test('if pausing saves fails the backup still succeeds but is flagged inconsistent', async () => {
  const id = seed();
  status = { exists: true, status: 'running' };
  rconFail = /^save-off$/;
  await backups.createBackup(id);
  assert.match(events(id, 'backup-created')[0].summary, /Warning: world saves could not be paused/);
  assert.ok(rcon.includes('save-on'), 'saves are still re-enabled');
});

test('if re-enabling saves fails, the operator is told loudly', async () => {
  const id = seed();
  status = { exists: true, status: 'running' };
  rconFail = /^save-on$/;
  await backups.createBackup(id);
  assert.equal(events(id, 'backup-warning').length, 1);
  assert.match(events(id, 'backup-warning')[0].summary, /save-on/);
});

test('restore swaps the archived world in and leaves a safety backup of the one it replaced', async () => {
  const id = seed();
  const b = await backups.createBackup(id, { reason: 'manual' });
  fs.writeFileSync(dataPath('servers', id, 'world/level.dat'), 'CHANGED');
  fs.writeFileSync(dataPath('servers', id, 'extra.txt'), 'new file');

  const steps = [];
  const out = await backups.restoreBackup(id, b.id, { actor: 'tester', task: { step: (s) => steps.push(s) } });
  assert.deepEqual(out, { ok: true });
  assert.equal(read(id, 'world/level.dat'), 'LEVEL');
  assert.ok(!fs.existsSync(dataPath('servers', id, 'extra.txt')), 'files added after the backup are gone');
  assert.equal(stopCalls, 1);
  assert.deepEqual(steps, ['Stopping server…', 'Creating safety backup…', 'Extracting backup…']);
  const safety = db.all("SELECT * FROM backups WHERE server_id = ? AND reason = 'pre-restore'", id);
  assert.equal(safety.length, 1, 'the replaced world is recoverable');
  assert.equal(events(id, 'backup-restored').length, 1);
  const leftovers = fs.readdirSync(dataPath('servers')).filter((d) => d.startsWith('.restore-displaced'));
  assert.deepEqual(leftovers, [], 'the displaced copy is cleaned up');
});

test('skipSafety restores without making a pre-restore backup', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  await backups.restoreBackup(id, b.id, { skipSafety: true });
  assert.equal(db.all("SELECT 1 FROM backups WHERE server_id = ? AND reason = 'pre-restore'", id).length, 0);
});

test('restore refuses to touch a world whose container did not stop (409)', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  fs.writeFileSync(dataPath('servers', id, 'world/level.dat'), 'LIVE');
  status = { exists: true, status: 'running' };
  await assert.rejects(
    () => backups.restoreBackup(id, b.id),
    (e) => e.status === 409 && /did not stop/.test(e.message)
  );
  assert.equal(read(id, 'world/level.dat'), 'LIVE', 'the live world is untouched');
});

test("restore: unknown backup, another server's backup, and a missing archive are all 404", async () => {
  const id = seed();
  const other = seed();
  const b = await backups.createBackup(other);
  await assert.rejects(
    () => backups.restoreBackup(id, 'bk_missing'),
    (e) => e.status === 404
  );
  await assert.rejects(
    () => backups.restoreBackup(id, b.id),
    (e) => e.status === 404,
    "cannot restore another server's backup onto this one"
  );
  fs.rmSync(dataPath(b.rel_path));
  await assert.rejects(
    () => backups.restoreBackup(other, b.id),
    (e) => e.status === 404 && /missing on disk/.test(e.message)
  );
});

test('restore is refused (507) before anything is stopped when the disk is too full', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  free = 1;
  await assert.rejects(
    () => backups.restoreBackup(id, b.id),
    (e) => e.status === 507
  );
  assert.equal(stopCalls, 0);
});

test('a corrupt archive fails the restore and leaves the original world intact', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  fs.writeFileSync(dataPath('servers', id, 'world/level.dat'), 'KEEP ME');
  fs.writeFileSync(dataPath(b.rel_path), 'this is not a zip file at all');
  await assert.rejects(() => backups.restoreBackup(id, b.id, { skipSafety: true }));
  assert.equal(read(id, 'world/level.dat'), 'KEEP ME');
  const staging = fs.readdirSync(dataPath('tmp')).filter((d) => d.startsWith(`restore-${id}`));
  assert.deepEqual(staging, [], 'the staging dir is cleaned up');
});

test('restore works when the server dir does not exist yet', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  fs.rmSync(dataPath('servers', id), { recursive: true });
  await backups.restoreBackup(id, b.id, { skipSafety: true });
  assert.equal(read(id, 'server.properties'), 'motd=hi');
});

test('a failing safety backup does not cancel the restore, but is recorded', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  const realSizeOf = indexer.sizeOf;
  // Make the safety backup's own disk gate fail while the restore preflight passes.
  let calls = 0;
  indexer.diskFree = async () => ({ free: ++calls >= 2 ? 0 : 1e15 });
  indexer.sizeOf = () => 1_000_000;
  try {
    const out = await backups.restoreBackup(id, b.id);
    assert.deepEqual(out, { ok: true });
  } finally {
    indexer.diskFree = async () => ({ free });
    indexer.sizeOf = realSizeOf;
  }
  assert.equal(db.all("SELECT 1 FROM backups WHERE server_id = ? AND reason = 'pre-restore'", id).length, 0);
  assert.match(events(id, 'backup-warning')[0].summary, /without a safety backup/);
  assert.equal(events(id, 'backup-restored').length, 1);
});

test('deleteBackup removes the file and the row, reports freed bytes, and is idempotent', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  const out = await backups.deleteBackup(b.id, { actor: 'tester' });
  assert.equal(out.freedBytes, b.size_bytes);
  assert.ok(!fs.existsSync(dataPath(b.rel_path)));
  assert.equal(db.get('SELECT 1 FROM backups WHERE id = ?', b.id), undefined);
  assert.equal(events(id, 'backup-deleted').length, 1);
  assert.deepEqual(await backups.deleteBackup(b.id), { freedBytes: 0 });
});

test('a backup and a restore cannot run at the same time on one server (409)', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  status = { exists: true, status: 'running' }; // makes the backup take >2s (save settle)
  const slow = backups.createBackup(id);
  await new Promise((r) => setTimeout(r, 50));
  await assert.rejects(
    () => backups.restoreBackup(id, b.id),
    (e) => e.status === 409
  );
  await slow;
});

test('verifyBackup reads every entry of a healthy archive and records an event', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  const out = await backups.verifyBackup(b.id, { actor: 'tester' });
  assert.equal(out.ok, true);
  assert.ok(out.entries >= 2);
  assert.equal(out.bytes, 'LEVEL'.length + 'motd=hi'.length);
  assert.equal(events(id, 'backup-verified').length, 1);
});

test('verifyBackup does not touch the live world or stop the server', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  fs.writeFileSync(dataPath('servers', id, 'world/level.dat'), 'LIVE');
  status = { exists: true, status: 'running' };
  await backups.verifyBackup(b.id);
  assert.equal(stopCalls, 0);
  assert.equal(read(id, 'world/level.dat'), 'LIVE');
});

test('verifyBackup catches a bit-flipped archive (422) and records the failure', async () => {
  const id = seed({ files: { 'world/region.mca': require('node:crypto').randomBytes(8192) } });
  const b = await backups.createBackup(id);
  const zip = dataPath(b.rel_path);
  const buf = fs.readFileSync(zip);
  buf[30 + 'world/region.mca'.length + 200] ^= 0xff; // inside the entry's data
  fs.writeFileSync(zip, buf);
  await assert.rejects(
    () => backups.verifyBackup(b.id),
    (e) => e.status === 422 && /damaged/.test(e.message)
  );
  assert.equal(events(id, 'backup-verify-failed').length, 1);
});

test('verifyBackup rejects a truncated or non-zip archive (422)', async () => {
  const id = seed();
  const b = await backups.createBackup(id);
  fs.writeFileSync(dataPath(b.rel_path), 'not a zip');
  await assert.rejects(
    () => backups.verifyBackup(b.id),
    (e) => e.status === 422
  );
});

test('verifyBackup: unknown backup and missing archive are 404', async () => {
  await assert.rejects(
    () => backups.verifyBackup('bk_missing'),
    (e) => e.status === 404
  );
  const id = seed();
  const b = await backups.createBackup(id);
  fs.rmSync(dataPath(b.rel_path));
  await assert.rejects(
    () => backups.verifyBackup(b.id),
    (e) => e.status === 404 && /missing on disk/.test(e.message)
  );
});
