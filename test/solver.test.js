'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareMcDesc, buildLoaderMap, pairMeta, LOADERS } = require('../src/services/solver');

test('compareMcDesc sorts release versions newest-first', () => {
  const sorted = ['1.20.1', '1.21.4', '1.19.2', '1.21.0'].sort(compareMcDesc);
  assert.deepEqual(sorted, ['1.21.4', '1.21.0', '1.20.1', '1.19.2']);
});

test('buildLoaderMap collects release/beta versions per loader and skips alphas', () => {
  const map = buildLoaderMap([
    { version_type: 'release', loaders: ['fabric'], game_versions: ['1.21', '1.20.1'] },
    { version_type: 'beta', loaders: ['fabric'], game_versions: ['1.21.1'] },
    { version_type: 'alpha', loaders: ['fabric'], game_versions: ['1.99.9'] },
  ]);
  const fabric = map.get('fabric');
  assert.ok(fabric.has('1.21') && fabric.has('1.20.1') && fabric.has('1.21.1'));
  assert.ok(!fabric.has('1.99.9'), 'alpha versions are excluded');
});

test('buildLoaderMap rejects snapshot/pre-release game versions', () => {
  const map = buildLoaderMap([
    { version_type: 'release', loaders: ['fabric'], game_versions: ['1.21.2-pre1', '26w02a', '1.21.3'] },
  ]);
  const fabric = map.get('fabric');
  assert.ok(fabric.has('1.21.3'));
  assert.equal(fabric.size, 1, 'only the plain release version is kept');
});

test('buildLoaderMap maps spigot/bukkit builds into the paper bucket', () => {
  const map = buildLoaderMap([{ version_type: 'release', loaders: ['spigot', 'bukkit'], game_versions: ['1.20.1'] }]);
  assert.ok(map.get('paper').has('1.20.1'));
});

test('pairMeta returns the loader label and itzg TYPE', () => {
  assert.deepEqual(pairMeta('fabric', '1.21'), {
    loader: 'fabric',
    loaderLabel: 'Fabric',
    type: 'FABRIC',
    mcVersion: '1.21',
  });
  // Every loader bucket is representable.
  for (const l of LOADERS) {
    assert.equal(pairMeta(l.id, '1.20.1').type, l.type);
  }
});

// ---- Cross-platform solve (CurseForge projects join the intersection) ----

test('solve mixes Modrinth and CurseForge projects into one compatibility answer', async () => {
  const { migrate } = require('../src/db/migrate');
  migrate();
  const db = require('../src/db');
  const apiKeys = require('../src/services/apiKeys');
  const { solve } = require('../src/services/solver');
  apiKeys.setKey('curseforge', 'test-key');

  const realFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    const json = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (url.includes('api.modrinth.com') && url.includes('/project/sodium/version')) {
      return json([
        { version_type: 'release', loaders: ['fabric'], game_versions: ['1.20.1', '1.21.1'] },
        { version_type: 'release', loaders: ['forge'], game_versions: ['1.20.1'] },
      ]);
    }
    if (url.includes('api.modrinth.com') && url.includes('/project/sodium')) {
      return json({ slug: 'sodium', title: 'Sodium', icon_url: null });
    }
    if (url.includes('api.curseforge.com') && /\/mods\/\d+\/files/.test(url)) {
      return json({
        data: [
          {
            id: 1,
            displayName: 'a',
            fileName: 'a.jar',
            downloadUrl: 'x',
            releaseType: 1,
            gameVersions: ['1.20.1', 'Fabric'],
          },
          {
            id: 2,
            displayName: 'b',
            fileName: 'b.jar',
            downloadUrl: 'x',
            releaseType: 1,
            gameVersions: ['1.20.4', 'Fabric'],
          },
        ],
        pagination: { totalCount: 2 },
      });
    }
    if (url.includes('api.curseforge.com') && url.includes('/mods/search')) {
      return json({
        data: [{ id: 55, slug: 'cf-thing', name: 'CF Thing', classId: 6, downloadCount: 1, latestFiles: [] }],
      });
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`));
  };
  try {
    const out = await solve(['sodium', { platform: 'curseforge', ref: 'cf-thing' }]);
    assert.ok(out.best, 'a full-coverage pair exists');
    assert.equal(out.best.loader, 'fabric');
    assert.equal(out.best.mcVersion, '1.20.1'); // the only version both support on fabric
    assert.equal(out.perProject.length, 2);
    const cf = out.perProject.find((p) => p.platform === 'curseforge');
    assert.equal(cf.key, 'curseforge:cf-thing');
    assert.equal(cf.supported, true);
  } finally {
    globalThis.fetch = realFetch;
    db.run("DELETE FROM api_cache WHERE key LIKE 'curseforge:%' OR key LIKE 'modrinth:%'");
  }
});
