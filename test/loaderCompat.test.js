'use strict';

// Quilt runs Fabric mods: the loader-compat helper and every filter built on
// it must accept fabric-tagged builds for a Quilt server (and ONLY widen for
// Quilt - a Forge server must not start accepting fabric builds).

const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/env');
const { migrate } = require('../src/db/migrate');
migrate();
const { compatibleLoaders, loaderAccepts } = require('../src/utils/loaderCompat');
const modIdentify = require('../src/services/modIdentify');
const modrinth = require('../src/services/modrinthApi');
const db = require('../src/db');

test('compatibleLoaders widens quilt to quilt+fabric and nothing else', () => {
  assert.deepEqual(compatibleLoaders('quilt'), ['quilt', 'fabric']);
  assert.deepEqual(compatibleLoaders('QUILT'), ['quilt', 'fabric']);
  assert.deepEqual(compatibleLoaders('fabric'), ['fabric']);
  assert.deepEqual(compatibleLoaders('forge'), ['forge']);
  assert.deepEqual(compatibleLoaders(''), []);
  assert.deepEqual(compatibleLoaders(null), []);
});

test('loaderAccepts: quilt server accepts fabric builds, not the reverse', () => {
  assert.equal(loaderAccepts('quilt', ['fabric']), true);
  assert.equal(loaderAccepts('quilt', ['quilt']), true);
  assert.equal(loaderAccepts('fabric', ['quilt']), false);
  assert.equal(loaderAccepts('forge', ['fabric']), false);
  assert.equal(loaderAccepts('quilt', []), false);
});

test('verdictFor: a fabric-tagged mod is ok on a quilt server', () => {
  const identity = { kind: 'mod', loaders: ['fabric'], mcVersions: ['1.21.1'] };
  const v = modIdentify.verdictFor(identity, { kind: 'mod', loader: 'quilt', mc: '1.21.1' });
  assert.equal(v.status, 'ok');
  assert.equal(v.loaderOk, true);
  // and still wrong-loader on forge
  const w = modIdentify.verdictFor(identity, { kind: 'mod', loader: 'forge', mc: '1.21.1' });
  assert.equal(w.status, 'wrong-loader');
});

test('modrinth version lookups for quilt request both loader tags', async () => {
  const realFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    db.run("DELETE FROM api_cache WHERE key LIKE 'modrinth:%'");
    await modrinth.getVersions('sodium', { loader: 'quilt', mcVersion: '1.21.1' });
    const u = new URL(urls[0]);
    assert.deepEqual(JSON.parse(u.searchParams.get('loaders')), ['quilt', 'fabric']);

    urls.length = 0;
    await modrinth.search({ query: 'sodium', kind: 'mod', loader: 'quilt' }).catch(() => {});
    const facets = JSON.parse(new URL(urls[0]).searchParams.get('facets'));
    assert.ok(
      facets.some((g) => g.includes('categories:quilt') && g.includes('categories:fabric')),
      `expected an OR-group with both loaders, got ${JSON.stringify(facets)}`
    );
  } finally {
    globalThis.fetch = realFetch;
    db.run("DELETE FROM api_cache WHERE key LIKE 'modrinth:%'");
  }
});
