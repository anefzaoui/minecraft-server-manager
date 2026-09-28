'use strict';

// The overview's Software change: POST /api/servers/:id/type/change refuses
// unknown types, no-op switches, and anything pack-managed (both directions -
// a pack owns its server's TYPE), and accepts a standalone switch as a
// background task (it fails later without Docker - the gate is what matters).

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

let cookie;
let port = 26700;

function seedTypedServer(id, type, mcVersion = '1.21.4') {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, ?, ?, ?, ?, ?, 'x', 1024, 1536, 'stopped', '{}')`,
    id,
    id,
    type,
    mcVersion,
    port,
    port + 1
  );
  return id;
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('an unknown software type is refused', async () => {
  const id = seedTypedServer('srv_soft_unknown', 'VANILLA');
  const r = await app.req('POST', `/api/servers/${id}/type/change`, {
    cookie,
    body: { targetType: 'NOT_A_TYPE' },
  });
  assert.equal(r.status, 400);
});

test('switching to the running software is refused', async () => {
  const id = seedTypedServer('srv_soft_same', 'VANILLA');
  const r = await app.req('POST', `/api/servers/${id}/type/change`, {
    cookie,
    body: { targetType: 'VANILLA' },
  });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /already runs/);
});

test('a modpack server keeps its software', async () => {
  const id = seedTypedServer('srv_soft_pack', 'AUTO_CURSEFORGE');
  const r = await app.req('POST', `/api/servers/${id}/type/change`, {
    cookie,
    body: { targetType: 'FABRIC' },
  });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /modpack/i);
});

test('switching to a modpack type is refused', async () => {
  const id = seedTypedServer('srv_soft_topack', 'VANILLA');
  for (const packType of ['AUTO_CURSEFORGE', 'MODRINTH', 'FTBA', 'GTNH']) {
    const r = await app.req('POST', `/api/servers/${id}/type/change`, {
      cookie,
      body: { targetType: packType },
    });
    assert.equal(r.status, 400, `expected ${packType} to be refused`);
    assert.match(r.json.error, /modpack/i);
  }
});

test('a standalone switch is accepted as a task', async () => {
  const id = seedTypedServer('srv_soft_ok', 'VANILLA');
  const r = await app.req('POST', `/api/servers/${id}/type/change`, {
    cookie,
    body: { targetType: 'FABRIC' },
  });
  // Accepted as a task (it fails later without Docker - what matters is that
  // the software gate let it through).
  assert.equal(r.status, 202);
  assert.ok(r.json.taskId);
});

test('a downgrade is refused, with the direction named', async () => {
  const id = seedTypedServer('srv_soft_downgrade', 'VANILLA', '1.21.4');
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '1.21.2' },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.ok, false);
  assert.deepEqual(r.json.downgrade, { from: '1.21.4', to: '1.21.2' });
  assert.match(r.json.error, /downgrad/i);
  assert.match(r.json.error, /void/);
  // Refused before anything happened: the pin is untouched.
  assert.equal(db.get('SELECT mc_version FROM servers WHERE id = ?', id).mc_version, '1.21.4');
});

test('force is the deliberate way past the downgrade gate', async () => {
  const id = seedTypedServer('srv_soft_downforce', 'VANILLA', '1.21.4');
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '1.21.2', force: true },
  });
  // Accepted as a task (it fails later without Docker - what matters is that
  // the downgrade gate let it through).
  assert.equal(r.status, 202);
  assert.ok(r.json.taskId);
});

test('an upgrade is never a downgrade', async () => {
  const id = seedTypedServer('srv_soft_nodown', 'VANILLA', '1.21.4');
  const r = await app.req('POST', `/api/servers/${id}/mcversion/upgrade`, {
    cookie,
    body: { targetVersion: '1.21.5' },
  });
  // Whatever the mod gate says (vanilla has no mods to check), the refusal
  // must not be a downgrade refusal.
  assert.equal(r.json.downgrade, undefined);
});

test('the version comparator only answers dotted numbers', () => {
  const { compareMcVersions, isDowngrade } = require('../src/utils/mcVersion');
  assert.equal(compareMcVersions('26.3', '26.2'), 1);
  assert.equal(compareMcVersions('26.2', '26.3'), -1);
  assert.equal(compareMcVersions('1.21.4', '1.21.4'), 0);
  assert.equal(compareMcVersions('1.20', '1.20.0'), 0);
  assert.equal(compareMcVersions('1.20.10', '1.20.4'), 1);
  assert.equal(compareMcVersions('LATEST', '1.20.1'), null);
  assert.equal(compareMcVersions('1.20.1', 'SNAPSHOT'), null);
  assert.equal(compareMcVersions('24w03a', '24w04a'), null);
  assert.equal(isDowngrade('26.3', '26.2'), true);
  assert.equal(isDowngrade('26.2', '26.3'), false);
  assert.equal(isDowngrade('1.21.4', '1.21.4'), false);
  assert.equal(isDowngrade('LATEST', '1.20.1'), false);
});

test('the overview renders the software card', async () => {
  const id = seedTypedServer('srv_soft_page', 'VANILLA');
  const r = await app.req('GET', `/servers/${id}/overview`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /Software &amp; Version/);
  assert.match(r.text, /data-ov-change-type/);
  assert.match(r.text, /data-ov-change-version/);
  assert.match(r.text, new RegExp(`data-chrome-status="${id}"`));
});

test('a modpack overview hides the change buttons', async () => {
  const id = seedTypedServer('srv_soft_pagepack', 'MODRINTH');
  const r = await app.req('GET', `/servers/${id}/overview`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /owns its type and version/);
  assert.doesNotMatch(r.text, /data-ov-change-type/);
  assert.doesNotMatch(r.text, /data-ov-change-version/);
});
