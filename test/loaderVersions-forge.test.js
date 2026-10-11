'use strict';

// Forge build lists come from the full maven metadata (every build ever
// published, in no reliable order), labelled from the promotions feed. A
// typed build is checked against the full list, never the capped dropdown.
// NeoForge's year-based Minecraft versions (26.x) map onto their own builds.

const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/env');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const loaderVersions = require('../src/services/loaderVersions');

const MAVEN_URL = 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml';
const PROMOS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const NEOFORGE_URL = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';

// The real metadata's shape: newest-ish first, but not reliably - 47.4.25 and
// 47.4.26 really do sit at the tail of the live list.
function mavenXml(versions) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <groupId>net.minecraftforge</groupId>
  <artifactId>forge</artifactId>
  <versioning>
    <latest>1.21-51.0.33</latest>
    <versions>
${versions.map((v) => `      <version>${v}</version>`).join('\n')}
    </versions>
  </versioning>
</metadata>`;
}

const MAVEN_VERSIONS = [
  '1.21-51.0.33',
  '1.20.1-47.4.15',
  '1.20.1-47.4.13',
  '1.20.1-47.4.10',
  '1.20.1-47.4.5',
  '1.20.1-47.3.0',
  '1.7.10-10.13.4.1614-1.7.10',
  '1.20.1-47.4.25',
  '1.20.1-47.4.26',
];
const PROMOS = { promos: { '1.20.1-recommended': '47.4.10', '1.20.1-latest': '47.4.26' } };

const realFetch = globalThis.fetch;
let routes;
test.beforeEach(() => {
  db.run("DELETE FROM api_cache WHERE key LIKE 'loader:%'");
  routes = {
    [MAVEN_URL]: () => new Response(mavenXml(MAVEN_VERSIONS), { status: 200 }),
    [PROMOS_URL]: () => Response.json(PROMOS),
    [NEOFORGE_URL]: () =>
      Response.json({ versions: ['21.1.190', '21.1.200', '26.2.0.10-beta', '26.3.0.68-beta', '26.3.0.69-beta'] }),
  };
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('http://127.0.0.1')) return realFetch(input, init);
    const route = routes[url];
    return route ? route() : new Response('not found', { status: 404 });
  };
});
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('parseForgeMaven reads every version tag', () => {
  assert.deepEqual(loaderVersions.parseForgeMaven(mavenXml(['1.20.1-47.4.10', ' 1.21-51.0.33 '])), [
    '1.20.1-47.4.10',
    '1.21-51.0.33',
  ]);
  assert.deepEqual(loaderVersions.parseForgeMaven('not xml at all'), []);
});

test('Forge lists every build for the Minecraft version, newest first, with the promotions labelled', async () => {
  const { builds, envKey } = await loaderVersions.getBuilds('forge', '1.20.1');
  assert.equal(envKey, 'FORGE_VERSION');
  assert.equal(builds[0].version, '', 'the "Latest" no-pin option leads');
  assert.deepEqual(
    builds.slice(1).map((b) => b.version),
    ['47.4.26', '47.4.25', '47.4.15', '47.4.13', '47.4.10', '47.4.5', '47.3.0'],
    'numeric order (47.4.26 above 47.4.5), other Minecraft versions left out'
  );
  const byVersion = Object.fromEntries(builds.map((b) => [b.version, b]));
  assert.equal(byVersion['47.4.26'].label, '47.4.26 (latest)');
  assert.equal(byVersion['47.4.10'].label, '47.4.10 (recommended)');
  assert.equal(byVersion['47.4.10'].recommended, true);
  assert.equal(byVersion['47.4.15'].label, '47.4.15');
  assert.equal(byVersion['47.4.15'].recommended, undefined);
});

test('an old build that repeats the Minecraft version is listed without the suffix', async () => {
  const { builds } = await loaderVersions.getBuilds('forge', '1.7.10');
  assert.deepEqual(
    builds.slice(1).map((b) => b.version),
    ['10.13.4.1614']
  );
});

test('without the promotions feed the full list still comes through, unlabelled', async () => {
  routes[PROMOS_URL] = () => new Response('down', { status: 503 });
  const { builds } = await loaderVersions.getBuilds('forge', '1.20.1');
  assert.equal(builds.length, 8);
  assert.ok(builds.slice(1).every((b) => b.label === b.version && !b.recommended));
});

test('without maven the two promoted builds are offered', async () => {
  routes[MAVEN_URL] = () => new Response('down', { status: 503 });
  const { builds } = await loaderVersions.getBuilds('forge', '1.20.1');
  assert.deepEqual(
    builds.map((b) => b.version),
    ['', '47.4.26', '47.4.10']
  );
});

test('with both Forge sources down the picker still has the Latest option', async () => {
  routes[MAVEN_URL] = () => new Response('down', { status: 503 });
  routes[PROMOS_URL] = () => new Response('down', { status: 503 });
  const { builds } = await loaderVersions.getBuilds('forge', '1.20.1');
  assert.deepEqual(
    builds.map((b) => b.version),
    ['']
  );
});

test('the maven list is cached as parsed versions, not raw XML', async () => {
  await loaderVersions.getBuilds('forge', '1.20.1');
  const row = db.get("SELECT value_json FROM api_cache WHERE key = 'loader:forge-maven'");
  assert.deepEqual(JSON.parse(row.value_json).versions, MAVEN_VERSIONS);
  // A second call is served from the cache.
  routes[MAVEN_URL] = () => {
    throw new Error('should not be fetched again');
  };
  const { builds } = await loaderVersions.getBuilds('forge', '1.20.1');
  assert.equal(builds.length, 8);
});

test('the dropdown is capped, but a typed build is checked against every build', async () => {
  const many = Array.from({ length: 60 }, (_, i) => `1.20.1-47.2.${i}`);
  routes[MAVEN_URL] = () => new Response(mavenXml(many), { status: 200 });
  const { builds } = await loaderVersions.getBuilds('forge', '1.20.1');
  assert.equal(builds.length, 41, 'Latest + 40 builds');
  assert.equal(await loaderVersions.isKnownBuild('forge', '1.20.1', '47.2.0'), true, 'the oldest is beyond the cap');
});

test('isKnownBuild accepts a real Forge build and refuses the rest', async () => {
  assert.equal(await loaderVersions.isKnownBuild('forge', '1.20.1', '47.4.15'), true);
  assert.equal(await loaderVersions.isKnownBuild('forge', '1.20.1', '47.4.99'), false);
  assert.equal(await loaderVersions.isKnownBuild('forge', '1.20.1', '51.0.33'), false, 'a build for another version');
});

test('a skipped Forge number names the closest newer build instead', async () => {
  // Forge never published 47.4.14; a mod asking for "47.4.14 or above" is
  // satisfied by 47.4.15.
  assert.deepEqual(await loaderVersions.checkBuild('forge', '1.20.1', '47.4.14'), {
    known: false,
    closestNewer: '47.4.15',
  });
  assert.deepEqual(await loaderVersions.checkBuild('forge', '1.20.1', '47.4.15'), { known: true, closestNewer: null });
  assert.deepEqual(await loaderVersions.checkBuild('forge', '1.20.1', '47.4.99'), { known: false, closestNewer: null });
});

test('isKnownBuild throws when Forge maven is down, rather than trusting the promotions only', async () => {
  routes[MAVEN_URL] = () => new Response('down', { status: 503 });
  await assert.rejects(loaderVersions.isKnownBuild('forge', '1.20.1', '47.4.15'));
});

test('NeoForge builds are matched for legacy and year-based Minecraft versions', async () => {
  assert.equal(loaderVersions.neoforgePrefix('1.21.1'), '21.1.');
  assert.equal(loaderVersions.neoforgePrefix('1.21'), '21.0.');
  assert.equal(loaderVersions.neoforgePrefix('26.3'), '26.3.0.');
  assert.equal(loaderVersions.neoforgePrefix('26.3.1'), '26.3.1.');
  assert.equal(loaderVersions.neoforgePrefix('LATEST'), null);
  const { builds } = await loaderVersions.getBuilds('neoforge', '26.3');
  assert.deepEqual(
    builds.slice(1).map((b) => b.version),
    ['26.3.0.69-beta', '26.3.0.68-beta']
  );
  assert.equal(builds[1].label, '26.3.0.69-beta (beta)');
  assert.equal(await loaderVersions.isKnownBuild('neoforge', '1.21.1', '21.1.200'), true);
  assert.equal(await loaderVersions.isKnownBuild('neoforge', '26.3', '21.1.200'), false);
});

test('compareBuilds orders builds numerically', () => {
  assert.ok(loaderVersions.compareBuilds('47.4.26', '47.4.5') > 0);
  assert.ok(loaderVersions.compareBuilds('47.4.10', '47.4.14') < 0);
  assert.equal(loaderVersions.compareBuilds('47.4.14', '47.4.14'), 0);
});

test('a 200 with no versions in it is a failure, not a cached "no builds"', async () => {
  routes[MAVEN_URL] = () => new Response('<html>maintenance</html>', { status: 200 });
  // The picker falls back to the promoted builds instead of showing nothing.
  const { builds } = await loaderVersions.getBuilds('forge', '1.20.1');
  assert.deepEqual(
    builds.map((b) => b.version),
    ['', '47.4.26', '47.4.10']
  );
  assert.equal(db.get("SELECT 1 FROM api_cache WHERE key = 'loader:forge-maven'"), undefined, 'nothing cached');
  // A typed build can't be checked against nothing: that is an outage, not a refusal.
  await assert.rejects(loaderVersions.checkBuild('forge', '1.20.1', '47.4.15'));
});

test('the recommended build stays in the list when 40 newer ones push it past the cap', async () => {
  const many = Array.from({ length: 60 }, (_, i) => `1.20.1-47.2.${i}`);
  routes[MAVEN_URL] = () => new Response(mavenXml(many), { status: 200 });
  routes[PROMOS_URL] = () => Response.json({ promos: { '1.20.1-recommended': '47.2.3', '1.20.1-latest': '47.2.59' } });
  const { builds } = await loaderVersions.getBuilds('forge', '1.20.1');
  const recommended = builds.find((b) => b.recommended);
  assert.ok(recommended, 'the recommended build is still offered');
  assert.equal(recommended.version, '47.2.3');
  assert.equal(builds.length, 42, 'Latest + 40 newest + the recommended one');
});

test('a pre-release sorts below its release', () => {
  assert.ok(loaderVersions.compareBuilds('0.30.1', '0.30.1-beta.4') > 0);
  assert.ok(loaderVersions.compareBuilds('0.30.1-beta.4', '0.30.1-beta.3') > 0);
  assert.ok(loaderVersions.compareBuilds('0.31.0-beta.1', '0.30.1') > 0);
  assert.ok(loaderVersions.compareBuilds('21.1.200', '21.1.200-beta') > 0);
});

test('NeoForge leaves out snapshot builds and sorts the rest itself', async () => {
  routes[NEOFORGE_URL] = () =>
    Response.json({
      versions: [
        '26.1.0.0-alpha.15+snapshot-9',
        '26.1.0.0-alpha.9+snapshot-5',
        '26.1.0.10',
        '26.1.0.3-beta',
        '26.1.0.3',
        '26.1.0.2+pre-3',
      ],
    });
  const { builds } = await loaderVersions.getBuilds('neoforge', '26.1');
  assert.deepEqual(
    builds.slice(1).map((b) => b.version),
    ['26.1.0.10', '26.1.0.3', '26.1.0.3-beta']
  );
});

test('the Forge build list and the promotions feed are fetched at the same time', async () => {
  const events = [];
  routes[PROMOS_URL] = async () => {
    events.push('promos-start');
    await new Promise((r) => setTimeout(r, 50));
    events.push('promos-end');
    return Response.json(PROMOS);
  };
  routes[MAVEN_URL] = () => {
    events.push('maven-start');
    return new Response(mavenXml(MAVEN_VERSIONS), { status: 200 });
  };
  await loaderVersions.getBuilds('forge', '1.20.1');
  assert.ok(events.indexOf('maven-start') < events.indexOf('promos-end'), events.join(' → '));
});

test('a NeoForge server on a Minecraft snapshot keeps the snapshot builds, which are its only ones', async () => {
  routes[NEOFORGE_URL] = () =>
    Response.json({ versions: ['26.1.0.0-alpha.9+snapshot-5', '26.1.0.0-alpha.15+snapshot-9', '21.1.200'] });
  assert.equal(await loaderVersions.isKnownBuild('neoforge', '26.1-snapshot-9', '26.1.0.0-alpha.15+snapshot-9'), true);
  assert.equal(await loaderVersions.isKnownBuild('neoforge', '26.1', '26.1.0.0-alpha.15+snapshot-9'), false);
});

test('Quilt builds come back newest first, not in publish order', async () => {
  routes['https://meta.quiltmc.org/v3/versions/loader'] = () =>
    Response.json([{ version: '0.19.4' }, { version: '0.20.0-beta.14' }, { version: '0.20.0' }]);
  const { builds } = await loaderVersions.getBuilds('quilt');
  assert.deepEqual(
    builds.slice(1).map((b) => b.version),
    ['0.20.0', '0.20.0-beta.14', '0.19.4']
  );
});
