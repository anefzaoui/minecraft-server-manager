'use strict';

// Modrinth modpack (.mrpack) import: index parsing, detection, hash-canonical
// resolution, preview verdicts, tolerant import, and the two-tree overrides
// order (server-overrides win).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const contentZip = require('../src/services/contentZip');
const library = require('../src/services/library');
const { tempZip } = require('./helpers/zipfix');

const SHA1_KNOWN = 'a'.repeat(40);
const INDEX = {
  formatVersion: 1,
  game: 'minecraft',
  versionId: '1.2.0',
  name: 'Fabric Pack',
  summary: 'a test pack',
  files: [
    {
      path: 'mods/sodium-0.5.jar',
      hashes: { sha1: SHA1_KNOWN, sha512: 'b'.repeat(128) },
      env: { server: 'required', client: 'required' },
      downloads: ['https://cdn.modrinth.com/data/AANobbMI/versions/v050/sodium-0.5.jar'],
      fileSize: 1234,
    },
    {
      path: 'mods/custom-thing.jar',
      hashes: { sha1: 'c'.repeat(40), sha512: 'd'.repeat(128) },
      env: { server: 'required', client: 'required' },
      downloads: ['https://example.com/custom-thing.jar'],
      fileSize: 99,
    },
    {
      path: 'mods/client-shader.jar',
      hashes: { sha1: 'e'.repeat(40) },
      env: { server: 'unsupported', client: 'required' },
      downloads: ['https://cdn.modrinth.com/whatever.jar'],
      fileSize: 5,
    },
    {
      path: 'resourcepacks/pretty.zip',
      hashes: { sha1: 'f'.repeat(40) },
      env: { server: 'optional', client: 'required' },
      downloads: ['https://cdn.modrinth.com/pretty.zip'],
      fileSize: 5,
    },
  ],
  dependencies: { minecraft: '1.20.1', 'fabric-loader': '0.15.11' },
};

const MODRINTH_HANDLERS = {
  'api.modrinth.com/v2/version_files': () => ({
    [SHA1_KNOWN]: {
      id: 'v050',
      project_id: 'AANobbMI',
      name: 'Sodium 0.5.0',
      version_number: '0.5.0',
      game_versions: ['1.20.1'],
      loaders: ['fabric'],
    },
  }),
  'api.modrinth.com/v2/projects': () => [
    { id: 'AANobbMI', slug: 'sodium', title: 'Sodium', icon_url: null, project_type: 'mod' },
  ],
};

const realFetch = globalThis.fetch;
function stubRegistries(handlers) {
  globalThis.fetch = (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    for (const [frag, handler] of Object.entries(handlers)) {
      if (url.includes(frag)) {
        return Promise.resolve({ ok: true, status: 200, json: async () => handler(new URL(url), init) });
      }
    }
    return realFetch(input, init);
  };
}
function unstub() {
  globalThis.fetch = realFetch;
  db.run("DELETE FROM api_cache WHERE key LIKE 'modrinth:%'");
}

function packZip(extra = {}) {
  return tempZip('pack.mrpack', { 'modrinth.index.json': JSON.stringify(INDEX), ...extra });
}

test('setup', async () => {
  await app.start();
});

test('parseMrpackIndex reads deps/loader and rejects junk', () => {
  const m = contentZip.parseMrpackIndex(JSON.stringify(INDEX));
  assert.equal(m.name, 'Fabric Pack');
  assert.equal(m.mcVersion, '1.20.1');
  assert.equal(m.loader, 'fabric');
  assert.equal(m.loaderVersion, '0.15.11');
  assert.equal(m.files.length, 4);
  assert.throws(() => contentZip.parseMrpackIndex('not json'), /not valid JSON/);
  assert.throws(() => contentZip.parseMrpackIndex('{"game":"terraria","files":[]}'), /not a Modrinth modpack/);
});

test('inspect detects an mrpack and counts both override trees', async () => {
  const zip = await packZip({
    'overrides/config/shared.txt': 'from overrides',
    'server-overrides/config/shared.txt': 'from server-overrides',
    'overrides/config/only-generic.txt': 'generic',
  });
  const info = await contentZip.inspect(zip);
  assert.equal(info.type, 'mrpack');
  assert.equal(info.manifest.name, 'Fabric Pack');
  assert.equal(info.overridesEntries.length, 3);
});

test('previewForServer canonicalizes via hash lookup and judges fit', async () => {
  const sid = app.seedServer('srv_mrprev');
  db.run("UPDATE servers SET type = 'FABRIC', mc_version = '1.20.1' WHERE id = ?", sid);
  const zip = await packZip();
  stubRegistries(MODRINTH_HANDLERS);
  try {
    const p = await contentZip.previewForServer(sid, zip);
    assert.equal(p.type, 'mrpack');
    assert.equal(p.pack.loader, 'fabric');
    // Only the two server-side mods are selectable items.
    assert.equal(p.items.length, 2);
    const sodium = p.items.find((i) => i.fileName === 'sodium-0.5.jar');
    assert.equal(sodium.name, 'Sodium');
    assert.equal(sodium.projectId, 'AANobbMI');
    assert.equal(sodium.verdict.status, 'ok');
    assert.equal(sodium.url, 'https://modrinth.com/mod/sodium');
    assert.equal(sodium.downloadUrl, undefined); // server-side detail stays server-side
    const custom = p.items.find((i) => i.fileName === 'custom-thing.jar');
    assert.equal(custom.projectId, null); // unknown hash keeps its embedded URL
    assert.equal(custom.verdict.status, 'unknown');
    assert.ok(p.warnings.some((w) => /client-only/.test(w)));
    assert.ok(p.warnings.some((w) => /non-mod/.test(w)));
  } finally {
    unstub();
  }
});

test('previewStandalone infers loader + MC for the wizard', async () => {
  const zip = await packZip();
  stubRegistries(MODRINTH_HANDLERS);
  try {
    const p = await contentZip.previewStandalone(zip);
    assert.deepEqual(p.inferred, { loader: 'fabric', mcVersion: '1.20.1', kind: 'mod' });
    assert.equal(p.pack.loaderVersion, '0.15.11');
  } finally {
    unstub();
  }
});

test('importForServer installs with hash verification meta and applies overrides in order', async () => {
  const sid = app.seedServer('srv_mrimp');
  db.run("UPDATE servers SET type = 'FABRIC', mc_version = '1.20.1' WHERE id = ?", sid);
  // Pre-existing server file: the overrides apply must back it up first.
  const serverDir = dataPath('servers', sid);
  fs.mkdirSync(path.join(serverDir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'config', 'shared.txt'), 'original');
  const zip = await packZip({
    'overrides/config/shared.txt': 'from overrides',
    'server-overrides/config/shared.txt': 'from server-overrides',
  });

  const realDownload = library.downloadToLibrary;
  const captured = [];
  library.downloadToLibrary = async (url, meta) => {
    captured.push({ url, meta });
    const id = `lib_mr${captured.length}`;
    const rel = `library/mods/${id}.jar`;
    fs.mkdirSync(path.dirname(dataPath(rel)), { recursive: true });
    fs.writeFileSync(dataPath(rel), 'jar');
    db.run(
      `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, file_id, version)
       VALUES (?, 'mod', ?, ?, ?, ?, 3, ?, ?, ?, ?)`,
      id,
      meta.name,
      meta.filename,
      rel,
      `sha-${id}`,
      meta.platform,
      meta.projectId,
      meta.fileId,
      meta.version
    );
    return db.get('SELECT * FROM library_files WHERE id = ?', id);
  };
  stubRegistries(MODRINTH_HANDLERS);
  try {
    const report = await contentZip.importForServer(sid, zip, { actor: 'tester', applyOverrides: true });
    assert.equal(report.installed.length, 2);
    assert.deepEqual(report.skipped.map((s) => s.reason).sort(), [
      'client-only',
      'not a server mod (resource/shader pack)',
    ]);

    // Canonical file → modrinth provenance + strongest published hash.
    const sodium = captured.find((c) => c.meta.filename === 'sodium-0.5.jar');
    assert.equal(sodium.meta.platform, 'modrinth');
    assert.equal(sodium.meta.projectId, 'AANobbMI');
    assert.equal(sodium.meta.expectedHashes.sha512, 'b'.repeat(128));
    // Unknown file → plain URL source, hashes still verified.
    const custom = captured.find((c) => c.meta.filename === 'custom-thing.jar');
    assert.equal(custom.meta.platform, 'url');
    assert.equal(custom.url, 'https://example.com/custom-thing.jar');
    assert.equal(custom.meta.expectedHashes.sha512, 'd'.repeat(128));

    // server-overrides wins the shared path; the original was backed up.
    assert.equal(fs.readFileSync(path.join(serverDir, 'config', 'shared.txt'), 'utf8'), 'from server-overrides');
    assert.equal(report.overrides.applied, 1);
    assert.equal(report.overrides.backedUp, 1);
    const backup = path.join(serverDir, report.overrides.backupDir, 'config', 'shared.txt');
    assert.equal(fs.readFileSync(backup, 'utf8'), 'original');
  } finally {
    library.downloadToLibrary = realDownload;
    unstub();
  }
});

test('teardown', async () => {
  await app.stop();
});
