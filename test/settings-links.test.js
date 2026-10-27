'use strict';

// Settings and Permissions are admin-only pages, so nobody else is shown a
// link to them (it would only lead to "Your role does not allow this").

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');

let admin;
test.before(async () => {
  await app.start();
  admin = await app.adminCookie();
});
test.after(() => app.stop());

async function signIn(username, role) {
  const create = await app.req('POST', '/api/users', {
    cookie: admin,
    body: { username, password: 'linkspass123', role },
  });
  assert.equal(create.status, 201);
  const login = await app.req('POST', '/login', { body: { username, password: 'linkspass123' } });
  return (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

const SETTINGS_LINK = /href="\/settings"/;
const PERMISSIONS_LINK = /href="\/settings\/permissions"/;

test('an admin sees the Settings and Permissions links', async () => {
  const page = await app.req('GET', '/modpacks', { cookie: admin });
  assert.equal(page.status, 200);
  assert.match(page.text, SETTINGS_LINK);
  assert.match(page.text, PERMISSIONS_LINK);
});

for (const role of ['operator', 'viewer']) {
  test(`${role}s are not shown links to the admin-only Settings page`, async () => {
    const cookie = await signIn(`links${role}`, role);
    const page = await app.req('GET', '/modpacks', { cookie });
    assert.equal(page.status, 200);
    assert.doesNotMatch(page.text, SETTINGS_LINK);
    assert.doesNotMatch(page.text, PERMISSIONS_LINK);
    assert.equal((await app.req('GET', '/settings', { cookie })).status, 403);
  });
}
