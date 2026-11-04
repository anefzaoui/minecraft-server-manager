'use strict';

// Per-MC version support probe for the plugin family (#53): a default-channel
// Paper server must never be offered a Minecraft version Paper has no build
// for, while the experimental channel legitimately tracks pre-releases. This
// mirrors the design notes in §8.3 - present cache = authoritative (even
// empty), thrown probe (registry down) = supported so an outage never invents
// a hold.

const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/env');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const loaderVersions = require('../src/services/loaderVersions');

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

// Stub fetch that serves per-URL Fill/Purpur payloads until /switchToOutage.
const realFetch = globalThis.fetch;
let requested = [];
let outage = false;
function serve(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
test.beforeEach(() => {
  requested = [];
  outage = false;
  db.run("DELETE FROM api_cache WHERE key LIKE 'loader:paper%' OR key LIKE 'loader:purpur%'");
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    if (outage) return new Response('boom', { status: 500 });
    const url = String(input);
    if (url.includes('fill.papermc.io')) {
      const mc = /versions\/([^/]+)/.exec(url)?.[1];
      // Per-MC control: 26.3 ships ALPHA only (hold for the default channel),
      // 26.2 has a stable build, everything else is empty.
      const builds =
        mc === '26.3'
          ? [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'ALPHA' }]
          : mc === '26.2'
            ? [{ id: 6, time: '2026-07-05T00:00:00Z', channel: 'STABLE' }]
            : [];
      return serve(200, builds);
    }
    if (url.includes('api.purpurmc.org')) {
      const mc = /purpur\/([^/]+)/.exec(url)?.[1];
      return serve(200, { builds: { all: mc === '26.3' ? ['26.3'] : [] } });
    }
    return serve(404, {});
  };
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('PAPER: default channel is unsupported on an ALPHA-only list, supported on a stable build', async () => {
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PAPER', '26.3'), {
    supported: false,
    heard: true,
  });
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PAPER', '26.2'), {
    supported: true,
    heard: true,
  });
});

test('PAPER: experimental channel treats an ALPHA build as supported', async () => {
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PAPER', '26.3', { channel: 'experimental' }), {
    supported: true,
    heard: true,
  });
});

test('PAPER: paper forks use the Paper bellwether', async () => {
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PUFFERFISH', '26.3'), {
    supported: false,
    heard: true,
  });
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('LEAF', '26.2'), {
    supported: true,
    heard: true,
  });
});

test('PURPUR: supported by presence in builds.all, unsupported on an empty list', async () => {
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PURPUR', '26.3'), {
    supported: true,
    heard: true,
  });
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PURPUR', '26.2'), {
    supported: false,
    heard: true,
  });
});

test('a registry outage never invents a hold', async () => {
  outage = true;
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PAPER', '26.3'), {
    supported: true,
    heard: false,
  });
  assert.deepEqual(await loaderVersions.mcAvailableOnServerType('PURPUR', '26.3'), {
    supported: true,
    heard: false,
  });
});

test('newestMcSupportedByServerType resolves the newest supportable release', async () => {
  const mc = await loaderVersions.newestMcSupportedByServerType('PAPER');
  assert.equal(mc, '26.2', '26.3 is Alpha-only, so the resolver must land on 26.2');
});

test('the resolver memo serves a second call for the same type/channel without a new flight', async () => {
  const before = requested.length;
  const again = await loaderVersions.newestMcSupportedByServerType('PAPER');
  assert.equal(again, '26.2');
  assert.equal(requested.length, before, 'the second call is served from the memo');
});

test('concurrent resolution for different types never shares one flight', async () => {
  // Paper-family default lanes land on 26.2 (26.3 is ALPHA-only); Purpur
  // builds 26.3 today. Fired together, each type must get ITS OWN answer - a
  // shared flight would leak the first caller's result to the second.
  const [forkMc, purpurMc] = await Promise.all([
    loaderVersions.newestMcSupportedByServerType('PUFFERFISH'),
    loaderVersions.newestMcSupportedByServerType('PURPUR'),
  ]);
  assert.equal(forkMc, '26.2', 'the Paper-family resolver keeps the stable ceiling');
  assert.equal(purpurMc, '26.3', 'the Purpur resolver must not inherit the Paper answer');
});

test('the resolver returns null when nothing on the manifest is supported', async () => {
  // Override the per-MC stub so every probe answers "no builds"; a distinct
  // type key keeps the PAPER memo above from leaking in. The empties land in
  // api_cache, authoritative on any later run.
  globalThis.fetch = async () => serve(200, []);
  const mc = await loaderVersions.newestMcSupportedByServerType('SPIGOT');
  assert.equal(mc, null);
});

test('mcAvailableOnServerType hits the cache when a probe was already stored', async () => {
  // Prime: run one probe, then clear the fetch stub's call count and re-run -
  // the api_cache row serves the second pass with no network.
  await loaderVersions.mcAvailableOnServerType('PAPER', '26.2');
  const calls = requested.length;
  await loaderVersions.mcAvailableOnServerType('PAPER', '26.2');
  assert.equal(requested.length, calls, 'a present cache entry is authoritative');
});
