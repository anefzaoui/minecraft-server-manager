'use strict';

// Bug 2 — "custom zip native loader": a fully pre-installed server zip (a
// locally-prepared pack, e.g. FTB StoneBlock 4) must be detected so MSM pins
// the container to the loader build already inside the archive instead of
// reinstalling/replacing it.

require('./helpers/env'); // isolate DATA_DIR before any src/ require
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
const contentZip = require('../src/services/contentZip');
const { tempZip, jarBuffer } = require('./helpers/zipfix');

// previewStandalone() identifies jars, which reads the api_keys table for a
// CurseForge key. node:test gives each file a fresh temp DATA_DIR, so migrate
// the throwaway DB here instead of relying on another test file running first.
migrate();

// Layout a neoforge 1.20.1 / 21.1.248 pre-installed server directory.
function neoforgeEntries() {
  return {
    'libraries/net/neoforged/neoforge/21.1.248/unix_args.txt': '[neoforge]',
    'libraries/io/netty/netty-common/4.1.97.Final/netty-common-4.1.97.Final.jar': 'x',
    'mods/some-mod.jar': 'x',
    'versions/1.20.1/1.20.1.json': '{}',
    'server.properties': 'motd=hello',
    'eula.txt': 'eula=true',
  };
}

test('detectNativeLoader: neoforge pre-installed server zip (path-based)', async () => {
  const zip = await tempZip('sb4.zip', neoforgeEntries());
  const got = await contentZip.detectNativeLoader(zip);
  assert.deepEqual(got, {
    isPreparedServer: true,
    loader: 'neoforge',
    loaderVersion: '21.1.248',
    mcVersion: '1.20.1',
  });
});

test('detectNativeLoader: forge zip yields MC version from the forge path', async () => {
  const zip = await tempZip('forge-srv.zip', {
    'libraries/net/minecraftforge/forge/1.20.1-47.2.20/unix_args.txt': '[forge]',
    'versions/1.20.1/1.20.1.json': '{}',
    'eula.txt': 'eula=true',
  });
  const got = await contentZip.detectNativeLoader(zip);
  assert.equal(got.isPreparedServer, true);
  assert.equal(got.loader, 'forge');
  assert.equal(got.loaderVersion, '47.2.20');
  assert.equal(got.mcVersion, '1.20.1');
});

test('detectNativeLoader: fabric loader libraries are recognized', async () => {
  const zip = await tempZip('fabric-srv.zip', {
    'libraries/net/fabricmc/fabric-loader/0.15.11/fabric-loader-0.15.11.jar': 'x',
    'versions/1.20.4/1.20.4.json': '{}',
    'eula.txt': 'eula=true',
  });
  const got = await contentZip.detectNativeLoader(zip);
  assert.equal(got.loader, 'fabric');
  assert.equal(got.loaderVersion, '0.15.11');
  assert.equal(got.mcVersion, '1.20.4');
});

test('detectNativeLoader: loose mod jars are NOT a pre-installed server', async () => {
  const a = await jarBuffer({ 'fabric.mod.json': JSON.stringify({ id: 'a', name: 'A', version: '1' }) });
  const zip = await tempZip('mods.zip', { 'mods/a.jar': a });
  const got = await contentZip.detectNativeLoader(zip);
  assert.deepEqual(got, { isPreparedServer: false, loader: null, loaderVersion: null, mcVersion: null });
});

test('detectNativeLoader: tagged fabric loader (common in FTB fabric exports)', async () => {
  const zip = await tempZip('fabric-tagged.zip', {
    'libraries/net/fabricmc/fabric-loader/0.15.11-fabricmod.2.4/fabric-loader-0.15.11-fabricmod.2.4.jar': 'x',
    'versions/1.20.4/1.20.4.json': '{}',
    'eula.txt': 'eula=true',
  });
  const got = await contentZip.detectNativeLoader(zip);
  assert.equal(got.loader, 'fabric');
  assert.equal(got.loaderVersion, '0.15.11-fabricmod.2.4');
  assert.equal(got.mcVersion, '1.20.4');
});

test('previewStandalone: jar zip exposes native detection to the wizard', async () => {
  const jar = await jarBuffer({ 'fabric.mod.json': JSON.stringify({ id: 'a', name: 'A', version: '1' }) });
  const zip = await tempZip('sb4.zip', {
    ...neoforgeEntries(),
    'mods/a.jar': jar,
  });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com') || url.includes('api.curseforge.com')) {
      return Promise.reject(new Error('offline'));
    }
    return realFetch(input);
  };
  try {
    const p = await contentZip.previewStandalone(zip);
    assert.equal(p.type, 'jars');
    assert.equal(p.native.isPreparedServer, true);
    assert.equal(p.native.loader, 'neoforge');
    assert.equal(p.native.loaderVersion, '21.1.248');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('previewStandalone: plain mods zip reports non-native', async () => {
  const a = await jarBuffer({ 'fabric.mod.json': JSON.stringify({ id: 'a', name: 'A', version: '1' }) });
  const zip = await tempZip('mods.zip', { 'mods/a.jar': a });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    if (url.includes('api.modrinth.com') || url.includes('api.curseforge.com')) {
      return Promise.reject(new Error('offline'));
    }
    return realFetch(input);
  };
  try {
    const p = await contentZip.previewStandalone(zip);
    assert.equal(p.type, 'jars');
    assert.equal(p.native.isPreparedServer, false);
    assert.equal(p.native.loader, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});
