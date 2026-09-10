'use strict';

// Regression tests for the authorization / path-traversal fixes:
//   - backup download and the per-server file manager are admin/operator only
//     (a read-only viewer must never reach server.properties / rcon.password)
//   - the mods content routes reject path-traversal in the `file` param
//   - the /settings and /storage pages are admin only
//   - advanced Docker overrides (extra binds mount arbitrary host paths) are
//     admin only - an operator must not be able to reach host root through them

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const authService = require('../src/services/auth');

let adminCookie;
let viewerCookie;

/** Create a user with the given role and return its session cookie string. */
async function login(username, password, role) {
  await authService.createUser({ username, password, role }, { actor: 'test' });
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

test('viewer cannot delete backups (403); admin passes the gate', async () => {
  const asViewer = await app.req('DELETE', '/api/backups/bk_anything', { cookie: viewerCookie });
  assert.equal(asViewer.status, 403);

  // deleteBackup() is idempotent for a missing id (200, freedBytes: 0) rather
  // than 404 - this only needs to confirm the role gate was passed.
  const asAdmin = await app.req('DELETE', '/api/backups/bk_anything', { cookie: adminCookie });
  assert.equal(asAdmin.status, 200);
});

test('viewer cannot delete mods (403); admin passes the gate', async () => {
  const asViewer = await app.req('DELETE', '/api/servers/srv_sec01/mods/some.jar', { cookie: viewerCookie });
  assert.equal(asViewer.status, 403);

  const asAdmin = await app.req('DELETE', '/api/servers/srv_sec01/mods/some.jar', { cookie: adminCookie });
  assert.notEqual(asAdmin.status, 403); // gate passed (200 or a benign 404, but never forbidden)
});

test('side-effecting GETs (staging tmp files) are gated above the method-based viewer check', async () => {
  for (const path of [
    '/api/events/export?format=csv',
    '/api/servers/srv_sec01/events/export?format=csv',
    '/api/servers/srv_sec01/worlds/world/download',
    '/api/servers/srv_sec01/integrations/invite/modpack.mrpack',
  ]) {
    const asViewer = await app.req('GET', path, { cookie: viewerCookie });
    assert.equal(asViewer.status, 403, `viewer must be 403 on ${path}`);

    const asAdmin = await app.req('GET', path, { cookie: adminCookie });
    assert.notEqual(asAdmin.status, 403, `admin gate must pass on ${path}`);
  }
});

test('advanced Docker overrides are admin-only; plain operator updates still work', async () => {
  const operatorCookie = await login('operator1', 'operatorpass123', 'operator');
  app.seedServer('srv_sec02');

  // The exact escalation this gate exists for: an operator binding the Docker
  // socket (or any host path) into a container they control.
  const binds = await app.req('PATCH', '/api/servers/srv_sec02', {
    cookie: operatorCookie,
    body: { extraBinds: [{ hostPath: '/var/run/docker.sock', containerPath: '/var/run/docker.sock' }] },
  });
  assert.equal(binds.status, 403);

  const create = await app.req('POST', '/api/servers', {
    cookie: operatorCookie,
    body: { name: 'Op Server', type: 'VANILLA', mcVersion: 'LATEST', start: false, networkName: 'proxy' },
  });
  assert.equal(create.status, 403);

  const networks = await app.req('GET', '/api/docker/networks', { cookie: operatorCookie });
  assert.equal(networks.status, 403);

  // Overrides absent → the operator's normal powers are untouched.
  const rename = await app.req('PATCH', '/api/servers/srv_sec02', {
    cookie: operatorCookie,
    body: { name: 'Renamed by operator' },
  });
  assert.equal(rename.status, 200);
});

test('/settings and /storage pages are admin only', async () => {
  for (const path of ['/settings', '/storage']) {
    const asViewer = await app.req('GET', path, { cookie: viewerCookie });
    assert.equal(asViewer.status, 403, `${path} should be forbidden for a viewer`);

    const asAdmin = await app.req('GET', path, { cookie: adminCookie });
    assert.equal(asAdmin.status, 200, `${path} should render for an admin`);
  }
});

test('/events/prune is admin-only: the delete is global (no server scoping), so an operator or viewer must not be able to wipe the audit trail', async () => {
  const operatorCookie = await login('op_prune', 'operatorpass123', 'operator');

  const asViewer = await app.req('POST', '/api/events/prune', { cookie: viewerCookie, body: { days: 7 } });
  assert.equal(asViewer.status, 403, 'viewer must be 403 on events/prune');

  const asOperator = await app.req('POST', '/api/events/prune', { cookie: operatorCookie, body: { days: 7 } });
  assert.equal(asOperator.status, 403, 'operator must be 403 on events/prune (admin-only)');

  const asAdmin = await app.req('POST', '/api/events/prune', { cookie: adminCookie, body: { days: 0 } });
  assert.ok([400, 200].includes(asAdmin.status), `admin gate must pass (400 for days:0 or 200, got ${asAdmin.status})`);
});

test('/api/v1 sits in the public zone: a cookieless call is a Bearer 401, not a login redirect', async () => {
  await app.req('POST', '/api/settings/public-api', { cookie: adminCookie, body: { enabled: true } });
  const r = await app.req('GET', '/api/v1/servers');
  assert.equal(r.status, 401); // token auth answered - never a 302 to /login
  assert.match(r.json.error, /Authorization/);
});
