'use strict';

// Regression coverage for Bug 7's roster-status half: offline players' "Status"
// column now distinguishes Joined (never whitelisted) vs Whitelisted vs Banned,
// and shows a "join blocked" hint for un-whitelisted names while enforcement is on.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { dataPath } = require('../src/storage/pathGuard');
const app = require('./helpers/app');

let cookie;

async function login() {
  const auth = require('../src/services/auth');
  const username = `roster${process.pid}`;
  await auth.createUser({ username, password: 'rosterpass123', role: 'admin' }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password: 'rosterpass123' } });
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
});

const ALICE = '3f5f7c2a-8a4e-4a1a-9c1b-000000000001'; // joined, never whitelisted
const BOB = '3f5f7c2a-8a4e-4a1a-9c1b-000000000002'; // joined + whitelisted
const CAROL = '3f5f7c2a-8a4e-4a1a-9c1b-000000000003'; // joined, then banned

function seed(id) {
  app.seedServer(id);
  const dir = dataPath('servers', id);
  fs.mkdirSync(dir, { recursive: true });
  const write = (file, value) => fs.writeFileSync(dataPath('servers', id, file), JSON.stringify(value, null, 2) + '\n');
  write('usercache.json', [
    { name: 'Alice', uuid: ALICE, expiresOn: '2027-01-01' },
    { name: 'Bob', uuid: BOB, expiresOn: '2027-02-02' },
    { name: 'Carol', uuid: CAROL, expiresOn: '2027-03-03' },
  ]);
  write('whitelist.json', [{ name: 'Bob', uuid: BOB }]);
  write('banned-players.json', [
    {
      name: 'Carol',
      uuid: CAROL,
      created: '2025-01-01 00:00:00 +0000',
      source: 'x',
      expires: 'forever',
      reason: 'bye',
    },
  ]);
  return id;
}

test('roster status column renders Joined / Whitelisted / Banned with enforcement off', async () => {
  const id = seed('srv_roster_off');

  const r = await app.req('GET', `/servers/${id}/players`, { cookie });
  assert.equal(r.status, 200);

  // Each offline status state appears exactly once among the seeded players
  // (the "Online" row needs a live RCON list, so it is not exercised headless).
  assert.match(r.text, /status-dot bg-stone-500[^>]*><\/span> Joined<\/span>/);
  assert.match(r.text, /status-dot bg-grass-700[^>]*><\/span> Whitelisted<\/span>/);
  assert.match(r.text, /status-dot bg-redstone-500[^>]*><\/span> Banned<\/span>/);

  // Enforcement is off, so the un-whitelisted player just reads "Not whitelisted",
  // never a blocked hint.
  assert.match(r.text, />Not whitelisted<\/div>/);
  assert.doesNotMatch(r.text, /join blocked/i);

  // The seen line and last-seen attribute survive for the joined-but-not-whitelisted player.
  assert.match(r.text, /data-last-seen="2027-01-01"/);
  assert.match(r.text, /seen ~2027-01-01/);
});

test('enforced whitelist turns un-whitelisted players into "Not whitelisted, join blocked"', async () => {
  const id = seed('srv_roster_on');
  fs.writeFileSync(dataPath('servers', id, 'server.properties'), '# test\nwhite-list=true\nonline-mode=true\n');

  const r = await app.req('GET', `/servers/${id}/players`, { cookie });
  assert.equal(r.status, 200);

  assert.match(r.text, /> Joined<\/span>/);
  assert.match(r.text, />Not whitelisted, join blocked<\/div>/);
  assert.match(r.text, /id="players-wl-enforce" checked/);
  // Whitelisted and banned players keep their own statuses.
  assert.match(r.text, />Whitelist<\/span>/);
  assert.match(r.text, />Banned<\/span>/);
});
