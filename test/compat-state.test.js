'use strict';

// The stored half of version compatibility (#52): what the panel is allowed to
// conclude from a scan result. Every "do not offer an upgrade" rule lives here -
// no scan, a stale one, one that never finished, or one that found a jar it
// could not identify.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const compat = require('../src/services/compat');

let port = 25900;
function seedForgeServer(id, { mcVersion = '1.20.1', mods = ['jei.jar'] } = {}) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, ?, 'FORGE', ?, ?, ?, 'x', 1024, 1536, 'stopped', '{}')`,
    id,
    id,
    mcVersion,
    port,
    port + 1
  );
  const dir = dataPath('servers', id, 'mods');
  fs.mkdirSync(dir, { recursive: true });
  for (const m of mods) fs.writeFileSync(path.join(dir, m), 'not-a-real-jar');
  return id;
}

function storeReport(serverId, report, { status = 'done', loader = 'forge', mcVersion = '1.20.1', signature } = {}) {
  db.run(
    `INSERT INTO version_compat (server_id, loader, mc_version, mods_signature, status, done, total, payload_json, started_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'), datetime('now'))
     ON CONFLICT(server_id) DO UPDATE SET loader = excluded.loader, mc_version = excluded.mc_version,
       mods_signature = excluded.mods_signature, status = excluded.status,
       payload_json = excluded.payload_json, completed_at = excluded.completed_at`,
    serverId,
    loader,
    mcVersion,
    signature === undefined ? compat.modsSignature(serverId) : signature,
    status,
    JSON.stringify(report)
  );
}

function report({ highest = '1.20.4', unknownCount = 0, partial = false, versions = null } = {}) {
  return {
    loader: 'forge',
    mcVersion: '1.20.1',
    modCount: 2,
    knownCount: 2 - unknownCount,
    unknownCount,
    unknown: unknownCount ? [{ file: 'mystery.jar', name: 'mystery', platform: null, projectId: null }] : [],
    highestCompatible: highest,
    partial,
    versions: versions || [
      { version: '1.20.4', readyCount: 2, missingCount: 0, unknownCount, status: 'ready', ready: [], missing: [] },
      {
        version: '1.21.1',
        readyCount: 1,
        missingCount: 1,
        unknownCount,
        status: 'blocked',
        ready: [],
        missing: [{ file: 'sodium.jar', name: 'Sodium', platform: 'modrinth', projectId: 'AANobbMI' }],
      },
    ],
  };
}

test('modCount counts jars on disk, disabled ones included', () => {
  const id = seedForgeServer('srv_count', { mods: ['a.jar', 'b.jar.disabled', 'notes.txt'] });
  assert.equal(compat.modCount(id), 2);
  assert.equal(compat.modCount('srv_does_not_exist'), 0);
});

test('no scan means no ceiling - a modded server is never offered a version', () => {
  const id = seedForgeServer('srv_noscan');
  const c = compat.compatCeiling(id);
  assert.equal(c.ceiling, null);
  assert.equal(c.reason, 'no-scan');
});

test('a completed scan yields its highest compatible version', () => {
  const id = seedForgeServer('srv_ok');
  storeReport(id, report({ highest: '1.20.4' }));
  const c = compat.compatCeiling(id);
  assert.equal(c.ceiling, '1.20.4');
  assert.equal(c.reason, 'ok');
});

test('a report for another Minecraft version is stale, not usable', () => {
  const id = seedForgeServer('srv_stale', { mcVersion: '1.20.1' });
  storeReport(id, report(), { mcVersion: '1.19.2' });
  const state = compat.getReport(id);
  assert.equal(state.stale, true);
  assert.equal(compat.compatCeiling(id).reason, 'stale');
});

test('a report stops being usable the moment the mods change', () => {
  const id = seedForgeServer('srv_mods_changed', { mods: ['jei.jar'] });
  storeReport(id, report());
  assert.equal(compat.compatCeiling(id).ceiling, '1.20.4');

  fs.writeFileSync(dataPath('servers', id, 'mods', 'new-arrival.jar'), 'not-a-real-jar');
  assert.equal(compat.getReport(id).stale, true, 'a mod the report never saw invalidates it');
  assert.equal(compat.compatCeiling(id).reason, 'stale');
  assert.equal(compat.upgradeVerdict(id, '1.20.4').allowed, false);

  // Put it back exactly as it was and the report is usable again.
  fs.rmSync(dataPath('servers', id, 'mods', 'new-arrival.jar'));
  assert.equal(compat.getReport(id).stale, false);
  assert.equal(compat.compatCeiling(id).ceiling, '1.20.4');
});

test('swapping a mod for a different build of the same name is a change too', () => {
  const id = seedForgeServer('srv_mods_swapped', { mods: ['jei.jar'] });
  storeReport(id, report());
  fs.writeFileSync(dataPath('servers', id, 'mods', 'jei.jar'), 'a different build entirely');
  assert.equal(compat.getReport(id).stale, true);
});

test('a report for another loader is stale too', () => {
  const id = seedForgeServer('srv_stale_loader');
  storeReport(id, report(), { loader: 'fabric' });
  assert.equal(compat.compatCeiling(id).reason, 'stale');
});

test('a partial (still running) report never produces a ceiling', () => {
  const id = seedForgeServer('srv_partial');
  storeReport(id, report({ partial: true }), { status: 'running' });
  assert.equal(compat.compatCeiling(id).reason, 'incomplete');
});

test('unidentified mods hold the ceiling back whatever the versions say', () => {
  const id = seedForgeServer('srv_unknown');
  storeReport(id, report({ unknownCount: 1 }));
  const c = compat.compatCeiling(id);
  assert.equal(c.ceiling, null);
  assert.equal(c.reason, 'unknown-mods');
  assert.equal(c.unknownCount, 1);
});

test('a scan left running by a restart reports as interrupted, not running', () => {
  const id = seedForgeServer('srv_interrupted');
  storeReport(id, report({ partial: true }), { status: 'running' });
  compat.reconcileScans();
  assert.equal(compat.getReport(id).status, 'interrupted');
});

test('upgradeVerdict allows anything on a server with no mods', () => {
  const id = seedForgeServer('srv_vanilla', { mods: [] });
  const v = compat.upgradeVerdict(id, '1.21.1');
  assert.equal(v.allowed, true);
  assert.equal(v.reason, 'no-mods');
});

test('upgradeVerdict blocks a version the mods cannot follow, and names them', () => {
  const id = seedForgeServer('srv_blocked');
  storeReport(id, report());
  const v = compat.upgradeVerdict(id, '1.21.1');
  assert.equal(v.allowed, false);
  assert.equal(v.reason, 'blocked');
  assert.equal(v.missingCount, 1);
  assert.deepEqual(
    v.missing.map((m) => m.name),
    ['Sodium']
  );
  assert.match(v.message, /1\.21\.1/);
});

test('upgradeVerdict allows a version every mod supports', () => {
  const id = seedForgeServer('srv_allowed');
  storeReport(id, report());
  assert.equal(compat.upgradeVerdict(id, '1.20.4').allowed, true);
});

test('upgradeVerdict refuses a version the scan never covered', () => {
  const id = seedForgeServer('srv_uncovered');
  storeReport(id, report());
  const v = compat.upgradeVerdict(id, '1.99.9');
  assert.equal(v.allowed, false);
  assert.equal(v.reason, 'not-scanned');
});

test('upgradeVerdict refuses while compatibility is unknown', () => {
  const id = seedForgeServer('srv_unknown_verdict');
  storeReport(id, report({ unknownCount: 1 }));
  const v = compat.upgradeVerdict(id, '1.20.4');
  assert.equal(v.allowed, false);
  assert.equal(v.reason, 'unknown-mods');
  assert.match(v.message, /could not be identified/);
});

test('every hold reason speaks plainly, with no jargon or bare codes', () => {
  const ids = ['srv_noscan', 'srv_stale', 'srv_partial', 'srv_unknown'];
  for (const id of ids) {
    const v = compat.upgradeVerdict(id, '1.20.4');
    assert.equal(v.allowed, false, id);
    assert.ok(/[.!?]$/.test(v.message), `${id}: "${v.message}" should end in a full stop`);
    assert.ok(!/undefined|null|\[object/.test(v.message), `${id}: "${v.message}" leaks internals`);
  }
});
