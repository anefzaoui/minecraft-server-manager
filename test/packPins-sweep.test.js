'use strict';

// pinUnpinnedServers must repair pre-0.9.7 servers (unpinned CF_SLUG /
// MODRINTH_MODPACK) from real evidence only - the panel's own server_packs
// row or the image's install manifest - and never guess "latest" (#22).

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const { pinUnpinnedServers } = require('../src/services/packPins');

let port = 25700;
function seedServer(id, type, env) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, ?, ?, ?, ?, 'x', 1024, 1536, 'stopped', ?)`,
    id,
    id,
    type,
    port,
    port + 1,
    JSON.stringify(env)
  );
}

function writeManifest(id, file, content) {
  const dir = dataPath('servers', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(content));
}

function serverRow(id) {
  const row = db.get('SELECT env_json, pending_recreate FROM servers WHERE id = ?', id);
  return { env: JSON.parse(row.env_json), pendingRecreate: row.pending_recreate };
}

test('pins an unpinned CurseForge server from its install manifest', () => {
  seedServer('srv_cfmani', 'AUTO_CURSEFORGE', { CF_SLUG: 'stoneblock-4' });
  writeManifest('srv_cfmani', '.curseforge-manifest.json', {
    slug: 'stoneblock-4',
    modId: 123456,
    fileId: 5891234,
    fileName: 'StoneBlock4-1.2.3.zip',
    modpackVersion: '1.2.3',
    modpackName: 'StoneBlock 4',
  });

  const result = pinUnpinnedServers();
  assert.ok(result.pinned >= 1);
  const { env, pendingRecreate } = serverRow('srv_cfmani');
  assert.equal(env.CF_FILE_ID, '5891234');
  assert.equal(pendingRecreate, 1);
  const pack = db.get("SELECT * FROM server_packs WHERE server_id = 'srv_cfmani'");
  assert.equal(pack.platform, 'curseforge');
  assert.equal(pack.pinned_version_id, '5891234');
  assert.equal(pack.pinned_version_name, '1.2.3');
  const event = db.get("SELECT * FROM events WHERE server_id = 'srv_cfmani' AND type = 'pack-pinned'");
  assert.ok(event, 'expected a pack-pinned event');
});

test('pins from the panel server_packs record when there is no manifest', () => {
  seedServer('srv_dbrec', 'MODRINTH', { MODRINTH_MODPACK: 'cobblemon' });
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES ('srv_dbrec', 'modrinth', 'cobblemon', 'Cobblemon', 'VeR51On1', '1.6.1')`
  );
  pinUnpinnedServers();
  assert.equal(serverRow('srv_dbrec').env.MODRINTH_VERSION, 'VeR51On1');
});

test('a manifest for a different pack is not trusted', () => {
  seedServer('srv_wrong', 'AUTO_CURSEFORGE', { CF_SLUG: 'all-the-mods-10' });
  writeManifest('srv_wrong', '.curseforge-manifest.json', { slug: 'some-other-pack', fileId: 99 });
  const result = pinUnpinnedServers();
  assert.equal(serverRow('srv_wrong').env.CF_FILE_ID, undefined);
  assert.ok(result.unresolved >= 1);
});

test('pins an unpinned Modrinth server from its install manifest', () => {
  seedServer('srv_mrmani', 'MODRINTH', { MODRINTH_MODPACK: 'fabulously-optimized' });
  writeManifest('srv_mrmani', '.modrinth-manifest.json', {
    projectSlug: 'fabulously-optimized',
    versionId: 'aBc123Xy',
  });
  pinUnpinnedServers();
  assert.equal(serverRow('srv_mrmani').env.MODRINTH_VERSION, 'aBc123Xy');
});

test('the sweep is idempotent: a second run finds nothing to do', () => {
  const result = pinUnpinnedServers();
  assert.equal(result.pinned, 0);
  // srv_wrong stays unresolved (still unpinned, still no usable evidence).
  assert.equal(result.unresolved, 1);
});
