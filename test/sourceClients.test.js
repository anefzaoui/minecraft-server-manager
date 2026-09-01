'use strict';

// The three keyless plugin sources (Hangar, Spiget, GitHub Releases) and the
// add-by-link routing that feeds them.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const mods = require('../src/services/mods');
const library = require('../src/services/library');
const githubApi = require('../src/services/githubApi');
const spigetApi = require('../src/services/spigetApi');
const hangarApi = require('../src/services/hangarApi');

const realFetch = globalThis.fetch;
function stubFetch(handler) {
  globalThis.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input.url || input);
    const out = handler(url, init);
    if (!out) throw new Error(`unexpected fetch in test: ${url}`);
    return out;
  };
}
test.afterEach(() => {
  globalThis.fetch = realFetch;
  db.run("DELETE FROM api_cache WHERE key LIKE 'github:%' OR key LIKE 'spiget:%' OR key LIKE 'hangar:%'");
});

test('setup', async () => {
  await app.start();
});

// ---- ref parsing ------------------------------------------------------------

test('parseRepoRef reads every GitHub URL shape people paste', () => {
  assert.deepEqual(githubApi.parseRepoRef('EssentialsX/Essentials'), {
    repo: 'EssentialsX/Essentials',
    tag: null,
    asset: null,
  });
  assert.deepEqual(githubApi.parseRepoRef('https://github.com/EssentialsX/Essentials'), {
    repo: 'EssentialsX/Essentials',
    tag: null,
    asset: null,
  });
  assert.deepEqual(githubApi.parseRepoRef('https://github.com/EssentialsX/Essentials/releases/tag/2.21.0'), {
    repo: 'EssentialsX/Essentials',
    tag: '2.21.0',
    asset: null,
  });
  assert.deepEqual(
    githubApi.parseRepoRef('https://github.com/EssentialsX/Essentials/releases/download/2.21.0/EssentialsX-2.21.0.jar'),
    { repo: 'EssentialsX/Essentials', tag: '2.21.0', asset: 'EssentialsX-2.21.0.jar' }
  );
  assert.equal(githubApi.parseRepoRef('https://github.com/onlyowner'), null);
  assert.equal(githubApi.parseRepoRef('not a repo'), null);
});

test('parseResourceRef reads SpigotMC id forms incl. pinned versions', () => {
  assert.deepEqual(spigetApi.parseResourceRef('28140'), { resourceId: 28140, versionId: null });
  assert.deepEqual(spigetApi.parseResourceRef('luckperms.28140'), { resourceId: 28140, versionId: null });
  assert.deepEqual(spigetApi.parseResourceRef('https://www.spigotmc.org/resources/luckperms.28140/'), {
    resourceId: 28140,
    versionId: null,
  });
  assert.deepEqual(spigetApi.parseResourceRef('https://www.spigotmc.org/resources/28140?version=555'), {
    resourceId: 28140,
    versionId: '555',
  });
  assert.equal(spigetApi.parseResourceRef('https://example.com/x'), null);
});

test('hangar compatibleWith matches exact and bare-minor tags', () => {
  assert.equal(hangarApi.compatibleWith(['1.21', '1.20.6'], '1.21.4'), true);
  assert.equal(hangarApi.compatibleWith(['1.20.6'], '1.21.4'), false);
  assert.equal(hangarApi.compatibleWith(['1.21.4'], '1.21.4'), true);
  assert.equal(hangarApi.compatibleWith(['1.21'], '1.2.5'), false); // "1.2" must not prefix-match "1.21"
});

test('classifyModSource routes the new hosts', () => {
  assert.equal(mods.classifyModSource('https://hangar.papermc.io/ViaVersion/ViaVersion').kind, 'hangar');
  assert.equal(mods.classifyModSource('https://www.spigotmc.org/resources/luckperms.28140/').kind, 'spiget');
  assert.equal(mods.classifyModSource('https://github.com/EssentialsX/Essentials/releases').kind, 'github');
  assert.equal(mods.classifyModSource('EssentialsX/Essentials').kind, 'github');
  assert.equal(mods.classifyModSource('sodium_extra').kind, 'modrinth');
  assert.equal(mods.classifyModSource('https://example.com/some.jar').kind, 'direct');
});

// ---- GitHub ETag cache ------------------------------------------------------

test('github client revalidates with If-None-Match and serves 304s from cache', async () => {
  const releases = [{ tag_name: 'v1', name: 'v1', draft: false, prerelease: false, html_url: 'x', assets: [] }];
  let calls = 0;
  stubFetch((url, init) => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify(releases), { status: 200, headers: { etag: '"abc123"' } });
    }
    assert.equal(init.headers['If-None-Match'], '"abc123"');
    return new Response(null, { status: 304 });
  });
  const first = await githubApi.getReleases('owner/repo');
  assert.equal(first[0].tag, 'v1');
  // Age the cache row past the TTL so the client must revalidate.
  db.run("UPDATE api_cache SET fetched_at = datetime('now', '-1 hour') WHERE key LIKE 'github:%'");
  const second = await githubApi.getReleases('owner/repo');
  assert.equal(second[0].tag, 'v1');
  assert.equal(calls, 2);
});

test('github rate limiting falls back to cache, else 429s with reset hint', async () => {
  stubFetch(
    () =>
      new Response('{}', { status: 403, headers: { 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 120) } })
  );
  await assert.rejects(githubApi.getReleases('owner/fresh'), /rate-limiting.*GITHUB_TOKEN/s);
});

// ---- install routing through stubbed registries -----------------------------

let libSeq = 0;
function captureDownloads() {
  const captured = [];
  const real = library.downloadToLibrary;
  // server_content.library_id is a real FK - insert an actual row.
  library.downloadToLibrary = async (url, meta) => {
    captured.push({ url, meta });
    const id = `lib_t${++libSeq}`;
    db.run(
      `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, version)
       VALUES (?, 'mod', ?, ?, ?, ?, 10, ?)`,
      id,
      meta.name || 'x',
      meta.filename || 'file.jar',
      `library/mods/${id}.jar`,
      `${id}-hash`,
      meta.version || null
    );
    return db.get('SELECT * FROM library_files WHERE id = ?', id);
  };
  const realInstall = library.installToServer;
  library.installToServer = async () => ({
    installedPath: '/x',
    filename: (captured[0] && (captured[0].meta.filename || 'file.jar')) || 'file.jar',
  });
  const restore = () => {
    library.downloadToLibrary = real;
    library.installToServer = realInstall;
  };
  return { captured, restore };
}

test('hangar install picks a compatible version and carries its sha256', async () => {
  const sid = app.seedServer('srv_hangar1');
  db.run("UPDATE servers SET type = 'PAPER', mc_version = '1.21.4' WHERE id = ?", sid);
  stubFetch((url) => {
    if (url.includes('/api/v1/projects/ViaVersion/versions')) {
      return Response.json({
        result: [
          {
            name: '5.0.0',
            createdAt: '2026-08-01T00:00:00Z',
            channel: { name: 'Release' },
            platformDependencies: { PAPER: ['1.21'] },
            downloads: {
              PAPER: {
                fileInfo: { name: 'ViaVersion-5.0.0.jar', sizeBytes: 5, sha256Hash: 'e'.repeat(64) },
                downloadUrl: 'https://hangarcdn.papermc.io/ViaVersion-5.0.0.jar',
                externalUrl: null,
              },
            },
          },
        ],
      });
    }
    if (url.includes('/api/v1/projects/ViaVersion')) {
      return Response.json({
        name: 'ViaVersion',
        namespace: { owner: 'ViaVersion', slug: 'ViaVersion' },
        stats: { downloads: 1 },
        avatarUrl: null,
        description: 'x',
      });
    }
    return null;
  });
  const { captured, restore } = captureDownloads();
  try {
    await mods.installFromUrl(sid, 'https://hangar.papermc.io/ViaVersion/ViaVersion', { actor: 'test' });
  } finally {
    restore();
  }
  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, 'https://hangarcdn.papermc.io/ViaVersion-5.0.0.jar');
  assert.equal(captured[0].meta.platform, 'hangar');
  assert.deepEqual(captured[0].meta.expectedHashes, { sha256: 'e'.repeat(64) });
});

test('spiget install uses the Cloudflare-dodging proxy URL; external resources 409', async () => {
  const sid = app.seedServer('srv_spiget1');
  db.run("UPDATE servers SET type = 'PAPER', mc_version = '1.21.4' WHERE id = ?", sid);
  const resource = (external) => ({
    id: 28140,
    name: 'LuckPerms',
    tag: 'perms',
    downloads: 1,
    icon: { url: 'data/icon.jpg' },
    testedVersions: ['1.21'],
    external,
    file: external ? { type: 'external' } : { type: '.jar' },
  });
  stubFetch((url) => {
    if (url.includes('/resources/28140/versions')) {
      return Response.json([{ id: 555, name: '5.4.100', releaseDate: 1756000000, downloads: 3 }]);
    }
    if (url.includes('/resources/28140')) return Response.json(resource(false));
    return null;
  });
  const { captured, restore } = captureDownloads();
  try {
    await mods.installFromUrl(sid, 'https://www.spigotmc.org/resources/luckperms.28140/', { actor: 'test' });
  } finally {
    restore();
  }
  assert.equal(captured[0].url, 'https://api.spiget.org/v2/resources/28140/versions/555/download/proxy');
  assert.equal(captured[0].meta.platform, 'spiget');
  assert.equal(captured[0].meta.version, '5.4.100');

  db.run("DELETE FROM api_cache WHERE key LIKE 'spiget:%'");
  stubFetch((url) => (url.includes('/resources/28140') ? Response.json(resource(true)) : null));
  await assert.rejects(
    mods.installFromUrl(sid, 'https://www.spigotmc.org/resources/luckperms.28140/', { actor: 'test' }),
    /hosted outside SpigotMC/
  );
});

test('github install prefers a stable release and skips sources/javadoc jars', async () => {
  const sid = app.seedServer('srv_gh1');
  db.run("UPDATE servers SET type = 'PAPER', mc_version = '1.21.4' WHERE id = ?", sid);
  stubFetch((url) => {
    if (url.endsWith('/repos/EssentialsX/Essentials')) {
      return Response.json({
        full_name: 'EssentialsX/Essentials',
        name: 'Essentials',
        description: 'x',
        owner: { avatar_url: null },
      });
    }
    if (url.includes('/repos/EssentialsX/Essentials/releases')) {
      return Response.json([
        {
          tag_name: 'v2.22.0-beta',
          draft: false,
          prerelease: true,
          html_url: 'x',
          assets: [{ name: 'EssentialsX-2.22.0-beta.jar', size: 1 }],
        },
        {
          tag_name: 'v2.21.0',
          draft: false,
          prerelease: false,
          html_url: 'x',
          assets: [
            { name: 'EssentialsX-2.21.0-sources.jar', size: 1 },
            { name: 'EssentialsX-2.21.0.jar', size: 1 },
          ],
        },
      ]);
    }
    return null;
  });
  const { captured, restore } = captureDownloads();
  try {
    await mods.installFromUrl(sid, 'EssentialsX/Essentials', { actor: 'test' });
  } finally {
    restore();
  }
  assert.equal(
    captured[0].url,
    'https://github.com/EssentialsX/Essentials/releases/download/v2.21.0/EssentialsX-2.21.0.jar'
  );
  assert.equal(captured[0].meta.platform, 'github');
  assert.equal(captured[0].meta.version, 'v2.21.0');
});

test('teardown', async () => {
  await app.stop();
});
