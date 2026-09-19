'use strict';

// Issue #39 regression: the itzg image re-asserts env-backed server.properties
// values on every start, so a panel-direct edit (World Controls PvP/difficulty,
// whitelist toggle, Files editor) was silently reverted. The fix un-sets the env
// var behind the changed property and marks the server for recreation - the
// rebuild is what actually drops the shadowing env var. These tests assert the
// state changes that prevent the revert (the image itself is out of reach here).

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const db = require('../src/db');
const app = require('./helpers/app'); // runs migrate() at load
const servers = require('../src/services/servers');
const { dataPath } = require('../src/storage/pathGuard');

const ID = 'srv_unlk01';

function setEnv(env) {
  db.run('UPDATE servers SET env_json = ?, pending_recreate = 0 WHERE id = ?', JSON.stringify(env), ID);
}

function envOf() {
  return JSON.parse(db.get('SELECT env_json FROM servers WHERE id = ?', ID).env_json || '{}');
}

function rowPending() {
  return db.get('SELECT pending_recreate FROM servers WHERE id = ?', ID).pending_recreate;
}

function propertiesText() {
  return fs.readFileSync(dataPath('servers', ID, 'server.properties'), 'utf8');
}

test.before(() => {
  app.seedServer(ID);
  fs.mkdirSync(dataPath('servers', ID), { recursive: true });
});

test('stripLiveManagedEnv removes exactly the live-managed keys and nothing else', () => {
  const rest = servers.stripLiveManagedEnv({ PVP: 'true', DIFFICULTY: 'normal', MOTD: 'Hi', MAX_PLAYERS: '12' });
  assert.deepEqual(rest, { MOTD: 'Hi', MAX_PLAYERS: '12' });
  // MOTD is render-excluded but env-owned - it must survive the strip.
  assert.deepEqual(servers.stripLiveManagedEnv({ MOTD: 'Hi' }), { MOTD: 'Hi' });
  assert.deepEqual(servers.stripLiveManagedEnv({}), {});
  assert.deepEqual(servers.stripLiveManagedEnv(null), {});
});

test('unlockPropertyEnv drops the env var behind a property and marks the server for recreation', () => {
  setEnv({ PVP: 'true', DIFFICULTY: 'normal', MAX_PLAYERS: '12' });
  const result = servers.unlockPropertyEnv(ID, ['pvp'], { actor: 'test' });
  assert.deepEqual(result, { removed: ['PVP'], rebuildNeeded: true });
  assert.deepEqual(envOf(), { DIFFICULTY: 'normal', MAX_PLAYERS: '12' });
  assert.equal(rowPending(), 1);
});

test('unlockPropertyEnv is a no-op when no matching env var is set', () => {
  setEnv({ MAX_PLAYERS: '12' });
  const result = servers.unlockPropertyEnv(ID, ['pvp', 'difficulty'], { actor: 'test' });
  assert.deepEqual(result, { removed: [], rebuildNeeded: false });
  assert.deepEqual(envOf(), { MAX_PLAYERS: '12' });
  assert.equal(rowPending(), 0);
});

test('writeServerProperties writes the file and un-sets only the changed env-backed props', () => {
  fs.writeFileSync(dataPath('servers', ID, 'server.properties'), 'gamemode=survival\npvp=true\n');
  setEnv({ PVP: 'true', MODE: 'survival', MAX_PLAYERS: '20' });
  const newText = 'gamemode=creative\npvp=false\nmin-players=8\n';
  const result = servers.writeServerProperties(ID, newText, { actor: 'test' });
  assert.equal(propertiesText(), newText); // exact content, no debris
  // gamemode and pvp both changed → both env vars un-set; min-players isn't a
  // catalog env var so it can never unlock anything.
  assert.deepEqual(result.unlocked.sort(), ['MODE', 'PVP']);
  assert.equal(result.rebuildNeeded, true);
  assert.deepEqual(envOf(), { MAX_PLAYERS: '20' });
  assert.equal(rowPending(), 1);
});

test('a direct motd edit un-sets the MOTD env so the last write wins', () => {
  setEnv({ MOTD: 'Old' });
  const result = servers.writeServerProperties(ID, 'motd=New!\n', { actor: 'test' });
  assert.deepEqual(result.unlocked, ['MOTD']);
  assert.deepEqual(envOf(), {});
});

test('writeServerProperties and unlockPropertyEnv 404 on an unknown server', () => {
  assert.throws(() => servers.unlockPropertyEnv('srv_nope', ['pvp']), /Server not found/);
  assert.throws(() => servers.writeServerProperties('srv_nope', 'pvp=false\n'), /Server not found/);
});

test('Files editor writes to server.properties go through the choke point', async () => {
  const files = require('../src/services/files');
  setEnv({ PVP: 'true', MOTD: 'Hi' });
  const out = await files.writeText(ID, 'server.properties', 'pvp=false\nmotd=New\n');
  assert.equal(out.rebuildNeeded, true);
  assert.deepEqual(out.unlocked.sort(), ['MOTD', 'PVP']);
  assert.deepEqual(envOf(), {});
  assert.equal(rowPending(), 1);
  assert.equal(propertiesText(), 'pvp=false\nmotd=New\n');

  // Any OTHER file goes through the plain path and must not touch the env row.
  setEnv({ PVP: 'true' });
  const plain = await files.writeText(ID, 'readme.txt', 'hello');
  assert.equal(plain.rebuildNeeded, undefined);
  assert.equal(plain.unlocked, undefined);
  assert.deepEqual(envOf(), { PVP: 'true' });
  assert.equal(rowPending(), 0);
});
