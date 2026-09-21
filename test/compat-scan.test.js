'use strict';

// The scan itself (#52): identifying the jars on disk, asking the registries
// once per project, and caching both halves so a re-scan (or a scan resumed
// after a restart) pays for almost nothing. The registries are stubbed - what
// is under test is the panel's own bookkeeping, not their JSON.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const curseforge = require('../src/services/curseforgeApi');
const modrinth = require('../src/services/modrinthApi');
const modIdentify = require('../src/services/modIdentify');
const compat = require('../src/services/compat');

let port = 26100;
function seedServer(id, { type = 'FORGE', mcVersion = '1.20.1', mods = [] } = {}) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, ?, ?, ?, ?, 'x', 1024, 1536, 'stopped', 'notify', '{}')`,
    id,
    id,
    type,
    mcVersion,
    port,
    port + 1
  );
  const dir = dataPath('servers', id, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  // Unique bytes per server: the identity cache is keyed on content, so two
  // servers sharing a file name must not share an identity by accident.
  for (const m of mods) fs.writeFileSync(path.join(dir, m), `bytes-of-${id}-${m}`);
  return id;
}

const MANIFEST = {
  latest: { release: '26.3', snapshot: '26.4-rc-1' },
  versions: [
    { id: '26.4-rc-1', type: 'snapshot' },
    { id: '26.3', type: 'release' },
    { id: '1.21.1', type: 'release' },
    { id: '1.20.4', type: 'release' },
    { id: '1.20.1', type: 'release' },
    { id: '1.19.2', type: 'release' },
  ],
};
db.run(
  `INSERT INTO api_cache (key, value_json, fetched_at) VALUES ('mojang-version-manifest', ?, datetime('now'))`,
  JSON.stringify(MANIFEST)
);

test('candidateVersions lists only newer releases, oldest first', async () => {
  assert.deepEqual(await compat.candidateVersions('1.20.1'), ['1.20.4', '1.21.1', '26.3']);
  assert.deepEqual(await compat.candidateVersions('26.3'), []);
  // A pin Mojang has never published cannot be placed, so nothing is offered
  // rather than a list built on a guess.
  assert.deepEqual(await compat.candidateVersions('1.20.1-custom'), []);
});

test('inventory resolves panel-installed mods with no registry call at all', async () => {
  const id = seedServer('srv_inv_lib', { mods: ['installed.jar'] });
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, platform, project_id, version)
     VALUES ('lib_a', 'mod', 'Installed Mod', 'installed.jar', 'library/mods/installed.jar', 'sha-a', 10, 'modrinth', 'PROJ_A', '1.0')`
  );
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version)
     VALUES ('sc_a', ?, 'lib_a', 'mod', 'overlay', 'Installed Mod', 'installed.jar', '1.0')`,
    id
  );
  let called = false;
  const orig = modIdentify.identifyJars;
  modIdentify.identifyJars = async () => {
    called = true;
    return [];
  };
  try {
    const items = await compat.inventory(id);
    assert.deepEqual(items, [
      { file: 'installed.jar', name: 'Installed Mod', platform: 'modrinth', projectId: 'PROJ_A' },
    ]);
    assert.equal(called, false, 'a known mod must not be re-identified');
  } finally {
    modIdentify.identifyJars = orig;
  }
});

test('inventory reads a CurseForge pack manifest before touching any jar', async () => {
  const id = seedServer('srv_inv_manifest', { mods: ['packmod.jar'] });
  fs.writeFileSync(
    dataPath('servers', id, '.curseforge-manifest.json'),
    JSON.stringify({ files: [{ fileName: 'packmod.jar', projectID: 424242, slug: 'packmod' }] })
  );
  const orig = modIdentify.identifyJars;
  modIdentify.identifyJars = async () => {
    throw new Error('should not be called');
  };
  try {
    const items = await compat.inventory(id);
    assert.deepEqual(items, [{ file: 'packmod.jar', name: 'packmod', platform: 'curseforge', projectId: '424242' }]);
  } finally {
    modIdentify.identifyJars = orig;
  }
});

test('an identified jar is remembered by its bytes, not its name', async () => {
  const id = seedServer('srv_inv_identify', { mods: ['mystery-1.0.jar'] });
  let calls = 0;
  const orig = modIdentify.identifyJars;
  modIdentify.identifyJars = async (files) => {
    calls += 1;
    return files.map((f) => ({
      filename: f.name,
      identity: {
        platform: 'curseforge',
        projectId: '999',
        name: 'Mystery Mod',
        version: '1.0',
        loaders: ['forge'],
        mcVersions: ['1.20.1'],
      },
    }));
  };
  try {
    const first = await compat.inventory(id);
    assert.equal(first[0].projectId, '999');
    assert.equal(calls, 1);
    const row = db.get('SELECT * FROM content_identity WHERE filename = ?', 'mystery-1.0.jar');
    assert.equal(row.platform, 'curseforge');
    assert.equal(row.project_id, '999');

    const second = await compat.inventory(id);
    assert.deepEqual(second, first);
    assert.equal(calls, 1, 'the identity cache must absorb the second scan');

    // Same name, different bytes: a cache keyed on the name would hand back
    // the wrong project here.
    const other = seedServer('srv_inv_same_name', { mods: [] });
    fs.writeFileSync(dataPath('servers', other, 'mods', 'mystery-1.0.jar'), 'entirely different bytes');
    const third = await compat.inventory(other);
    assert.equal(calls, 2, 'different bytes must be identified afresh');
    assert.equal(third[0].projectId, '999');
  } finally {
    modIdentify.identifyJars = orig;
  }
});

test('a jar neither registry knows stays unidentified rather than assumed fine', async () => {
  const id = seedServer('srv_inv_unknown', { mods: ['private-build.jar'] });
  const orig = modIdentify.identifyJars;
  modIdentify.identifyJars = async (files) => files.map((f) => ({ filename: f.name, identity: null }));
  try {
    const items = await compat.inventory(id);
    assert.equal(items[0].platform, null);
    assert.equal(items[0].projectId, null);
    // "Nobody knows this jar" is not cached: a registry having a bad minute
    // must not gate the server forever.
    assert.equal(db.get('SELECT COUNT(*) AS n FROM content_identity WHERE filename = ?', 'private-build.jar').n, 0);
  } finally {
    modIdentify.identifyJars = orig;
  }
});

test('a jar that could not be identified once is asked about again next time', async () => {
  const id = seedServer('srv_inv_retry', { mods: ['flaky.jar'] });
  const orig = modIdentify.identifyJars;
  let calls = 0;
  modIdentify.identifyJars = async (files) => {
    calls += 1;
    if (calls === 1) throw new Error('CurseForge is down');
    return files.map((f) => ({
      filename: f.name,
      identity: { platform: 'modrinth', projectId: 'MR_RETRY', name: 'Flaky Mod', version: '1.0' },
    }));
  };
  try {
    const first = await compat.inventory(id);
    assert.equal(first[0].platform, null, 'the outage leaves it unknown');
    const second = await compat.inventory(id);
    assert.equal(calls, 2, 'the next scan asks again');
    assert.equal(second[0].projectId, 'MR_RETRY');
  } finally {
    modIdentify.identifyJars = orig;
  }
});

test('fetchSupport asks CurseForge once in bulk and caches every project', async () => {
  const items = [
    { file: 'a.jar', name: 'A', platform: 'curseforge', projectId: '1' },
    { file: 'b.jar', name: 'B', platform: 'curseforge', projectId: '2' },
  ];
  let calls = 0;
  const orig = curseforge.getModsBulk;
  curseforge.getModsBulk = async (ids) => {
    calls += 1;
    assert.deepEqual(ids, ['1', '2']);
    return [
      {
        modId: 1,
        name: 'A',
        latestFilesIndexes: [
          { gameVersion: '1.20.1', modLoader: 1, releaseType: 'release' }, // forge
          { gameVersion: '1.21.1', modLoader: 6, releaseType: 'release' }, // neoforge
          { gameVersion: '1.21.1', modLoader: 1, releaseType: 'alpha' }, // ignored
          { gameVersion: '26.3-rc-1', modLoader: 1, releaseType: 'release' }, // ignored
        ],
      },
      { modId: 2, name: 'B', latestFilesIndexes: [{ gameVersion: '1.20.1', modLoader: 0, releaseType: 'release' }] },
    ];
  };
  try {
    const support = await compat.fetchSupport(items);
    assert.equal(calls, 1);
    const a = support.get('curseforge:1');
    assert.deepEqual(a.versions['1.20.1'], ['forge']);
    assert.deepEqual(a.versions['1.21.1'], ['neoforge'], 'an alpha build must not count');
    assert.equal(a.versions['26.3-rc-1'], undefined, 'a release candidate is not a release');
    // modLoader 0 ("Any") carries no loader claim.
    assert.deepEqual(support.get('curseforge:2').versions['1.20.1'], [null]);
    assert.ok(db.get("SELECT * FROM project_support WHERE platform = 'curseforge' AND project_id = '1'"));

    curseforge.getModsBulk = async () => {
      throw new Error('should not be called again');
    };
    const again = await compat.fetchSupport(items);
    assert.deepEqual(again.get('curseforge:1').versions['1.20.1'], ['forge']);
  } finally {
    curseforge.getModsBulk = orig;
  }
});

test('fetchSupport keeps Modrinth loaders paired with their own versions', async () => {
  const items = [{ file: 'm.jar', name: 'M', platform: 'modrinth', projectId: 'MR1' }];
  const orig = modrinth.getVersions;
  modrinth.getVersions = async () => [
    { version_type: 'release', loaders: ['forge'], game_versions: ['1.20.1'] },
    { version_type: 'release', loaders: ['neoforge'], game_versions: ['1.21.1'] },
    { version_type: 'alpha', loaders: ['forge'], game_versions: ['1.21.1'] },
  ];
  try {
    const support = await compat.fetchSupport(items);
    const m = support.get('modrinth:MR1');
    assert.deepEqual(m.versions['1.20.1'], ['forge']);
    // The flattened project-level list would have said "forge, 1.21.1" here -
    // this is the pairing the whole gate depends on.
    assert.deepEqual(m.versions['1.21.1'], ['neoforge']);
    assert.equal(compat.supportsVersion(m, '1.21.1', 'forge'), false);
  } finally {
    modrinth.getVersions = orig;
  }
});

test('a project the registry cannot answer for is left unresolved, never passed', async () => {
  const items = [{ file: 'gone.jar', name: 'Gone', platform: 'curseforge', projectId: '4040' }];
  const orig = curseforge.getModsBulk;
  curseforge.getModsBulk = async () => []; // delisted project
  try {
    const support = await compat.fetchSupport(items);
    assert.equal(support.has('curseforge:4040'), false);
    assert.equal(compat.supportsVersion(support.get('curseforge:4040'), '1.20.4', 'forge'), false);
  } finally {
    curseforge.getModsBulk = orig;
  }
});

test('a registry outage fails the projects it covers without failing the scan', async () => {
  const items = [{ file: 'x.jar', name: 'X', platform: 'curseforge', projectId: '7' }];
  const orig = curseforge.getModsBulk;
  curseforge.getModsBulk = async () => {
    throw new Error('CurseForge is down');
  };
  try {
    const support = await compat.fetchSupport(items);
    assert.equal(support.size, 0);
  } finally {
    curseforge.getModsBulk = orig;
  }
});

test('startScan runs end to end, stores the report, and reports its ceiling', async () => {
  const id = seedServer('srv_scan_e2e', { mods: ['a.jar', 'b.jar'] });
  const origIdentify = modIdentify.identifyJars;
  const origBulk = curseforge.getModsBulk;
  modIdentify.identifyJars = async (files) =>
    files.map((f) => ({
      filename: f.name,
      identity: {
        platform: 'curseforge',
        projectId: f.name === 'a.jar' ? '11' : '22',
        name: f.name === 'a.jar' ? 'Mod A' : 'Mod B',
        version: '1.0',
      },
    }));
  curseforge.getModsBulk = async () => [
    {
      modId: 11,
      name: 'Mod A',
      latestFilesIndexes: [
        { gameVersion: '1.20.4', modLoader: 1, releaseType: 'release' },
        { gameVersion: '1.21.1', modLoader: 1, releaseType: 'release' },
      ],
    },
    { modId: 22, name: 'Mod B', latestFilesIndexes: [{ gameVersion: '1.20.4', modLoader: 1, releaseType: 'release' }] },
  ];
  try {
    await compat.startScan(id, { actor: 'test' });
    await waitForScan(id);
    const state = compat.getReport(id);
    assert.equal(state.status, 'done');
    assert.equal(state.report.modCount, 2);
    assert.equal(state.report.unknownCount, 0);
    assert.equal(state.report.highestCompatible, '1.20.4');
    assert.deepEqual(
      state.report.versions.map((v) => `${v.version}:${v.status}`),
      ['1.20.4:ready', '1.21.1:blocked', '26.3:blocked']
    );
    assert.deepEqual(
      state.report.versions[1].missing.map((m) => m.name),
      ['Mod B']
    );
    assert.equal(compat.compatCeiling(id).ceiling, '1.20.4');

    const event = db.get("SELECT * FROM events WHERE server_id = ? AND type = 'version-check'", id);
    assert.ok(event, 'a scan records what it concluded');
    assert.match(event.summary, /1\.20\.4/);
  } finally {
    modIdentify.identifyJars = origIdentify;
    curseforge.getModsBulk = origBulk;
  }
});

test('a server tracking the newest version has nothing ahead to check', async () => {
  const id = seedServer('srv_scan_latest', { mcVersion: 'LATEST', mods: ['a.jar'] });
  await assert.rejects(() => compat.startScan(id, { actor: 'test' }), /newest Minecraft version/);
});

test('a server already on the newest release records an empty, finished report', async () => {
  const id = seedServer('srv_scan_top', { mcVersion: '26.3', mods: ['a.jar'] });
  await compat.startScan(id, { actor: 'test' });
  const state = compat.getReport(id);
  assert.equal(state.status, 'done');
  assert.deepEqual(state.report.versions, []);
  assert.equal(state.report.highestCompatible, null);
});

test('a running scan keeps showing the previous report until the new one lands', async () => {
  const id = seedServer('srv_scan_keep', { mods: ['a.jar'] });
  const origIdentify = modIdentify.identifyJars;
  const origBulk = curseforge.getModsBulk;
  modIdentify.identifyJars = async (files) =>
    files.map((f) => ({ filename: f.name, identity: { platform: 'curseforge', projectId: '31', name: 'Mod K' } }));
  curseforge.getModsBulk = async () => [
    { modId: 31, name: 'Mod K', latestFilesIndexes: [{ gameVersion: '1.20.4', modLoader: 1, releaseType: 'release' }] },
  ];
  try {
    await compat.startScan(id, { actor: 'test' });
    await waitForScan(id);
    assert.equal(compat.getReport(id).report.highestCompatible, '1.20.4');

    // Progress writes must not wipe the stored report: that is what keeps the
    // page useful while a re-scan runs, and what survives a restart.
    const beforeBytes = db.get('SELECT length(payload_json) AS n FROM version_compat WHERE server_id = ?', id).n;
    db.run(
      "UPDATE version_compat SET status = 'running', phase = 'checking', done = 1, total = 2 WHERE server_id = ?",
      id
    );
    const state = compat.getReport(id);
    assert.ok(state.report, 'the previous report is still there mid-scan');
    assert.equal(db.get('SELECT length(payload_json) AS n FROM version_compat WHERE server_id = ?', id).n, beforeBytes);
  } finally {
    modIdentify.identifyJars = origIdentify;
    curseforge.getModsBulk = origBulk;
  }
});

test('two scans for the same server cannot overlap', async () => {
  const id = seedServer('srv_scan_lock', { mods: ['a.jar'] });
  const origIdentify = modIdentify.identifyJars;
  const origBulk = curseforge.getModsBulk;
  modIdentify.identifyJars = async (files) => {
    await new Promise((r) => setTimeout(r, 150));
    return files.map((f) => ({ filename: f.name, identity: { platform: 'curseforge', projectId: '11', name: 'A' } }));
  };
  curseforge.getModsBulk = async () => [{ modId: 11, name: 'A', latestFilesIndexes: [] }];
  try {
    await compat.startScan(id, { actor: 'test' });
    await assert.rejects(() => compat.startScan(id, { actor: 'test' }), /already running/);
    await waitForScan(id);
  } finally {
    modIdentify.identifyJars = origIdentify;
    curseforge.getModsBulk = origBulk;
  }
});

test('an identification outage finishes the scan with those mods unknown', async () => {
  const id = seedServer('srv_scan_outage', { mods: ['a.jar'] });
  const origIdentify = modIdentify.identifyJars;
  modIdentify.identifyJars = async () => {
    throw new Error('Modrinth and CurseForge are both unreachable');
  };
  try {
    await compat.startScan(id, { actor: 'test' });
    const state = await waitForScan(id);
    // Finishing with an honest "unknown" beats failing outright: the page can
    // still show what it does know, and the gate stays shut either way.
    assert.equal(state.status, 'done');
    assert.equal(state.report.unknownCount, 1);
    assert.equal(state.report.highestCompatible, null);
    assert.equal(compat.compatCeiling(id).reason, 'unknown-mods');
  } finally {
    modIdentify.identifyJars = origIdentify;
  }
});

test('a failed scan is never mistaken for an answer', async () => {
  const id = seedServer('srv_scan_failed_state', { mods: ['a.jar'] });
  db.run(
    `INSERT INTO version_compat (server_id, loader, mc_version, status, error, payload_json, updated_at)
     VALUES (?, 'forge', '1.20.1', 'failed', 'the panel could not reach either registry', ?, datetime('now'))`,
    id,
    JSON.stringify({
      loader: 'forge',
      mcVersion: '1.20.1',
      modCount: 1,
      knownCount: 1,
      unknownCount: 0,
      unknown: [],
      highestCompatible: '1.20.4',
      partial: false,
      versions: [],
    })
  );
  const state = compat.getReport(id);
  assert.equal(state.status, 'failed');
  // The stale report is kept for display, but nothing may act on it.
  assert.ok(state.report);
  assert.equal(compat.compatCeiling(id).ceiling, null);
  assert.equal(compat.upgradeVerdict(id, '1.20.4').allowed, false);
});

async function waitForScan(serverId, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = compat.getReport(serverId);
    if (state.status !== 'running') return state;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('the scan did not finish in time');
}
