'use strict';

// Regression coverage for Bug 4: admin-configurable defaults for new servers.
// The settings service layers operator overrides over the .env/built-in
// config.defaults; the API round-trips and clamps them; the settings page
// renders the editable card; the wizard pre-fills from the effective defaults.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const settings = require('../src/services/settings');
const config = require('../src/config');

let cookie;
let viewerCookie;
let operatorCookie;

async function login(username, password, role) {
  const auth = require('../src/services/auth');
  await auth.createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  operatorCookie = await login('dfltop', 'operatorpass123', 'operator');
  viewerCookie = await login('dfltviewer', 'viewerpass123', 'viewer');
  // Offline-friendly wizard render: seed a fresh Mojang manifest so the
  // /servers/new route serves from cache instead of hitting the network.
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'mojang-version-manifest',
    JSON.stringify({
      latest: { release: '1.21.4' },
      versions: [
        { id: '1.21.4', type: 'release', releaseTime: '2024-12-03T14:30:00+00:00' },
        { id: '1.12.2', type: 'release', releaseTime: '2017-09-18T13:00:00+00:00' },
      ],
    })
  );
});

test.after(async () => {
  await app.stop();
});

test('defaults start at the built-in/.env config and are readable by any user', async () => {
  const r = await app.req('GET', '/api/settings/defaults', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.defaults, config.defaults);
  assert.deepEqual(r.json.base, config.defaults);
  for (const c of [viewerCookie, operatorCookie]) {
    const res = await app.req('GET', '/api/settings/defaults', { cookie: c });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.defaults, config.defaults);
  }
});

test('only admins can change the defaults', async () => {
  const body = { heapMb: 6144 };
  for (const c of [viewerCookie, operatorCookie]) {
    const res = await app.req('POST', '/api/settings/defaults', { cookie: c, body });
    assert.equal(res.status, 403, 'non-admin must be rejected');
  }
});

test('a partial override layers over the built-ins and persists', async () => {
  const res = await app.req('POST', '/api/settings/defaults', {
    cookie,
    body: { heapMb: 6144, quotaWarnPct: 60 },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.defaults.heapMb, 6144);
  assert.equal(res.json.defaults.quotaWarnPct, 60);
  // Untouched fields keep the built-in values.
  assert.equal(res.json.defaults.diskQuotaGb, config.defaults.diskQuotaGb);
  assert.equal(res.json.defaults.containerMemoryMb, config.defaults.containerMemoryMb);
  assert.equal(settings.getDefaults().heapMb, 6144);

  const read = await app.req('GET', '/api/settings/defaults', { cookie });
  assert.equal(read.json.defaults.heapMb, 6144);
  assert.equal(read.json.defaults.quotaWarnPct, 60);
});

test('out-of-bounds or junk values are clamped and ignored', async () => {
  const res = await app.req('POST', '/api/settings/defaults', {
    cookie,
    body: { heapMb: 1, diskQuotaGb: -5, quotaCriticalPct: 200, cpus: 0.25, bogusField: 123 },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.defaults.heapMb, 512); // clamped to the floor
  assert.equal(res.json.defaults.diskQuotaGb, 0); // clamped to the floor
  assert.equal(res.json.defaults.quotaCriticalPct, 100); // clamped to the ceiling
  assert.equal(res.json.defaults.cpus, 0.25); // fractional CPU is legal
  assert.equal(res.json.defaults.quotaWarnPct, 60); // untouched override survives
});

test('the settings page renders the editable defaults card from effective values', async () => {
  const r = await app.req('GET', '/settings', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /id="dflt-save"/);
  assert.match(r.text, /id="dflt-restore"/);
  assert.match(r.text, /<input[^>]*id="dflt-heap"[^>]*value="512"/);
  assert.match(r.text, /<input[^>]*id="dflt-cpus"[^>]*value="0\.25"/);
  // The restore anchor still knows the built-in value.
  assert.match(r.text, new RegExp(`id="dflt-heap"[^>]*data-default="${config.defaults.heapMb}"`));
});

test('the create wizard pre-fills from the effective defaults', async () => {
  const r = await app.req('GET', '/servers/new', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /value="512"[^>]*data-out="wz-ram-out"/); // RAM slider
  assert.match(r.text, /value="0"[^>]*data-out="wz-quota-out"/); // quota slider
  assert.match(r.text, /id="wz-ram-out">512 MB/);
});

test('reset drops the overrides back to the built-ins', async () => {
  const res = await app.req('POST', '/api/settings/defaults', { cookie, body: { reset: true } });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.defaults, config.defaults);
  assert.deepEqual(settings.getDefaults(), config.defaults);
  assert.equal(db.get("SELECT value_json FROM settings WHERE key = 'panel_defaults'"), undefined);
  // The page and wizard are back to the built-in values too.
  const settingsPage = await app.req('GET', '/settings', { cookie });
  assert.match(settingsPage.text, new RegExp(`id="dflt-heap"[^>]*value="${config.defaults.heapMb}"`));
  const wizardPage = await app.req('GET', '/servers/new', { cookie });
  assert.match(wizardPage.text, new RegExp(`value="${config.defaults.heapMb}"[^>]*data-out="wz-ram-out"`));
});
