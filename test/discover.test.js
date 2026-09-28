'use strict';

// Discover feeds for the empty states: trending projects shaped exactly like
// search results (so the UI reuses its install flows), narrowed to the
// server's loader + MC. Outbound registry calls are stubbed per-host.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const modBrowser = require('../src/services/modBrowser');
const apiKeys = require('../src/services/apiKeys');

const realFetch = globalThis.fetch;
const upstreamCalls = [];
let upstreamRoutes = {};

function stubUpstream(routes) {
  upstreamRoutes = routes;
  upstreamCalls.length = 0;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url ? input.url : String(input);
    for (const [host, handler] of Object.entries(upstreamRoutes)) {
      if (url.includes(host)) {
        upstreamCalls.push(url);
        const body = handler(new URL(url), init);
        return Promise.resolve({ ok: true, status: 200, json: async () => body });
      }
    }
    return realFetch(input, init);
  };
}

function restoreFetch() {
  globalThis.fetch = realFetch;
  db.run("DELETE FROM api_cache WHERE key LIKE 'modrinth:%' OR key LIKE 'curseforge:%'");
}

const MODRINTH_HIT = {
  project_id: 'AAAA1111',
  slug: 'sodium',
  title: 'Sodium',
  description: 'rendering engine',
  icon_url: null,
  downloads: 500,
  categories: [],
  latest_version: '1.0',
};

const CF_MOD = {
  id: 4321,
  slug: 'jei',
  name: 'JEI',
  summary: 'item viewer',
  logo: null,
  downloadCount: 900,
  classId: 6,
  latestFiles: [],
};

let cookie;
let port = 27000;

function seed(id) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, ?, 'FABRIC', '1.20.1', ?, ?, 'x', 1024, 1536, 'stopped', '{}')`,
    id,
    id,
    port,
    port + 1
  );
  return id;
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test.after(async () => {
  await app.stop();
});

test('modrinth discover asks for downloads-sorted, loader/MC-narrowed projects', async () => {
  stubUpstream({ 'api.modrinth.com': () => ({ hits: [MODRINTH_HIT] }) });
  try {
    const results = await modBrowser.discover({ platform: 'modrinth', kind: 'mod', loader: 'fabric', mc: '1.20.1' });
    assert.equal(results.length, 1);
    assert.deepEqual(Object.keys(results[0]).sort(), [
      'description',
      'downloads',
      'iconUrl',
      'name',
      'platform',
      'projectId',
      'ref',
    ]);
    assert.equal(results[0].ref, 'sodium');
    const url = new URL(upstreamCalls[0]);
    assert.equal(url.searchParams.get('query'), '');
    assert.equal(url.searchParams.get('index'), 'downloads');
    const flat = JSON.parse(url.searchParams.get('facets')).flat();
    assert.ok(flat.includes('project_type:mod'));
    assert.ok(flat.includes('categories:fabric'));
    assert.ok(flat.includes('versions:1.20.1'));
    // Show More pages carry the offset through.
    upstreamCalls.length = 0;
    await modBrowser.discover({ platform: 'modrinth', kind: 'mod', loader: 'fabric', mc: '1.20.1', offset: 8 });
    assert.equal(new URL(upstreamCalls[0]).searchParams.get('offset'), '8');
  } finally {
    restoreFetch();
  }
});

test('curseforge discover asks for popular projects, same shape', async () => {
  apiKeys.setKey('curseforge', 'test-key-abc');
  stubUpstream({ 'api.curseforge.com': () => ({ data: [CF_MOD] }) });
  try {
    const results = await modBrowser.discover({ platform: 'curseforge', kind: 'mod', loader: 'forge', mc: '1.20.1' });
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, 'curseforge');
    assert.equal(results[0].ref, 'jei');
    const url = new URL(upstreamCalls[0]);
    assert.equal(url.searchParams.get('searchFilter'), '');
    assert.equal(url.searchParams.get('sortField'), '2');
    upstreamCalls.length = 0;
    await modBrowser.discover({ platform: 'curseforge', kind: 'mod', loader: 'forge', mc: '1.20.1', offset: 8 });
    assert.equal(new URL(upstreamCalls[0]).searchParams.get('index'), '8');
  } finally {
    restoreFetch();
  }
});

test('discover routes reject unknown platforms without touching registries', async () => {
  upstreamCalls.length = 0;
  for (const path of ['/api/mods/discover?platform=nope', '/api/packs/discover?platform=nope']) {
    const r = await app.req('GET', path, { cookie });
    assert.equal(r.status, 400, path);
  }
  assert.equal(upstreamCalls.length, 0, 'no upstream call on validation failure');
});

const CF_WORLD = {
  id: 777,
  slug: 'skyblock-island',
  name: 'Skyblock Island',
  summary: 'a floating island',
  logo: null,
  downloadCount: 42,
  classId: 999,
  latestFiles: [],
};

function stubCurseforgeWorlds(worldsClassId) {
  stubUpstream({
    'api.curseforge.com': (url) => {
      if (url.pathname.endsWith('/categories')) {
        return worldsClassId == null
          ? { data: [] }
          : { data: [{ id: worldsClassId, name: 'Worlds', slug: 'worlds', isClass: true, classId: worldsClassId }] };
      }
      return { data: [CF_WORLD] };
    },
  });
}

test('curseforge worlds search resolves the Worlds class live', async () => {
  apiKeys.setKey('curseforge', 'test-key-abc');
  // A deliberately odd id proves the search uses the resolved class, not a constant.
  stubCurseforgeWorlds(999);
  try {
    const curseforge = require('../src/services/curseforgeApi');
    const results = await curseforge.searchWorlds({ limit: 6 });
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Skyblock Island');
    const searchUrl = new URL(upstreamCalls.find((u) => u.includes('/mods/search')));
    assert.equal(searchUrl.searchParams.get('classId'), '999');
    assert.equal(searchUrl.searchParams.get('sortField'), '2');
  } finally {
    restoreFetch();
  }
});

test('curseforge worlds search falls back when categories fail', async () => {
  apiKeys.setKey('curseforge', 'test-key-abc');
  stubCurseforgeWorlds(null);
  try {
    const curseforge = require('../src/services/curseforgeApi');
    const results = await curseforge.searchWorlds({ limit: 6 });
    assert.equal(results.length, 1);
    const searchUrl = new URL(upstreamCalls.find((u) => u.includes('/mods/search')));
    assert.equal(searchUrl.searchParams.get('classId'), '17');
  } finally {
    restoreFetch();
  }
});

test('worlds discover routes validate without touching registries', async () => {
  upstreamCalls.length = 0;
  const badLimit = await app.req('GET', '/api/worlds/discover?limit=99', { cookie });
  assert.equal(badLimit.status, 400);
  const badSave = await app.req('POST', '/api/worlds/discover-save', { cookie, body: {} });
  assert.equal(badSave.status, 400);
  const badSaveId = await app.req('POST', '/api/worlds/discover-save', { cookie, body: { modId: -3 } });
  assert.equal(badSaveId.status, 400);
  assert.equal(upstreamCalls.length, 0, 'no upstream call on validation failure');
});

test('worlds discover lists trending worlds', async () => {
  apiKeys.setKey('curseforge', 'test-key-abc');
  stubCurseforgeWorlds(999);
  try {
    const r = await app.req('GET', '/api/worlds/discover', { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.results.length, 1);
    assert.equal(r.json.results[0].name, 'Skyblock Island');
    assert.equal(r.json.results[0].modId, 777);
    // Second pages carry the offset through to the registry.
    upstreamCalls.length = 0;
    const page2 = await app.req('GET', '/api/worlds/discover?offset=6', { cookie });
    assert.equal(page2.status, 200);
    const searchUrl = new URL(upstreamCalls.find((u) => u.includes('/mods/search')));
    assert.equal(searchUrl.searchParams.get('index'), '6');
  } finally {
    restoreFetch();
  }
});

test('worlds save accepts valid work as a task', async () => {
  // Accepted as a task (it fails later without a real registry behind it -
  // what matters is that validation let it through).
  const r = await app.req('POST', '/api/worlds/discover-save', {
    cookie,
    body: { modId: 777, name: 'Skyblock Island' },
  });
  assert.equal(r.status, 202);
  assert.ok(r.json.taskId);
});

test('the mods empty state carries the recommendations block', async () => {
  const id = seed('srv_disc_empty');
  const r = await app.req('GET', `/servers/${id}/mods`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /data-mods-discover/);
  assert.match(r.text, /data-discover-platform="modrinth"/);
});

test('the recommendations block stays with mods installed', async () => {
  const fsp = require('node:fs/promises');
  const path = require('node:path');
  const { dataPath } = require('../src/storage/pathGuard');
  const id = seed('srv_disc_full');
  const modDir = dataPath('servers', id, 'mods');
  await fsp.mkdir(modDir, { recursive: true });
  await fsp.writeFile(path.join(modDir, 'somemod.jar'), 'x');
  db.run(
    `INSERT INTO server_content (id, server_id, kind, managed_by, name, filename, version)
     VALUES ('sc_disc_full', ?, 'mod', 'overlay', 'Some Mod', 'somemod.jar', '1.0')`,
    id
  );
  const r = await app.req('GET', `/servers/${id}/mods`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /data-mod-row/);
  assert.match(r.text, /data-mods-discover/);
  assert.match(r.text, /data-discover-results/);
});

test('the modpacks page carries recommendations when nothing is installed', async () => {
  const r = await app.req('GET', '/modpacks', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /id="packs-recommended"/);
});

test('the worlds page carries recommendations when the library is empty', async () => {
  const r = await app.req('GET', '/worlds', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /id="worlds-recommended-grid"/);
});

test('the blueprints page carries recommendations when empty', async () => {
  const r = await app.req('GET', '/blueprints', { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /id="bp-recommended-grid"/);
  assert.match(r.text, /data-bp-platform="modrinth"/);
});
