'use strict';

// The pure half of version compatibility (#52): turning an inventory plus a
// support map into "which Minecraft versions can this server actually move to".
// No network, no disk - every fixture here is a hand-built support map, so the
// rules (loader pairing, unknown jars, the compatibility ceiling) are pinned
// exactly.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const compat = require('../src/services/compat');

const JEI = { file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' };
const SODIUM = { file: 'sodium.jar', name: 'Sodium', platform: 'modrinth', projectId: 'AANobbMI' };
const MYSTERY = { file: 'some-private-build.jar', name: 'some-private-build', platform: null, projectId: null };

function support(entries) {
  return new Map(Object.entries(entries).map(([key, versions]) => [key, { versions }]));
}

test('supportsVersion pairs loader with version, never either alone', () => {
  const map = { versions: { '1.20.1': ['forge'], '1.21.1': ['neoforge'] } };
  assert.equal(compat.supportsVersion(map, '1.20.1', 'forge'), true);
  // The trap this whole feature exists for: the project DOES support 1.21.1,
  // but only on NeoForge, so a Forge server cannot follow it there.
  assert.equal(compat.supportsVersion(map, '1.21.1', 'forge'), false);
  assert.equal(compat.supportsVersion(map, '1.21.1', 'neoforge'), true);
  assert.equal(compat.supportsVersion(map, '1.21.4', 'forge'), false);
});

test('supportsVersion lets Quilt run Fabric builds, and honours a loaderless build', () => {
  assert.equal(compat.supportsVersion({ versions: { '1.20.1': ['fabric'] } }, '1.20.1', 'quilt'), true);
  assert.equal(compat.supportsVersion({ versions: { '1.20.1': ['fabric'] } }, '1.20.1', 'forge'), false);
  // CurseForge "Any" (modLoader 0) is stored as null and must not be treated
  // as an incompatibility.
  assert.equal(compat.supportsVersion({ versions: { '1.20.1': [null] } }, '1.20.1', 'forge'), true);
  // A server with no loader at all (vanilla-ish) accepts any build.
  assert.equal(compat.supportsVersion({ versions: { '1.20.1': ['fabric'] } }, '1.20.1', null), true);
});

test('supportsVersion treats a missing project as unsupported, never as a pass', () => {
  assert.equal(compat.supportsVersion(null, '1.20.1', 'forge'), false);
  assert.equal(compat.supportsVersion({}, '1.20.1', 'forge'), false);
});

test('buildMatrix splits ready and missing per version and finds the ceiling', () => {
  const items = [JEI, SODIUM];
  const map = support({
    'curseforge:238222': { '1.20.2': ['forge'], '1.20.4': ['forge'], '1.21.1': ['forge'] },
    'modrinth:AANobbMI': { '1.20.2': ['forge'], '1.20.4': ['forge'] },
  });
  const matrix = compat.buildMatrix(items, map, {
    loader: 'forge',
    mcVersion: '1.20.1',
    candidates: ['1.20.2', '1.20.4', '1.21.1'],
  });

  assert.equal(matrix.versions[0].status, 'ready');
  assert.equal(matrix.versions[1].status, 'ready');
  assert.equal(matrix.versions[2].status, 'blocked');
  assert.deepEqual(
    matrix.versions[2].missing.map((m) => m.name),
    ['Sodium']
  );
  // The newest version EVERY mod can follow - not the newest that exists.
  assert.equal(matrix.highestCompatible, '1.20.4');
  assert.equal(matrix.knownCount, 2);
  assert.equal(matrix.unknownCount, 0);
});

test('one unidentifiable jar makes every version unknown and kills the ceiling', () => {
  const map = support({ 'curseforge:238222': { '1.20.2': ['forge'] } });
  const matrix = compat.buildMatrix([JEI, MYSTERY], map, {
    loader: 'forge',
    mcVersion: '1.20.1',
    candidates: ['1.20.2'],
  });
  assert.equal(matrix.versions[0].status, 'unknown');
  assert.equal(matrix.versions[0].readyCount, 1);
  assert.equal(matrix.versions[0].missingCount, 0);
  assert.equal(matrix.unknownCount, 1);
  assert.equal(matrix.highestCompatible, null, 'an unknown jar must never yield a ceiling');
  assert.deepEqual(
    matrix.unknown.map((u) => u.file),
    ['some-private-build.jar']
  );
});

test('the ceiling is the newest ready version even when a later one is blocked', () => {
  const map = support({
    'curseforge:238222': { '1.20.2': ['forge'], '1.21.1': ['forge'] },
    'modrinth:AANobbMI': { '1.20.2': ['forge'], '1.21.1': ['forge'] },
  });
  const matrix = compat.buildMatrix([JEI, SODIUM], map, {
    loader: 'forge',
    mcVersion: '1.20.1',
    // 1.20.4 is a hole: neither mod publishes for it.
    candidates: ['1.20.2', '1.20.4', '1.21.1'],
  });
  assert.deepEqual(
    matrix.versions.map((v) => v.status),
    ['ready', 'blocked', 'ready']
  );
  assert.equal(matrix.highestCompatible, '1.21.1');
});

test('a mod no registry answered for is never called incompatible', () => {
  // Hangar / SpigotMC / GitHub projects, and projects a registry has dropped,
  // have no per-version build list to read. Reporting "no build for 1.21.1"
  // about one would be inventing an answer nobody gave - and would block an
  // upgrade on it.
  const HANGAR = { file: 'EssentialsX.jar', name: 'EssentialsX', platform: 'hangar', projectId: 'EssentialsX' };
  const map = support({ 'curseforge:238222': { '1.21.1': ['forge'] } });
  const matrix = compat.buildMatrix([JEI, HANGAR], map, {
    loader: 'forge',
    mcVersion: '1.20.1',
    candidates: ['1.21.1'],
  });
  assert.deepEqual(matrix.versions[0].missing, [], 'nothing may be called missing on no evidence');
  assert.equal(matrix.versions[0].status, 'unknown');
  assert.equal(matrix.knownCount, 1, 'only the answered-for mod counts as checked');
  assert.deepEqual(
    matrix.unchecked.map((m) => m.name),
    ['EssentialsX']
  );
  assert.deepEqual(matrix.unknown, [], 'it WAS identified - it just could not be checked');
  assert.equal(matrix.unknownCount, 1, 'the gate counts it the same either way');
  assert.equal(matrix.highestCompatible, null);
});

test('a server with no mods has no blockers and no ceiling of its own', () => {
  const matrix = compat.buildMatrix([], new Map(), {
    loader: 'forge',
    mcVersion: '1.20.1',
    candidates: ['1.20.2'],
  });
  assert.equal(matrix.modCount, 0);
  assert.equal(matrix.versions[0].status, 'ready');
  assert.equal(matrix.highestCompatible, '1.20.2');
});

test('isPlainVersion keeps releases and rejects snapshots and pre-releases', () => {
  for (const v of ['1.20.1', '1.21', '26.3', '1.7.10']) assert.equal(compat.isPlainVersion(v), true, v);
  for (const v of ['26.3-rc-1', '1.21.2-pre1', '23w13a', 'Fabric 0.15', '']) {
    assert.equal(compat.isPlainVersion(v), false, v);
  }
});
