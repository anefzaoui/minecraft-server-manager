'use strict';

// installFromUrl build selection: hybrid Modrinth projects (plugin + mod
// builds under one project) must never hand a plugin server a mod build.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const mods = require('../src/services/mods');
const library = require('../src/services/library');

const realFetch = globalThis.fetch;
function stubModrinth(handler) {
  globalThis.fetch = (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => handler(new URL(url), init) });
    }
    return realFetch(input, init);
  };
}
function unstub() {
  globalThis.fetch = realFetch;
  db.run("DELETE FROM api_cache WHERE key LIKE 'modrinth:%'");
}

// A hybrid project: the NEWEST build is the Fabric one — pre-fix, versions[0]
// installed it into plugins/.
const PROJECT = { id: 'P1', slug: 'chunky', title: 'Chunky', project_type: 'mod', icon_url: null };
const FABRIC_BUILD = {
  id: 'v-fabric',
  version_number: '1.4.0-fabric',
  loaders: ['fabric'],
  game_versions: ['1.20.1'],
  date_published: '2026-02-02',
  files: [{ url: 'https://cdn.modrinth.com/chunky-fabric.jar', filename: 'chunky-fabric.jar', primary: true }],
};
const PAPER_BUILD = {
  id: 'v-paper',
  version_number: '1.4.0-paper',
  loaders: ['paper', 'folia'],
  game_versions: ['1.20.1'],
  date_published: '2026-02-01',
  files: [{ url: 'https://cdn.modrinth.com/chunky-paper.jar', filename: 'chunky-paper.jar', primary: true }],
};

test('setup', async () => {
  await app.start();
  await app.adminCookie();
});

test("installFromUrl on a plugin server skips a hybrid project's mod builds", async () => {
  const sid = app.seedServer('srv_hybrid');
  db.run("UPDATE servers SET type = 'PAPER', mc_version = '1.20.1' WHERE id = ?", sid);

  const realDownload = library.downloadToLibrary;
  const downloads = [];
  library.downloadToLibrary = async (url, meta) => {
    downloads.push(url);
    const id = `lib_h${downloads.length}`;
    const rel = `library/plugins/${id}.jar`;
    const fs = require('node:fs');
    const path = require('node:path');
    const { dataPath } = require('../src/storage/pathGuard');
    fs.mkdirSync(path.dirname(dataPath(rel)), { recursive: true });
    fs.writeFileSync(dataPath(rel), 'jar');
    db.run(
      `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, file_id, version)
       VALUES (?, 'plugin', ?, ?, ?, ?, 3, 'modrinth', ?, ?, ?)`,
      id,
      meta.name,
      meta.filename,
      rel,
      `sha-${id}`,
      meta.projectId,
      meta.fileId,
      meta.version
    );
    return db.get('SELECT * FROM library_files WHERE id = ?', id);
  };
  stubModrinth((url) => {
    if (url.pathname.endsWith('/version')) return [FABRIC_BUILD, PAPER_BUILD]; // newest-first
    return PROJECT;
  });
  try {
    await mods.installFromUrl(sid, 'https://modrinth.com/plugin/chunky', { actor: 'tester' });
    assert.deepEqual(downloads, ['https://cdn.modrinth.com/chunky-paper.jar'], 'paper build chosen over newer fabric');
    const row = db.get("SELECT * FROM server_content WHERE server_id = ? AND filename = 'chunky-paper.jar'", sid);
    assert.ok(row);
    assert.equal(row.kind, 'plugin');
  } finally {
    library.downloadToLibrary = realDownload;
    unstub();
  }
});

test('installFromUrl 404s clearly when a project has no plugin build at all', async () => {
  const sid = app.seedServer('srv_hybrid2');
  db.run("UPDATE servers SET type = 'PAPER', mc_version = '1.20.1' WHERE id = ?", sid);
  stubModrinth((url) => {
    if (url.pathname.endsWith('/version')) return [FABRIC_BUILD];
    return PROJECT;
  });
  try {
    await assert.rejects(
      () => mods.installFromUrl(sid, 'https://modrinth.com/mod/chunky', { actor: 'tester' }),
      /no.*plugin build|No Chunky plugin build/i
    );
  } finally {
    unstub();
  }
});

test('teardown', async () => {
  await app.stop();
});
