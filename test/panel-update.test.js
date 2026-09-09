'use strict';

// Regression coverage for Bug 6 ("Update MSM"): an admin-only settings control
// that compares the installed version against the latest GitHub release and
// links to it. Never modifies panel files, never hits GitHub at page render.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const githubApi = require('../src/services/githubApi');
const panelUpdate = require('../src/services/panelUpdate');

let cookie;
let opCookie;
let viewerCookie;

async function login(username, password, role) {
  const auth = require('../src/services/auth');
  await auth.createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  opCookie = await login('updtop', 'operatorpass123', 'operator');
  viewerCookie = await login('updtviewer', 'viewerpass123', 'viewer');
});

test.after(async () => {
  await app.stop();
});

test.beforeEach(() => {
  db.run("DELETE FROM api_cache WHERE key = 'panel-latest-release'");
});

// One minor ahead of package.json's current version (0.12.0).
const RELEASE = {
  tag: 'v0.13.0',
  name: 'v0.13.0',
  publishedAt: '2026-01-01T00:00:00Z',
  htmlUrl: 'https://github.com/anefzaoui/minecraft-server-manager/releases/tag/v0.13.0',
};

test('compareVersions decides -1/0/1 for semver and null for unknown shapes', () => {
  assert.equal(panelUpdate.compareVersions('v1.2.3', 'v1.2.2'), 1);
  assert.equal(panelUpdate.compareVersions('0.11.0', '0.11.0'), 0);
  assert.equal(panelUpdate.compareVersions('1.2.3', 'v2.0.0'), -1);
  assert.equal(panelUpdate.compareVersions('nightly', '0.11.0'), null);
  assert.equal(panelUpdate.compareVersions(null, '0.11.0'), null);
  assert.equal(panelUpdate.compareVersions('2.0', '0.11.0'), null);
});

test('checkLatest reports an update when GitHub has a newer semver tag', async (t) => {
  t.mock.method(githubApi, 'getReleases', async () => [RELEASE]);
  const r = await panelUpdate.checkLatest();
  assert.equal(r.current, '0.12.0');
  assert.equal(r.isNewer, true);
  assert.equal(r.latest.version, '0.13.0');
  assert.equal(r.latest.htmlUrl, RELEASE.htmlUrl);
  assert.equal(r.error, null);
  assert.ok(db.get("SELECT 1 FROM api_cache WHERE key = 'panel-latest-release'"), 'result should be cached');
});

test('checkLatest reports no update for the same or an older tag, and tolerates non-semver tags', async (t) => {
  for (const tag of ['v0.12.0', 'v0.10.0']) {
    t.mock.method(githubApi, 'getReleases', async () => [{ ...RELEASE, tag }]);
    const r = await panelUpdate.checkLatest({ refresh: true });
    assert.equal(r.isNewer, false, `${tag} must not look newer than 0.12.0`);
  }
  t.mock.method(githubApi, 'getReleases', async () => [{ ...RELEASE, tag: 'nightly-2026-01-01' }]);
  const r = await panelUpdate.checkLatest({ refresh: true });
  assert.equal(r.latest.version, 'nightly-2026-01-01');
  assert.equal(r.isNewer, false, 'unknown tag shapes must not be treated as newer');
});

test('getReleases returning no releases yields a no-update answer', async (t) => {
  t.mock.method(githubApi, 'getReleases', async () => []);
  const r = await panelUpdate.checkLatest({ refresh: true });
  assert.equal(r.latest, null);
  assert.equal(r.isNewer, false);
});

test('API: admin can check (200); operator and viewer are 403', async (t) => {
  t.mock.method(githubApi, 'getReleases', async () => [RELEASE]);
  const asViewer = await app.req('GET', '/api/settings/panel-update', { cookie: viewerCookie });
  assert.equal(asViewer.status, 403);
  const asOp = await app.req('GET', '/api/settings/panel-update', { cookie: opCookie });
  assert.equal(asOp.status, 403);
  const asAdmin = await app.req('GET', '/api/settings/panel-update?refresh=1', { cookie });
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.json.update.isNewer, true);
});

test('refresh=1 forces a fresh GitHub lookup even with a warm cache', async (t) => {
  let calls = 0;
  t.mock.method(githubApi, 'getReleases', async () => {
    calls += 1;
    return [RELEASE];
  });
  await panelUpdate.checkLatest();
  assert.equal(calls, 1);
  await panelUpdate.checkLatest({ refresh: true });
  assert.equal(calls, 2, 'refresh must bypass the cached result');
});

test('GitHub down with a stale cache degrades (200 + error); with nothing cached it is a 502', async (t) => {
  // Warm the cache first.
  t.mock.method(githubApi, 'getReleases', async () => [RELEASE]);
  await panelUpdate.checkLatest();

  t.mock.method(githubApi, 'getReleases', async () => {
    throw new Error('boom');
  });
  const stale = await app.req('GET', '/api/settings/panel-update', { cookie });
  assert.equal(stale.status, 200);
  assert.equal(stale.json.update.isNewer, true, 'stale-cache answer still carries the last known good');
  assert.match(stale.json.update.error, /boom/);

  const cold = await app.req('GET', '/api/settings/panel-update?refresh=1', { cookie });
  assert.equal(cold.status, 502, 'nothing cached + GitHub down must surface as a 502');
  assert.equal(
    cold.json.error,
    'Something went wrong on the server. Check the panel logs for details.',
    '5xx internals stay redacted'
  );
});

test('the Settings page renders the control without ever calling GitHub', async (t) => {
  const spy = t.mock.method(githubApi, 'getReleases', async () => [RELEASE]);
  const r = await app.req('GET', '/settings', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /id="msm-update-btn"/);
  assert.match(r.text, /v0\.12\.0/);
  assert.equal(spy.mock.callCount(), 0, 'page render must not hit the network');
});
