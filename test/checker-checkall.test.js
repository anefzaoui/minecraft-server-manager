'use strict';

// checkAll end to end against stubbed registries: what lands in findings vs. only
// in the cache, per subject kind (pack, overlay mod, image, Minecraft version,
// loader build), the manual/ignore rules, per-run image de-duplication, and that
// one failing lookup never aborts the sweep.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate();
const db = require('../src/db');

const packsService = require('../src/services/packs');
const modrinth = require('../src/services/modrinthApi');
const curseforge = require('../src/services/curseforgeApi');
const hangar = require('../src/services/hangarApi');
const spiget = require('../src/services/spigetApi');
const github = require('../src/services/githubApi');
const containers = require('../src/docker/containers');
const images = require('../src/docker/images');
const mojang = require('../src/services/mojang');
const loaderVersions = require('../src/services/loaderVersions');
const checker = require('../src/updates/checker');

let latestFor = async () => null;
packsService.latestFor = (id) => latestFor(id);
let inspect = async () => ({ exists: false });
containers.inspectStatus = (id) => inspect(id);
const pulls = [];
images.pullImage = async (ref) => {
  pulls.push(ref);
};
let imageIds = {};
images.imageId = async (ref) => imageIds[ref] || null;
mojang.getVersionManifest = async () => ({
  latest: { release: '1.21.4' },
  versions: [{ id: '1.21.4' }, { id: '1.21.1' }, { id: '1.20.1' }],
});
let builds = [];
loaderVersions.getBuilds = async () => ({ builds });

let n = 0;
function server(over = {}) {
  n += 1;
  const s = { type: 'FABRIC', mc: 'LATEST', policy: 'notify', env: {}, ...over };
  const id = `srv_ck${n}`;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, update_policy, env_json)
     VALUES (?, ?, ?, ?, ?, ?, 'x', 1024, 1536, ?, ?)`,
    id,
    `Server ${n}`,
    s.type,
    s.mc,
    28600 + n * 2,
    28601 + n * 2,
    s.policy,
    JSON.stringify(s.env)
  );
  return id;
}
function overlayMod(serverId, { platform, projectId, version = '1.0', kind = 'mod', ignored = null }) {
  const lib = `lib_${serverId}_${platform}`;
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, version)
     VALUES (?, ?, 'Some Mod', ?, 'x', ?, 1, ?, ?, ?)`,
    lib,
    kind,
    `${lib}.jar`,
    lib,
    platform,
    projectId,
    version
  );
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, ignored_update_version)
     VALUES (?, ?, ?, ?, 'overlay', 'Some Mod', ?, ?, ?)`,
    `sc_${lib}`,
    serverId,
    lib,
    kind,
    `${lib}.jar`,
    version,
    ignored
  );
  return `sc_${lib}`;
}
const check = (type, id) => db.get('SELECT * FROM update_checks WHERE subject_type = ? AND subject_id = ?', type, id);

test.beforeEach(() => {
  db.run('DELETE FROM events');
  db.run('DELETE FROM update_checks');
  db.run('DELETE FROM server_content');
  db.run('DELETE FROM library_files');
  db.run('DELETE FROM server_packs');
  db.run('DELETE FROM servers');
  latestFor = async () => null;
  inspect = async () => ({ exists: false });
  imageIds = {};
  pulls.length = 0;
  builds = [];
  checker.invalidateOutdatedCache();
});

const packResult = (over = {}) => ({
  current: { id: '1', name: 'v1' },
  latest: { id: '2', name: 'v2' },
  updateAvailable: true,
  projectName: 'ATM',
  projectRef: 'atm',
  platform: 'curseforge',
  ...over,
});

test('nothing installed means an empty sweep, a summary event, and a last-check stamp', async () => {
  server();
  const findings = await checker.checkAll();
  assert.deepEqual(findings, []);
  assert.equal(
    db.all("SELECT summary FROM events WHERE type = 'update-check'")[0].summary,
    /* prettier */ 'Update check: everything up to date.'
  );
  assert.ok(db.get("SELECT 1 FROM api_cache WHERE key = 'last-update-check'"));
  assert.ok(checker.lastCheckedAt());
});

test('a pending pack update is a finding and is cached with its changelog link', async () => {
  const id = server();
  latestFor = async () => packResult();
  const findings = await checker.checkAll();
  assert.deepEqual(findings, [
    {
      server: db.get('SELECT display_name FROM servers WHERE id = ?', id).display_name,
      kind: 'pack',
      subject: 'ATM',
      current: 'v1',
      latest: 'v2',
    },
  ]);
  const row = check('pack', id);
  assert.equal(row.latest_version, '2');
  assert.ok(row.changelog_url);
  assert.match(db.all("SELECT summary FROM events WHERE type = 'update-check'")[0].summary, /1 update\(s\) available/);
});

test('an up-to-date pack clears its cached offer', async () => {
  const id = server();
  latestFor = async () => packResult();
  await checker.checkAll();
  latestFor = async () => packResult({ updateAvailable: false });
  assert.deepEqual(await checker.checkAll(), []);
  assert.equal(check('pack', id).latest_version, null);
});

test('manual policy refreshes the cache but reports nothing', async () => {
  const id = server({ policy: 'manual' });
  latestFor = async () => packResult();
  assert.deepEqual(await checker.checkAll(), []);
  assert.equal(check('pack', id).latest_version, '2');
});

test('an ignored pack build is cached but kept out of findings, until a newer one appears', async () => {
  const id = server();
  latestFor = async () => packResult();
  await checker.checkAll();
  assert.deepEqual(checker.setUpdateIgnored('pack', id), { ignored: '2' });
  assert.deepEqual(await checker.checkAll(), []);
  latestFor = async () => packResult({ latest: { id: '3', name: 'v3' } });
  assert.equal((await checker.checkAll()).length, 1, 'a newer build lapses the ignore');
  assert.deepEqual(checker.setUpdateIgnored('pack', id, { ignore: false }), { ignored: null });
});

test('setUpdateIgnored guards: content is refused, and nothing pending is a 409', () => {
  const id = server();
  assert.throws(
    () => checker.setUpdateIgnored('content', 'x'),
    (e) => e.status === 400
  );
  assert.throws(
    () => checker.setUpdateIgnored('pack', id),
    (e) => e.status === 409
  );
});

test('a failing pack lookup is swallowed and the rest of the sweep still runs', async () => {
  server();
  const b = server();
  latestFor = async (id) => {
    if (id !== b) throw new Error('registry down');
    return packResult();
  };
  const findings = await checker.checkAll();
  assert.equal(findings.length, 1);
});

test('overlay mods are checked per platform and only real name changes are findings', async () => {
  const id = server({ type: 'PAPER' });
  const mr = overlayMod(id, { platform: 'modrinth', projectId: 'P1', version: '1.0' });
  const cf = overlayMod(id, { platform: 'curseforge', projectId: '77', version: '1.0' });
  const hg = overlayMod(id, { platform: 'hangar', projectId: 'ess', version: '1.0' });
  const sp = overlayMod(id, { platform: 'spiget', projectId: '9', version: '1.0' });
  const gh = overlayMod(id, { platform: 'github', projectId: 'o/r', version: 'v1' });
  modrinth.getVersions = async () => [{ id: 'm2', version_number: '2.0' }];
  curseforge.getFiles = async () => [{ fileId: 5, name: '1.0' }]; // same name: up to date
  hangar.getVersions = async () => [{ name: '3.0' }];
  spiget.getVersions = async () => [{ versionId: 's9', name: '4.0' }];
  github.getReleases = async () => [
    { tag: 'v3-rc', prerelease: true, assets: [1], htmlUrl: 'u3' },
    { tag: 'v2', prerelease: false, assets: [1], htmlUrl: 'u2' },
    { tag: 'v9', prerelease: false, assets: [], htmlUrl: 'u9' },
  ];
  const findings = await checker.checkAll();
  assert.deepEqual(findings.map((f) => f.latest).sort(), ['2.0', '3.0', '4.0', 'v2']);
  assert.equal(check('content', mr).latest_version, 'm2');
  assert.equal(check('content', cf).latest_version, null, 'same version name is not an update');
  assert.equal(check('content', hg).latest_name, '3.0');
  assert.equal(check('content', sp).latest_version, 's9');
  assert.equal(check('content', gh).changelog_url, 'u2', 'stable release wins over a newer prerelease');
});

test('an ignored overlay build is not a finding, and one broken mod does not stop the others', async () => {
  const id = server({ type: 'PAPER' });
  overlayMod(id, { platform: 'modrinth', projectId: 'P1', version: '1.0', ignored: '2.0' });
  overlayMod(id, { platform: 'hangar', projectId: 'boom', version: '1.0' });
  modrinth.getVersions = async () => [{ id: 'm2', version_number: '2.0' }];
  hangar.getVersions = async () => {
    throw new Error('hangar 500');
  };
  assert.deepEqual(await checker.checkAll(), []);
});

test('datapacks are matched on the newest version that carries a zip, ignoring the loader', async () => {
  const id = server({ type: 'PAPER' });
  const sc = overlayMod(id, { platform: 'modrinth', projectId: 'DP', version: '1.0', kind: 'datapack' });
  const modsService = require('../src/services/mods');
  const realPick = modsService.pickDownloadFile;
  let seenOpts;
  modrinth.getVersions = async (pid, opts) => {
    seenOpts = opts;
    return [
      { id: 'jar-only', version_number: '3.0' },
      { id: 'zip', version_number: '2.0', zip: true },
    ];
  };
  modsService.pickDownloadFile = (v) => (v.zip ? { filename: 'x.zip' } : null);
  try {
    await checker.checkAll();
  } finally {
    modsService.pickDownloadFile = realPick;
  }
  assert.equal(seenOpts.loader, undefined);
  assert.equal(check('content', sc).latest_version, 'zip');
});

test('image updates compare the running image id, and each distinct ref is pulled once per sweep', async () => {
  const a = server();
  const b = server();
  inspect = async () => ({ exists: true, imageId: 'sha256:' + 'a'.repeat(64) });
  const ref = require('../src/services/servers').resolveImage(require('../src/services/servers').getServer(a));
  imageIds[ref] = 'sha256:' + 'b'.repeat(64);
  const findings = await checker.checkAll();
  assert.equal(findings.filter((f) => f.kind === 'image').length, 2);
  assert.equal(pulls.filter((p) => p === ref).length, 1, 'pulled once for two servers');
  assert.equal(findings[0].current, 'a'.repeat(12));
  assert.equal(check('image', b).latest_version, 'sha256:' + 'b'.repeat(64));
});

test('an image that matches, or that could not be resolved, is not an update; a missing container is skipped', async () => {
  const a = server();
  inspect = async () => ({ exists: true, imageId: 'sha256:same' });
  const ref = require('../src/services/servers').resolveImage(require('../src/services/servers').getServer(a));
  imageIds[ref] = 'sha256:same';
  assert.deepEqual(await checker.checkAll(), []);
  imageIds[ref] = null;
  assert.deepEqual(await checker.checkAll(), []);
  inspect = async () => ({ exists: false });
  assert.deepEqual(await checker.checkAll(), []);
  inspect = async () => {
    throw new Error('docker down');
  };
  assert.deepEqual(await checker.checkAll(), [], 'a Docker outage is not fatal');
});

test('a pinned Minecraft version older than the newest release is offered; LATEST is never checked', async () => {
  const pinned = server({ mc: '1.20.1' });
  server({ mc: 'LATEST' });
  const findings = await checker.checkAll();
  const mc = findings.filter((f) => f.kind === 'mc_version');
  assert.equal(mc.length, 1);
  assert.deepEqual([mc[0].current, mc[0].latest], ['1.20.1', '1.21.4']);
  assert.equal(check('mc_version', pinned).latest_version, '1.21.4');
});

test('a server already on the newest release, or on an unrecognised pin, is handled', async () => {
  const cur = server({ mc: '1.21.4' });
  await checker.checkAll();
  assert.equal(check('mc_version', cur).latest_version, null);
  const odd = server({ mc: '26w01a' });
  const findings = await checker.checkAll();
  assert.ok(findings.some((f) => f.kind === 'mc_version' && f.current === '26w01a'));
  assert.ok(check('mc_version', odd));
});

test('an ignored Minecraft version offer stays out of findings', async () => {
  const id = server({ mc: '1.20.1' });
  await checker.checkAll();
  checker.setUpdateIgnored('mc_version', id);
  assert.equal((await checker.checkAll()).filter((f) => f.kind === 'mc_version').length, 0);
});

test('a pinned loader build older than the newest is offered; unpinned or current is not', async () => {
  const id = server({ env: { FABRIC_LOADER_VERSION: '0.15.0' } });
  builds = [{ label: 'Latest (recommended)' }, { version: '0.16.9', label: '0.16.9' }, { version: '0.15.0' }];
  const findings = await checker.checkAll();
  assert.deepEqual(
    findings.filter((f) => f.kind === 'loader_build').map((f) => [f.current, f.latest]),
    [['0.15.0', '0.16.9']]
  );
  assert.equal(check('loader_build', id).latest_name, '0.16.9');
  builds = [{ version: '0.15.0', label: '0.15.0' }];
  assert.equal((await checker.checkAll()).filter((f) => f.kind === 'loader_build').length, 0);
  db.run('DELETE FROM servers');
  server({ env: {} });
  builds = [{ version: '9', label: '9' }];
  const b = await checker.checkAll();
  assert.equal(b.filter((f) => f.kind === 'loader_build').length, 0, 'an unpinned loader already tracks latest');
});

test('a failing standalone lookup is swallowed', async () => {
  server({ mc: '1.20.1' });
  mojang.getVersionManifest = async () => {
    throw new Error('mojang down');
  };
  try {
    assert.deepEqual(await checker.checkAll(), []);
  } finally {
    mojang.getVersionManifest = async () => ({
      latest: { release: '1.21.4' },
      versions: [{ id: '1.21.4' }, { id: '1.21.1' }, { id: '1.20.1' }],
    });
  }
});

test('countOutdatedByKind and listOutdated reflect what the sweep cached', async () => {
  const id = server();
  db.run(
    "INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name) VALUES (?, 'curseforge', 'atm', 'ATM', '1', 'v1')",
    id
  );
  latestFor = async () => packResult();
  await checker.checkAll();
  assert.equal(checker.countOutdated(), 1);
  assert.deepEqual(checker.countOutdatedByKind(), { all: 1, mods: 1, server: 0 });
  assert.equal(checker.listOutdated()[0].serverId, id);
  checker.setUpdateIgnored('pack', id);
  assert.equal(checker.countOutdated(), 0, 'ignored updates drop out of the badge');
});
