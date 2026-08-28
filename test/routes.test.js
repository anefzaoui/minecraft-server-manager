'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const eventsService = require('../src/events');
const db = require('../src/db');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('API requires authentication', async () => {
  const r = await app.req('GET', '/api/settings/localization');
  // Unauthed API calls are rejected (401) or redirected to login (302) — never 200.
  assert.notEqual(r.status, 200);
});

test('authed localization GET/POST round-trips', async () => {
  const get = await app.req('GET', '/api/settings/localization', { cookie });
  assert.equal(get.status, 200);
  assert.ok(get.json.localization.timezone);

  const post = await app.req('POST', '/api/settings/localization', {
    cookie,
    body: { timezone: 'Asia/Tokyo', country: 'JP' },
  });
  assert.equal(post.status, 200);
  assert.equal(post.json.localization.timezone, 'Asia/Tokyo');

  const bad = await app.req('POST', '/api/settings/localization', { cookie, body: { timezone: 'Nowhere/Nope' } });
  assert.equal(bad.status, 400);
});

test('event export (extracted to the events service) returns CSV and JSON', async () => {
  eventsService.recordEvent({ actor: 'admin', type: 'test-event', summary: 'hello export world' });

  const csv = await app.req('GET', '/api/events/export?format=csv', { cookie });
  assert.equal(csv.status, 200);
  assert.match(csv.text, /id,created_at,server_id,actor,type,summary/);
  assert.match(csv.text, /hello export world/);

  const json = await app.req('GET', '/api/events/export?format=json', { cookie });
  assert.equal(json.status, 200);
  assert.ok(Array.isArray(json.json));
  assert.ok(json.json.some((e) => e.summary === 'hello export world'));
});

test('event prune (extracted) returns a numeric removed count', async () => {
  const r = await app.req('POST', '/api/events/prune', { cookie, body: { days: 1 } });
  assert.equal(r.status, 200);
  assert.equal(typeof r.json.removed, 'number');
});

test('console-label (extracted to servers service) sanitizes and 404s unknown servers', async () => {
  const missing = await app.req('PUT', '/api/servers/nope/console-label', { cookie, body: { label: 'x' } });
  assert.equal(missing.status, 404);

  app.seedServer('srv_label01');
  const ok = await app.req('PUT', '/api/servers/srv_label01/console-label', { cookie, body: { label: 'A§dmin\n\tX' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.label, 'AdminX'); // § byte + control chars stripped
});

test('the pack platform enum accepts gtnh', async () => {
  // Seed the cached index so the resolver never reaches the network.
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES ('gtnh:versions', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    JSON.stringify(require('./fixtures/gtnh-versions.json'))
  );

  // A bad version is rejected by the resolver with 404, not by the enum with 400.
  const res = await app.req('POST', '/api/packs/resolve', {
    cookie,
    body: { platform: 'gtnh', ref: 'gtnh', versionId: 'definitely-not-a-version' },
  });
  assert.equal(res.status, 404);
});

test('an unknown pack platform is still rejected', async () => {
  const res = await app.req('POST', '/api/packs/resolve', {
    cookie,
    body: { platform: 'technic', ref: 'tekkit' },
  });
  assert.equal(res.status, 400);
});

test('cached library icons are served authed-only (the /library/icons static mount)', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { dataPath } = require('../src/storage/pathGuard');
  const iconDir = dataPath('library', 'icons', 'mods');
  fs.mkdirSync(iconDir, { recursive: true });
  fs.writeFileSync(path.join(iconDir, 'lib_test1.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const authed = await app.req('GET', '/library/icons/mods/lib_test1.png', { cookie });
  assert.equal(authed.status, 200);

  const unauthed = await app.req('GET', '/library/icons/mods/lib_test1.png');
  assert.notEqual(unauthed.status, 200); // login redirect, never the file

  // The mount must not expose the rest of the library (jar pool).
  const jarDir = dataPath('library', 'mods');
  fs.mkdirSync(jarDir, { recursive: true });
  fs.writeFileSync(path.join(jarDir, 'secret.jar'), 'jar');
  const escape = await app.req('GET', '/library/icons/../mods/secret.jar', { cookie });
  assert.notEqual(escape.status, 200);
});
