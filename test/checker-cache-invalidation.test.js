'use strict';

// countOutdatedByKind (src/updates/checker.js) memoizes its result until
// invalidateOutdatedCache() runs. Four mutation paths change the exact rows
// that query reads - applying/reverting a mod update, deleting a server, and
// applying a modpack version - but only some of them called invalidate, so
// the outdated-count badge could go stale after each of the others (a bug
// from the same commit that added the memo, b934198). This confirms all four
// now call it.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const checker = require('../src/updates/checker');
const containers = require('../src/docker/containers');

let port = 26800;
function seedFabricServer(id) {
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

function seedLibraryFile({ id, filename, version }) {
  const rel = `library/mods/${id}-${filename}`;
  fs.mkdirSync(path.dirname(dataPath(rel)), { recursive: true });
  fs.writeFileSync(dataPath(rel), `jar-bytes-${version}`);
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, file_id, version)
     VALUES (?, 'mod', 'Test Mod', ?, ?, ?, ?, 'modrinth', 'PROJ1', ?, ?)`,
    id,
    filename,
    rel,
    `sha-${id}`,
    fs.statSync(dataPath(rel)).size,
    `file-${version}`,
    version
  );
  return db.get('SELECT * FROM library_files WHERE id = ?', id);
}

test('applyOverlayUpdate and revertOverlayUpdate both invalidate the outdated-count cache', async (t) => {
  const modrinth = require('../src/services/modrinthApi');
  const library = require('../src/services/library');
  const mods = require('../src/services/mods');

  const id = seedFabricServer('srv_cache_mod');
  const oldBuild = seedLibraryFile({ id: 'lib_cache_old', filename: 'testmod-1.0.jar', version: '1.0' });
  const newBuild = seedLibraryFile({ id: 'lib_cache_new', filename: 'testmod-2.0.jar', version: '2.0' });
  fs.copyFileSync(dataPath(oldBuild.rel_path), dataPath('servers', id, 'mods', oldBuild.filename));
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version)
     VALUES ('sc_cache1', ?, ?, 'mod', 'overlay', 'Test Mod', ?, ?)`,
    id,
    oldBuild.id,
    oldBuild.filename,
    oldBuild.version
  );
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name, checked_at)
     VALUES ('content', 'sc_cache1', '1.0', 'ver_2', '2.0', datetime('now'))`
  );

  t.mock.method(modrinth, 'resolveUrl', async () => ({ projectId: 'PROJ1', versionId: 'ver_2', projectType: 'mod' }));
  t.mock.method(modrinth, 'getVersion', async () => ({
    id: 'ver_2',
    version_number: '2.0',
    loaders: ['fabric'],
    game_versions: ['1.20.1'],
    files: [{ url: 'https://example.invalid/testmod-2.0.jar', filename: 'testmod-2.0.jar', primary: true }],
  }));
  t.mock.method(modrinth, 'primaryFile', (v) => v.files[0]);
  t.mock.method(library, 'downloadToLibrary', async () => newBuild);
  const invalidate = t.mock.method(checker, 'invalidateOutdatedCache');

  // Priming a cache read before the mutation is what would go stale without
  // the fix - assert the wiring exists rather than reason about the exact
  // predicate transition (the SQL is already covered elsewhere).
  checker.countOutdatedByKind({ serverIds: [id] });
  const callsBeforeApply = invalidate.mock.calls.length;
  await mods.applyOverlayUpdate(id, { contentId: 'sc_cache1' }, { actor: 'test' });
  assert.ok(invalidate.mock.calls.length > callsBeforeApply, 'applyOverlayUpdate must invalidate the cache');

  checker.countOutdatedByKind({ serverIds: [id] });
  const callsBeforeRevert = invalidate.mock.calls.length;
  await mods.revertOverlayUpdate(id, { file: 'testmod-2.0.jar' }, { actor: 'test' });
  assert.ok(invalidate.mock.calls.length > callsBeforeRevert, 'revertOverlayUpdate must invalidate the cache');
});

test('deleteServer invalidates the outdated-count cache', async (t) => {
  const servers = require('../src/services/servers');
  t.mock.method(containers, 'stopContainer', async () => {});
  t.mock.method(containers, 'removeContainer', async () => {});
  const invalidate = t.mock.method(checker, 'invalidateOutdatedCache');

  const id = seedFabricServer('srv_cache_del');
  checker.countOutdatedByKind({ serverIds: [id] });
  const callsBefore = invalidate.mock.calls.length;
  await servers.deleteServer(id);
  assert.ok(invalidate.mock.calls.length > callsBefore, 'deleteServer must invalidate the cache');
});

test('applyPack invalidates the outdated-count cache', async (t) => {
  const packs = require('../src/services/packs');
  const invalidate = t.mock.method(checker, 'invalidateOutdatedCache');

  const id = seedFabricServer('srv_cache_pack');
  checker.countOutdatedByKind({ serverIds: [id] });
  const callsBefore = invalidate.mock.calls.length;
  await packs.applyPack(
    id,
    {
      platform: 'modrinth',
      projectRef: 'sop',
      projectName: 'Simply Optimized',
      versionId: 'abc123',
      versionName: '1.0.0',
      mcVersion: '1.20.1',
    },
    { actor: 'test', force: true }
  );
  assert.ok(invalidate.mock.calls.length > callsBefore, 'applyPack must invalidate the cache');
});
