'use strict';

// Paper build lists come from the Fill v3 API (the legacy v2 endpoint 404s for
// MC releases above 1.21.11): bare newest-first array, SCREAMING_CASE channels,
// mapped back onto itzg's default/experimental PAPER_CHANNEL vocabulary.

const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/env');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const loaderVersions = require('../src/services/loaderVersions');

const V3_BUILDS = [
  { id: 12, time: '2026-08-30T00:00:00Z', channel: 'ALPHA', downloads: {} },
  { id: 11, time: '2026-08-20T00:00:00Z', channel: 'STABLE', downloads: {} },
  { id: 10, time: '2026-08-10T00:00:00Z', channel: 'RECOMMENDED', downloads: {} },
  { id: 9, time: '2026-08-01T00:00:00Z', channel: 'BETA', downloads: {} },
];

const realFetch = globalThis.fetch;
let requested = [];
test.beforeEach(() => {
  requested = [];
  db.run("DELETE FROM api_cache WHERE key LIKE 'loader:paper%'");
  globalThis.fetch = async (input, init) => {
    requested.push({ url: String(input), headers: (init && init.headers) || {} });
    return new Response(JSON.stringify(V3_BUILDS), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('paper builds hit Fill v3 with a User-Agent and keep newest-first order', async () => {
  const { builds, envKey } = await loaderVersions.getBuilds('paper', '26.2');
  assert.equal(envKey, 'PAPER_BUILD');
  assert.match(requested[0].url, /^https:\/\/fill\.papermc\.io\/v3\/projects\/paper\/versions\/26\.2\/builds$/);
  assert.ok(requested[0].headers['User-Agent'], 'Fill requires a descriptive User-Agent');
  // [0] is the "Latest (recommended)" no-pin sentinel; then stable channels newest-first.
  assert.deepEqual(
    builds.slice(1).map((b) => b.version),
    ['11', '10']
  );
});

test('experimental channel maps to ALPHA/BETA builds', async () => {
  const { builds } = await loaderVersions.getBuilds('paper', '26.2', { channel: 'experimental' });
  assert.deepEqual(
    builds.slice(1).map((b) => b.version),
    ['12', '9']
  );
  assert.match(builds[1].label, /alpha/);
});

test('a Fill outage still yields the Latest option (never dead-ends)', async () => {
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  const { builds } = await loaderVersions.getBuilds('paper', '26.2');
  assert.equal(builds.length, 1);
  assert.equal(builds[0].version, '');
});
