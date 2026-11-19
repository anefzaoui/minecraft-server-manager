'use strict';

// #53: loader-aware LATEST/SNAPSHOT display. A plugin-family LATEST pin
// resolves to the newest Minecraft version the loader actually ships, plugin
// SNAPSHOT renders bare (Paper builds releases only), and everything else
// keeps the age-old Mojang-manifest behaviour. No network: the probe reads
// api_cache, and the resolver memo is keyed by (type, channel), so each
// scenario uses its own type to stay isolated.

const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/env');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { displayVersion } = require('../src/web/viewModels');

const MANIFEST = {
  latest: { release: '26.3', snapshot: '26.4-rc-1' },
  versions: [
    { id: '26.4-rc-1', type: 'snapshot', releaseTime: '2026-09-01T00:00:00Z' },
    { id: '26.3', type: 'release', releaseTime: '2026-08-01T00:00:00Z' },
    { id: '26.2', type: 'release', releaseTime: '2026-07-01T00:00:00Z' },
    { id: '1.21.1', type: 'release', releaseTime: '2024-08-08T00:00:00Z' },
  ],
};
db.run(
  `INSERT INTO api_cache (key, value_json, fetched_at) VALUES ('mojang-version-manifest', ?, datetime('now'))
   ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
  JSON.stringify(MANIFEST)
);

const realFetch = globalThis.fetch;
test.beforeEach(() => {
  db.run("DELETE FROM api_cache WHERE key LIKE 'loader:paper%' OR key LIKE 'loader:purpur%'");
  // Any stray probe would hit the network; make that a loud failure instead.
  globalThis.fetch = async () => {
    throw new Error('unexpected network during a displayVersion unit test');
  };
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

function seedProbe(mc, builds) {
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'loader:paper3:' + mc,
    JSON.stringify(builds)
  );
}

const serverOf = (overrides) => ({ mc_version: 'LATEST', type: 'PAPER', env: {}, ...overrides });

test('plugin-family LATEST resolves to the newest version Paper ships', async () => {
  seedProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'ALPHA' }]);
  seedProbe('26.2', [{ id: 6, time: '2026-07-05T00:00:00Z', channel: 'STABLE' }]);
  assert.equal(
    await displayVersion(serverOf({ type: 'PAPER' })),
    'LATEST (26.2)',
    '26.3 is pre-release only, so the pin points at the newest shipped build'
  );
});

test('plugin-family LATEST shows 26.3 once Paper ships it', async () => {
  seedProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'STABLE' }]);
  seedProbe('26.2', [{ id: 6, time: '2026-07-05T00:00:00Z', channel: 'STABLE' }]);
  assert.equal(await displayVersion(serverOf({ type: 'FOLIA' })), 'LATEST (26.3)');
});

test('a registry with no data at all falls back to the Mojang latest label', async () => {
  // Empty probe cache for every release the resolver would try = "no build".
  seedProbe('26.3', []);
  seedProbe('26.2', []);
  seedProbe('1.21.1', []);
  assert.equal(await displayVersion(serverOf({ type: 'LEAF' })), 'LATEST (26.3)');
});

test('plugin-family SNAPSHOT renders bare (Paper builds releases only)', async () => {
  assert.equal(await displayVersion(serverOf({ mc_version: 'SNAPSHOT' })), 'SNAPSHOT');
});

test('vanilla LATEST keeps the Mojang-manifest behaviour', async () => {
  assert.equal(await displayVersion(serverOf({ type: 'VANILLA' })), 'LATEST (26.3)');
});

test('vanilla SNAPSHOT still resolves its number', async () => {
  assert.equal(await displayVersion(serverOf({ type: 'VANILLA', mc_version: 'SNAPSHOT' })), 'SNAPSHOT (26.4-rc-1)');
});

test('a concrete pin passes through unchanged on any flavor', async () => {
  assert.equal(await displayVersion(serverOf({ mc_version: '1.20.4' })), '1.20.4');
  assert.equal(await displayVersion(serverOf({ type: 'VANILLA', mc_version: '1.20.4' })), '1.20.4');
});
