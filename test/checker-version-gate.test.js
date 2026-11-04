'use strict';

// #52: a Minecraft version update must never be offered to a modded server
// just because Mojang published a newer release. The offer is capped at what
// the server's last version scan proved every mod can follow, and when that
// cannot be established, nothing is offered at all.
//
// No network: the Mojang manifest is seeded into the API cache, the servers
// have no modpack and no container, so checkAll() only exercises the standalone
// version path.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');

// A manifest shaped exactly like Mojang's: newest first, mixed channels, and
// the calendar-versioned releases that started the whole report (#52).
const MANIFEST = {
  latest: { release: '26.3', snapshot: '26.4-rc-1' },
  versions: [
    { id: '26.4-rc-1', type: 'snapshot', releaseTime: '2026-09-01T00:00:00Z' },
    { id: '26.3', type: 'release', releaseTime: '2026-08-01T00:00:00Z' },
    { id: '26.2', type: 'release', releaseTime: '2026-07-01T00:00:00Z' },
    { id: '1.21.1', type: 'release', releaseTime: '2024-08-08T00:00:00Z' },
    { id: '1.20.4', type: 'release', releaseTime: '2023-12-07T00:00:00Z' },
    { id: '1.20.2', type: 'release', releaseTime: '2023-09-21T00:00:00Z' },
    { id: '1.20.1', type: 'release', releaseTime: '2023-06-12T00:00:00Z' },
  ],
};
db.run(
  `INSERT INTO api_cache (key, value_json, fetched_at) VALUES ('mojang-version-manifest', ?, datetime('now'))
   ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
  JSON.stringify(MANIFEST)
);

const checker = require('../src/updates/checker');
const compat = require('../src/services/compat');

let port = 25700;
function seedServer(id, { type = 'FORGE', mods = [], mcVersion = '1.20.1', envJson = '{}' } = {}) {
  port += 2;
  // 'notify' (not the 'manual' default) so findings are actually reported -
  // 'manual' means "leave me alone" and suppresses every notification.
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, ?, ?, ?, ?, 'x', 1024, 1536, 'stopped', 'notify', ?)`,
    id,
    id,
    type,
    mcVersion,
    port,
    port + 1,
    envJson
  );
  const dir = dataPath('servers', id, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  for (const m of mods) fs.writeFileSync(path.join(dir, m), 'not-a-real-jar');
  return id;
}

function storeScan(serverId, { highest, unknownCount = 0, versions }) {
  db.run(
    `INSERT INTO version_compat (server_id, loader, mc_version, mods_signature, status, done, total, payload_json, started_at, updated_at, completed_at)
     VALUES (?, 'forge', '1.20.1', ?, 'done', 0, 0, ?, datetime('now'), datetime('now'), datetime('now'))
     ON CONFLICT(server_id) DO UPDATE SET payload_json = excluded.payload_json, status = 'done'`,
    serverId,
    compat.modsSignature(serverId),
    JSON.stringify({
      loader: 'forge',
      mcVersion: '1.20.1',
      modCount: 1 + unknownCount,
      knownCount: 1,
      unknownCount,
      unknown: unknownCount ? [{ file: 'mystery.jar', name: 'mystery', platform: null, projectId: null }] : [],
      highestCompatible: highest,
      partial: false,
      versions,
    })
  );
}

const READY_TO_1_20_4 = [
  { version: '1.20.2', readyCount: 1, missingCount: 0, unknownCount: 0, status: 'ready', ready: [], missing: [] },
  { version: '1.20.4', readyCount: 1, missingCount: 0, unknownCount: 0, status: 'ready', ready: [], missing: [] },
  {
    version: '1.21.1',
    readyCount: 0,
    missingCount: 1,
    unknownCount: 0,
    status: 'blocked',
    ready: [],
    missing: [{ file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' }],
  },
  {
    version: '26.2',
    readyCount: 0,
    missingCount: 1,
    unknownCount: 0,
    status: 'blocked',
    ready: [],
    missing: [{ file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' }],
  },
  {
    version: '26.3',
    readyCount: 0,
    missingCount: 1,
    unknownCount: 0,
    status: 'blocked',
    ready: [],
    missing: [{ file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' }],
  },
];

function mcFindings(findings, serverId) {
  return findings.filter((f) => f.kind === 'mc_version' && f.server === serverId);
}

test('the reported bug: a modded 1.20.1 server is not told to go to 26.3', async () => {
  const id = seedServer('srv_modded_noscan', { mods: ['jei.jar'] });
  const findings = await checker.checkAll({ actor: 'test' });
  assert.deepEqual(mcFindings(findings, id), []);
  const row = db.get("SELECT * FROM update_checks WHERE subject_type = 'mc_version' AND subject_id = ?", id);
  assert.equal(row.latest_version, null, 'no version may be cached as available');
});

test('an unmodded server still gets the newest release, exactly as before', async () => {
  const id = seedServer('srv_vanilla', { type: 'VANILLA', mods: [] });
  const findings = await checker.checkAll({ actor: 'test' });
  const mine = mcFindings(findings, id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].latest, '26.3');
  assert.equal(mine[0].current, '1.20.1');
});

test('a scanned server is offered its ceiling, not the newest release', async () => {
  const id = seedServer('srv_scanned', { mods: ['jei.jar'] });
  storeScan(id, { highest: '1.20.4', versions: READY_TO_1_20_4 });
  const findings = await checker.checkAll({ actor: 'test' });
  const mine = mcFindings(findings, id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].latest, '1.20.4', 'the offer is capped at what the mods support');
  assert.equal(compat.compatCeiling(id).ceiling, '1.20.4');
});

test('an unidentifiable jar silences the offer even with a finished scan', async () => {
  const id = seedServer('srv_unknown_jar', { mods: ['jei.jar', 'mystery.jar'] });
  storeScan(id, { highest: '1.20.4', unknownCount: 1, versions: READY_TO_1_20_4 });
  const findings = await checker.checkAll({ actor: 'test' });
  assert.deepEqual(mcFindings(findings, id), []);
});

test('a retired offer is cleared from the cache, so the badge cannot go stale', async () => {
  const id = seedServer('srv_retired', { mods: [] });
  // First run: unmodded, so 26.3 is genuinely on offer and gets cached.
  await checker.checkAll({ actor: 'test' });
  let row = db.get("SELECT * FROM update_checks WHERE subject_type = 'mc_version' AND subject_id = ?", id);
  assert.equal(row.latest_version, '26.3');

  // Someone adds a mod. The next check can no longer establish compatibility,
  // so yesterday's offer must not survive.
  fs.writeFileSync(dataPath('servers', id, 'mods', 'late-arrival.jar'), 'not-a-real-jar');
  await checker.checkAll({ actor: 'test' });
  row = db.get("SELECT * FROM update_checks WHERE subject_type = 'mc_version' AND subject_id = ?", id);
  assert.equal(row.latest_version, null);
  assert.equal(checker.countOutdatedByKind({ serverIds: [id] }).server, 0);
});

test('a ceiling equal to the running version is not an upgrade', async () => {
  const id = seedServer('srv_at_ceiling', { mods: ['jei.jar'] });
  storeScan(id, {
    highest: null,
    versions: [
      {
        version: '1.20.2',
        readyCount: 0,
        missingCount: 1,
        unknownCount: 0,
        status: 'blocked',
        ready: [],
        missing: [{ file: 'jei.jar', name: 'JEI', platform: 'curseforge', projectId: '238222' }],
      },
    ],
  });
  const findings = await checker.checkAll({ actor: 'test' });
  assert.deepEqual(mcFindings(findings, id), []);
});

// ---- #53: plugin-family gate (Paper & forks ship per-MC builds that lag -----
// Mojang, so an unmodded Paper server must not be offered 26.3 until Paper
// publishes it on the server's channel).

function seedPaper(id, mcVersion = '26.2', envJson = '{}') {
  return seedServer(id, { type: 'PAPER', mods: [], mcVersion, envJson });
}

function seedPaperProbe(mc, builds) {
  // Same V3 shape the real Fill API returns (see test/loaderVersions-paper.test.js).
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    'loader:paper3:' + mc,
    JSON.stringify(builds)
  );
}

test('a default-channel Paper server is not offered a version with no stable build (the reported bug)', async () => {
  const id = seedPaper('srv_paper_hold');
  seedPaperProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'ALPHA' }]); // no STABLE/RECOMMENDED
  const findings = await checker.checkAll({ actor: 'test' });
  assert.deepEqual(mcFindings(findings, id), [], 'nothing is offered while Paper has no build');
  const row = db.get("SELECT * FROM update_checks WHERE subject_type = 'mc_version' AND subject_id = ?", id);
  assert.equal(row.latest_version, null);
});

test('an experimental-channel Paper server keeps tracking the pre-release channel', async () => {
  const id = seedPaper('srv_paper_alpha', '26.2', JSON.stringify({ PAPER_CHANNEL: 'experimental' }));
  seedPaperProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'ALPHA' }]);
  const findings = await checker.checkAll({ actor: 'test' });
  const mine = mcFindings(findings, id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].latest, '26.3', 'the experimental channel legitimately tracks pre-releases');
});

test('a Paper server IS offered the version once a stable build ships', async () => {
  const id = seedPaper('srv_paper_shipped');
  seedPaperProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'STABLE' }]);
  const findings = await checker.checkAll({ actor: 'test' });
  const mine = mcFindings(findings, id);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].latest, '26.3');
});

test('a phantom 26.3 offer is cleared once Paper stops shipping it (badge cannot go stale)', async () => {
  const id = seedPaper('srv_paper_retired');
  // First pass: Paper did ship 26.3, so the offer is cached.
  seedPaperProbe('26.3', [{ id: 7, time: '2026-08-05T00:00:00Z', channel: 'STABLE' }]);
  await checker.checkAll({ actor: 'test' });
  let row = db.get("SELECT * FROM update_checks WHERE subject_type = 'mc_version' AND subject_id = ?", id);
  assert.equal(row.latest_version, '26.3');

  // Paper's 26.3 builds vanish (its registry now returns only older variants).
  db.run("DELETE FROM api_cache WHERE key = 'loader:paper3:26.3'");
  seedPaperProbe('26.3', []);
  await checker.checkAll({ actor: 'test' });
  row = db.get("SELECT * FROM update_checks WHERE subject_type = 'mc_version' AND subject_id = ?", id);
  assert.equal(row.latest_version, null, 'the retired offer must be cleared, not cached as current');
});
