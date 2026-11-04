'use strict';

// Server create / start / stop / restart / kill / rebuild and the status refresh,
// with the Docker layer stubbed: rollback of a half-created server, the fail-fast
// checks, event ordering (stop-requested BEFORE the stop), and stall/boot handling.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('../src/db/migrate').migrate();
const db = require('../src/db');

// Stub destructured collaborators BEFORE servers.js loads.
const logsMod = require('../src/docker/logs');
let logText = '';
const logCalls = [];
logsMod.fetchLogs = async (id, opts) => {
  logCalls.push(opts);
  if (logText instanceof Error) throw logText;
  return logText;
};
const portsMod = require('../src/services/ports');
const busyPorts = new Set();
portsMod.isPortFree = async (p) => !busyPorts.has(p);
portsMod.suggestPorts = async () => ({ game: 25565, rcon: 25575, bedrock: null });

const containers = require('../src/docker/containers');
const images = require('../src/docker/images');
const calls = [];
let failOn = {};
let inspect = { exists: false };
let createErr = null;
let createErrOnce = null;
const track =
  (name, ret) =>
  async (...a) => {
    calls.push(name);
    if (failOn[name]) throw failOn[name];
    return typeof ret === 'function' ? ret(...a) : ret;
  };
containers.createContainer = async (spec) => {
  calls.push('create');
  lastSpec = spec;
  if (createErrOnce) {
    const e = createErrOnce;
    createErrOnce = null;
    throw e;
  }
  if (createErr) throw createErr;
  return `cid_${calls.length}`;
};
let lastSpec;
containers.removeContainer = track('remove');
containers.startContainer = track('startContainer');
containers.stopContainer = track('stopContainer');
containers.killContainer = track('kill');
containers.inspectStatus = async () => inspect;
containers.removeStaleNameConflict = track('removeStale', false);
containers.chownDataDir = track('chown');
images.ensureImage = track('ensureImage');

const defaults = {
  createContainer: containers.createContainer,
  stopContainer: containers.stopContainer,
  removeStaleNameConflict: containers.removeStaleNameConflict,
  inspectStatus: containers.inspectStatus,
};

const servers = require('../src/services/servers');
const { dataPath } = require('../src/storage/pathGuard');
const scheduler = require('../src/services/scheduler');

const events = (id, type) => db.all('SELECT * FROM events WHERE server_id = ? AND type = ?', id, type);
const row = (id) => db.get('SELECT * FROM servers WHERE id = ?', id);
const create = (over = {}) => servers.createServer({ name: 'Test', type: 'PAPER', autoBackup: false, ...over });

test.beforeEach(() => {
  Object.assign(containers, defaults);
  calls.length = 0;
  logCalls.length = 0;
  failOn = {};
  inspect = { exists: false };
  createErr = null;
  createErrOnce = null;
  logText = '';
  busyPorts.clear();
});

test.after(() => {
  for (const r of db.all('SELECT id FROM schedules')) scheduler.deleteSchedule(r.id);
});

test('createServer inserts the row with defaults, makes the dirs, builds the container, and records an event', async () => {
  const progress = [];
  const s = await servers.createServer(
    { name: 'Alpha', type: 'PAPER', autoBackup: false },
    { actor: 'tester', onProgress: (p) => progress.push(p) }
  );
  assert.match(s.id, /^srv_/);
  assert.equal(s.mc_version, 'LATEST');
  assert.equal(s.status, 'stopped');
  assert.equal(s.auto_restart, 1, 'auto-restart defaults on');
  assert.deepEqual([s.port_game, s.port_rcon], [25565, 25575]);
  assert.match(s.container_id, /^cid_/);
  assert.ok(fs.existsSync(dataPath('servers', s.id)));
  assert.equal(events(s.id, 'created').length, 1);
  assert.deepEqual(calls, ['ensureImage', 'create']);
  assert.match(progress[0], /^Pulling image .*…$/);
  assert.equal(progress.at(-1), 'Creating container…');
  assert.equal(lastSpec.ports.game, 25565);
  assert.equal(lastSpec.env.EULA, 'TRUE');
});

test('an explicit game port is validated together with its derived RCON port', async () => {
  const s = await create({ portGame: 30000 });
  assert.equal(s.port_rcon, 30000 + require('../src/config').ports.rconOffset);
  // Another server's game port sits exactly where this one's RCON would land.
  await create({ portGame: 41000 + require('../src/config').ports.rconOffset });
  await assert.rejects(
    () => create({ portGame: 41000 }),
    (e) => e.status === 400 && /already in use/.test(e.message)
  );
  await create({ portGame: 32001 }); // takes the query port asked for below
  await assert.rejects(
    () => create({ portGame: 32000, portRcon: 32002, portQuery: 32001 }),
    (e) => e.status === 400
  );
  assert.equal(db.all('SELECT 1 FROM servers WHERE port_game IN (41000, 32000)').length, 0, 'no row left behind');
});

test('a CurseForge server without an API key fails fast (412) before anything is created', async () => {
  const before = db.all('SELECT id FROM servers').length;
  await assert.rejects(
    () => create({ type: 'AUTO_CURSEFORGE', env: { CF_SLUG: 'atm10', CF_FILE_ID: '1' } }),
    (e) => e.status === 412 && /API key/.test(e.message)
  );
  assert.equal(db.all('SELECT id FROM servers').length, before);
  assert.deepEqual(calls, []);
});

test('an unpinned modpack selector is refused (400)', async () => {
  const apiKeys = require('../src/services/apiKeys');
  const real = apiKeys.getKey;
  apiKeys.getKey = () => 'key';
  try {
    await assert.rejects(
      () => create({ type: 'AUTO_CURSEFORGE', env: { CF_SLUG: 'atm10' } }),
      (e) => e.status === 400
    );
  } finally {
    apiKeys.getKey = real;
  }
});

test('a failed container create rolls back the row, ports, and directories, and rethrows', async () => {
  createErr = new Error('daemon exploded');
  const before = db.all('SELECT id FROM servers').length;
  await assert.rejects(() => create(), /daemon exploded/);
  assert.equal(db.all('SELECT id FROM servers').length, before);
  assert.ok(calls.includes('remove'), 'the partial container is cleaned up');
  const dirs = fs.readdirSync(dataPath('servers')).filter((d) => d.startsWith('srv_'));
  for (const d of dirs)
    assert.ok(db.get('SELECT 1 FROM servers WHERE id = ?', d), 'no orphan dir for a rolled-back server');
});

test('a rollback survives its own cleanup failing, and a 409 on a custom name is explained', async () => {
  createErr = Object.assign(new Error('conflict'), { statusCode: 409 });
  failOn = { remove: new Error('cannot remove') };
  await assert.rejects(
    () => create({ containerName: 'my-mc' }),
    (e) => e.status === 409 && /"my-mc" is already in use/.test(e.message)
  );
});

test('a failed create does not break the next one (serialized chain)', async () => {
  createErrOnce = new Error('first fails');
  const bad = create();
  const good = create();
  await assert.rejects(() => bad, /first fails/);
  assert.ok((await good).id);
});

test('new servers get a staggered daily backup schedule unless autoBackup is off', async () => {
  const s = await servers.createServer({ name: 'Backed', type: 'PAPER' });
  const sched = db.all('SELECT * FROM schedules WHERE server_id = ?', s.id);
  assert.equal(sched.length, 1);
  assert.equal(sched[0].task_type, 'backup');
  const [m, h] = sched[0].cron.split(' ').map(Number);
  assert.ok(h >= 2 && h <= 5 && m >= 0 && m < 60, sched[0].cron);
  const off = await create();
  assert.equal(db.all('SELECT 1 FROM schedules WHERE server_id = ?', off.id).length, 0);
});

test('create with start:true starts the server after creating it', async () => {
  const s = await servers.createServer({ name: 'Go', type: 'PAPER', autoBackup: false }, { start: true });
  assert.ok(calls.includes('startContainer'));
  assert.equal(row(s.id).status, 'starting');
});

test('startServer rebuilds a missing container or a pending change first, then starts and records it', async () => {
  const s = await create();
  calls.length = 0;
  inspect = { exists: false };
  await servers.startServer(s.id, { actor: 'tester' });
  assert.deepEqual(
    calls.filter((c) => ['remove', 'create', 'startContainer'].includes(c)),
    ['remove', 'create', 'startContainer']
  );
  assert.equal(row(s.id).status, 'starting');
  assert.equal(events(s.id, 'started').length, 1);

  calls.length = 0;
  inspect = { exists: true, status: 'exited' };
  await servers.startServer(s.id);
  assert.ok(!calls.includes('create'), 'an up-to-date container is just started');
  db.run('UPDATE servers SET pending_recreate = 1 WHERE id = ?', s.id);
  calls.length = 0;
  await servers.startServer(s.id);
  assert.ok(calls.includes('create'), 'pending config changes are applied on start');
  assert.equal(row(s.id).pending_recreate, 0);
});

test('lifecycle calls on an unknown server are a 404', async () => {
  for (const fn of ['startServer', 'stopServer', 'killServer', 'recreateServer']) {
    await assert.rejects(
      () => servers[fn]('srv_nope'),
      (e) => e.status === 404,
      fn
    );
  }
});

test('stopServer records the request BEFORE stopping, then marks stopped with a log excerpt', async () => {
  const s = await create();
  logText = 'Saving worlds\nStopping server';
  let requestedBeforeStop = false;
  containers.stopContainer = async () => {
    requestedBeforeStop = events(s.id, 'stop-requested').length === 1;
  };
  await servers.stopServer(s.id, { actor: 'tester' });
  containers.stopContainer = track('stopContainer');
  assert.equal(requestedBeforeStop, true, 'so the watcher never reads the exit as a crash');
  assert.equal(row(s.id).status, 'stopped');
  const [ev] = events(s.id, 'stopped');
  assert.ok(ev.log_excerpt_path, 'the console tail is kept with the event');
});

test('a stop that does not take effect is reported (502) and never claims success', async () => {
  const s = await create();
  db.run("UPDATE servers SET status = 'running' WHERE id = ?", s.id);
  failOn = { stopContainer: new Error('still running') };
  await assert.rejects(
    () => servers.stopServer(s.id),
    (e) => e.status === 502
  );
  assert.equal(row(s.id).status, 'running');
  assert.equal(events(s.id, 'stop-failed').length, 1);
  assert.equal(events(s.id, 'stopped').length, 0);
});

test('a stop still succeeds when the log excerpt cannot be read', async () => {
  const s = await create();
  logText = new Error('logs gone');
  await servers.stopServer(s.id);
  assert.equal(events(s.id, 'stopped')[0].log_excerpt_path, null);
});

test('restart stops then starts and records the request and the outcome', async () => {
  const s = await create();
  await servers.restartServer(s.id);
  const types = db
    .all('SELECT type FROM events WHERE server_id = ? ORDER BY id', s.id)
    .map((e) => e.type)
    .filter((t) => t !== 'created');
  assert.deepEqual(types, ['restart-requested', 'stop-requested', 'stopped', 'started', 'restarted']);
});

test('kill records the request first, force-stops, and warns the world may not have saved', async () => {
  const s = await create();
  await servers.killServer(s.id, { actor: 'tester' });
  assert.equal(row(s.id).status, 'stopped');
  assert.equal(events(s.id, 'kill-requested').length, 1);
  assert.match(events(s.id, 'killed')[0].summary, /may not have saved/);
});

test('a second lifecycle op on the same server while one runs is refused (409)', async () => {
  const s = await create();
  let release;
  containers.stopContainer = () => new Promise((r) => (release = r));
  const stopping = servers.stopServer(s.id);
  await new Promise((r) => setImmediate(r));
  await assert.rejects(
    () => servers.killServer(s.id),
    (e) => e.status === 409
  );
  release();
  await stopping;
  containers.stopContainer = track('stopContainer');
});

test('recreate of a running server stops it gracefully (marking it requested), rebuilds, and restarts', async () => {
  const s = await create();
  inspect = { exists: true, status: 'running' };
  calls.length = 0;
  await servers.recreateServer(s.id);
  assert.deepEqual(
    calls.filter((c) => ['stopContainer', 'remove', 'create', 'startContainer'].includes(c)),
    ['stopContainer', 'remove', 'create', 'startContainer']
  );
  assert.ok(events(s.id, 'stop-requested').some((e) => /Rebuild requested/.test(e.summary)));
  assert.equal(events(s.id, 'recreated').length, 1);
});

test('recreate tolerates a failing graceful stop and can be quiet', async () => {
  const s = await create();
  inspect = { exists: true, status: 'exited' };
  await servers.recreateServer(s.id, { quiet: true });
  assert.equal(events(s.id, 'recreated').length, 0);
  inspect = { exists: true, status: 'running' };
  failOn = { stopContainer: new Error('wedged') };
  await servers.recreateServer(s.id, { quiet: true });
  assert.ok(calls.includes('remove'), 'removal is forced regardless');
});

test('recreate: a 409 name conflict on our own orphan is removed and retried once', async () => {
  const s = await create();
  let attempts = 0;
  containers.createContainer = async () => {
    attempts += 1;
    if (attempts === 1) throw Object.assign(new Error('conflict'), { statusCode: 409 });
    return 'cid_retry';
  };
  containers.removeStaleNameConflict = async () => true;
  await servers.recreateServer(s.id, { quiet: true });
  assert.equal(attempts, 2);
  assert.equal(row(s.id).container_id, 'cid_retry');
});

test('recreate: a 409 that is not ours is explained for a custom name and rethrown otherwise', async () => {
  const s = await create({ containerName: 'custom' });
  const plain = await create();
  containers.createContainer = async () => {
    throw Object.assign(new Error('conflict'), { statusCode: 409 });
  };
  containers.removeStaleNameConflict = async () => false;
  await assert.rejects(
    () => servers.recreateServer(s.id, { quiet: true }),
    (e) => e.status === 409 && /"custom" is already in use/.test(e.message)
  );
  await assert.rejects(
    () => servers.recreateServer(plain.id, { quiet: true }),
    (e) => e.statusCode === 409
  );
});

test('recreate does not clear a pending flag that a concurrent edit set mid-rebuild', async () => {
  const s = await create();
  db.run('UPDATE servers SET pending_recreate = 1 WHERE id = ?', s.id);
  containers.createContainer = async () => {
    db.run('UPDATE servers SET heap_mb = heap_mb + 512 WHERE id = ?', s.id); // a PATCH lands mid-recreate
    return 'cid_mid';
  };
  await servers.recreateServer(s.id, { quiet: true });
  assert.equal(row(s.id).pending_recreate, 1, 'the new change still needs applying');
});

// ---- status refresh -----------------------------------------------------------

async function withServer(status, { startedAgoMs = null, autoStart = 0, autoRestart = 0 } = {}) {
  const s = await create();
  const started =
    startedAgoMs == null ? null : new Date(Date.now() - startedAgoMs).toISOString().slice(0, 19).replace('T', ' ');
  db.run(
    'UPDATE servers SET status = ?, last_started_at = ?, auto_start = ?, auto_restart = ? WHERE id = ?',
    status,
    started,
    autoStart,
    autoRestart,
    s.id
  );
  return s.id;
}

test('refreshStatuses mirrors Docker: running, exited, and missing containers', async () => {
  const id = await withServer('stopped');
  inspect = { exists: true, status: 'running', health: 'healthy' };
  await servers.refreshStatuses();
  assert.equal(row(id).status, 'running');
  inspect = { exists: false };
  await servers.refreshStatuses();
  assert.equal(row(id).status, 'stopped');
});

test('a server that is starting for under 2 minutes stays starting without reading logs', async () => {
  const id = await withServer('starting', { startedAgoMs: 30_000 });
  inspect = { exists: true, status: 'starting' };
  await servers.refreshStatuses();
  assert.equal(row(id).status, 'starting');
  assert.equal(logCalls.length, 0);
});

test('a booting server flips to running once this boot logged "Done (", scoped to this boot', async () => {
  const id = await withServer('starting', { startedAgoMs: 5 * 60_000 });
  inspect = { exists: true, status: 'starting' };
  logText = 'Done (12.3s)! For help, type "help"';
  await servers.refreshStatuses();
  assert.equal(row(id).status, 'running');
  assert.ok(Number.isFinite(logCalls.at(-1).since), 'only this boot is read');
});

test('a server still booting after 10 minutes is flagged stalled once, with a diagnosis when possible', async () => {
  const id = await withServer('starting', { startedAgoMs: 15 * 60_000 });
  inspect = { exists: true, status: 'starting' };
  logText = 'Failed to bind to port 25565';
  await servers.refreshStatuses();
  assert.equal(row(id).status, 'stalled');
  const [ev] = events(id, 'startup-stalled');
  assert.match(ev.summary, /game port is already in use/);
  await servers.refreshStatuses();
  assert.equal(events(id, 'startup-stalled').length, 1, 'announced once');
  logText = 'Done (99s)!';
  await servers.refreshStatuses();
  assert.equal(row(id).status, 'running', 'a stalled server recovers when it finally finishes booting');
});

test('a slow boot with no diagnosable log gets the generic stalled message', async () => {
  const id = await withServer('starting', { startedAgoMs: 12 * 60_000 });
  inspect = { exists: true, status: 'starting' };
  logText = new Error('no logs');
  await servers.refreshStatuses();
  assert.match(events(id, 'startup-stalled')[0].summary, /Still starting after 12 minutes/);
});

test('boot: a server that was up but is now down gets one alert, unless the boot will restart it', async () => {
  const lost = await withServer('running');
  const auto = await withServer('running', { autoStart: 1 });
  const crashedRestart = await withServer('running', { autoRestart: 1 });
  inspect = { exists: false };
  await servers.refreshStatuses({ boot: true });
  assert.equal(events(lost, 'offline-after-restart').length, 1);
  assert.equal(events(auto, 'offline-after-restart').length, 0, 'auto_start will bring it back');
  assert.equal(events(crashedRestart, 'offline-after-restart').length, 1, 'not crashed, so nothing revives it');

  const c = await withServer('running', { autoRestart: 1 });
  inspect = { exists: true, status: 'crashed' };
  await servers.refreshStatuses({ boot: true });
  assert.equal(events(c, 'offline-after-restart').length, 0, 'auto_restart will revive a crashed server');
});

test('a non-boot refresh never raises the offline alert', async () => {
  const id = await withServer('running');
  inspect = { exists: false };
  await servers.refreshStatuses();
  assert.equal(events(id, 'offline-after-restart').length, 0);
});

test('one failing inspect does not stop the rest of the fleet from refreshing', async () => {
  const bad = await withServer('running');
  const good = await withServer('stopped');
  containers.inspectStatus = async (id) => {
    if (id === bad) throw new Error('inspect failed');
    return { exists: true, status: 'running', health: 'healthy' };
  };
  await servers.refreshStatuses();
  containers.inspectStatus = async () => inspect;
  assert.equal(row(bad).status, 'running', 'the failing one keeps its last known status');
  assert.equal(row(good).status, 'running');
});

test('overlapping refreshes are coalesced', async () => {
  await withServer('stopped');
  let inspects = 0;
  containers.inspectStatus = async () => {
    inspects += 1;
    await new Promise((r) => setTimeout(r, 30));
    return { exists: false };
  };
  const total = db.all('SELECT 1 FROM servers WHERE deleted_at IS NULL').length;
  await Promise.all([servers.refreshStatuses(), servers.refreshStatuses()]);
  containers.inspectStatus = async () => inspect;
  assert.equal(inspects, total, 'the second call was a no-op while the first was running');
});
