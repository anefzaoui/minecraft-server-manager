'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const config = require('../src/config');
const files = require('../src/services/files');

const SID = 'srv_filesvc';
let root;

test.before(() => {
  db.run(
    `INSERT OR IGNORE INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, 'Files', 'PAPER', 25671, 26671, 'x', 1024, 1536, 'stopped')`,
    SID
  );
  root = path.join(config.dataDir, 'servers', SID);
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(root, 'a.txt'), 'hello');
});

test('resolvePath rejects escapes', () => {
  assert.throws(() => files.resolvePath(SID, '../../x'), { status: 400 });
  assert.equal(files.resolvePath(SID, '').rel, '');
});

test('list sorts dirs first and errors on missing / non-folder', async () => {
  const r = await files.list(SID, '');
  assert.deepEqual(
    r.entries.map((e) => e.name),
    ['sub', 'a.txt']
  );
  assert.equal(r.entries[1].size, 5);
  await assert.rejects(files.list(SID, 'nope'), { status: 404 });
  await assert.rejects(files.list(SID, 'a.txt'), { status: 400 });
});

test('global scope hides and blocks panel-internal files', async () => {
  const r = await files.list(null, '');
  assert.ok(!r.entries.some((e) => e.name === 'panel.db' || e.name === '.session-secret'));
  await assert.rejects(files.readText(null, 'panel.db'), { status: 403 });
  await assert.rejects(files.writeText(null, '.session-secret', 'x'), { status: 403 });
  await assert.rejects(files.remove(null, '.hidden'), { status: 403 });
  await assert.rejects(files.rename(null, 'panel.db', 'x'), { status: 403 });
  await assert.rejects(files.move(null, 'panel.db', ''), { status: 403 });
  await assert.rejects(files.statFile(null, 'panel.db'), { status: 403 });
});

test('readText / writeText round trip and guards', async () => {
  assert.equal((await files.readText(SID, 'a.txt')).content, 'hello');
  await assert.rejects(files.readText(SID, 'missing.txt'), { status: 404 });
  fs.writeFileSync(path.join(root, 'bin.dat'), Buffer.from([1, 0, 2]));
  await assert.rejects(files.readText(SID, 'bin.dat'), { status: 415 });

  const w = await files.writeText(SID, 'sub/new.txt', 'héllo');
  assert.equal(w.size, 6);
  assert.equal((await files.readText(SID, 'sub/new.txt')).content, 'héllo');
  await files.writeText(SID, 'sub/new.txt', 'again');
  await assert.rejects(files.writeText(SID, 'nodir/x.txt', 'x'), { status: 404 });
  await assert.rejects(files.writeText(SID, 'sub', 'x'), { status: 400 });
  await assert.rejects(files.writeText(SID, '', 'x'), { status: 400 });
  await assert.rejects(files.writeText(SID, 'big.txt', 'x'.repeat(3 * 1024 * 1024 * 10)), { status: 413 });
});

test('writeText routes server.properties through the choke point', async () => {
  const r = await files.writeText(SID, 'server.properties', 'motd=hi\n');
  assert.equal(r.path, 'server.properties');
  assert.ok('rebuildNeeded' in r);
});

test('mkdir / rename / move / copy / remove', async () => {
  assert.deepEqual(await files.mkdir(SID, 'made/deep'), { path: 'made/deep' });
  await assert.rejects(files.mkdir(SID, 'made'), { status: 409 });
  await assert.rejects(files.mkdir(SID, ''), { status: 400 });

  assert.deepEqual(await files.rename(SID, 'a.txt', 'b.txt'), { path: 'b.txt' });
  assert.deepEqual(await files.rename(SID, 'sub/new.txt', 'n2.txt'), { path: 'sub/n2.txt' });
  await assert.rejects(files.rename(SID, 'nope', 'x'), { status: 404 });
  await assert.rejects(files.rename(SID, '', 'x'), { status: 400 });
  await assert.rejects(files.rename(SID, 'b.txt', '..'), { status: 400 });
  fs.writeFileSync(path.join(root, 'c.txt'), 'c');
  await assert.rejects(files.rename(SID, 'b.txt', 'c.txt'), { status: 409 });

  assert.deepEqual(await files.move(SID, 'b.txt', 'made'), { path: 'made/b.txt' });
  await assert.rejects(files.move(SID, 'made', 'made/deep'), { status: 400 });
  await assert.rejects(files.move(SID, 'nope', 'made'), { status: 404 });
  await assert.rejects(files.move(SID, 'c.txt', 'zzz'), { status: 400 });
  await assert.rejects(files.move(SID, '', 'made'), { status: 400 });
  fs.writeFileSync(path.join(root, 'made', 'c.txt'), 'dup');
  await assert.rejects(files.move(SID, 'c.txt', 'made'), { status: 409 });

  const cp = await files.copy(SID, 'made', 'sub');
  assert.equal(cp.path, 'sub/made');
  assert.ok(fs.existsSync(path.join(root, 'sub', 'made', 'deep')));
  await assert.rejects(files.copy(SID, 'made', 'sub'), { status: 409 });
  await assert.rejects(files.copy(SID, 'made', 'made/deep'), { status: 400 });
  await assert.rejects(files.copy(SID, 'nope', 'sub'), { status: 404 });
  await assert.rejects(files.copy(SID, 'c.txt', 'zzz'), { status: 400 });
  await assert.rejects(files.copy(SID, '', 'sub'), { status: 400 });

  const rm = await files.remove(SID, 'sub/made');
  assert.ok(rm.freedBytes >= 0);
  await assert.rejects(files.remove(SID, 'sub/made'), { status: 404 });
  await assert.rejects(files.remove(SID, ''), { status: 400 });
});

test('acceptUpload sanitizes the name and moves the file', async () => {
  const tmp = path.join(root, 'upload.tmp');
  fs.writeFileSync(tmp, 'data');
  const r = await files.acceptUpload(SID, 'sub', tmp, 'we:ird?.txt');
  assert.deepEqual(r, { path: 'sub/we_ird_.txt', name: 'we_ird_.txt', size: 4 });
  await assert.rejects(files.acceptUpload(SID, 'zzz', tmp, 'x'), { status: 400 });
  fs.writeFileSync(tmp, 'd');
  await assert.rejects(files.acceptUpload(SID, 'sub', tmp, '..'), { status: 400 });
});

test('statFile returns file info and 404s folders', async () => {
  const s = await files.statFile(SID, 'sub/we_ird_.txt');
  assert.equal(s.size, 4);
  assert.equal(s.name, 'we_ird_.txt');
  await assert.rejects(files.statFile(SID, 'sub'), { status: 404 });
});

test('assertDiskFree rejects an absurd size', async () => {
  await assert.rejects(files.assertDiskFree(Number.MAX_SAFE_INTEGER), { status: 507 });
  await files.assertDiskFree(1);
  files.assertRoom(null, 1);
});
