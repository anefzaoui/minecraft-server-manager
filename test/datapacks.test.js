'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const mods = require('../src/services/mods');
const modrinth = require('../src/services/modrinthApi');
const library = require('../src/services/library');

/** Fake library_files row so server_content's FK on library_id is satisfied. */
function fakeLibraryRow(id, meta) {
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, 100)`,
    id,
    meta.category,
    meta.name,
    meta.filename,
    `library/${id}`,
    `sha-${id}`
  );
  return { id, name: meta.name, version: meta.version, icon_url: meta.iconUrl || null, size_bytes: 100 };
}

test('contentDir maps datapack to world/datapacks for both mod and plugin server types', () => {
  assert.equal(mods.contentDir({ type: 'FABRIC' }, 'datapack'), 'world/datapacks');
  assert.equal(mods.contentDir({ type: 'PAPER' }, 'datapack'), 'world/datapacks');
});

test('listContent scans world/datapacks alongside the mod/plugin dir', async () => {
  const id = app.seedServer('srv_dp_list'); // PAPER
  const modsDir = dataPath('servers', id, 'plugins');
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(modsDir, { recursive: true });
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(modsDir, 'someplugin.jar'), 'x');
  await fsp.writeFile(path.join(dpDir, 'better-caves.zip'), 'x');

  const items = await mods.listContent(id);
  const names = items.map((i) => i.file);
  assert.ok(names.includes('someplugin.jar'));
  assert.ok(names.includes('better-caves.zip'));
  assert.equal(items.find((i) => i.file === 'someplugin.jar').kind, 'plugin');
  assert.equal(items.find((i) => i.file === 'better-caves.zip').kind, 'datapack');
});

test('listContent works for a mod-type (non-plugin) server too', async () => {
  const id = app.seedServer('srv_dp_list_mod');
  db.run(`UPDATE servers SET type = 'FABRIC' WHERE id = ?`, id);
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'terralith.zip'), 'x');

  const items = await mods.listContent(id);
  assert.equal(items.find((i) => i.file === 'terralith.zip')?.kind, 'datapack');
});

test('installFromUrl auto-detects a Modrinth datapack and does not filter its version by loader', async () => {
  const id = app.seedServer('srv_dp_install');
  db.run(`UPDATE servers SET type = 'FORGE', mc_version = '1.21.1' WHERE id = ?`, id);

  const realResolveUrl = modrinth.resolveUrl;
  const realGetVersions = modrinth.getVersions;
  const realPrimaryFile = modrinth.primaryFile;
  const realDownload = library.downloadToLibrary;
  const realInstall = library.installToServer;

  let capturedLoader = 'unset';
  modrinth.resolveUrl = async () => ({
    projectId: 'dp123',
    slug: 'terralith',
    title: 'Terralith',
    iconUrl: null,
    projectType: 'datapack',
    versionId: null,
  });
  modrinth.getVersions = async (projectId, { loader } = {}) => {
    capturedLoader = loader;
    return [{ id: 'v1', version_number: '2.5.0', game_versions: ['1.21.1'], loaders: [], files: [] }];
  };
  modrinth.primaryFile = () => ({ url: 'https://example.invalid/terralith.zip', filename: 'terralith.zip' });
  library.downloadToLibrary = async (url, meta) => fakeLibraryRow('lib_dp1', meta);
  library.installToServer = async () => ({ filename: 'terralith.zip' });

  try {
    const result = await mods.installFromUrl(id, 'https://modrinth.com/datapack/terralith', { actor: 'test' });
    assert.equal(capturedLoader, undefined); // no loader facet for a datapack version lookup
    assert.equal(result.filename, 'terralith.zip');
    const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', id, 'terralith.zip');
    assert.equal(row.kind, 'datapack');
  } finally {
    modrinth.resolveUrl = realResolveUrl;
    modrinth.getVersions = realGetVersions;
    modrinth.primaryFile = realPrimaryFile;
    library.downloadToLibrary = realDownload;
    library.installToServer = realInstall;
  }
});

test('installFromUrl still honors an explicit kind over auto-detection', async () => {
  const id = app.seedServer('srv_dp_explicit');

  const realResolveUrl = modrinth.resolveUrl;
  const realGetVersions = modrinth.getVersions;
  const realPrimaryFile = modrinth.primaryFile;
  const realDownload = library.downloadToLibrary;
  const realInstall = library.installToServer;

  modrinth.resolveUrl = async () => ({
    projectId: 'p1',
    slug: 'sodium',
    title: 'Sodium',
    iconUrl: null,
    projectType: 'mod', // NOT a datapack
    versionId: null,
  });
  modrinth.getVersions = async () => [{ id: 'v1', version_number: '1.0', game_versions: [], loaders: [], files: [] }];
  modrinth.primaryFile = () => ({ url: 'https://example.invalid/sodium.jar', filename: 'sodium.jar' });
  library.downloadToLibrary = async (url, meta) => fakeLibraryRow('lib_x1', meta);
  library.installToServer = async () => ({ filename: 'sodium.jar' });

  try {
    // Caller explicitly says datapack even though Modrinth reports it as a mod -
    // the explicit kind must win, same as it always has.
    await mods.installFromUrl(id, 'https://modrinth.com/mod/sodium', { actor: 'test', kind: 'datapack' });
    const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', id, 'sodium.jar');
    assert.equal(row.kind, 'datapack');
  } finally {
    modrinth.resolveUrl = realResolveUrl;
    modrinth.getVersions = realGetVersions;
    modrinth.primaryFile = realPrimaryFile;
    library.downloadToLibrary = realDownload;
    library.installToServer = realInstall;
  }
});
