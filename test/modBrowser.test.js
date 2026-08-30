'use strict';

// Unified mod/plugin browser: kind pass-through to both platforms, plugin
// loader stripping, blocked-download flag, and the widened /api/mods/search
// + /api/mods/versions routes (which the per-server mods tab now uses).

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const modBrowser = require('../src/services/modBrowser');
const apiKeys = require('../src/services/apiKeys');

// Outbound registry calls are stubbed per-host; anything else (the in-process
// test server on 127.0.0.1) falls through to the real fetch.
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
  slug: 'worldedit',
  title: 'WorldEdit',
  description: 'edit worlds',
  icon_url: null,
  downloads: 5,
  categories: [],
  latest_version: '7.3',
};

const CF_MOD = {
  id: 4321,
  slug: 'worldedit',
  name: 'WorldEdit',
  summary: 'edit worlds',
  logo: null,
  downloadCount: 9,
  classId: 5,
  latestFiles: [],
};

// One shared admin session — /setup only works once per throwaway DB.
let cookie = '';
test('setup: boot app', async () => {
  await app.start();
  cookie = await app.adminCookie();
});

test('modBrowser.search passes plugin kind to Modrinth and drops the loader facet', async () => {
  stubUpstream({ 'api.modrinth.com': () => ({ hits: [MODRINTH_HIT] }) });
  try {
    const results = await modBrowser.search({
      query: 'worldedit',
      platform: 'modrinth',
      kind: 'plugin',
      loader: 'paper',
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, 'modrinth');
    assert.equal(results[0].ref, 'worldedit');
    const url = new URL(upstreamCalls[0]);
    const facets = JSON.parse(url.searchParams.get('facets'));
    const flat = facets.flat();
    assert.ok(flat.includes('categories:paper'), 'plugin category facet present');
    assert.ok(!flat.some((f) => f === 'categories:fabric' || f === 'project_type:plugin'), 'no bogus facets');
  } finally {
    restoreFetch();
  }
});

test('modBrowser.search sends plugin classId to CurseForge without a modLoaderType', async () => {
  apiKeys.setKey('curseforge', 'test-key-abc');
  stubUpstream({ 'api.curseforge.com': () => ({ data: [CF_MOD] }) });
  try {
    const results = await modBrowser.search({
      query: 'worldedit',
      platform: 'curseforge',
      kind: 'plugin',
      loader: 'paper',
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].projectId, '4321');
    const url = new URL(upstreamCalls[0]);
    assert.equal(url.searchParams.get('classId'), '5'); // bukkit-plugins class
    assert.equal(url.searchParams.get('modLoaderType'), null, 'loader stripped for plugins');
  } finally {
    restoreFetch();
  }
});

test('modBrowser.versions marks CF files without a downloadUrl as not downloadable', async () => {
  apiKeys.setKey('curseforge', 'test-key-abc');
  stubUpstream({
    'api.curseforge.com': (url) => {
      if (url.pathname.endsWith('/files'))
        return {
          data: [
            { id: 1, displayName: 'v2', fileName: 'we-2.jar', downloadUrl: null, gameVersions: [], releaseType: 1 },
            {
              id: 2,
              displayName: 'v1',
              fileName: 'we-1.jar',
              downloadUrl: 'https://cdn/x.jar',
              gameVersions: [],
              releaseType: 1,
            },
          ],
        };
      return { data: [CF_MOD] }; // slug search from metaFor
    },
  });
  try {
    const versions = await modBrowser.versions({
      platform: 'curseforge',
      ref: 'worldedit',
      kind: 'plugin',
      loader: 'paper',
    });
    assert.equal(versions.length, 2);
    assert.equal(versions[0].downloadable, false);
    assert.equal(versions[1].downloadable, true);
  } finally {
    restoreFetch();
  }
});

test('modBrowser.versions resolves a bare CF plugin slug under the bukkit-plugins class', async () => {
  apiKeys.setKey('curseforge', 'test-key-abc');
  // The slug exists ONLY in classId 5 — resolving it under mc-mods (classId 6,
  // the pre-fix behavior for bare slugs) returns nothing and 404s the install.
  stubUpstream({
    'api.curseforge.com': (url) => {
      if (url.pathname.endsWith('/files'))
        return {
          data: [
            {
              id: 9,
              displayName: 'v1',
              fileName: 'wg-1.jar',
              downloadUrl: 'https://cdn/wg.jar',
              gameVersions: [],
              releaseType: 1,
            },
          ],
        };
      return url.searchParams.get('classId') === '5' ? { data: [CF_MOD] } : { data: [] };
    },
  });
  try {
    const versions = await modBrowser.versions({
      platform: 'curseforge',
      ref: 'worldedit',
      kind: 'plugin',
      loader: 'paper',
    });
    assert.equal(versions.length, 1);
    const slugSearches = upstreamCalls.filter((u) => u.includes('/mods/search'));
    assert.ok(slugSearches.length >= 1);
    assert.equal(
      new URL(slugSearches[0]).searchParams.get('classId'),
      '5',
      'plugin slug resolved in bukkit-plugins first'
    );
  } finally {
    restoreFetch();
  }
});

test('GET /api/mods/search accepts kind=plugin with loader=paper (route no longer 400s)', async () => {
  stubUpstream({ 'api.modrinth.com': () => ({ hits: [MODRINTH_HIT] }) });
  try {
    const r = await app.req('GET', '/api/mods/search?q=worldedit&kind=plugin&loader=paper&platform=modrinth', {
      cookie,
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.results[0].name, 'WorldEdit');
  } finally {
    restoreFetch();
  }
});

test('GET /api/mods/search rejects an unknown kind or loader', async () => {
  const badKind = await app.req('GET', '/api/mods/search?q=x&kind=warez', { cookie });
  assert.equal(badKind.status, 400);
  const badLoader = await app.req('GET', '/api/mods/search?q=x&loader=bedrock', { cookie });
  assert.equal(badLoader.status, 400);
});

test('GET /api/mods/search with platform=curseforge and no key answers 412', async () => {
  apiKeys.deleteKey('curseforge');
  const r = await app.req('GET', '/api/mods/search?q=worldedit&platform=curseforge', { cookie });
  assert.equal(r.status, 412);
  assert.match(r.json.error || '', /API key/i);
});

test('GET /api/servers/:id/mods carries platform + projectId provenance', async () => {
  const sid = app.seedServer('srv_modprov');
  const fs = require('node:fs');
  const path = require('node:path');
  const { dataPath } = require('../src/storage/pathGuard');
  const dir = dataPath('servers', sid, 'plugins');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'worldedit-7.3.jar'), 'jar-bytes');
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, version)
     VALUES ('lib_wet1', 'plugin', 'WorldEdit', 'worldedit-7.3.jar', 'library/mods/deadbeef-worldedit.jar', 'deadbeef', 9, 'modrinth', 'AAAA1111', '7.3')`
  );
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename)
     VALUES ('sc_wet1', ?, 'lib_wet1', 'plugin', 'overlay', 'WorldEdit', 'worldedit-7.3.jar')`,
    sid
  );
  const r = await app.req('GET', `/api/servers/${sid}/mods`, { cookie });
  assert.equal(r.status, 200);
  const item = r.json.mods.find((m) => m.file === 'worldedit-7.3.jar');
  assert.ok(item, 'installed row present');
  assert.equal(item.platform, 'modrinth');
  assert.equal(item.projectId, 'AAAA1111');
});

test('teardown: stop app', async () => {
  await app.stop();
});
