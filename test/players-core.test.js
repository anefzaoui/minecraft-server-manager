'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { dataPath } = require('../src/storage/pathGuard');
const players = require('../src/services/players');
const app = require('./helpers/app');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

function seedFiles(serverId, files = {}) {
  fs.mkdirSync(dataPath('servers', serverId), { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    if (data === null) {
      fs.rmSync(dataPath('servers', serverId, name), { force: true });
    } else {
      fs.writeFileSync(dataPath('servers', serverId, name), JSON.stringify(data, null, 2) + '\n');
    }
  }
  return serverId;
}

const UUID = '3f5f7c2a-8a4e-4a1a-9c1b-000000000001';

const USERCACHE = [{ name: 'Steve', uuid: UUID, expiresOn: '2027-01-01' }];
const OPS = [{ name: 'Steve', uuid: UUID, level: 4, bypassesPlayerLimit: true }];
const BANNED = [
  { name: 'Steve', uuid: UUID, created: '2025-01-01 00:00:00 +0000', source: 'x', expires: 'forever', reason: 'bye' },
];
const BANNED_IPS = [
  {
    ip: '1.2.3.4',
    created: '2025-01-01 00:00:00 +0000',
    source: 'x',
    expires: 'forever',
    reason: 'bad',
    player: 'Steve',
  },
];

test('listPlayers merges all role files and flags online players', () => {
  const id = app.seedServer('pl_merge');
  seedFiles(id, {
    'usercache.json': USERCACHE,
    'whitelist.json': [{ name: 'Steve', uuid: UUID }],
    'ops.json': OPS,
    'banned-players.json': BANNED,
  });
  const list = players.listPlayers(id, ['Steve']);
  assert.equal(list.length, 1);
  const p = list[0];
  assert.equal(p.name, 'Steve');
  assert.equal(p.uuid, UUID);
  assert.equal(p.online, true);
  assert.equal(p.whitelisted, true);
  assert.equal(p.op, true);
  assert.equal(p.opLevel, 4);
  assert.equal(p.bypassesPlayerLimit, true);
  assert.equal(p.banned, true);
  assert.equal(p.banReason, 'bye');
});

test('listPlayers reflects an expired ban as pardoned', () => {
  const id = app.seedServer('pl_exp');
  seedFiles(id, {
    'usercache.json': USERCACHE,
    'banned-players.json': [{ ...BANNED[0], expires: '2000-01-01 00:00:00 +0000' }],
  });
  const p = players.listPlayers(id)[0];
  assert.equal(p.banned, false);
  assert.equal(p.banReason, null);
  assert.equal(p.banExpires, null);
});

test('setWhitelisted adds and removes via file edit when stopped', async () => {
  const id = app.seedServer('pl_wl');
  seedFiles(id, { 'usercache.json': USERCACHE });
  const added = await players.setWhitelisted(id, 'Steve', true);
  assert.equal(added.whitelisted, true);
  const written = JSON.parse(fs.readFileSync(dataPath('servers', id, 'whitelist.json'), 'utf8'));
  assert.deepEqual(written, [{ uuid: UUID, name: 'Steve' }]);

  const removed = await players.setWhitelisted(id, 'Steve', false);
  assert.equal(removed.whitelisted, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(dataPath('servers', id, 'whitelist.json'), 'utf8')), []);
});

test('setWhitelisted rejects an invalid player name via assertName', async () => {
  const id = app.seedServer('pl_badname');
  seedFiles(id, { 'usercache.json': USERCACHE });
  await assert.rejects(() => players.setWhitelisted(id, 'bad name!', true), /Invalid player name/);
});

test('setWhitelistEnforced toggles server.properties, and getWhitelistEnforced reads it', async () => {
  const id = app.seedServer('pl_props');
  seedFiles(id);
  assert.equal(players.getWhitelistEnforced(id), false);
  await players.setWhitelistEnforced(id, true);
  assert.equal(players.getWhitelistEnforced(id), true);
  await players.setWhitelistEnforced(id, false);
  assert.equal(players.getWhitelistEnforced(id), false);
});

test('setWhitelistEnforced edits an existing white-list line in place', async () => {
  const id = app.seedServer('pl_props2');
  seedFiles(id);
  fs.writeFileSync(dataPath('servers', id, 'server.properties'), 'motd=hi\nwhite-list=false\nonline-mode=true\n');
  await players.setWhitelistEnforced(id, true);
  const text = fs.readFileSync(dataPath('servers', id, 'server.properties'), 'utf8');
  assert.match(text, /\nwhite-list=true\n/);
  const parts = text.trim().split('\n');
  assert.equal(parts.length, 3);
});

test('setOp writes ops.json with clamped level when stopped', async () => {
  const id = app.seedServer('pl_op');
  seedFiles(id, { 'usercache.json': USERCACHE });
  const res = await players.setOp(id, 'Steve', true, 2);
  assert.equal(res.op, true);
  assert.equal(res.opLevel, 2);
  const ops = JSON.parse(fs.readFileSync(dataPath('servers', id, 'ops.json'), 'utf8'));
  assert.equal(ops[0].level, 2);
  const deop = await players.setOp(id, 'Steve', false);
  assert.equal(deop.op, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(dataPath('servers', id, 'ops.json'), 'utf8')), []);
});

test('banPlayer/pardonPlayer round-trip and clean control-char-laden reasons', async () => {
  const id = app.seedServer('pl_ban');
  seedFiles(id, { 'usercache.json': USERCACHE });
  const ban = await players.banPlayer(id, 'Steve', 'cheating\r\n\x00');
  assert.equal(ban.banned, true);
  let file = JSON.parse(fs.readFileSync(dataPath('servers', id, 'banned-players.json'), 'utf8'));
  assert.equal(file[0].reason, 'cheating');
  assert.equal(file[0].expires, 'forever');
  assert.equal(file[0].source, 'Minecraft Server Manager');

  await players.pardonPlayer(id, 'Steve');
  file = JSON.parse(fs.readFileSync(dataPath('servers', id, 'banned-players.json'), 'utf8'));
  assert.deepEqual(file, []);
});

test('banPlayer writes a real expiry timestamp when a duration is requested', async () => {
  const id = app.seedServer('pl_bandur');
  seedFiles(id, { 'usercache.json': USERCACHE });
  await players.banPlayer(id, 'Steve', 'timeout', { durationMs: 60_000 });
  const file = JSON.parse(fs.readFileSync(dataPath('servers', id, 'banned-players.json'), 'utf8'));
  assert.match(file[0].expires, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+0000$/);
});

test('banIp/pardonIp round-trip and reject invalid IPs', async () => {
  const id = app.seedServer('pl_bip');
  seedFiles(id);
  const ban = await players.banIp(id, '1.2.3.4', 'abuse', { player: 'Steve' });
  assert.equal(ban.banned, true);
  assert.equal(ban.player, 'Steve');
  let file = JSON.parse(fs.readFileSync(dataPath('servers', id, 'banned-ips.json'), 'utf8'));
  assert.equal(file[0].ip, '1.2.3.4');
  assert.equal(file[0].player, 'Steve');

  await players.pardonIp(id, '1.2.3.4');
  file = JSON.parse(fs.readFileSync(dataPath('servers', id, 'banned-ips.json'), 'utf8'));
  assert.deepEqual(file, []);

  await assert.rejects(() => players.banIp(id, 'garbage', 'x'), /Invalid IP/);
  await assert.rejects(() => players.pardonIp(id, 'not-an-ip'), /Invalid IP/);
});

test('listBannedIps filters expired entries', () => {
  const id = app.seedServer('pl_lbip');
  seedFiles(id, {
    'banned-ips.json': [BANNED_IPS[0], { ...BANNED_IPS[0], ip: '5.6.7.8', expires: '2000-01-01 00:00:00 +0000' }],
  });
  const list = players.listBannedIps(id);
  assert.equal(list.length, 1);
  assert.equal(list[0].ip, '1.2.3.4');
  assert.equal(list[0].expires, 'forever');
});

test('readJson rejects unsupported files and tolerates missing ones', () => {
  const id = app.seedServer('pl_readjson');
  seedFiles(id);
  assert.deepEqual(players.readJson(id, 'usercache.json'), []);
  assert.throws(() => players.readJson(id, 'evil.json'), /Unsupported player file/);
});

test('resolveIdentity resolves a known local player without network', async () => {
  const id = app.seedServer('pl_res');
  seedFiles(id, { 'usercache.json': USERCACHE });
  const res = await players.resolveIdentity(id, 'Steve');
  assert.equal(res.uuid, UUID);
  assert.equal(res.name, 'Steve');
});
