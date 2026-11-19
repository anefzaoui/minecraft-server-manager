'use strict';

// World library + per-server world operations, with Docker status stubbed.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const tar = require('tar');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

const containers = require('../src/docker/containers');
let dockerStatus = { exists: false };
containers.inspectStatus = async () => dockerStatus;
const execCalls = [];
containers.execCapture = async (id, cmd) => {
  execCalls.push(cmd.join(' '));
  return { stdout: '', exitCode: 0 };
};

const backups = require('../src/services/backups');
let backupCalls = 0;
backups.createBackupUnguarded = async () => {
  backupCalls++;
};

const worlds = require('../src/services/worlds');

let nextPort = 25900;
function mkServer(id, { type = 'PAPER', mc = '1.21.1' } = {}) {
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, ?, ?, ?, ?, ?, 'x', 1024, 1536, 'stopped')`,
    id,
    `Srv ${id}`,
    type,
    mc,
    nextPort,
    nextPort + 1000
  );
  nextPort++;
  return id;
}

/** Gzipped level.dat carrying a version name, seed, and spawn. */
function levelDat(version = '1.21.1', seed = 12345n) {
  const name = Buffer.concat([
    Buffer.from('080004', 'hex'),
    Buffer.from('Name'),
    Buffer.from([0, version.length]),
    Buffer.from(version),
  ]);
  const seedTag = Buffer.concat([Buffer.from([0x04, 0x00, 10]), Buffer.from('RandomSeed')]);
  const seedVal = Buffer.alloc(8);
  seedVal.writeBigInt64BE(seed);
  const spawn = (n, v) => {
    const b = Buffer.alloc(4);
    b.writeInt32BE(v);
    return Buffer.concat([Buffer.from([0x03, 0x00, n.length]), Buffer.from(n), b]);
  };
  return zlib.gzipSync(Buffer.concat([name, seedTag, seedVal, spawn('SpawnX', 10), spawn('SpawnZ', -20)]));
}

function mkWorld(id, name, { dims = false, version = '1.21.1' } = {}) {
  const base = dataPath('servers', id);
  for (const n of dims ? [name, `${name}_nether`, `${name}_the_end`] : [name]) {
    fs.mkdirSync(path.join(base, n, 'region'), { recursive: true });
    fs.writeFileSync(path.join(base, n, 'level.dat'), levelDat(version));
    fs.writeFileSync(path.join(base, n, 'region', 'r.0.0.mca'), 'x'.repeat(2048));
  }
}

test('level.dat readers', () => {
  const f = dataPath('tmp', 'ld.dat');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, levelDat('1.20.4', -99n));
  assert.equal(worlds.readLevelVersion(f), '1.20.4');
  assert.deepEqual(worlds.readLevelSpawn(f), { x: 10, z: -20 });
  assert.equal(worlds.readLevelVersion(dataPath('tmp', 'missing.dat')), null);
  assert.equal(worlds.readLevelSpawn(dataPath('tmp', 'missing.dat')), null);
  assert.equal(worlds.isDimName('world_nether'), true);
  assert.equal(worlds.isDimName('_nether'), false);
});

test('compatWarnings: flavor family and version direction', () => {
  const srv = { type: 'FABRIC', mc_version: '1.20.1' };
  assert.equal(worlds.compatWarnings({ flavor: 'FABRIC', version: '1.20.1' }, srv).length, 0);
  assert.match(worlds.compatWarnings({ flavor: 'PAPER', version: null }, srv)[0], /Paper server/);
  assert.match(worlds.compatWarnings({ version: '1.21.0' }, srv)[0], /cannot downgrade/);
  assert.match(worlds.compatWarnings({ version: '1.19' }, srv)[0], /upgraded on first load/);
  assert.equal(worlds.compatWarnings({ version: '1.19' }, { type: 'PAPER', mc_version: 'LATEST' }).length, 0);
});

test('listServerWorlds groups dims, marks active, and activeLevelName honors properties', async () => {
  const id = mkServer('srv_wl1');
  mkWorld(id, 'world', { dims: true });
  mkWorld(id, 'other');
  fs.writeFileSync(dataPath('servers', id, 'server.properties'), 'level-name=other\nlevel-seed=42\n');
  const list = await worlds.listServerWorlds(id);
  assert.deepEqual(
    list.map((w) => [w.name, w.active, w.dims.length]),
    [
      ['other', true, 1],
      ['world', false, 3],
    ]
  );
  assert.equal(list[0].seed, '42');
  const idx = await worlds.listServerWorlds(id, { sizesFromIndex: true });
  assert.equal(idx.length, 2);
  await assert.rejects(worlds.listServerWorlds('srv_nope'), { status: 404 });
  assert.deepEqual(await worlds.listServerWorlds(mkServer('srv_wl1b')), []);
  assert.deepEqual(worlds.serverWorldDims(id, 'world').length, 3);
});

test('extract → library → install (alongside + replace) → copy between servers', async () => {
  const a = mkServer('srv_wla');
  const b = mkServer('srv_wlb', { type: 'FABRIC' });
  await assert.rejects(worlds.extractFromServer(a), { status: 404 }); // no level.dat yet
  mkWorld(a, 'world', { dims: true });

  const row = await worlds.extractFromServer(a, { name: 'Snap', actor: 'tester' });
  assert.equal(row.name, 'Snap');
  assert.equal(row.version, '1.21.1');

  const lib = worlds.libraryWorlds();
  assert.equal(lib[0].sourceKind, 'extract');
  assert.match(lib[0].source, /Extracted from Srv srv_wla/);
  assert.equal(worlds.libraryWorlds({ visibleServerIds: new Set() })[0].source, 'Extracted from a server');

  assert.match(worlds.installWarnings(row.id, b)[0], /Paper server/);
  await assert.rejects(worlds.installToServer('lib_nope', b), { status: 404 });

  const alongside = await worlds.installToServer(row.id, b, { mode: 'alongside', newName: 'copy:1' });
  assert.equal(alongside.installedAs, 'copy_1');
  await assert.rejects(worlds.installToServer(row.id, b, { mode: 'alongside', newName: 'copy:1' }), { status: 409 });
  assert.ok(fs.existsSync(dataPath('servers', b, 'copy_1_nether')));

  dockerStatus = { exists: true, status: 'running' };
  await assert.rejects(worlds.installToServer(row.id, b), { status: 409 });
  dockerStatus = { exists: false };
  mkWorld(b, 'world');
  const replaced = await worlds.installToServer(row.id, b, { actor: 'tester' });
  assert.equal(replaced.installedAs, 'world');
  assert.equal(backupCalls, 1);
  assert.ok(fs.existsSync(dataPath('servers', b, 'world_the_end')));

  assert.match(worlds.copyWarnings(a, b)[0], /Paper server/);
  await assert.rejects(worlds.copyBetweenServers(a, a), { status: 400 });
  const copied = await worlds.copyBetweenServers(a, b, { mode: 'alongside', newName: 'from-a' });
  assert.equal(copied.installedAs, 'from-a');

  // Running source → the copy is wrapped in save-off / save-on.
  dockerStatus = { exists: true, status: 'running' };
  execCalls.length = 0;
  await worlds.extractFromServer(a, { name: 'Live' });
  assert.deepEqual(execCalls, ['rcon-cli save-off', 'rcon-cli save-all flush', 'rcon-cli save-on']);
  dockerStatus = { exists: false };

  await worlds.deleteLibraryWorld(row.id, { actor: 'tester' });
  await assert.rejects(worlds.deleteLibraryWorld(row.id), { status: 404 });
});

test('duplicate / rename / activate / delete / reset', async () => {
  const id = mkServer('srv_wlops');
  mkWorld(id, 'world', { dims: true });
  mkWorld(id, 'alt');

  const dup = await worlds.duplicateWorld(id, 'world');
  assert.equal(dup.name, 'world-copy');
  assert.equal((await worlds.duplicateWorld(id, 'world')).name, 'world-copy2');
  assert.ok(fs.existsSync(dataPath('servers', id, 'world-copy_nether')));
  await assert.rejects(worlds.duplicateWorld(id, 'ghost'), { status: 404 });
  await assert.rejects(worlds.duplicateWorld(id, '../x'), { status: 400 });

  await assert.rejects(worlds.deleteServerWorld(id, 'world'), { status: 409 }); // active
  await worlds.deleteServerWorld(id, 'world-copy2');
  await assert.rejects(worlds.deleteServerWorld(id, 'world-copy2'), { status: 404 });

  assert.deepEqual(await worlds.activateWorld(id, 'world'), { active: 'world', changed: false });
  assert.deepEqual(await worlds.activateWorld(id, 'alt'), { active: 'alt', changed: true });
  await assert.rejects(worlds.activateWorld(id, 'ghost'), { status: 404 });

  const rn = await worlds.renameWorld(id, 'alt', 'renamed!');
  assert.deepEqual(rn, { name: 'renamed!', wasActive: true });
  await assert.rejects(worlds.renameWorld(id, 'world', 'renamed!'), { status: 409 });
  await assert.rejects(worlds.renameWorld(id, 'ghost', 'x'), { status: 404 });
  await assert.rejects(worlds.renameWorld(id, 'world', '   '), { status: 400 });

  dockerStatus = { exists: true, status: 'running' };
  await assert.rejects(worlds.renameWorld(id, 'world', 'y'), { status: 409 });
  await assert.rejects(worlds.activateWorld(id, 'world'), { status: 409 });
  await assert.rejects(worlds.resetWorld(id), { status: 409 });
  dockerStatus = { exists: false };

  const kept = await worlds.resetWorld(id, { seedMode: 'keep', levelType: 'FLAT', backup: true });
  assert.equal(kept.level, 'renamed!');
  assert.equal(kept.keptSeed, '12345');
  assert.equal(kept.levelType, 'FLAT');
  assert.ok(!fs.existsSync(dataPath('servers', id, 'renamed!')));
  await assert.rejects(worlds.resetWorld(id), { status: 404 });

  mkWorld(id, 'renamed!');
  const custom = await worlds.resetWorld(id, { seedMode: 'custom', seed: ' hello ', backup: false });
  assert.equal(custom.seed, 'hello');
  mkWorld(id, 'renamed!');
  const rnd = await worlds.resetWorld(id, { backup: false });
  assert.equal(rnd.seed, null);
});

test('prepareWorldDownload zips a world', async () => {
  const id = mkServer('srv_wldl');
  mkWorld(id, 'world');
  const dl = await worlds.prepareWorldDownload(id, 'world');
  assert.match(dl.filename, /^Srv srv_wldl-world\.zip$/);
  assert.ok(dl.size > 0);
  fs.rmSync(dl.absPath);
  await assert.rejects(worlds.prepareWorldDownload(id, 'ghost'), { status: 404 });
});

test('importArchive handles zip and tar.gz, and rejects junk', async () => {
  await assert.rejects(worlds.importArchive(dataPath('tmp', 'nope.zip')), { status: 400 });

  const src = dataPath('tmp', 'imp-src');
  fs.mkdirSync(path.join(src, 'MyWorld', 'region'), { recursive: true });
  fs.writeFileSync(path.join(src, 'MyWorld', 'level.dat'), levelDat('1.18.2'));
  fs.writeFileSync(path.join(src, 'MyWorld', 'region', 'r.mca'), 'data');
  const tgz = dataPath('tmp', 'imp.tar.gz');
  await tar.c({ gzip: true, file: tgz, cwd: src }, ['MyWorld']);
  const row = await worlds.importArchive(tgz, { originalName: 'imp.tar.gz', actor: 'tester', flavor: 'PAPER' });
  assert.equal(row.version, '1.18.2');
  assert.equal(row.name, 'imp.tar');
  assert.equal(worlds.libraryWorlds().find((w) => w.id === row.id).sourceKind, 'upload');

  const junk = dataPath('tmp', 'junk.bin');
  fs.writeFileSync(junk, 'not an archive');
  await assert.rejects(worlds.importArchive(junk), { status: 400 });

  const empty = dataPath('tmp', 'empty.tar');
  fs.mkdirSync(path.join(src, 'x'), { recursive: true });
  fs.writeFileSync(path.join(src, 'x', 'readme.txt'), 'hi');
  await tar.c({ file: empty, cwd: src }, ['x']);
  await assert.rejects(worlds.importArchive(empty, { originalName: 'empty.tar' }), /No level\.dat/);
});
