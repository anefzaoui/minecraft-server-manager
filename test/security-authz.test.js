'use strict';

// Regression tests for the authorization / path-traversal fixes:
//   - backup download and the per-server file manager are admin/operator only
//     (a read-only viewer must never reach server.properties / rcon.password)
//   - the mods content routes reject path-traversal in the `file` param
//   - the /settings and /storage pages are admin only

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const authService = require('../src/services/auth');

let adminCookie;
let viewerCookie;

/** Create a user with the given role and return its session cookie string. */
async function login(username, password, role) {
  authService.createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  await app.start();
  adminCookie = await app.adminCookie();
  viewerCookie = await login('viewer1', 'viewerpass123', 'viewer');
  app.seedServer('srv_sec01');
});

test.after(async () => {
  await app.stop();
});

test('viewer cannot download backups (403); admin passes the gate (404 for a missing id)', async () => {
  const asViewer = await app.req('GET', '/api/backups/bk_anything/download', { cookie: viewerCookie });
  assert.equal(asViewer.status, 403);

  const asAdmin = await app.req('GET', '/api/backups/bk_anything/download', { cookie: adminCookie });
  assert.equal(asAdmin.status, 404); // gate passed, backup simply doesn't exist
});

test('viewer cannot read server files (403); admin passes the gate', async () => {
  const asViewer = await app.req('GET', '/api/servers/srv_sec01/files/read?path=server.properties', {
    cookie: viewerCookie,
  });
  assert.equal(asViewer.status, 403);

  const asAdmin = await app.req('GET', '/api/servers/srv_sec01/files/list', { cookie: adminCookie });
  assert.notEqual(asAdmin.status, 403); // gate passed (200 or a benign 404, but never forbidden)
});

test('mods toggle rejects path traversal in the file param', async () => {
  const r = await app.req('POST', '/api/servers/srv_sec01/mods/toggle', {
    cookie: adminCookie,
    body: { file: '../../../panel.db', enabled: false },
  });
  assert.equal(r.status, 400);
});

test('mods delete rejects an encoded traversal in the :file param', async () => {
  const r = await app.req('DELETE', '/api/servers/srv_sec01/mods/..%2F..%2F..%2F.session-secret', {
    cookie: adminCookie,
  });
  assert.equal(r.status, 400);
});

test('/settings and /storage pages are admin only', async () => {
  for (const path of ['/settings', '/storage']) {
    const asViewer = await app.req('GET', path, { cookie: viewerCookie });
    assert.equal(asViewer.status, 403, `${path} should be forbidden for a viewer`);

    const asAdmin = await app.req('GET', path, { cookie: adminCookie });
    assert.equal(asAdmin.status, 200, `${path} should render for an admin`);
  }
});
