'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const worlds = require('../src/services/worlds');
const app = require('./helpers/app');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const env = require('./helpers/env');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

function writeLevel(file, contents = Buffer.from('')) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function makeLevelDat(version) {
  // raw (non-gzip) NBT string tag for "Name" -> value
  return Buffer.concat([
    Buffer.from('080004', 'hex'),
    Buffer.from('Name'),
    Buffer.from([0x00, version.length]),
    Buffer.from(version),
  ]);
}

test('detectWorldRoot finds a nested world root and split dims', async () => {
  const root = path.join(env.dir, 'detect');
  writeLevel(path.join(root, 'wrapper', 'world', 'level.dat'));
  writeLevel(path.join(root, 'wrapper', 'world_nether', 'level.dat'));
  writeLevel(path.join(root, 'wrapper', 'world_the_end', 'level.dat'));

  const result = await worlds.detectWorldRoot(root);
  assert.ok(result);
  assert.equal(path.basename(result.rootAbs), 'world');
  assert.equal(result.split, true);
  assert.equal(result.dims.length, 3);
});

test('detectWorldRoot returns null when no level.dat exists', async () => {
  const root = path.join(env.dir, 'nodetect');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'readme.txt'), 'hi');
  assert.equal(await worlds.detectWorldRoot(root), null);
});

test('detectWorldRoot handles a top-level world directly', async () => {
  const root = path.join(env.dir, 'flat');
  writeLevel(path.join(root, 'level.dat'));
  const result = await worlds.detectWorldRoot(root);
  assert.equal(result.rootAbs, path.resolve(root));
  assert.equal(result.dims.length, 1);
  assert.equal(result.split, false);
});

test('readLevelVersion parses the NBT Name tag and returns null on junk', () => {
  const good = path.join(env.dir, 'lv', 'level.dat');
  fs.mkdirSync(path.dirname(good), { recursive: true });
  fs.writeFileSync(good, makeLevelDat('1.21.5'));
  assert.equal(worlds.readLevelVersion(good), '1.21.5');

  // gzipped variant
  const zlib = require('node:zlib');
  const gz = path.join(env.dir, 'lv', 'level.dat.gz');
  fs.writeFileSync(gz, zlib.gzipSync(makeLevelDat('1.20.1')));
  assert.equal(worlds.readLevelVersion(gz), '1.20.1');

  // missing file
  assert.equal(worlds.readLevelVersion(path.join(env.dir, 'lv', 'missing.dat')), null);
});

test('compatWarnings flags loader family and version differences', () => {
  // same family, same version -> none
  assert.deepEqual(
    worlds.compatWarnings({ flavor: 'PAPER', version: '1.21' }, { type: 'PURPUR', mc_version: '1.21' }),
    []
  );
  // loader family mismatch
  assert.equal(
    worlds.compatWarnings({ flavor: 'FORGE', version: '1.21' }, { type: 'PAPER', mc_version: '1.21' }).length,
    1
  );
  // newer world version (can't downgrade)
  assert.equal(
    worlds.compatWarnings({ flavor: 'PAPER', version: '1.22' }, { type: 'PAPER', mc_version: '1.21' }).length,
    1
  );
  // older world version (upgrade warning)
  assert.equal(
    worlds.compatWarnings({ flavor: 'PAPER', version: '1.20' }, { type: 'PAPER', mc_version: '1.21' }).length,
    1
  );
  // LATEST target -> no version warning
  assert.deepEqual(
    worlds.compatWarnings({ flavor: 'PAPER', version: '1.20' }, { type: 'PAPER', mc_version: 'LATEST' }),
    []
  );
});

test('serverWorldDims includes split dims that exist on disk', () => {
  const sid = app.seedServer('wdims');
  const base = dataPath('servers', sid);
  fs.mkdirSync(path.join(base, 'world'), { recursive: true });
  fs.mkdirSync(path.join(base, 'world_nether'), { recursive: true });
  const dims = worlds.serverWorldDims(sid, 'world');
  assert.equal(dims.length, 2);
  assert.ok(dims.includes(dataPath('servers', sid, 'world_nether')));
});

test('activeLevelName prefers LEVEL env, then server.properties, then world', () => {
  const sid = app.seedServer('wact');
  const base = dataPath('servers', sid);
  fs.mkdirSync(base, { recursive: true });
  // no server.properties -> 'world'
  const plain = worlds.activeLevelName({ id: sid, env: {} });
  assert.equal(plain, 'world');

  // with LEVEL env
  assert.equal(worlds.activeLevelName({ id: sid, env: { LEVEL: 'myworld' } }), 'myworld');
});

test('listServerWorlds marks active world, sizes dims, and reads seed', async () => {
  const sid = app.seedServer('wworlds');
  const base = dataPath('servers', sid);
  fs.mkdirSync(path.join(base, 'survival'), { recursive: true });
  fs.mkdirSync(path.join(base, 'survival_nether'), { recursive: true });
  fs.mkdirSync(path.join(base, 'creative'), { recursive: true });
  writeLevel(path.join(base, 'survival', 'level.dat'));
  writeLevel(path.join(base, 'creative', 'level.dat'));
  fs.writeFileSync(path.join(base, 'survival', 'data.bin'), Buffer.alloc(512));

  // make survival active via server.properties
  fs.writeFileSync(path.join(base, 'server.properties'), 'level-name=survival\nlevel-seed=12345\n');

  const list = await worlds.listServerWorlds(sid);
  const active = list.find((w) => w.active);
  assert.equal(active.name, 'survival');
  assert.equal(active.seed, '12345');
  assert.deepEqual(active.dims, ['survival', 'survival_nether']);
  assert.equal(list.length, 2);

  // a seeded server with no world dir -> []
  const emptySid = app.seedServer('wempty');
  assert.deepEqual(await worlds.listServerWorlds(emptySid), []);
  // an unknown server -> 404
  await assert.rejects(() => worlds.listServerWorlds('missing-server'), /Server not found/);
});

test('libraryWorlds maps rows and deleteLibraryWorld 404s/deletes', async () => {
  // insert two library world rows (upload + extract) and a non-world row that is excluded
  const id1 = 'lib_test1';
  const id2 = 'lib_test2';
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes,
       platform, version, mc_versions_json, loaders_json, world_source, world_flavor, created_at)
     VALUES (?, 'world', 'Cool Map', 'cool.zip', 'library/worlds/cool.zip', 'aaaa', 100,
       'upload', '1.21', '["1.21"]', '["paper"]', 'upload', 'PAPER', datetime('now'))`,
    id1
  );
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes,
       world_source, world_flavor, created_at)
     VALUES (?, 'world', 'Extracted', 'ext.zip', 'library/worlds/ext.zip', 'bbbb', 200,
       'extract:srv_abc', 'FORGE', datetime('now'))`,
    id2
  );
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, created_at)
     VALUES ('lib_mod', 'mod', 'A Mod', 'm.jar', 'library/mods/m.jar', 'cccc', 50, datetime('now'))`
  );

  const list = worlds.libraryWorlds();
  assert.equal(list.length, 2);
  const upload = list.find((w) => w.id === id1);
  assert.equal(upload.source, 'Uploaded');
  assert.equal(upload.flavor, 'Paper');
  assert.equal(upload.mcVersion, '1.21');
  const extract = list.find((w) => w.id === id2);
  assert.equal(extract.source, 'Extracted from srv_abc');

  // delete the upload world (file doesn't need to exist - rm is force)
  const res = await worlds.deleteLibraryWorld(id1);
  assert.equal(res.freedBytes, 100);
  assert.equal(worlds.libraryWorlds().length, 1);

  // 404 for missing
  await assert.rejects(() => worlds.deleteLibraryWorld('lib_missing'), /World not found in the library/);

  // cleanup rows
  db.run('DELETE FROM library_files WHERE id IN (?, ?)', id2, 'lib_mod');
});

test('installWarnings and copyWarnings 404 on missing inputs', async () => {
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, created_at)
     VALUES ('lib_404', 'world', 'X', 'x.zip', 'library/worlds/x.zip', 'dddd', 10, datetime('now'))`
  );
  try {
    assert.throws(() => worlds.installWarnings('lib_missing', 'srv_abc'), /World not found in the library/);
    assert.throws(() => worlds.installWarnings('lib_404', 'not-a-server'), /Server not found/);
    assert.throws(() => worlds.copyWarnings('not-a-server', 'srv_abc'), /Server not found/);
  } finally {
    db.run('DELETE FROM library_files WHERE id = ?', 'lib_404');
  }
});
