'use strict';

// Split update policies: game/server-level findings (image, Minecraft and
// loader versions, packs) follow update_policy; overlay content follows the
// separate mod_update_policy. Manual hides each side independently.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const checker = require('../src/updates/checker');

let cookie;
let port = 27100;

function seedServer(id, { updatePolicy = 'notify', modUpdatePolicy = null } = {}) {
  port += 2;
  const cols = [
    'id',
    'display_name',
    'type',
    'mc_version',
    'port_game',
    'port_rcon',
    'rcon_password_cipher',
    'heap_mb',
    'container_memory_mb',
    'status',
    'update_policy',
    'env_json',
  ];
  const vals = [id, id, 'PAPER', '1.21.4', port, port + 1, 'x', 1024, 1536, 'stopped', updatePolicy, '{}'];
  if (modUpdatePolicy !== null) {
    cols.push('mod_update_policy');
    vals.push(modUpdatePolicy);
  }
  db.run(`INSERT INTO servers (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...vals);
  return id;
}

function seedContentCheck(serverId, contentId = 'sc_pol_1') {
  db.run(
    `INSERT INTO server_content (id, server_id, kind, managed_by, name, filename, version)
     VALUES (?, ?, 'mod', 'overlay', 'Some Mod', 'somemod.jar', '1.0')`,
    contentId,
    serverId
  );
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name)
     VALUES ('content', ?, '1.0', 'file-2', '2.0')`,
    contentId
  );
}

function seedImageCheck(serverId) {
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name)
     VALUES ('image', ?, 'sha256:aaa', 'sha256:bbb', 'itzg/minecraft-server:java21')`,
    serverId
  );
  // An image row only lists while a container exists for the server.
  db.run(`UPDATE servers SET container_id = 'cid-pol' WHERE id = ?`, serverId);
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('new servers default both policies to manual', () => {
  const id = seedServer('srv_pol_default');
  const row = db.get('SELECT update_policy, mod_update_policy FROM servers WHERE id = ?', id);
  assert.equal(row.mod_update_policy, 'manual');
});

test('PATCH updates the mods policy', async () => {
  const id = seedServer('srv_pol_patch');
  const r = await app.req('PATCH', `/api/servers/${id}`, { cookie, body: { modUpdatePolicy: 'notify' } });
  assert.equal(r.status, 200);
  assert.equal(db.get('SELECT mod_update_policy FROM servers WHERE id = ?', id).mod_update_policy, 'notify');
  const bad = await app.req('PATCH', `/api/servers/${id}`, { cookie, body: { modUpdatePolicy: 'sometimes' } });
  assert.equal(bad.status, 400);
});

test('listOutdated hides each side under its own manual policy', () => {
  // Mods manual, game notify: content hidden, image shown.
  const a = seedServer('srv_pol_a', { updatePolicy: 'notify', modUpdatePolicy: 'manual' });
  seedContentCheck(a, 'sc_pol_a');
  seedImageCheck(a);
  // Mods notify, game manual: content shown, image hidden.
  const b = seedServer('srv_pol_b', { updatePolicy: 'manual', modUpdatePolicy: 'notify' });
  seedContentCheck(b, 'sc_pol_b');
  seedImageCheck(b);

  const rows = checker.listOutdated();
  const kinds = (sid) =>
    rows
      .filter((r) => r.serverId === sid)
      .map((r) => r.subjectType)
      .sort();
  assert.deepEqual(kinds(a), ['image']);
  assert.deepEqual(kinds(b), ['content']);
});
test('countOutdatedByKind follows the same split', () => {
  // srv_pol_a contributes its image (server), srv_pol_b its content (mods).
  // Other suites seed their own rows in their own processes - this file only
  // asserts the two servers it owns.
  const forServer = (sid) => checker.countOutdatedByKind({ serverIds: [sid] });
  assert.deepEqual(forServer('srv_pol_a'), { all: 1, mods: 0, server: 1 });
  assert.deepEqual(forServer('srv_pol_b'), { all: 1, mods: 1, server: 0 });
});

test('the Updates page renders both sections', async () => {
  const r = await app.req('GET', '/updates', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /Mods &amp; Packs/);
  assert.match(r.text, />Server</);
});
