'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
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

test('listContent adopts an orphaned datapack file from its library_files match', async () => {
  const id = app.seedServer('srv_dp_orphan'); // PAPER, no pack
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'sky-void-additions-1.5.2.zip'), 'x');

  // A library row exists (the shared copy), but the server_content row that
  // linked it to this server is gone - the exact state migration 016 left.
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version, icon_url, platform, project_id)
     VALUES ('lib_orphan_dp', 'datapack', 'Sky Void Additions', 'sky-void-additions-1.5.2.zip',
             'library/lib_orphan_dp', 'sha-orphan-dp', 100, '1.5.2',
             'https://example.invalid/icon.png', 'modrinth', 'sky-void-additions')`
  );

  const item = (await mods.listContent(id)).find((i) => i.file === 'sky-void-additions-1.5.2.zip');
  assert.ok(item, 'orphan datapack file is listed');
  assert.equal(item.name, 'Sky Void Additions'); // library name, not prettifyJarName
  assert.equal(item.version, '1.5.2');
  assert.equal(item.iconUrl, 'https://example.invalid/icon.png');
  assert.equal(item.source, 'overlay'); // shows as custom, not a bare "file"
  assert.equal(item.kind, 'datapack');
  assert.equal(item.enabled, true);
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

test('installFromUrl picks the .zip datapack build, never a same-version mod .jar', async () => {
  const id = app.seedServer('srv_dp_zip_pref');
  db.run(`UPDATE servers SET type = 'FABRIC', mc_version = '1.21.1' WHERE id = ?`, id);

  const realResolveUrl = modrinth.resolveUrl;
  const realGetVersions = modrinth.getVersions;
  const realDownload = library.downloadToLibrary;
  const realInstall = library.installToServer;

  let downloadedUrl = null;
  modrinth.resolveUrl = async () => ({
    projectId: 'dp1',
    slug: 'sky-void-additions',
    title: 'Sky Void Additions',
    iconUrl: null,
    projectType: 'datapack',
    versionId: null,
  });
  // A "+mod" version (jar-only) sorts newest; the datapack version has the .zip.
  modrinth.getVersions = async () => [
    {
      id: 'v-mod',
      version_number: '1.5.2+mod',
      game_versions: ['1.21.1'],
      loaders: ['fabric', 'quilt'],
      files: [
        {
          url: 'https://example.invalid/sky-void-additions-1.5.2.jar',
          filename: 'sky-void-additions-1.5.2.jar',
          primary: true,
        },
      ],
    },
    {
      id: 'v-dp',
      version_number: '1.5.2',
      game_versions: ['1.21.1'],
      loaders: ['datapack'],
      files: [
        {
          url: 'https://example.invalid/sky-void-additions-1.5.2.zip',
          filename: 'sky-void-additions-1.5.2.zip',
          primary: true,
        },
      ],
    },
  ];
  library.downloadToLibrary = async (url, meta) => {
    downloadedUrl = url;
    return fakeLibraryRow('lib_dpzip', meta);
  };
  library.installToServer = async () => ({ filename: 'sky-void-additions-1.5.2.zip' });

  try {
    const result = await mods.installFromUrl(id, 'https://modrinth.com/datapack/sky-void-additions', { actor: 'test' });
    assert.equal(downloadedUrl, 'https://example.invalid/sky-void-additions-1.5.2.zip');
    assert.equal(result.filename, 'sky-void-additions-1.5.2.zip');
  } finally {
    modrinth.resolveUrl = realResolveUrl;
    modrinth.getVersions = realGetVersions;
    library.downloadToLibrary = realDownload;
    library.installToServer = realInstall;
  }
});

test('installFromUrl refuses a direct .jar URL when the kind is datapack', async () => {
  const id = app.seedServer('srv_dp_jar_reject');
  db.run(`UPDATE servers SET type = 'PAPER' WHERE id = ?`, id);
  await assert.rejects(
    () =>
      mods.installFromUrl(id, 'https://example.invalid/some-datapack-mod-1.0.jar', { actor: 'test', kind: 'datapack' }),
    /must be a \.zip/i
  );
});

test('removeContent finds and deletes a row-less datapack (no server_content row)', async () => {
  const id = app.seedServer('srv_dp_orphan_remove');
  db.run(`UPDATE servers SET type = 'FABRIC' WHERE id = ?`, id);
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  const file = path.join(dpDir, 'loose-terralith.zip');
  await fsp.writeFile(file, 'x');

  // No server_content row exists for this file (e.g. dropped in by hand) -
  // removeContent used to default to the mods/plugins dir when it couldn't
  // find a row, silently missed the datapack, and reported success anyway.
  const result = await mods.removeContent(id, 'loose-terralith.zip', { actor: 'test' });
  assert.ok(result.freedBytes > 0);
  await assert.rejects(fsp.access(file));
});

test('removeContent refuses a row-less file on a pack server (would just come back on recreate)', async () => {
  const id = app.seedServer('srv_dp_pack_remove');
  db.run(`UPDATE servers SET type = 'AUTO_CURSEFORGE' WHERE id = ?`, id);
  const modsDir = dataPath('servers', id, 'mods');
  await fsp.mkdir(modsDir, { recursive: true });
  await fsp.writeFile(path.join(modsDir, 'packmod.jar'), 'x');

  // Pack-installed files never get a server_content row, so a naive
  // `row && row.managed_by === 'pack'` check let these through deletion -
  // they'd then reappear the next time the pack recreated since nothing
  // excluded them.
  await assert.rejects(mods.removeContent(id, 'packmod.jar', { actor: 'test' }), (err) => err.status === 409);
  await assert.doesNotReject(fsp.access(path.join(modsDir, 'packmod.jar')));
});

test('setEnabled toggles a row-less datapack instead of silently no-oping', async () => {
  const id = app.seedServer('srv_dp_orphan_toggle');
  db.run(`UPDATE servers SET type = 'FABRIC' WHERE id = ?`, id);
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  const file = path.join(dpDir, 'loose-toggle.zip');
  await fsp.writeFile(file, 'x');

  const result = await mods.setEnabled(id, 'loose-toggle.zip', false, { actor: 'test' });
  assert.equal(result.applied, 'instant');
  await assert.rejects(fsp.access(file));
  await assert.doesNotReject(fsp.access(`${file}.disabled`));
});

test('installFromUrl does not filter plugin installs by the hardcoded "paper" loader', async () => {
  const id = app.seedServer('srv_plugin_loader'); // PAPER by default

  const realResolveUrl = modrinth.resolveUrl;
  const realGetVersions = modrinth.getVersions;
  const realPrimaryFile = modrinth.primaryFile;
  const realDownload = library.downloadToLibrary;
  const realInstall = library.installToServer;

  let capturedLoader = 'unset';
  modrinth.resolveUrl = async () => ({
    projectId: 'plug1',
    slug: 'someplugin',
    title: 'SomePlugin',
    iconUrl: null,
    projectType: 'plugin',
    versionId: null,
  });
  modrinth.getVersions = async (projectId, { loader } = {}) => {
    capturedLoader = loader;
    return [{ id: 'v1', version_number: '1.0', game_versions: [], loaders: [], files: [] }];
  };
  modrinth.primaryFile = () => ({ url: 'https://example.invalid/someplugin.jar', filename: 'someplugin.jar' });
  library.downloadToLibrary = async (url, meta) => fakeLibraryRow('lib_plug1', meta);
  library.installToServer = async () => ({ filename: 'someplugin.jar' });

  try {
    await mods.installFromUrl(id, 'https://modrinth.com/plugin/someplugin', { actor: 'test' });
    // A plugin server only carries a Bukkit-API-compatible loader tag
    // ('paper') - many plugins that run fine on Paper only tag
    // 'spigot'/'bukkit', so the version lookup must not filter by loader.
    assert.equal(capturedLoader, undefined);
  } finally {
    modrinth.resolveUrl = realResolveUrl;
    modrinth.getVersions = realGetVersions;
    modrinth.primaryFile = realPrimaryFile;
    library.downloadToLibrary = realDownload;
    library.installToServer = realInstall;
  }
});

test('installFromUrl with ignoreVersion also waives the loader match, not just MC version', async () => {
  const id = app.seedServer('srv_mod_ignoreversion');
  db.run(`UPDATE servers SET type = 'FABRIC', mc_version = '1.21.1' WHERE id = ?`, id);

  const realResolveUrl = modrinth.resolveUrl;
  const realGetVersions = modrinth.getVersions;
  const realPrimaryFile = modrinth.primaryFile;
  const realDownload = library.downloadToLibrary;
  const realInstall = library.installToServer;

  let captured = { loader: 'unset', mcVersion: 'unset' };
  modrinth.resolveUrl = async () => ({
    projectId: 'mod1',
    slug: 'somemod',
    title: 'SomeMod',
    iconUrl: null,
    projectType: 'mod',
    versionId: null,
  });
  modrinth.getVersions = async (projectId, { loader, mcVersion } = {}) => {
    captured = { loader, mcVersion };
    return [{ id: 'v1', version_number: '1.0', game_versions: ['1.20.9'], loaders: ['forge'], files: [] }];
  };
  modrinth.primaryFile = () => ({ url: 'https://example.invalid/somemod.jar', filename: 'somemod.jar' });
  library.downloadToLibrary = async (url, meta) => fakeLibraryRow('lib_mod1', meta);
  library.installToServer = async () => ({ filename: 'somemod.jar' });

  try {
    await mods.installFromUrl(id, 'https://modrinth.com/mod/somemod', { actor: 'test', ignoreVersion: true });
    assert.equal(captured.loader, undefined);
    assert.equal(captured.mcVersion, undefined);
  } finally {
    modrinth.resolveUrl = realResolveUrl;
    modrinth.getVersions = realGetVersions;
    modrinth.primaryFile = realPrimaryFile;
    library.downloadToLibrary = realDownload;
    library.installToServer = realInstall;
  }
});

test('installFromUrl still filters mod installs by loader when ignoreVersion is not set', async () => {
  const id = app.seedServer('srv_mod_strict');
  db.run(`UPDATE servers SET type = 'FABRIC' WHERE id = ?`, id);

  const realResolveUrl = modrinth.resolveUrl;
  const realGetVersions = modrinth.getVersions;
  const realPrimaryFile = modrinth.primaryFile;
  const realDownload = library.downloadToLibrary;
  const realInstall = library.installToServer;

  let capturedLoader = 'unset';
  modrinth.resolveUrl = async () => ({
    projectId: 'mod2',
    slug: 'othermod',
    title: 'OtherMod',
    iconUrl: null,
    projectType: 'mod',
    versionId: null,
  });
  modrinth.getVersions = async (projectId, { loader } = {}) => {
    capturedLoader = loader;
    return [{ id: 'v1', version_number: '1.0', game_versions: [], loaders: ['fabric'], files: [] }];
  };
  modrinth.primaryFile = () => ({ url: 'https://example.invalid/othermod.jar', filename: 'othermod.jar' });
  library.downloadToLibrary = async (url, meta) => fakeLibraryRow('lib_mod2', meta);
  library.installToServer = async () => ({ filename: 'othermod.jar' });

  try {
    await mods.installFromUrl(id, 'https://modrinth.com/mod/othermod', { actor: 'test' });
    assert.equal(capturedLoader, 'fabric');
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
  // A real datapack build ships a .zip (a .jar here would be a mod-wrapped
  // build, which installFromUrl now refuses for datapack/resourcepack kinds).
  modrinth.getVersions = async () => [
    {
      id: 'v1',
      version_number: '1.0',
      game_versions: [],
      loaders: [],
      files: [{ url: 'https://example.invalid/sodium-datapack.zip', filename: 'sodium-datapack.zip', primary: true }],
    },
  ];
  modrinth.primaryFile = (v) => v.files[0];
  library.downloadToLibrary = async (url, meta) => fakeLibraryRow('lib_x1', meta);
  library.installToServer = async () => ({ filename: 'sodium-datapack.zip' });

  try {
    // Caller explicitly says datapack even though Modrinth reports it as a mod -
    // the explicit kind must win, same as it always has.
    await mods.installFromUrl(id, 'https://modrinth.com/mod/sodium', { actor: 'test', kind: 'datapack' });
    const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', id, 'sodium-datapack.zip');
    assert.equal(row.kind, 'datapack');
  } finally {
    modrinth.resolveUrl = realResolveUrl;
    modrinth.getVersions = realGetVersions;
    modrinth.primaryFile = realPrimaryFile;
    library.downloadToLibrary = realDownload;
    library.installToServer = realInstall;
  }
});

// --- robust orphan adoption -------------------------------------------------

/** Stub the background metadata repair so adoption tests never hit the network. */
function muteMetaRepair() {
  const real = library.ensureContentMeta;
  library.ensureContentMeta = async () => {};
  return () => {
    library.ensureContentMeta = real;
  };
}

test('listContent adopts an orphan whose library row has a drifted category', async () => {
  const id = app.seedServer('srv_dp_catdrift'); // PAPER, no pack
  const restore = muteMetaRepair();
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'skyblock-advancements-1.0.12.zip'), 'x');

  // Modrinth typed this datapack project as a "mod", so category = 'mod'.
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version, icon_url, platform, project_id)
     VALUES ('lib_catdrift', 'mod', 'Skyblock Advancements', 'skyblock-advancements-1.0.12.zip',
             'library/lib_catdrift', 'sha-catdrift', 100, '1.0.12',
             'https://example.invalid/adv.png', 'modrinth', 'skyblock-advancements')`
  );

  try {
    const item = (await mods.listContent(id)).find((i) => i.file === 'skyblock-advancements-1.0.12.zip');
    assert.equal(item.name, 'Skyblock Advancements');
    assert.equal(item.version, '1.0.12');
    assert.equal(item.iconUrl, 'https://example.invalid/adv.png');
    assert.equal(item.source, 'overlay');
    assert.equal(item.kind, 'datapack');
  } finally {
    restore();
  }
});

test('listContent adopts an orphan by file hash when the name gained/lost an extension', async () => {
  const id = app.seedServer('srv_dp_hash');
  const restore = muteMetaRepair();
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  const bytes = 'datapack-zip-bytes';
  await fsp.writeFile(path.join(dpDir, 'standard-skyblock-2.1.6.zip'), bytes);
  const sha = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');

  // Library row recorded a .jar name (a mod-wrapped build) - only the hash matches.
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version, platform, project_id)
     VALUES ('lib_hash', 'datapack', 'Standard Skyblock', 'ab12cd34-standard-skyblock-2.1.6.jar',
             'library/lib_hash', ?, 100, '2.1.6', 'modrinth', 'standard-skyblock')`,
    sha
  );

  try {
    const item = (await mods.listContent(id)).find((i) => i.file === 'standard-skyblock-2.1.6.zip');
    assert.equal(item.name, 'Standard Skyblock');
    assert.equal(item.version, '2.1.6');
    assert.equal(item.source, 'overlay');
  } finally {
    restore();
  }
});

test('a confident adoption heals the missing overlay server_content row', async () => {
  const id = app.seedServer('srv_dp_heal');
  const restore = muteMetaRepair();
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'skyvoid-biome-islands.zip'), 'x');
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version, platform, project_id)
     VALUES ('lib_heal', 'datapack', 'Skyvoid Biome Islands', 'skyvoid-biome-islands.zip',
             'library/lib_heal', 'sha-heal', 100, '1.0', 'modrinth', 'skyvoid-biome-islands')`
  );

  try {
    await mods.listContent(id);
    const row = db.get(
      'SELECT * FROM server_content WHERE server_id = ? AND filename = ?',
      id,
      'skyvoid-biome-islands.zip'
    );
    assert.ok(row, 'overlay row was healed');
    assert.equal(row.managed_by, 'overlay');
    assert.equal(row.library_id, 'lib_heal');
    assert.equal(row.kind, 'datapack');

    // Second render now resolves through the row, still as custom content.
    const item = (await mods.listContent(id)).find((i) => i.file === 'skyvoid-biome-islands.zip');
    assert.equal(item.source, 'overlay');
    assert.equal(item.name, 'Skyvoid Biome Islands');
  } finally {
    restore();
  }
});

test('a pack server neither adopts nor heals a row-less datapack file', async () => {
  const id = app.seedServer('srv_dp_packguard');
  const restore = muteMetaRepair();
  db.run(`UPDATE servers SET type = 'AUTO_CURSEFORGE' WHERE id = ?`, id);
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'pack-bundled-dp.zip'), 'x');
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version, platform, project_id)
     VALUES ('lib_packguard', 'datapack', 'Pack Bundled DP', 'pack-bundled-dp.zip',
             'library/lib_packguard', 'sha-packguard', 100, '1.0', 'modrinth', 'pack-bundled-dp')`
  );

  try {
    const item = (await mods.listContent(id)).find((i) => i.file === 'pack-bundled-dp.zip');
    assert.equal(item.source, 'pack');
    assert.equal(
      db.get('SELECT COUNT(*) AS n FROM server_content WHERE server_id = ?', id).n,
      0,
      'no overlay row was written on a pack server'
    );
  } finally {
    restore();
  }
});

test('an ambiguous stem-only match drives display but is not healed', async () => {
  const id = app.seedServer('srv_dp_ambiguous_name');
  const restore = muteMetaRepair();
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'ambiguous-pack.zip'), 'x');
  // Two rows share the lower-cased stem 'ambiguous-pack'; neither matches the
  // on-disk 'ambiguous-pack.zip' by exact name, case-folded name, or hash.
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes)
     VALUES ('lib_ambig_a', 'datapack', 'A', 'ambiguous-pack.jar', 'library/a', 'sha-a', 100),
            ('lib_ambig_b', 'datapack', 'B', 'Ambiguous-Pack.jar', 'library/b', 'sha-b', 100)`
  );

  try {
    const item = (await mods.listContent(id)).find((i) => i.file === 'ambiguous-pack.zip');
    assert.equal(item.source, 'unknown', 'stays a bare file row');
    assert.equal(db.get('SELECT COUNT(*) AS n FROM server_content WHERE server_id = ?', id).n, 0);
  } finally {
    restore();
  }
});

test('installFromUrl routes a Modrinth "mod" that is really a datapack (loader tag) to world/datapacks', async () => {
  const id = app.seedServer('srv_dp_moddetect');
  db.run(`UPDATE servers SET type = 'FABRIC', mc_version = '1.21.1' WHERE id = ?`, id);

  const realResolveUrl = modrinth.resolveUrl;
  const realGetVersions = modrinth.getVersions;
  const realPrimaryFile = modrinth.primaryFile;
  const realDownload = library.downloadToLibrary;
  const realInstall = library.installToServer;

  let seenCategory = null;
  modrinth.resolveUrl = async () => ({
    projectId: 'p-mod-dp',
    slug: 'sky-void-additions',
    title: 'Sky Void Additions',
    iconUrl: 'https://example.invalid/svA.png',
    projectType: 'mod', // Modrinth types it as a mod
    versionId: null,
  });
  modrinth.getVersions = async () => [
    {
      id: 'v9',
      version_number: '1.5.2',
      game_versions: ['1.21.1'],
      loaders: ['datapack'], // ... but the build is tagged datapack
      files: [
        {
          url: 'https://example.invalid/sky-void-additions-1.5.2.zip',
          filename: 'sky-void-additions-1.5.2.zip',
          primary: true,
        },
      ],
    },
  ];
  modrinth.primaryFile = (v) => v.files[0];
  library.downloadToLibrary = async (url, meta) => {
    seenCategory = meta.category;
    return fakeLibraryRow('lib_moddetect', meta);
  };
  library.installToServer = async () => ({ filename: 'sky-void-additions-1.5.2.zip' });

  try {
    await mods.installFromUrl(id, 'https://modrinth.com/mod/sky-void-additions', { actor: 'test' });
    assert.equal(seenCategory, 'datapack', 'library stored it under the datapack category');
    const row = db.get(
      'SELECT * FROM server_content WHERE server_id = ? AND filename = ?',
      id,
      'sky-void-additions-1.5.2.zip'
    );
    assert.equal(row.kind, 'datapack');
  } finally {
    modrinth.resolveUrl = realResolveUrl;
    modrinth.getVersions = realGetVersions;
    modrinth.primaryFile = realPrimaryFile;
    library.downloadToLibrary = realDownload;
    library.installToServer = realInstall;
  }
});

test('an orphan is only healed into a row when the library match is unambiguous', async () => {
  const id = app.seedServer('srv_dp_ambig_two');
  const restore = muteMetaRepair();
  const db = require('../src/db');
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'pack.zip'), 'on-disk-bytes-that-match-neither');
  // Two different projects both uploaded as "pack.zip" (the library dedups by hash, not name).
  for (const [lid, name, sha] of [
    ['lib_amb_a', 'Project A', 'sha-ambig-a'],
    ['lib_amb_b', 'Project B', 'sha-ambig-b'],
  ]) {
    db.run(
      `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version, platform, project_id)
       VALUES (?, 'datapack', ?, 'pack.zip', ?, ?, 10, '1.0', 'modrinth', ?)`,
      lid,
      name,
      `library/${lid}`,
      sha,
      lid
    );
  }
  try {
    const item = (await mods.listContent(id)).find((i) => i.file === 'pack.zip');
    assert.ok(item, 'the file is listed');
    assert.equal(
      db.get("SELECT COUNT(*) AS n FROM server_content WHERE server_id = ? AND filename = 'pack.zip'", id).n,
      0,
      'no server_content row was written for a coin-toss match (it would drive wrong update checks)'
    );
  } finally {
    restore();
  }
});

test('a resource-pack row never adopts a file that lives in the datapacks folder', async () => {
  const id = app.seedServer('srv_dp_wrong_category');
  const restore = muteMetaRepair();
  const db = require('../src/db');
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'shared-name.zip'), 'datapack-bytes');
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version, platform, project_id)
     VALUES ('lib_rp_only', 'resourcepack', 'Fancy Textures', 'shared-name.zip', 'library/lib_rp_only', 'sha-rp', 10, '3.0', 'modrinth', 'fancy-textures')`
  );
  try {
    const item = (await mods.listContent(id)).find((i) => i.file === 'shared-name.zip');
    assert.ok(item);
    assert.notEqual(item.name, 'Fancy Textures', 'the resource-pack row was not adopted for a datapack');
    assert.equal(db.get('SELECT COUNT(*) AS n FROM server_content WHERE server_id = ?', id).n, 0);
  } finally {
    restore();
  }
});
