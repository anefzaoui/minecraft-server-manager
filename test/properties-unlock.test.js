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
// worldControls destructures execCapture at load, and the app helper below
// loads it (via the routes) - so the RCON seam is swapped BEFORE that happens.
const containers = require('../src/docker/containers');
let execImpl = async () => {
  throw new Error('unexpected docker exec in a unit test');
};
containers.execCapture = (serverId, cmd, opts) => execImpl(serverId, cmd, opts);
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

test("creation keeps PVP/DIFFICULTY so the wizard's choices apply at create", () => {
  // Regression guard: these fields must NOT be stripped at create - the wizard
  // renders them (mode: 'simple'), so stripping silently drops the user's
  // choice. They apply once via env, and un-pin whenever the panel edits the
  // property directly.
  const spec = servers.previewCreateSpec({
    type: 'VANILLA',
    javaTag: 'java21',
    env: { PVP: 'false', DIFFICULTY: 'hard', MOTD: 'Hi', MAX_PLAYERS: '10' },
  });
  assert.equal(spec.env.PVP, 'false');
  assert.equal(spec.env.DIFFICULTY, 'hard');
  assert.equal(spec.env.MOTD, 'Hi');
  assert.equal(spec.env.MAX_PLAYERS, '10');
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

test('unsetEnvKeys removes explicit env keys and marks the server for recreation', () => {
  setEnv({ WHITELIST: 'Notch,Herobrine', ENABLE_WHITELIST: 'true', MOTD: 'Hi' });
  const result = servers.unsetEnvKeys(ID, ['WHITELIST', 'WHITELIST_FILE', 'ENABLE_WHITELIST'], { actor: 'test' });
  assert.deepEqual(result, { removed: ['WHITELIST', 'ENABLE_WHITELIST'], rebuildNeeded: true });
  assert.deepEqual(envOf(), { MOTD: 'Hi' });
  assert.equal(rowPending(), 1);

  const noop = servers.unsetEnvKeys(ID, ['NOT_SET'], { actor: 'test' });
  assert.deepEqual(noop, { removed: [], rebuildNeeded: false });
});

test('the offline whitelist toggle clears every provisioning env var, not just ENABLE_WHITELIST', async () => {
  const players = require('../src/services/players');
  setEnv({ WHITELIST: 'Notch', WHITELIST_FILE: '/whitelist.json', ENABLE_WHITELIST: 'true', MAX_PLAYERS: '12' });
  await players.setWhitelistEnforced(ID, false, { actor: 'test' });
  // WHITELIST / WHITELIST_FILE also provision whitelisting in the itzg image,
  // so turning the panel toggle off must clear them or white-list=true is
  // re-asserted on the next start and the toggle silently reverts.
  assert.deepEqual(envOf(), { MAX_PLAYERS: '12' });
  assert.equal(rowPending(), 1);
  assert.equal(propertiesText().includes('white-list=false'), true);
  await players.setWhitelistEnforced(ID, true, { actor: 'test' });
  assert.equal(propertiesText().includes('white-list=true'), true);
});

test('writeServerProperties and unlockPropertyEnv 404 on an unknown server', () => {
  assert.throws(() => servers.unlockPropertyEnv('srv_nope', ['pvp']), /Server not found/);
  assert.throws(() => servers.writeServerProperties('srv_nope', 'pvp=false\n'), /Server not found/);
  assert.throws(() => servers.unsetEnvKeys('srv_nope', ['WHITELIST']), /Server not found/);
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

test('setServerProperty replaces one key in place, appends when absent, and un-sets its env', () => {
  fs.writeFileSync(dataPath('servers', ID, 'server.properties'), 'pvp=true\nmax-players=20\n');
  setEnv({ PVP: 'true', DIFFICULTY: 'easy' });
  let result = servers.setServerProperty(ID, 'pvp', 'false', { actor: 'test' });
  assert.equal(propertiesText(), 'pvp=false\nmax-players=20\n');
  assert.deepEqual(result, { rebuildNeeded: true, unlocked: ['PVP'] });
  result = servers.setServerProperty(ID, 'difficulty', 'hard', { actor: 'test' });
  assert.equal(propertiesText(), 'pvp=false\nmax-players=20\ndifficulty=hard\n');
  assert.deepEqual(result, { rebuildNeeded: true, unlocked: ['DIFFICULTY'] });
  assert.deepEqual(envOf(), {});
  // Same value again: nothing changed, nothing to unlock.
  setEnv({ DIFFICULTY: 'hard' });
  result = servers.setServerProperty(ID, 'difficulty', 'hard', { actor: 'test' });
  assert.deepEqual(result, { rebuildNeeded: false, unlocked: [] });
  assert.deepEqual(envOf(), { DIFFICULTY: 'hard' });
});

test('a difficulty quick action writes the property and un-sets DIFFICULTY (a dedicated server re-applies it on boot)', async () => {
  const worldControls = require('../src/services/worldControls');
  fs.writeFileSync(dataPath('servers', ID, 'server.properties'), 'difficulty=easy\npvp=true\n');
  setEnv({ DIFFICULTY: 'easy', PVP: 'true' });
  db.run("UPDATE servers SET status = 'running' WHERE id = ?", ID);
  const calls = [];
  execImpl = async (id, cmd) => {
    calls.push(cmd);
    return 'The difficulty has been set to Hard';
  };
  try {
    await worldControls.runQuick(ID, 'difficulty-hard', { actor: 'test' });
    assert.ok(calls.length >= 1);
    assert.equal(propertiesText(), 'difficulty=hard\npvp=true\n');
    assert.deepEqual(envOf(), { PVP: 'true' });
    assert.equal(rowPending(), 1);
    // PvP goes through the same choke point.
    await worldControls.runQuick(ID, 'pvp-off', { actor: 'test' });
    assert.equal(propertiesText(), 'difficulty=hard\npvp=false\n');
    assert.deepEqual(envOf(), {});
  } finally {
    execImpl = async () => {
      throw new Error('unexpected docker exec in a unit test');
    };
  }
});

test("the running whitelist toggle survives Minecraft's own server.properties rewrite", async () => {
  // Live finding (Paper 1.21): `whitelist on/off` makes the server re-save
  // server.properties from the values it loaded at boot, undoing PvP /
  // difficulty / Files edits made while running. The toggle must restore them.
  const players = require('../src/services/players');
  const file = dataPath('servers', ID, 'server.properties');
  fs.writeFileSync(file, 'pvp=true\ndifficulty=hard\nwhite-list=true\nmotd=Hi\n');
  setEnv({ WHITELIST: 'Notch', MOTD: 'Hi' });
  const calls = [];
  execImpl = async (id, cmd) => {
    calls.push(cmd);
    // Simulate Minecraft: rewrite the whole file from its boot-time values.
    fs.writeFileSync(file, 'pvp=false\ndifficulty=easy\nwhite-list=false\nmotd=Hi\n');
    return 'Whitelist is now turned off';
  };
  try {
    await players.setWhitelistEnforced(ID, false, { running: true, actor: 'test' });
    assert.deepEqual(calls, [['rcon-cli', '--', 'whitelist', 'off']]);
    assert.equal(propertiesText(), 'pvp=true\ndifficulty=hard\nwhite-list=false\nmotd=Hi\n');
    assert.deepEqual(envOf(), { MOTD: 'Hi' });
    assert.equal(rowPending(), 1);
  } finally {
    execImpl = async () => {
      throw new Error('unexpected docker exec in a unit test');
    };
  }
});
