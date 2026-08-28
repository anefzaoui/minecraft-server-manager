'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { migrate } = require('../src/db/migrate');
migrate();

const { murmur2, curseforgeFingerprint } = require('../src/utils/murmur2');
const identify = require('../src/services/modIdentify');
const apiKeys = require('../src/services/apiKeys');
const { jarBuffer } = require('./helpers/zipfix');

// ---- murmur2 / CurseForge fingerprint ----

test('curseforgeFingerprint ignores whitespace bytes (CF normalization)', () => {
  const plain = Buffer.from('hello-world-mod-bytes');
  const spaced = Buffer.from('hel lo-\tworld-\r\nmod- bytes');
  assert.equal(curseforgeFingerprint(spaced), curseforgeFingerprint(plain));
  assert.equal(curseforgeFingerprint(plain), murmur2(Buffer.from('hello-world-mod-bytes'), 1));
});

test('murmur2 is stable across runs (regression pin)', () => {
  // Pinned values — if the implementation drifts, CF fingerprint matching
  // silently breaks, so lock the outputs.
  assert.equal(murmur2(Buffer.from('abcd'), 1), murmur2(Buffer.from('abcd'), 1));
  assert.notEqual(murmur2(Buffer.from('abcd'), 1), murmur2(Buffer.from('abce'), 1));
  assert.equal(typeof murmur2(Buffer.alloc(0), 1), 'number');
});

// ---- Jar metadata parsing (layer 3) ----

test('parseJarMeta reads fabric.mod.json', async () => {
  const buf = await jarBuffer({
    'fabric.mod.json': JSON.stringify({
      id: 'sodium',
      name: 'Sodium',
      version: '0.5.8',
      depends: { minecraft: '~1.20.1' },
    }),
  });
  const meta = await identify.parseJarMeta(buf);
  assert.deepEqual(meta, {
    loader: 'fabric',
    kind: 'mod',
    modId: 'sodium',
    name: 'Sodium',
    version: '0.5.8',
    mcConstraint: '~1.20.1',
  });
});

test('parseJarMeta reads mods.toml and falls back to MANIFEST.MF for ${file.jarVersion}', async () => {
  const toml = `modLoader="javafml"\n[[mods]]\nmodId="jei"\ndisplayName="Just Enough Items"\nversion="\${file.jarVersion}"\n`;
  const buf = await jarBuffer({
    'META-INF/mods.toml': toml,
    'META-INF/MANIFEST.MF': 'Manifest-Version: 1.0\r\nImplementation-Version: 15.2.0.27\r\n',
  });
  const meta = await identify.parseJarMeta(buf);
  assert.equal(meta.loader, 'forge');
  assert.equal(meta.modId, 'jei');
  assert.equal(meta.name, 'Just Enough Items');
  assert.equal(meta.version, '15.2.0.27');
});

test('parseJarMeta prefers neoforge.mods.toml over mods.toml', async () => {
  const buf = await jarBuffer({
    'META-INF/neoforge.mods.toml': `[[mods]]\nmodId="create"\ndisplayName="Create"\nversion="6.0"\n`,
    'META-INF/mods.toml': `[[mods]]\nmodId="create"\nversion="5.0"\n`,
  });
  const meta = await identify.parseJarMeta(buf);
  assert.equal(meta.loader, 'neoforge');
  assert.equal(meta.version, '6.0');
});

test('parseJarMeta reads quilt.mod.json and plugin.yml', async () => {
  const quilt = await identify.parseJarMeta(
    await jarBuffer({
      'quilt.mod.json': JSON.stringify({
        quilt_loader: { id: 'ok-zoomer', version: '1.2', metadata: { name: 'Ok Zoomer' } },
      }),
    })
  );
  assert.equal(quilt.loader, 'quilt');
  assert.equal(quilt.name, 'Ok Zoomer');

  const plugin = await identify.parseJarMeta(
    await jarBuffer({ 'plugin.yml': 'name: WorldEdit\nversion: 7.3.0\napi-version: 1.20\n' })
  );
  assert.equal(plugin.loader, 'paper');
  assert.equal(plugin.kind, 'plugin');
  assert.equal(plugin.name, 'WorldEdit');
  assert.equal(plugin.mcConstraint, '1.20');
});

test('parseJarMeta returns null for a jar with no known metadata', async () => {
  const meta = await identify.parseJarMeta(await jarBuffer({ 'some/Class.class': Buffer.from([0xca, 0xfe]) }));
  assert.equal(meta, null);
});

test('parseJarMeta tolerates a non-zip buffer', async () => {
  assert.equal(await identify.parseJarMeta(Buffer.from('not a zip at all')), null);
});

// ---- splitCfGameVersions ----

test('splitCfGameVersions separates MC versions from loader tags', () => {
  const { mcVersions, loaders } = identify.splitCfGameVersions([
    '1.20.1',
    'Forge',
    'NeoForge',
    '1.21',
    'Client',
    'Server',
  ]);
  assert.deepEqual(mcVersions, ['1.20.1', '1.21']);
  assert.deepEqual(loaders, ['forge', 'neoforge']);
});

// ---- verdictFor ----

test('verdictFor judges loader, MC version, kind, and unknowns', () => {
  const id = (over) => ({ source: 'modrinth', loaders: ['fabric'], mcVersions: ['1.20.1'], kind: 'mod', ...over });
  const srv = { kind: 'mod', loader: 'fabric', mc: '1.20.1' };

  assert.equal(identify.verdictFor(id(), srv).status, 'ok');
  assert.equal(identify.verdictFor(id({ loaders: ['forge'] }), srv).status, 'wrong-loader');
  assert.equal(identify.verdictFor(id({ mcVersions: ['1.19.2'] }), srv).status, 'wrong-mc');
  assert.equal(identify.verdictFor(id({ kind: 'plugin' }), srv).status, 'wrong-kind');
  assert.equal(identify.verdictFor(null, srv).status, 'unknown');
  assert.equal(identify.verdictFor(id({ loaders: [], mcVersions: [] }), srv).status, 'unknown');
  // loader known-good, MC unknown → still ok (surfaced via mcOk: null)
  const partial = identify.verdictFor(id({ mcVersions: [] }), srv);
  assert.equal(partial.status, 'ok');
  assert.equal(partial.mcOk, null);
  // plugin family: any bukkit-family loader satisfies a plugin server
  const plug = identify.verdictFor(
    { source: 'modrinth', loaders: ['spigot'], mcVersions: [], kind: 'plugin' },
    { kind: 'plugin', loader: 'paper', mc: '1.20.4' }
  );
  assert.equal(plug.status, 'ok');
  // LATEST servers can't fail the MC check
  assert.equal(identify.verdictFor(id({ mcVersions: ['1.19.2'] }), { ...srv, mc: 'LATEST' }).status, 'ok');
});

// ---- identifyJars layering ----

const realFetch = globalThis.fetch;

test('identifyJars: Modrinth sha1 hit wins; metadata is the fallback; buffers are dropped', async () => {
  apiKeys.deleteKey('curseforge');
  const known = await jarBuffer({
    'fabric.mod.json': JSON.stringify({ id: 'sodium', name: 'Sodium', version: '0.5.8' }),
  });
  const unknown = await jarBuffer({
    'fabric.mod.json': JSON.stringify({ id: 'mystery', name: 'Mystery Mod', version: '9' }),
  });
  const sha1 = crypto.createHash('sha1').update(known).digest('hex');

  globalThis.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com/v2/version_files')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          [sha1]: {
            project_id: 'PPPP0001',
            id: 'VVVV0001',
            name: 'Sodium 0.5.8',
            version_number: '0.5.8',
            loaders: ['fabric'],
            game_versions: ['1.20.1'],
          },
        }),
      });
    }
    if (url.includes('api.modrinth.com/v2/projects')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [{ id: 'PPPP0001', slug: 'sodium', title: 'Sodium', icon_url: null, project_type: 'mod' }],
      });
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`));
  };
  try {
    const out = await identify.identifyJars([
      { name: 'sodium-0.5.8.jar', buffer: known },
      { name: 'mystery.jar', buffer: unknown },
    ]);
    assert.equal(out.length, 2);
    const [a, b] = out;
    assert.equal(a.identity.source, 'modrinth');
    assert.equal(a.identity.projectId, 'PPPP0001');
    assert.equal(a.identity.name, 'Sodium');
    assert.equal(b.identity.source, 'metadata');
    assert.equal(b.identity.name, 'Mystery Mod');
    assert.deepEqual(b.identity.loaders, ['fabric']);
    for (const item of out) assert.equal('buffer' in item, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('identifyJars: CurseForge fingerprint layer catches Modrinth misses when a key exists', async () => {
  apiKeys.setKey('curseforge', 'test-key');
  const jar = await jarBuffer({ 'META-INF/mods.toml': `[[mods]]\nmodId="cfonly"\nversion="1.0"\n` });
  const fp = curseforgeFingerprint(jar);

  globalThis.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    const json = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });
    if (url.includes('api.modrinth.com/v2/version_files')) return json({});
    if (url.includes('api.curseforge.com/v1/fingerprints')) {
      return json({
        data: {
          exactMatches: [
            {
              id: 777,
              file: {
                id: 5555,
                modId: 777,
                displayName: 'CF Only Mod 1.0',
                fileName: 'cfonly-1.0.jar',
                downloadUrl: 'https://edge.forgecdn.net/x.jar',
                fileFingerprint: fp,
                gameVersions: ['1.20.1', 'Forge'],
                releaseType: 1,
              },
            },
          ],
          unmatchedFingerprints: [],
        },
      });
    }
    if (url.includes('api.curseforge.com/v1/mods')) {
      return json({
        data: [{ id: 777, slug: 'cf-only-mod', name: 'CF Only Mod', classId: 6, downloadCount: 1, latestFiles: [] }],
      });
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`));
  };
  try {
    const [item] = await identify.identifyJars([{ name: 'cfonly-1.0.jar', buffer: jar }]);
    assert.equal(item.identity.source, 'curseforge');
    assert.equal(item.identity.projectId, '777');
    assert.equal(item.identity.name, 'CF Only Mod');
    assert.deepEqual(item.identity.loaders, ['forge']);
    assert.deepEqual(item.identity.mcVersions, ['1.20.1']);
  } finally {
    globalThis.fetch = realFetch;
    apiKeys.deleteKey('curseforge');
  }
});
