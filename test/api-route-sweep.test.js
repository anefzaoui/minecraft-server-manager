'use strict';

// Contract sweep over every /api route: an admin calling any route with empty
// input and a throwaway server must get a handled response (2xx/4xx), never an
// unhandled crash. Only routes that need a live Docker daemon or the internet may answer 5xx.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const router = require('../src/web/routes/api');

const NEEDS_DOCKER = new Set([
  'POST /api/servers/srv_sweep/start',
  'POST /api/servers/srv_sweep/kill',
  'POST /api/servers/srv_sweep/recreate',
  'GET /api/docker/networks',
  'GET /api/servers/srv_sweep/logs',
  'GET /api/servers/srv_sweep/stats',
  'POST /api/servers/srv_sweep/stop',
  'POST /api/servers/srv_sweep/restart',
]);
// Routes that reach an outside service and answer 5xx when it is unreachable
// (the sweep runs offline, see the fetch stub below).
const NEEDS_NETWORK = new Set(['GET /api/settings/panel-update', 'POST /api/servers/srv_sweep/map/enable']);
// Would remove the server the sweep is running against.
const SKIP = new Set(['DELETE /api/servers/srv_sweep']);

// The sweep must not depend on the internet: a slow or blocked network in CI
// turned one route (GET /api/versions, which needs Mojang's manifest when
// nothing is cached) into a 500 after minutes of timeouts. Requests to the
// test server pass through; the Mojang manifest is served from a tiny fixture;
// every other outside request fails immediately, as if offline.
const realFetch = globalThis.fetch;
const MANIFEST = {
  latest: { release: '1.21.1', snapshot: '1.21.1' },
  versions: [{ id: '1.21.1', type: 'release', url: '', time: '', releaseTime: '2024-08-08T00:00:00+00:00' }],
};
test.before(async () => {
  globalThis.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url)) return realFetch(input, init);
    if (url.startsWith('https://launchermeta.mojang.com/')) return Response.json(MANIFEST);
    throw new TypeError('fetch failed (network is blocked in this test)');
  };
  await app.start();
});
test.after(async () => {
  globalThis.fetch = realFetch;
  await app.stop();
});

test('no /api route crashes on empty input', async () => {
  const cookie = await app.adminCookie();
  app.seedServer('srv_sweep');
  const routes = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) routes.push([method.toUpperCase(), layer.route.path]);
  }
  assert.ok(routes.length > 100, 'expected to discover the router');

  const crashed = [];
  for (const [method, p] of routes) {
    const url = '/api' + p.replace(/:id\b/g, 'srv_sweep').replace(/:[A-Za-z]+/g, 'x');
    const key = `${method} ${url}`;
    if (SKIP.has(key)) continue;
    const r = await app.req(method, url, { cookie, body: method === 'GET' ? undefined : {} });
    if (r.status >= 500 && !NEEDS_DOCKER.has(key) && !NEEDS_NETWORK.has(key)) crashed.push(`${key} -> ${r.status}`);
  }
  assert.deepEqual(crashed, []);
});
