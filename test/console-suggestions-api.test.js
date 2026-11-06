'use strict';

require('./helpers/env');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { start, stop, req, adminCookie, seedServer } = require('./helpers/app');

let admin;
let viewer;
let serverId;

before(async () => {
  await start();
  admin = await adminCookie();
  serverId = seedServer('srv_suggest1');
  require('../src/db').run("UPDATE servers SET mc_version = '1.21.4' WHERE id = ?", serverId);

  const auth = require('../src/services/auth');
  await auth.createUser({ username: 'suggest_viewer', password: 'viewerpass123', role: 'viewer' }, { actor: 'test' });
  const login = await req('POST', '/login', { body: { username: 'suggest_viewer', password: 'viewerpass123' } });
  viewer = (login.setCookie || []).map((value) => value.split(';')[0]).join('; ');
});

after(stop);

test('console suggestion API returns catalog help to console-authorized users', async () => {
  const response = await req(
    'GET',
    `/api/servers/${serverId}/console-suggestions?input=${encodeURIComponent('give ')}`,
    {
      cookie: admin,
    }
  );

  assert.equal(response.status, 200);
  assert.ok(response.json.suggestions.some((item) => item.value === '@a'));
  assert.equal(response.json.help.command, 'give');
  assert.ok(response.json.help.usages.includes('/give <targets> <item>'));
});

test('console suggestion API rejects oversized and unauthenticated requests', async () => {
  const oversized = await req('GET', `/api/servers/${serverId}/console-suggestions?input=${'x'.repeat(501)}`, {
    cookie: admin,
  });
  assert.equal(oversized.status, 400);

  const signedOut = await req('GET', `/api/servers/${serverId}/console-suggestions?input=list`);
  assert.equal(signedOut.status, 401);
});

test('console suggestion API refuses users without the console permission', async () => {
  const response = await req('GET', `/api/servers/${serverId}/console-suggestions?input=list`, { cookie: viewer });
  assert.equal(response.status, 403);
});
