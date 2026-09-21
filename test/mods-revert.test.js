'use strict';

// Undoing a mod update (#52): the build a mod was updated FROM is remembered,
// the library still holds its file, and reverting puts it back without a
// download. The registry and the download are stubbed; everything the panel
// itself does - the library row, the file on disk, the overlay row, the ignore
// that stops the bad build being offered straight back - is real.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const library = require('../src/services/library');
const modrinth = require('../src/services/modrinthApi');
const mods = require('../src/services/mods');

let port = 26300;
function seedServer(id) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, 'FABRIC', '1.20.1', ?, ?, 'x', 1024, 1536, 'stopped', 'notify', '{}')`,
    id,
    id,
    port,
    port + 1
  );
  fs.mkdirSync(dataPath('servers', id, 'mods'), { recursive: true });
  return id;
}

/** A library entry with a real file behind it, as a download would leave. */
function seedLibraryFile({ id, filename, version, projectId = 'PROJ1', name = 'Test Mod' }) {
  const rel = `library/mods/${id}-${filename}`;
  fs.mkdirSync(path.dirname(dataPath(rel)), { recursive: true });
  fs.writeFileSync(dataPath(rel), `jar-bytes-${version}`);
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, file_id, version)
     VALUES (?, 'mod', ?, ?, ?, ?, ?, 'modrinth', ?, ?, ?)`,
    id,
    name,
    filename,
    rel,
    `sha-${id}`,
    fs.statSync(dataPath(rel)).size,
    projectId,
    `file-${version}`,
    version
  );
  return db.get('SELECT * FROM library_files WHERE id = ?', id);
}

function installOverlay(serverId, lib, { contentId = 'sc_1' } = {}) {
  fs.copyFileSync(dataPath(lib.rel_path), dataPath('servers', serverId, 'mods', lib.filename));
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version)
     VALUES (?, ?, ?, 'mod', 'overlay', ?, ?, ?)`,
    contentId,
    serverId,
    lib.id,
    lib.name,
    lib.filename,
    lib.version
  );
  return contentId;
}

test('an update records the build it came from, and reverting restores it', async () => {
  const id = seedServer('srv_revert');
  const oldBuild = seedLibraryFile({ id: 'lib_old', filename: 'testmod-1.0.jar', version: '1.0' });
  const newBuild = seedLibraryFile({ id: 'lib_new', filename: 'testmod-2.0.jar', version: '2.0' });
  installOverlay(id, oldBuild);
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name, checked_at)
     VALUES ('content', 'sc_1', '1.0', 'ver_2', '2.0', datetime('now'))`
  );

  const origResolve = modrinth.resolveUrl;
  const origVersion = modrinth.getVersion;
  const origPrimary = modrinth.primaryFile;
  const origDownload = library.downloadToLibrary;
  modrinth.resolveUrl = async () => ({ projectId: 'PROJ1', versionId: 'ver_2', projectType: 'mod' });
  modrinth.getVersion = async () => ({
    id: 'ver_2',
    version_number: '2.0',
    loaders: ['fabric'],
    game_versions: ['1.20.1'],
    files: [{ url: 'https://example.invalid/testmod-2.0.jar', filename: 'testmod-2.0.jar', primary: true }],
  });
  modrinth.primaryFile = (v) => v.files[0];
  library.downloadToLibrary = async () => newBuild;

  try {
    const result = await mods.applyOverlayUpdate(id, { contentId: 'sc_1' }, { actor: 'test' });
    assert.equal(result.version, '2.0');
    assert.equal(result.revertTo, '1.0');

    const updated = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', id, 'testmod-2.0.jar');
    assert.equal(updated.version, '2.0');
    assert.equal(updated.previous_library_id, 'lib_old');
    assert.equal(updated.previous_version, '1.0');
    assert.ok(fs.existsSync(dataPath('servers', id, 'mods', 'testmod-2.0.jar')));
    assert.ok(!fs.existsSync(dataPath('servers', id, 'mods', 'testmod-1.0.jar')));

    // The new build breaks the server - put it back.
    const reverted = await mods.revertOverlayUpdate(id, { file: 'testmod-2.0.jar' }, { actor: 'test' });
    assert.equal(reverted.version, '1.0');
    assert.equal(reverted.revertedFrom, '2.0');
    assert.ok(fs.existsSync(dataPath('servers', id, 'mods', 'testmod-1.0.jar')));
    assert.ok(!fs.existsSync(dataPath('servers', id, 'mods', 'testmod-2.0.jar')));

    const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', id, 'testmod-1.0.jar');
    assert.equal(row.library_id, 'lib_old');
    assert.equal(row.version, '1.0');
    // The build just reverted away from stops being offered, until a newer one
    // appears - the same rule as a manual ignore.
    assert.equal(row.ignored_update_version, '2.0');
    // No revert pointer left: there is nothing further back to go to.
    assert.equal(row.previous_library_id, null);

    const listed = await mods.listContent(id);
    const entry = listed.find((m) => m.file === 'testmod-1.0.jar');
    assert.equal(entry.version, '1.0');
    assert.equal(entry.revertTo, null);
    assert.equal(entry.updateAvailable, null, 'the reverted-away build must not be offered again');
  } finally {
    modrinth.resolveUrl = origResolve;
    modrinth.getVersion = origVersion;
    modrinth.primaryFile = origPrimary;
    library.downloadToLibrary = origDownload;
  }
});

test('a disabled mod stays disabled across a revert', async () => {
  const id = seedServer('srv_revert_disabled');
  seedLibraryFile({ id: 'lib_d_old', filename: 'dmod-1.0.jar', version: '1.0' });
  const newBuild = seedLibraryFile({ id: 'lib_d_new', filename: 'dmod-2.0.jar', version: '2.0' });
  fs.copyFileSync(dataPath(newBuild.rel_path), dataPath('servers', id, 'mods', 'dmod-2.0.jar.disabled'));
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, enabled, previous_library_id, previous_version)
     VALUES ('sc_d', ?, 'lib_d_new', 'mod', 'overlay', 'Test Mod', 'dmod-2.0.jar', '2.0', 0, 'lib_d_old', '1.0')`,
    id
  );

  await mods.revertOverlayUpdate(id, { contentId: 'sc_d' }, { actor: 'test' });
  assert.ok(fs.existsSync(dataPath('servers', id, 'mods', 'dmod-1.0.jar.disabled')));
  assert.ok(!fs.existsSync(dataPath('servers', id, 'mods', 'dmod-1.0.jar')));
  const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', id, 'dmod-1.0.jar');
  assert.equal(row.enabled, 0);
});

test('a mod that was never updated has nothing to revert to', async () => {
  const id = seedServer('srv_revert_none');
  const lib = seedLibraryFile({ id: 'lib_only', filename: 'only-1.0.jar', version: '1.0' });
  installOverlay(id, lib, { contentId: 'sc_only' });
  await assert.rejects(
    () => mods.revertOverlayUpdate(id, { contentId: 'sc_only' }, { actor: 'test' }),
    (err) => err.status === 409 && /no earlier build/i.test(err.message)
  );
});

test('a revert whose library file is gone fails safely, leaving the mod installed', async () => {
  const id = seedServer('srv_revert_gone');
  const oldBuild = seedLibraryFile({ id: 'lib_g_old', filename: 'gmod-1.0.jar', version: '1.0' });
  const newBuild = seedLibraryFile({ id: 'lib_g_new', filename: 'gmod-2.0.jar', version: '2.0' });
  fs.copyFileSync(dataPath(newBuild.rel_path), dataPath('servers', id, 'mods', 'gmod-2.0.jar'));
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, previous_library_id, previous_version)
     VALUES ('sc_g', ?, 'lib_g_new', 'mod', 'overlay', 'Test Mod', 'gmod-2.0.jar', '2.0', 'lib_g_old', '1.0')`,
    id
  );
  fs.rmSync(dataPath(oldBuild.rel_path));

  await assert.rejects(
    () => mods.revertOverlayUpdate(id, { contentId: 'sc_g' }, { actor: 'test' }),
    (err) => err.status === 409 && /no longer in the mod library/i.test(err.message)
  );
  // Nothing was removed on the way to failing.
  assert.ok(fs.existsSync(dataPath('servers', id, 'mods', 'gmod-2.0.jar')));
  assert.ok(db.get('SELECT 1 FROM server_content WHERE id = ?', 'sc_g'));
});

test('installing a build by hand clears the revert pointer', async () => {
  const id = seedServer('srv_revert_manual');
  seedLibraryFile({ id: 'lib_m_old', filename: 'mmod-1.0.jar', version: '1.0' });
  const build2 = seedLibraryFile({ id: 'lib_m_two', filename: 'mmod-2.0.jar', version: '2.0' });
  const build3 = seedLibraryFile({ id: 'lib_m_three', filename: 'mmod-2.0.jar', version: '3.0' });
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, previous_library_id, previous_version)
     VALUES ('sc_m', ?, 'lib_m_two', 'mod', 'overlay', 'Test Mod', 'mmod-2.0.jar', '2.0', 'lib_m_old', '1.0')`,
    id
  );
  const origDownload = library.downloadToLibrary;
  library.downloadToLibrary = async () => build3;
  try {
    await mods.installResolved(
      id,
      { downloadUrl: 'https://example.invalid/mmod-3.0.jar', meta: { category: 'mod' }, kind: 'mod' },
      { actor: 'test' }
    );
    const row = db.get('SELECT * FROM server_content WHERE id = ?', 'sc_m');
    assert.equal(row.version, '3.0');
    assert.equal(row.previous_library_id, null, 'a hand-picked build is not an update to undo');
    assert.equal(row.previous_version, null);
  } finally {
    library.downloadToLibrary = origDownload;
  }
  assert.ok(build2);
});

test('a revert makes no network call at all: the library is the source', async () => {
  const id = seedServer('srv_revert_offline');
  const oldBuild = seedLibraryFile({ id: 'lib_off_old', filename: 'off-1.0.jar', version: '1.0' });
  const newBuild = seedLibraryFile({ id: 'lib_off_new', filename: 'off-2.0.jar', version: '2.0' });
  fs.copyFileSync(dataPath(newBuild.rel_path), dataPath('servers', id, 'mods', 'off-2.0.jar'));
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, previous_library_id, previous_version)
     VALUES ('sc_off', ?, 'lib_off_new', 'mod', 'overlay', 'Test Mod', 'off-2.0.jar', '2.0', 'lib_off_old', '1.0')`,
    id
  );

  // The project could have been pulled from its registry since - a revert must
  // not depend on anyone answering.
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (...args) => {
    calls += 1;
    throw new Error(`a revert must not reach the network (tried ${args[0]})`);
  };
  try {
    const result = await mods.revertOverlayUpdate(id, { contentId: 'sc_off' }, { actor: 'test' });
    assert.equal(result.version, '1.0');
    assert.equal(calls, 0, 'no request may be made');
    assert.ok(fs.existsSync(dataPath('servers', id, 'mods', 'off-1.0.jar')));
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(oldBuild);
});
