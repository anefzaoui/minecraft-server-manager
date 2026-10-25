'use strict';

// Changing a server's game port after creation, and the free-port rules it
// shares with create: a server's own live and pending ports are free for
// itself, other servers' pending ports are taken, host ports other Docker
// containers publish are taken, and non-admins stay inside the game runway.
// A high runway keeps the OS probe away from anything a developer machine runs.
process.env.PORT_GAME_START = '47100';
const app = require('./helpers/app');
const { realPublishedHostPorts } = require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const containers = require('../src/docker/containers');
const images = require('../src/docker/images');
const ports = require('../src/services/ports');
const servers = require('../src/services/servers');
const { guardOp } = require('../src/services/opLock');

let cookie;
let opCookie;
let viewerCookie;

async function login(username, password, role) {
  await require('../src/services/auth').createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

function seed(id, game, { rcon = game + 1000, bedrock = null, extraPorts = [] } = {}) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, port_bedrock, rcon_password_cipher, heap_mb, container_memory_mb, extra_ports_json)
     VALUES (?, ?, 'VANILLA', ?, ?, ?, 'x', 1024, 1536, ?)`,
    id,
    id,
    game,
    rcon,
    bedrock,
    JSON.stringify(extraPorts)
  );
}

const row = (id) => ({
  ...db.get(
    'SELECT port_game, port_rcon, port_game_pending, port_rcon_pending, pending_recreate FROM servers WHERE id = ?',
    id
  ),
});
const putPort = (id, port, who = cookie) => app.req('PUT', `/api/servers/${id}/port`, { cookie: who, body: { port } });
const lastSummary = (id) =>
  db.get('SELECT summary FROM events WHERE server_id = ? ORDER BY id DESC LIMIT 1', id).summary;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  opCookie = await login('portop', 'operatorpass123', 'operator');
  viewerCookie = await login('portviewer', 'viewerpass123', 'viewer');
});
test.after(app.stop);
test.beforeEach((t) => {
  db.run('DELETE FROM servers');
  db.run('DELETE FROM events'); // event assertions must see only this test's history
  ports.clearPortCache();
  t.mock.method(containers, 'inspectStatus', async () => ({ exists: true, status: 'stopped' }));
});

// ---- free-port rules ---------------------------------------------------------

test('suggestPorts skips other servers but may hand a server its own current ports', async () => {
  seed('srv_a', 47100);
  assert.equal((await ports.suggestPorts()).game, 47101);
  assert.deepEqual(await ports.suggestPorts({ exceptServerId: 'srv_a' }), { game: 47100, rcon: 48100, bedrock: null });
  assert.equal(await ports.isPortFree(47100), false);
  assert.equal(await ports.isPortFree(47100, { exceptServerId: 'srv_a' }), true);
});

test('a server keeps its own Bedrock and extra ports while it moves its game port', async () => {
  seed('srv_a', 47100, { bedrock: 47102, extraPorts: [{ hostPort: 47101, containerPort: 8100, protocol: 'tcp' }] });
  assert.equal(await ports.isPortFree(47101, { exceptServerId: 'srv_a' }), false);
  assert.equal(await ports.isPortFree(47102, { exceptServerId: 'srv_a' }), false);
});

test('host ports other Docker containers publish are never suggested', async (t) => {
  t.mock.method(containers, 'publishedHostPorts', async () => new Set([47100, 48101]));
  // 47100 is taken outright; 47101 is free but its RCON port 48101 is not.
  assert.equal((await ports.suggestPorts()).game, 47102);
});

test('an unreachable Docker daemon falls back to the DB and OS checks', async (t) => {
  t.mock.method(containers, 'publishedHostPorts', async () => {
    throw new Error('connect ENOENT /var/run/docker.sock');
  });
  assert.equal((await ports.suggestPorts()).game, 47100);
});

test('the Docker snapshot is reused for a few seconds instead of listed per check', async (t) => {
  const spy = t.mock.method(containers, 'publishedHostPorts', async () => new Set());
  await ports.isPortFree(47100);
  await ports.isPortFree(47101);
  await ports.suggestPorts();
  assert.equal(spy.mock.callCount(), 1);
});

test('checkGamePort explains why a port is unusable', async () => {
  seed('srv_a', 47100);
  seed('srv_b', 47120);
  assert.equal((await ports.checkGamePort(47120, { exceptServerId: 'srv_a' })).reason, 'taken');
  // Too high for its RCON port, and below the runway for a non-admin.
  assert.equal((await ports.checkGamePort(65000, { exceptServerId: 'srv_a', isAdmin: true })).reason, 'range');
  const low = await ports.checkGamePort(41234, { exceptServerId: 'srv_a' });
  assert.deepEqual([low.reason, low.min, low.max], ['range', 47100, 64535]);
  assert.equal((await ports.checkGamePort(41234, { exceptServerId: 'srv_a', isAdmin: true })).free, true);
});

// ---- PUT /servers/:id/port -----------------------------------------------------

test('a port change waits as pending: the live pair keeps serving until a rebuild', async () => {
  seed('srv_a', 47100);
  const r = await putPort('srv_a', 47150);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.changed, r.json.cancelled, r.json.running], [true, false, false]);
  assert.deepEqual(row('srv_a'), {
    port_game: 47100,
    port_rcon: 48100,
    port_game_pending: 47150,
    port_rcon_pending: 48150,
    pending_recreate: 1,
  });
  assert.equal(lastSummary('srv_a'), 'Game port set to move from 47100 to 47150 on the next start or restart.');
});

test('a running server is reported so the UI can offer a restart', async (t) => {
  t.mock.method(containers, 'inspectStatus', async () => ({ exists: true, status: 'running' }));
  seed('srv_a', 47100);
  const r = await putPort('srv_a', 47150);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.running, true);
});

test('choosing the live port again cancels a pending move', async () => {
  seed('srv_a', 47100);
  await putPort('srv_a', 47150);
  // Its own pending and live ports are free for it, though Docker may hold the live one.
  const check = await app.req('GET', '/api/servers/srv_a/port/check?port=47150', { cookie });
  assert.equal(check.json.free, true);
  const r = await putPort('srv_a', 47100);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.changed, r.json.cancelled], [true, true]);
  assert.equal(row('srv_a').port_game_pending, null);
  assert.equal(lastSummary('srv_a'), 'Game port move to 47150 cancelled. It stays on 47100.');
});

test('saving the pending port again is a no-op', async () => {
  seed('srv_a', 47100);
  await putPort('srv_a', 47150);
  const r = await putPort('srv_a', 47150);
  assert.equal(r.json.changed, false);
});

test('a port another server holds, live, pending, or as derived RCON, is refused', async () => {
  seed('srv_a', 47100);
  seed('srv_b', 47120);
  await putPort('srv_b', 47130); // srv_b now holds 47120 live and 47130 pending
  for (const port of [47120, 47130, 46120]) {
    // 46120's derived RCON port is srv_b's live game port.
    const r = await putPort('srv_a', port);
    assert.equal(r.status, 400, `port ${port}`);
    assert.match(r.json.error, /already in use/);
  }
  assert.equal(row('srv_a').port_game_pending, null);
});

test('a game port whose RCON port something outside the panel holds is refused', async () => {
  // An OS-level clash nothing in the DB or Docker knows about, like a dev server
  // on the derived RCON port.
  seed('srv_a', 47100);
  const blocker = require('node:net').createServer();
  await new Promise((resolve) => blocker.listen(48170, '0.0.0.0', resolve));
  try {
    const r = await putPort('srv_a', 47170);
    assert.equal(r.status, 400);
    assert.equal(
      r.json.error,
      'Port 47170 or its RCON port 48170 is already in use. Pick another, or use the next free port.'
    );
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test('non-admins stay inside the game port range; admins may go below it', async () => {
  seed('srv_a', 47100);
  const op = await putPort('srv_a', 41234, opCookie);
  assert.equal(op.status, 400);
  assert.equal(op.json.error, 'Pick a game port from 47100 to 64535.');
  const admin = await putPort('srv_a', 41234, cookie);
  assert.equal(admin.status, 200, admin.text);
  assert.equal(row('srv_a').port_rcon_pending, 42234);
});

test('a game port too high for its RCON port is refused with the range', async () => {
  seed('srv_a', 47100);
  const r = await putPort('srv_a', 65000);
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'Pick a game port from 1024 to 64535.');
  assert.equal((await putPort('srv_a', 'abc')).status, 400);
});

test('a port change while another action runs on the server answers 409', async () => {
  seed('srv_a', 47100);
  let release;
  const held = guardOp('restart', () => new Promise((r) => (release = r)))('srv_a');
  const r = await putPort('srv_a', 47150);
  assert.equal(r.status, 409);
  assert.match(r.json.error, /Another action is running/);
  release();
  await held;
});

test('viewers can neither change, check, nor suggest ports', async () => {
  seed('srv_a', 47100);
  for (const [method, path] of [
    ['PUT', '/api/servers/srv_a/port'],
    ['GET', '/api/servers/srv_a/port/check?port=47150'],
    ['GET', '/api/servers/srv_a/port/suggest'],
    ['GET', '/api/ports/check?port=47150'],
    ['GET', '/api/ports/suggest'],
  ]) {
    const body = method === 'PUT' ? { port: 47150 } : undefined;
    const r = await app.req(method, path, { cookie: viewerCookie, body });
    assert.ok([403, 404].includes(r.status), `${method} ${path} answered ${r.status}`);
  }
  assert.equal(row('srv_a').port_game_pending, null);
});

test('the server-scoped check and suggest routes treat its own ports as free', async () => {
  seed('srv_a', 47100);
  const check = await app.req('GET', '/api/servers/srv_a/port/check?port=47100', { cookie });
  assert.equal(check.json.free, true);
  assert.equal(check.json.rcon, 48100);
  const global = await app.req('GET', '/api/ports/check?port=47100', { cookie });
  assert.equal(global.json.free, false);
  const suggest = await app.req('GET', '/api/servers/srv_a/port/suggest', { cookie });
  assert.equal(suggest.json.ports.game, 47100);
});

// ---- applying it: the rebuild ------------------------------------------------------

function mockRebuild(t, onCreate = () => {}) {
  const specs = [];
  t.mock.method(containers, 'stopContainer', async () => {});
  t.mock.method(containers, 'removeContainer', async () => {});
  t.mock.method(containers, 'removeStaleNameConflict', async () => false);
  t.mock.method(images, 'ensureImage', async () => {});
  t.mock.method(containers, 'createContainer', async (spec) => {
    specs.push(spec);
    onCreate();
    return 'cid-test';
  });
  return specs;
}

test('a rebuild promotes the pending pair and builds the container on it', async (t) => {
  const specs = mockRebuild(t);
  seed('srv_a', 47100);
  await putPort('srv_a', 47150);
  await servers.recreateServer('srv_a', { actor: 'test' });
  assert.deepEqual(specs[0].ports, { game: 47150, rcon: 48150, bedrock: null });
  assert.deepEqual(row('srv_a'), {
    port_game: 47150,
    port_rcon: 48150,
    port_game_pending: null,
    port_rcon_pending: null,
    pending_recreate: 0,
  });
  const moved = db.get(
    "SELECT summary FROM events WHERE server_id = 'srv_a' AND summary LIKE 'Game port moved%' ORDER BY id DESC LIMIT 1"
  );
  assert.equal(moved.summary, 'Game port moved from 47100 to 47150.');
});

test('a port change that lands mid-rebuild keeps the rebuild flag for the next one', async (t) => {
  mockRebuild(t, () => {
    db.run('UPDATE servers SET port_game_pending = 47160, port_rcon_pending = 48160, pending_recreate = 1');
  });
  seed('srv_a', 47100);
  await servers.recreateServer('srv_a', { actor: 'test' });
  assert.equal(row('srv_a').pending_recreate, 1);
  assert.equal(row('srv_a').port_game_pending, 47160);
});

test('a slow server create never blocks a port change', async (t) => {
  let finishPull;
  t.mock.method(images, 'ensureImage', () => new Promise((r) => (finishPull = r)));
  t.mock.method(containers, 'createContainer', async () => 'cid-new');
  // A new server seeds a backup schedule, whose cron timer would keep this process alive.
  t.mock.method(require('../src/services/scheduler'), 'createSchedule', () => {});
  seed('srv_a', 47100);
  const creating = servers.createServer({ name: 'Slow', type: 'VANILLA', mcVersion: '1.21.1' }, { actor: 'test' });
  while (!finishPull) await new Promise((r) => setImmediate(r)); // create is now inside the image pull
  const r = await putPort('srv_a', 47150);
  assert.equal(r.status, 200, r.text);
  finishPull();
  const created = await creating;
  assert.notEqual(created.port_game, 47150);
});

// ---- the Docker listing itself -------------------------------------------------------

test('publishedHostPorts reads live and stopped bindings, skipping the server itself', async (t) => {
  const docker = require('../src/docker/connect').getDocker();
  t.mock.method(docker, 'listContainers', async () => [
    { Id: 'own', State: 'running', Labels: { 'msm.id': 'srv_a' }, Ports: [{ PublicPort: 47100 }] },
    { Id: 'other', State: 'running', Labels: { 'msm.id': 'srv_b' }, Ports: [{ PublicPort: 47120 }, {}] },
    { Id: 'outside', State: 'exited', Labels: {}, Ports: [] },
    { Id: 'managed-stopped', State: 'exited', Labels: { 'msm.id': 'srv_c' }, Ports: [] },
  ]);
  const inspected = [];
  t.mock.method(docker, 'getContainer', (id) => ({
    inspect: async () => {
      inspected.push(id);
      const binds =
        id === 'outside'
          ? { '25565/tcp': [{ HostIp: '', HostPort: '47130' }], '8080/tcp': null }
          : { '7000/udp': [{ HostPort: '47140-47142' }] };
      return { HostConfig: { PortBindings: binds } };
    },
  }));
  const used = await realPublishedHostPorts({ exceptServerId: 'srv_a' });
  assert.deepEqual(
    [...used].sort((a, b) => a - b),
    [47120, 47130, 47140, 47141, 47142]
  );
  assert.deepEqual(inspected.sort(), ['managed-stopped', 'outside']); // never the server itself
});

test('publishedHostPorts keeps running containers ports when an inspect hangs', async (t) => {
  const docker = require('../src/docker/connect').getDocker();
  t.mock.method(docker, 'listContainers', async () => [
    { Id: 'live', State: 'running', Labels: {}, Ports: [{ PublicPort: 47120 }] },
    { Id: 'stuck', State: 'exited', Labels: {}, Ports: [] },
  ]);
  t.mock.method(docker, 'getContainer', () => ({ inspect: () => new Promise(() => {}) }));
  const used = await realPublishedHostPorts({ deadlineMs: 50 });
  assert.deepEqual([...used], [47120]);
});

test('publishedHostPorts throws when the list itself never answers', async (t) => {
  const docker = require('../src/docker/connect').getDocker();
  t.mock.method(docker, 'listContainers', () => new Promise(() => {}));
  await assert.rejects(realPublishedHostPorts({ deadlineMs: 50 }), /did not list/);
});

// ---- applying it through start / restart, and when it can't --------------------

function mockLifecycle(t, { startFails = false } = {}) {
  const specs = mockRebuild(t);
  let running = false;
  t.mock.method(containers, 'inspectStatus', async () => ({ exists: true, status: running ? 'running' : 'stopped' }));
  t.mock.method(containers, 'startContainer', async () => {
    if (startFails) throw Object.assign(new Error('port is already allocated'), { statusCode: 500 });
    running = true;
  });
  t.mock.method(containers, 'stopContainer', async () => {
    running = false;
  });
  return specs;
}
test('Keep (the live game port) cancels a move even when RCON was set by hand', async () => {
  seed('srv_a', 47100, { rcon: 47999 });
  await putPort('srv_a', 47150);
  const r = await putPort('srv_a', 47100);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.cancelled, true);
  assert.deepEqual([row('srv_a').port_game_pending, row('srv_a').port_rcon], [null, 47999]);
});

test('a start applies a pending move', async (t) => {
  const specs = mockLifecycle(t);
  seed('srv_a', 47100);
  await putPort('srv_a', 47150);
  await servers.startServer('srv_a', { actor: 'test' });
  assert.equal(specs.at(-1).ports.game, 47150);
  assert.deepEqual(
    [row('srv_a').port_game, row('srv_a').port_game_pending, row('srv_a').pending_recreate],
    [47150, null, 0]
  );
});

test('a restart of a running server applies a pending move', async (t) => {
  const specs = mockLifecycle(t);
  seed('srv_a', 47100);
  await servers.startServer('srv_a', { actor: 'test' });
  await putPort('srv_a', 47150);
  await servers.restartServer('srv_a', { actor: 'test' });
  assert.equal(specs.at(-1).ports.game, 47150);
  assert.equal(row('srv_a').port_game, 47150);
});

test('a start that fails on the new port puts the old one back and keeps the move pending', async (t) => {
  mockLifecycle(t, { startFails: true });
  seed('srv_a', 47100);
  await putPort('srv_a', 47150);
  await assert.rejects(servers.startServer('srv_a', { actor: 'test' }));
  assert.deepEqual(row('srv_a'), {
    port_game: 47100,
    port_rcon: 48100,
    port_game_pending: 47150,
    port_rcon_pending: 48150,
    pending_recreate: 1,
  });
  assert.equal(
    db.get(
      "SELECT summary FROM events WHERE server_id = 'srv_a' AND type = 'port-move-blocked' ORDER BY id DESC LIMIT 1"
    ).summary,
    'The server could not start on port 47150, so it stays on 47100. The move is still pending.'
  );
});

test('a pending port taken by something else by start time: the server starts on its old port', async (t) => {
  const specs = mockLifecycle(t);
  seed('srv_a', 47100);
  await putPort('srv_a', 47150);
  const blocker = require('node:net').createServer();
  await new Promise((resolve) => blocker.listen(47150, '0.0.0.0', resolve));
  try {
    await servers.startServer('srv_a', { actor: 'test' });
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
  assert.equal(specs.at(-1).ports.game, 47100); // up, on the old port
  const r = row('srv_a');
  assert.deepEqual([r.port_game, r.port_game_pending, r.pending_recreate], [47100, 47150, 1]); // tried again next start
  assert.match(
    db.get(
      "SELECT summary FROM events WHERE server_id = 'srv_a' AND type = 'port-move-blocked' ORDER BY id DESC LIMIT 1"
    ).summary,
    /in use by something else, so the server stayed on 47100/
  );
  assert.ok(!db.get("SELECT 1 AS x FROM events WHERE server_id = 'srv_a' AND summary LIKE 'Game port moved%'"));
});
