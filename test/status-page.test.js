'use strict';

// Opt-in public status pages: slug validation, uniqueness, enable/disable
// semantics, and the unauthenticated /status/:slug route.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const statusPage = require('../src/integrations/statusPage');

test.before(async () => {
  await app.start();
  await app.adminCookie();
  app.seedServer('srv_sp_a');
  const db = require('../src/db');
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES ('srv_sp_b', 'Other', 'PAPER', 25601, 26601, 'x', 1024, 1536)`
  );
});
test.after(async () => {
  await app.stop();
});

test('a server with no page reads as disabled with no path', () => {
  assert.deepEqual(statusPage.getStatusPage('srv_sp_a'), { enabled: false, slug: null, path: null });
});

test('enabling stores the slug and exposes its public path', () => {
  const r = statusPage.setStatusPage('srv_sp_a', { enabled: true, slug: 'my-server' });
  assert.deepEqual(r, { enabled: true, slug: 'my-server', path: '/status/my-server' });
  assert.equal(statusPage.findBySlug('my-server'), 'srv_sp_a');
});

test('slugs must be 3-40 lowercase letters, numbers, or dashes', () => {
  for (const bad of ['ab', 'UPPER', 'has space', 'under_score', 'x'.repeat(41), '../etc', '']) {
    assert.throws(
      () => statusPage.setStatusPage('srv_sp_a', { enabled: true, slug: bad }),
      (err) => err.status === 400,
      `rejects "${bad}"`
    );
  }
  assert.equal(statusPage.findBySlug('AB'), null);
  assert.equal(statusPage.findBySlug(undefined), null);
});

test('a slug already used by another server is refused (409), but re-saving your own is fine', () => {
  assert.throws(
    () => statusPage.setStatusPage('srv_sp_b', { enabled: true, slug: 'my-server' }),
    (err) => err.status === 409
  );
  assert.equal(statusPage.setStatusPage('srv_sp_a', { enabled: true, slug: 'my-server' }).enabled, true);
});

test('disabling without a slug keeps the address but stops resolving it', () => {
  const r = statusPage.setStatusPage('srv_sp_a', { enabled: false });
  assert.equal(r.enabled, false);
  assert.equal(r.slug, 'my-server');
  assert.equal(statusPage.findBySlug('my-server'), null);
  // Re-enabling restores the same address.
  assert.equal(statusPage.setStatusPage('srv_sp_a', { enabled: true, slug: r.slug }).path, '/status/my-server');
});

test('disabling a server that never had a page is harmless', () => {
  const r = statusPage.setStatusPage('srv_sp_b', { enabled: false });
  assert.deepEqual(r, { enabled: false, slug: null, path: null });
});

test('the public route serves an enabled page with no login, and a 404 otherwise', async () => {
  const ok = await app.req('GET', '/status/my-server', { headers: { Accept: 'text/html' } });
  assert.equal(ok.status, 200);
  assert.match(ok.text, /Test Server/);
  const missing = await app.req('GET', '/status/no-such-page', { headers: { Accept: 'text/html' } });
  assert.equal(missing.status, 404);
  const invalid = await app.req('GET', '/status/NOT%20VALID', { headers: { Accept: 'text/html' } });
  assert.equal(invalid.status, 404);
});

test('a disabled page 404s publicly', async () => {
  statusPage.setStatusPage('srv_sp_a', { enabled: false });
  const r = await app.req('GET', '/status/my-server', { headers: { Accept: 'text/html' } });
  assert.equal(r.status, 404);
});

test('the public page never leaks admin data', async () => {
  statusPage.setStatusPage('srv_sp_a', { enabled: true, slug: 'my-server' });
  const r = await app.req('GET', '/status/my-server', { headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  assert.ok(!/rcon|25599|26599|href="\/servers/i.test(r.text), 'no ports, rcon, or panel links');
});
