'use strict';

// The pack upgrade / rollback orchestrator, with every collaborator stubbed:
// step ordering, the guards that fire BEFORE any destructive work, failure
// handling (502 + rollback offer), auto-upgrade rollback, and waitForHealthy.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate();
const db = require('../src/db');

// Patch destructured collaborators BEFORE upgrade.js loads.
const containers = require('../src/docker/containers');
const logsMod = require('../src/docker/logs');
let inspectQueue = [];
let logText = '';
containers.inspectStatus = async () => {
  const next = inspectQueue.length > 1 ? inspectQueue.shift() : inspectQueue[0];
  if (next instanceof Error) throw next;
  return next;
};
let fetchLogsImpl = async () => logText;
logsMod.fetchLogs = (...a) => fetchLogsImpl(...a);

const serversService = require('../src/services/servers');
const packsService = require('../src/services/packs');
const backupsService = require('../src/services/backups');
const { upgradePack, rollbackPack, upgradeStatus, runAutoUpgrades } = require('../src/updates/upgrade');

const calls = [];
let resolved;
let failOn = null;

function stub(obj, name, fn) {
  obj[name] = async (...args) => {
    calls.push(name);
    if (failOn === name) throw new Error(`${name} failed`);
    return fn(...args);
  };
}
stub(packsService, 'resolvePack', async () => resolved);
stub(packsService, 'applyPack', async () => ({ previous: { pinned_version_id: '100' } }));
stub(packsService, 'afterPackOperation', async () => {});
stub(backupsService, 'createBackup', async () => ({ id: 'bk_1' }));
stub(backupsService, 'restoreBackup', async () => {});
stub(serversService, 'stopServer', async () => {});
stub(serversService, 'recreateServer', async () => {});
stub(serversService, 'startServer', async () => {});

// Make the 5s poll interval instant.
const realSetTimeout = globalThis.setTimeout;
test.before(() => {
  globalThis.setTimeout = (fn) => realSetTimeout(fn, 0);
});
test.after(() => {
  globalThis.setTimeout = realSetTimeout;
});

let port = 27100;
function seed(id, { policy = 'manual', status = 'stopped', mc = '1.20.1', pinned = '100', prev = null } = {}) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, update_policy, env_json)
     VALUES (?, ?, 'AUTO_CURSEFORGE', ?, ?, ?, 'x', 1024, 1536, ?, ?, '{}')`,
    id,
    id,
    mc,
    port,
    port + 1,
    status,
    policy
  );
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name, previous_version_id, previous_version_name)
     VALUES (?, 'curseforge', 'atm10', 'All the Mods 10', ?, ?, ?, ?)`,
    id,
    pinned,
    `v${pinned}`,
    prev,
    prev && `v${prev}`
  );
}

function reset(opts = {}) {
  calls.length = 0;
  failOn = null;
  logText = 'Done (1.2s)!';
  inspectQueue = [{ exists: true, status: 'running', health: 'healthy' }];
  resolved = { versionId: '200', versionName: 'v200', mcVersion: '1.20.1', ...opts };
}

function events(serverId, type) {
  return db.all('SELECT * FROM events WHERE server_id = ? AND type = ?', serverId, type);
}

test('a happy-path upgrade runs every step in order and records the event', async () => {
  reset();
  seed('srv_up_ok', { status: 'running' });
  const steps = [];
  const out = await upgradePack('srv_up_ok', { onStep: (s) => steps.push(s), actor: 'tester' });
  assert.deepEqual(out, { ok: true, from: 'v100', to: 'v200', backupId: 'bk_1' });
  assert.deepEqual(steps, ['resolving', 'backing-up', 'stopping', 'applying', 'recreating', 'monitoring', 'overlay']);
  assert.deepEqual(calls, [
    'resolvePack',
    'createBackup',
    'stopServer',
    'applyPack',
    'recreateServer',
    'startServer',
    'afterPackOperation',
  ]);
  assert.equal(events('srv_up_ok', 'update-applied').length, 1);
  assert.equal(upgradeStatus('srv_up_ok'), null, 'the in-flight marker is cleared');
});

test('a stopped server is not stopped again, and skipBackup skips the backup', async () => {
  reset();
  seed('srv_up_stopped');
  await upgradePack('srv_up_stopped', { skipBackup: true });
  assert.ok(!calls.includes('stopServer'));
  assert.ok(!calls.includes('createBackup'));
});

test('a stalled server still counts as running and is stopped before files change', async () => {
  reset();
  seed('srv_up_stalled', { status: 'stalled' });
  await upgradePack('srv_up_stalled');
  assert.ok(calls.indexOf('stopServer') < calls.indexOf('applyPack'));
});

test('the task handle mirrors step labels', async () => {
  reset();
  seed('srv_up_task');
  const labels = [];
  await upgradePack('srv_up_task', { task: { step: (l) => labels.push(l) } });
  assert.equal(labels[0], 'Resolving target version…');
  assert.ok(labels.includes('Restoring custom mod overlay…'));
});

test('guards fire before any destructive work: unknown server, no pack, already current', async () => {
  reset();
  await assert.rejects(
    () => upgradePack('srv_nope'),
    (e) => e.status === 404
  );
  seed('srv_up_nopack');
  db.run('DELETE FROM server_packs WHERE server_id = ?', 'srv_up_nopack');
  await assert.rejects(
    () => upgradePack('srv_up_nopack'),
    (e) => e.status === 400
  );
  seed('srv_up_same', { pinned: '200' });
  await assert.rejects(
    () => upgradePack('srv_up_same'),
    (e) => e.status === 400 && /Already on/.test(e.message)
  );
  assert.ok(!calls.includes('createBackup') && !calls.includes('stopServer'));
});

test('crossing Minecraft versions needs explicit confirmation, before any backup', async () => {
  reset({ mcVersion: '1.21.1' });
  seed('srv_up_mc', { mc: '1.20.1' });
  await assert.rejects(
    () => upgradePack('srv_up_mc'),
    (e) => e.status === 409 && e.requiresVersionConfirm && e.fromMcVersion === '1.20.1' && e.toMcVersion === '1.21.1'
  );
  assert.ok(!calls.includes('createBackup'));
  assert.equal(upgradeStatus('srv_up_mc'), null, 'the marker is cleared after a refusal');
  // Confirming lets it through.
  const out = await upgradePack('srv_up_mc', { allowVersionChange: true });
  assert.equal(out.ok, true);
});

test('LATEST / SNAPSHOT servers do not trip the version gate', async () => {
  reset({ mcVersion: '1.21.1' });
  seed('srv_up_latest', { mc: 'LATEST' });
  assert.equal((await upgradePack('srv_up_latest')).ok, true);
});

test('a second upgrade or a rollback while one is running is refused (409)', async () => {
  reset();
  seed('srv_up_busy', { prev: '90' });
  let release;
  packsService.resolvePack = async () => {
    await new Promise((r) => (release = r));
    return resolved;
  };
  const first = upgradePack('srv_up_busy');
  await new Promise((r) => setImmediate(r));
  assert.equal(upgradeStatus('srv_up_busy').step, 'resolving');
  await assert.rejects(
    () => upgradePack('srv_up_busy'),
    (e) => e.status === 409
  );
  await assert.rejects(
    () => rollbackPack('srv_up_busy'),
    (e) => e.status === 409
  );
  release();
  await first;
  stub(packsService, 'resolvePack', async () => resolved);
});

test('an unhealthy boot throws 502 with a rollback offer and records update-failed', async () => {
  reset();
  seed('srv_up_bad');
  inspectQueue = [{ exists: true, status: 'crashed' }];
  logText = 'java.lang.OutOfMemoryError';
  await assert.rejects(
    () => upgradePack('srv_up_bad'),
    (e) => e.status === 502 && e.rollbackAvailable === true && e.backupId === 'bk_1'
  );
  const [ev] = events('srv_up_bad', 'update-failed');
  assert.ok(ev, 'update-failed recorded');
  assert.ok(!calls.includes('afterPackOperation'), 'the overlay is not restored on a failed boot');
  assert.equal(upgradeStatus('srv_up_bad'), null);
});

test('with the backup skipped, a failed boot offers no rollback', async () => {
  reset();
  seed('srv_up_bad2');
  inspectQueue = [{ exists: false }];
  await assert.rejects(
    () => upgradePack('srv_up_bad2', { skipBackup: true }),
    (e) => e.status === 502 && e.rollbackAvailable === false
  );
});

test('a step failure propagates and still clears the in-flight marker', async () => {
  reset();
  seed('srv_up_boom');
  failOn = 'applyPack';
  await assert.rejects(() => upgradePack('srv_up_boom'), /applyPack failed/);
  assert.equal(upgradeStatus('srv_up_boom'), null);
});

test('waitForHealthy: no healthcheck needs a stable run AND a "Done (" log line', async () => {
  reset();
  seed('srv_up_nohc');
  inspectQueue = [{ exists: true, status: 'running', health: null }];
  logText = 'Loading...';
  // Never prints Done, so make it print Done only after a few polls.
  let polls = 0;
  fetchLogsImpl = async () => (++polls > 3 ? 'Done (9s)!' : 'Loading...');
  const out = await upgradePack('srv_up_nohc', { skipBackup: true });
  assert.equal(out.ok, true);
  assert.ok(polls > 3);
  fetchLogsImpl = async () => logText;
});

test('waitForHealthy: a still-"starting" healthcheck is accepted once the log says Done', async () => {
  reset();
  seed('srv_up_starting');
  inspectQueue = [{ exists: true, status: 'starting', health: 'starting' }];
  logText = '[Server thread/INFO]: Done (41s)! For help, type "help"';
  assert.equal((await upgradePack('srv_up_starting', { skipBackup: true })).ok, true);
});

test('waitForHealthy: an inspect error is treated as unhealthy', async () => {
  reset();
  seed('srv_up_inspecterr');
  inspectQueue = [new Error('docker down')];
  await assert.rejects(
    () => upgradePack('srv_up_inspecterr', { skipBackup: true }),
    (e) => e.status === 502
  );
});

test('rollback needs a recorded previous version', async () => {
  reset();
  seed('srv_rb_none');
  await assert.rejects(
    () => rollbackPack('srv_rb_none'),
    (e) => e.status === 400
  );
});

test('rollback stops, restores the backup, re-pins the previous version, and restarts', async () => {
  reset();
  seed('srv_rb_ok', { pinned: '200', prev: '100' });
  const out = await rollbackPack('srv_rb_ok', { backupId: 'bk_9' });
  assert.deepEqual(out, { ok: true, version: 'v100' });
  assert.deepEqual(calls, ['stopServer', 'restoreBackup', 'resolvePack', 'applyPack', 'recreateServer', 'startServer']);
  const [ev] = events('srv_rb_ok', 'update-rolled-back');
  assert.match(ev.summary, /backup restored/);
  assert.equal(upgradeStatus('srv_rb_ok'), null);
});

test('rollback tolerates a failing stop and works without a backup', async () => {
  reset();
  seed('srv_rb_nobk', { pinned: '200', prev: '100' });
  const realStop = serversService.stopServer;
  serversService.stopServer = async () => {
    throw new Error('already stopped');
  };
  const out = await rollbackPack('srv_rb_nobk');
  serversService.stopServer = realStop;
  assert.equal(out.ok, true);
  assert.ok(!calls.includes('restoreBackup'));
});

function seedCheck(id, latest, ignored = null) {
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name, ignored_version, checked_at)
     VALUES ('pack', ?, 'v100', ?, ?, ?, datetime('now'))`,
    id,
    latest,
    `v${latest}`,
    ignored
  );
}

test('auto-upgrade applies a pending update and counts it', async () => {
  reset();
  seed('srv_au_ok', { policy: 'auto' });
  seedCheck('srv_au_ok', '200');
  const r = await runAutoUpgrades();
  assert.equal(r.applied >= 1, true);
  assert.equal(events('srv_au_ok', 'update-applied').length, 1);
});

test('auto-upgrade respects "ignore this update"', async () => {
  reset();
  seed('srv_au_ign', { policy: 'auto' });
  seedCheck('srv_au_ign', '250', '250');
  const r = await runAutoUpgrades();
  assert.equal(r.skipped >= 1, true);
  assert.equal(events('srv_au_ign', 'update-applied').length, 0);
});

test('auto-upgrade skips (with an event) a cross-Minecraft-version update', async () => {
  reset({ versionId: '300', versionName: 'v300', mcVersion: '1.21.1' });
  seed('srv_au_mc', { policy: 'auto', mc: '1.20.1' });
  seedCheck('srv_au_mc', '300');
  await runAutoUpgrades();
  assert.equal(events('srv_au_mc', 'auto-update-skipped').length, 1);
  assert.equal(events('srv_au_mc', 'update-applied').length, 0);
});

test('auto-upgrade rolls back automatically after a failed boot', async () => {
  reset({ versionId: '400', versionName: 'v400' });
  seed('srv_au_rb', { policy: 'auto', prev: '90' });
  seedCheck('srv_au_rb', '400');
  inspectQueue = [{ exists: true, status: 'crashed' }];
  calls.length = 0;
  const r = await runAutoUpgrades();
  assert.equal(r.failed >= 1, true);
  assert.ok(calls.includes('restoreBackup'), 'the pre-update backup was restored');
  assert.equal(events('srv_au_rb', 'update-failed').length, 1);
});

test('auto-upgrade escalates when the automatic rollback also fails', async () => {
  reset({ versionId: '500', versionName: 'v500' });
  seed('srv_au_rbfail', { policy: 'auto', prev: '90' });
  seedCheck('srv_au_rbfail', '500');
  inspectQueue = [{ exists: true, status: 'crashed' }];
  const realRestore = backupsService.restoreBackup;
  backupsService.restoreBackup = async () => {
    throw new Error('disk full');
  };
  await runAutoUpgrades();
  backupsService.restoreBackup = realRestore;
  assert.equal(events('srv_au_rbfail', 'auto-update-failed').length, 1);
});
