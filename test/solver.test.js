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
