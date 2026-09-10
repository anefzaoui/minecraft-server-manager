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
  // Unauthed API calls are rejected (401) or redirected to login (302) - never 200.
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

test('CSV export defuses spreadsheet formula injection in influenced cells', () => {
  eventsService.recordEvent({ actor: '=cmd|calc', type: 'test-formula', summary: '+SUM(A1:A9)' });
  const { body } = eventsService.exportEvents(null, { format: 'csv' });
  const row = body.split('\r\n').find((l) => l.includes('test-formula'));
  assert.ok(row, 'the formula row is present');
  // The leading = / + is neutralized with a single quote, still inside the quoted cell.
  assert.match(row, /"'=cmd\|calc"/);
  assert.match(row, /"'\+SUM\(A1:A9\)"/);
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

test('/modpacks lists pack-backed servers (sidebar VMs no longer carry pack info)', async () => {
  const id = app.seedServer('srv_pack01');
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES (?, 'modrinth', 'cobblemon', 'Cobblemon Pack', 'v1', '1.0.0')`,
    id
  );

  const r = await app.req('GET', '/modpacks', { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /Cobblemon Pack/);
  assert.doesNotMatch(r.text, /No Modpacks Installed/);
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
  // Registry icon URLs can end in .svg - the sandbox CSP is what keeps a
  // malicious mod author's SVG from running script in the panel origin.
  assert.match(String(authed.headers.get('content-security-policy')), /sandbox/);

  const unauthed = await app.req('GET', '/library/icons/mods/lib_test1.png');
  assert.notEqual(unauthed.status, 200); // login redirect, never the file

  // The mount must not expose the rest of the library (jar pool).
  const jarDir = dataPath('library', 'mods');
  fs.mkdirSync(jarDir, { recursive: true });
  fs.writeFileSync(path.join(jarDir, 'secret.jar'), 'jar');
  const escape = await app.req('GET', '/library/icons/../mods/secret.jar', { cookie });
  assert.notEqual(escape.status, 200);
});

test('the Mods tab marks icon <img>s and ships the puzzle fallback template', async () => {
  const fsp = require('node:fs/promises');
  const path = require('node:path');
  const { dataPath } = require('../src/storage/pathGuard');
  const id = app.seedServer('srv_modicons'); // PAPER, no pack
  const dpDir = dataPath('servers', id, 'world/datapacks');
  await fsp.mkdir(dpDir, { recursive: true });
  await fsp.writeFile(path.join(dpDir, 'render-dp.zip'), 'x');
  db.run(
    `INSERT INTO server_content (id, server_id, kind, managed_by, name, filename, version, icon_url)
     VALUES ('sc_render', ?, 'datapack', 'overlay', 'Render DP', 'render-dp.zip', '1.0',
             'https://example.invalid/render.png')`,
    id
  );

  const r = await app.req('GET', `/servers/${id}/mods`, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /<img[^>]*\bdata-mod-icon\b/);
  const templates = r.text.match(/<template id="mod-icon-fallback">/g) || [];
  assert.equal(templates.length, 1, 'exactly one fallback template');
  assert.match(r.text, /<template id="mod-icon-fallback">.*bg-inset.*<\/template>/s);
});

test('dashboard renders the combined resource overview', async () => {
  app.seedServer('srv_dashcombined');
  const r = await app.req('GET', '/', { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200);
  // Section wrapper and heading always render once servers exist.
  assert.match(r.text, /Resource Overview/);
  assert.match(r.text, /id="combined-overview"/);
  // The "At a glance" band (memory, storage, health, updates) renders.
  assert.match(r.text, /Memory allotted/);
  assert.match(r.text, /Storage used/);
  assert.match(r.text, /Servers by Status/);
  // A stopped server produces no live breakdown, so the fallback copy shows.
  assert.match(r.text, /No servers are running right now\./);
});

test('dashboard renders the per-server breakdown with a live server', async () => {
  app.seedServer('srv_dashlive');
  db.run("UPDATE servers SET status = 'running', cpus = 2 WHERE id = 'srv_dashlive'");
  const r = await app.req('GET', '/', { cookie, headers: { Accept: 'text/html' } });
  assert.equal(r.status, 200, 'a running server must not crash the dashboard');
  // The running server's CPU segment computes cap = cpus * 100 via the `mul` helper.
  assert.match(r.text, /data-seg-cap="200"/);
  assert.match(r.text, /data-combined-row="srv_dashlive"/);
  // The run-only fallback copy is NOT shown when a server is running.
  assert.doesNotMatch(r.text, /No servers are running right now\./);
});
