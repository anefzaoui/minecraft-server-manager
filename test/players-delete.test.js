'use strict';

// Delete-player coverage: the full offline wipe (role files + playerdata +
// stats/advancements + snapshots + notes) through deletePlayer() and the
// DELETE API route, plus the "still online" guard that refuses to run while
// the player is in the RCON list.

require('./helpers/env');

// Swap the docker adapter's execCapture for a canned `rcon-cli list` answer
// BEFORE any src/ module pulls the real one in, so the online guard can be
// exercised headlessly. Offline paths never touch it (they skip under
// `running: false`).
const ONLINE_LIST = 'There are 1 of a max of 20 players online: Alice\n';
const containersPath = require.resolve('../src/docker/containers');
const containers = require(containersPath);
require.cache[containersPath].exports = { ...containers, execCapture: async () => ONLINE_LIST };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodePath = require('node:path');
const { dataPath } = require('../src/storage/pathGuard');
const players = require('../src/services/players');
const playerNotes = require('../src/services/playerNotes');
const app = require('./helpers/app');

let cookie;

async function login() {
  const auth = require('../src/services/auth');
  const username = `del${process.pid}`;
  await auth.createUser({ username, password: 'delpass123', role: 'admin' }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password: 'delpass123' } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  await app.start();
  cookie = await login();
});
test.after(async () => {
  await app.stop();
});
test.beforeEach(() => {
  const db = require('../src/db');
  db.run('DELETE FROM servers');
  db.run('DELETE FROM events');
  db.run('DELETE FROM player_notes');
});

const ALICE = '3f5f7c2a-8a4e-4a1a-9c1b-000000000001';
const BOB = '3f5f7c2a-8a4e-4a1a-9c1b-000000000002';

function write(serverId, file, value) {
  fs.writeFileSync(dataPath('servers', serverId, file), JSON.stringify(value, null, 2) + '\n');
}
function read(serverId, file) {
  return JSON.parse(fs.readFileSync(dataPath('servers', serverId, file), 'utf8'));
}

/** Seed a server with Alice in every role file + world data in BOTH layouts. */
function seed(id) {
  app.seedServer(id);
  fs.mkdirSync(dataPath('servers', id), { recursive: true });
  write(id, 'usercache.json', [
    { name: 'Alice', uuid: ALICE, expiresOn: '2027-01-01' },
    { name: 'Bob', uuid: BOB, expiresOn: '2027-02-02' },
  ]);
  write(id, 'whitelist.json', [
    { name: 'Alice', uuid: ALICE },
    { name: 'Bob', uuid: BOB },
  ]);
  write(id, 'ops.json', [{ name: 'Alice', uuid: ALICE, level: 4, bypassesPlayerLimit: false }]);
  write(id, 'banned-players.json', [
    {
      name: 'Alice',
      uuid: ALICE,
      created: '2025-01-01 00:00:00 +0000',
      source: 'x',
      expires: 'forever',
      reason: 'bye',
    },
  ]);

  const level = dataPath('servers', id, 'world');
  fs.mkdirSync(nodePath.join(level, 'players', 'data'), { recursive: true });
  fs.mkdirSync(nodePath.join(level, 'playerdata'), { recursive: true });
  fs.mkdirSync(nodePath.join(level, 'stats'), { recursive: true });
  fs.mkdirSync(nodePath.join(level, 'advancements'), { recursive: true });
  // Modern (players/data) + legacy (playerdata) layouts, .dat + .dat_old.
  for (const dir of [nodePath.join(level, 'players', 'data'), nodePath.join(level, 'playerdata')]) {
    for (const uuid of [ALICE, BOB]) {
      fs.writeFileSync(nodePath.join(dir, `${uuid}.dat`), 'x');
      fs.writeFileSync(nodePath.join(dir, `${uuid}.dat_old`), 'x');
    }
  }
  fs.writeFileSync(nodePath.join(level, 'stats', `${ALICE}.json`), '{}');
  fs.writeFileSync(nodePath.join(level, 'advancements', `${ALICE}.json`), '{}');
  fs.writeFileSync(nodePath.join(level, 'stats', `${BOB}.json`), '{}');
  fs.writeFileSync(nodePath.join(level, 'advancements', `${BOB}.json`), '{}');

  const snaps = dataPath('logs', id, 'inventories', ALICE);
  fs.mkdirSync(snaps, { recursive: true });
  fs.writeFileSync(nodePath.join(snaps, '2025-01-01.nbt'), 'x');

  playerNotes.addNote(id, { uuid: ALICE, name: 'Alice' }, 'reported for griefing', { actor: 'test' });
  playerNotes.addNote(id, { uuid: BOB, name: 'Bob' }, 'keep an eye on Bob', { actor: 'test' });
  return id;
}

test('deletePlayer wipes roles, both playerdata layouts, stats, advancements, snapshots and notes', async () => {
  const id = seed('srv_del_full');
  const level = dataPath('servers', id, 'world');
  const res = await players.deletePlayer(id, 'Alice');
  assert.equal(res.uuid, ALICE);

  // Role files drop every Alice entry (Bob only occupies usercache + whitelist here).
  for (const file of ['usercache.json', 'whitelist.json', 'ops.json', 'banned-players.json']) {
    const entries = read(id, file);
    assert.equal(
      entries.some((e) => e.uuid === ALICE || (e.name && e.name.toLowerCase() === 'alice')),
      false,
      `${file} still has Alice`
    );
  }
  assert.equal(
    read(id, 'usercache.json').some((e) => e.uuid === BOB),
    true
  );
  assert.equal(
    read(id, 'whitelist.json').some((e) => e.uuid === BOB),
    true
  );

  // World data: Alice's files gone from both layouts, Bob's untouched.
  for (const dir of [nodePath.join(level, 'players', 'data'), nodePath.join(level, 'playerdata')]) {
    for (const ext of ['.dat', '.dat_old']) {
      assert.equal(fs.existsSync(nodePath.join(dir, `${ALICE}${ext}`)), false, `${dir}/${ALICE}${ext} survived`);
      assert.equal(fs.existsSync(nodePath.join(dir, `${BOB}${ext}`)), true, `${dir}/${BOB}${ext} got removed`);
    }
  }
  assert.equal(fs.existsSync(nodePath.join(level, 'stats', `${ALICE}.json`)), false);
  assert.equal(fs.existsSync(nodePath.join(level, 'advancements', `${ALICE}.json`)), false);
  assert.equal(fs.existsSync(nodePath.join(level, 'stats', `${BOB}.json`)), true);
  assert.equal(fs.existsSync(nodePath.join(level, 'advancements', `${BOB}.json`)), true);

  // Snapshots + notes.
  assert.equal(fs.existsSync(dataPath('logs', id, 'inventories', ALICE)), false);
  assert.equal(playerNotes.listNotes(id, ALICE).length, 0);
  assert.equal(playerNotes.listNotes(id, BOB).length, 1);

  // Result counts what it removed.
  assert.equal(res.removed.playerdata, 4);
  assert.equal(res.removed.stats, true);
  assert.equal(res.removed.advancements, true);
  assert.equal(res.removed.snapshots, true);
  assert.equal(res.removed.notes, 1);

  // The audit log carries the event.
  const ev = require('../src/db').all('SELECT * FROM events WHERE type = ?', 'player-deleted');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].server_id, id);
  assert.match(ev[0].summary, /Alice/);
});

test('deletePlayer tolerates a never-joined player with no on-disk data', async () => {
  const id = seed('srv_del_never');
  fs.rmSync(nodePath.join(dataPath('servers', id, 'world'), 'players', 'data', `${ALICE}.dat`), { force: true });
  fs.rmSync(nodePath.join(dataPath('servers', id, 'world'), 'players', 'data', `${ALICE}.dat_old`), { force: true });
  fs.rmSync(nodePath.join(dataPath('servers', id, 'world'), 'playerdata'), { recursive: true, force: true });
  fs.rmSync(nodePath.join(dataPath('servers', id, 'world'), 'stats', `${ALICE}.json`), { force: true });
  fs.rmSync(nodePath.join(dataPath('servers', id, 'world'), 'advancements', `${ALICE}.json`), { force: true });

  const res = await players.deletePlayer(id, 'Alice');
  assert.equal(res.removed.playerdata, 0);
  assert.equal(fs.existsSync(dataPath('servers', id, 'world')), true, 'the whole world dir must survive');
  assert.equal(
    read(id, 'usercache.json').some((e) => e.uuid === ALICE),
    false
  );
});

test('deletePlayer refuses while the player is online (RCON list)', async () => {
  const id = seed('srv_del_online');
  await assert.rejects(
    () => players.deletePlayer(id, 'Alice', { running: true }),
    (err) => err.status === 409 && /still online/.test(err.message)
  );
  // Nothing was touched.
  assert.equal(
    read(id, 'whitelist.json').some((e) => e.uuid === ALICE),
    true
  );
  assert.equal(fs.existsSync(nodePath.join(dataPath('servers', id, 'world'), 'players', 'data', `${ALICE}.dat`)), true);
});

test('deletePlayer rejects an invalid name', async () => {
  const id = app.seedServer('srv_del_bad');
  fs.mkdirSync(dataPath('servers', id), { recursive: true });
  await assert.rejects(() => players.deletePlayer(id, 'bad name!'), /Invalid player name/);
});

test('DELETE /api/servers/:id/players/:name wipes a player end to end', async () => {
  const id = seed('srv_del_api');
  const r = await app.req('DELETE', `/api/servers/${id}/players/Alice`, { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.result.uuid, ALICE);

  const list = await app.req('GET', `/api/servers/${id}/players`, { cookie });
  assert.equal(list.status, 200);
  assert.equal(
    list.json.players.some((p) => p.uuid === ALICE),
    false
  );
  assert.equal(
    list.json.players.some((p) => p.uuid === BOB),
    true
  );

  // The detail page still renders (it shows a fallback row for unknown players)
  // but no longer carries Alice's identity.
  const body = await app.req('GET', `/servers/${id}/players/Alice`, { cookie });
  assert.equal(body.status, 200);
  assert.match(body.text, /data-player-uuid=""/);
  assert.doesNotMatch(body.text, new RegExp(`data-player-uuid="${ALICE}"`));
});

test('DELETE rejects an invalid player name with 400', async () => {
  const id = app.seedServer('srv_del_api_bad');
  fs.mkdirSync(dataPath('servers', id), { recursive: true });
  const r = await app.req('DELETE', `/api/servers/${id}/players/bad%20name%21`, { cookie });
  assert.equal(r.status, 400);
  assert.equal(r.json.ok, false);
});
