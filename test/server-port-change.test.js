'use strict';

// Changing a server's game port after creation, applied at once: a running
// server is restarted on the new port, a stopped one gets a new container on
// it, and a failure puts it back on the old port with the row untouched. Plus
// the free-port rules it shares with create, and the Docker port listing.
//
// Ports come from a random high runway so the OS probe can't collide with
// anything a developer machine happens to run. P(n) is that runway + n.
const BASE = 41000 + Math.floor(Math.random() * 300) * 10;
process.env.PORT_GAME_START = String(BASE);
const P = (n) => BASE + n;
const R = (n) => BASE + n + 1000; // the derived RCON port

const app = require('./helpers/app');
const { realPublishedHostPorts } = require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
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

const row = (id) => ({ ...db.get('SELECT port_game, port_rcon, pending_recreate FROM servers WHERE id = ?', id) });
// restart: true is what the card sends once the person agreed to restart a running server.
const putPort = (id, port, who = cookie, extra = { restart: true }) =>
  app.req('PUT', `/api/servers/${id}/port`, { cookie: who, body: { port, ...extra } });
const summaries = (id) =>
  db.all('SELECT summary FROM events WHERE server_id = ? ORDER BY id', id).map((e) => e.summary);

function hold(port) {
  const s = net.createServer();
  return new Promise((resolve) => s.listen(port, '0.0.0.0', () => resolve(() => new Promise((r) => s.close(r)))));
}

/**
 * A fake Docker for one server: tracks what each container was built on and
 * whether it runs. `failOn(ports)` decides whether starting the container built
 * last fails (like Docker refusing to bind a port), returning the error text.
 */
function mockDocker(t, { running = false, failOn = () => null } = {}) {
  const built = [];
  const calls = { start: 0, stop: 0 };
  let up = running;
  t.mock.method(containers, 'inspectStatus', async () => ({ exists: true, status: up ? 'running' : 'stopped' }));
  t.mock.method(containers, 'stopContainer', async () => {
    calls.stop++;
    up = false;
  });
  t.mock.method(containers, 'removeContainer', async () => {});
  t.mock.method(containers, 'removeStaleNameConflict', async () => false);
  t.mock.method(images, 'ensureImage', async () => {});
  t.mock.method(containers, 'createContainer', async (spec) => {
    built.push(spec.ports);
    return `cid-${built.length}`;
  });
  t.mock.method(containers, 'startContainer', async () => {
    calls.start++;
    const message = failOn(built.at(-1));
    if (message) throw Object.assign(new Error(message), { statusCode: 500 });
    if (up) throw Object.assign(new Error('(HTTP code 304) container already started'), { statusCode: 304 });
    up = true;
  });
  return { built, calls, isUp: () => up };
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  opCookie = await login('portop', 'operatorpass123', 'operator');
  viewerCookie = await login('portviewer', 'viewerpass123', 'viewer');
});
test.after(app.stop);
test.beforeEach((t) => {
  db.run('DELETE FROM servers');
  db.run('DELETE FROM events');
  ports.clearPortCache();
  t.mock.method(containers, 'inspectStatus', async () => ({ exists: true, status: 'stopped' }));
});

// ---- free-port rules ---------------------------------------------------------

test('suggestPorts skips other servers but may hand a server its own current ports', async () => {
  seed('srv_a', P(0));
  assert.equal((await ports.suggestPorts()).game, P(1));
  assert.deepEqual(await ports.suggestPorts({ exceptServerId: 'srv_a' }), { game: P(0), rcon: R(0), bedrock: null });
  assert.equal(await ports.isPortFree(P(0)), false);
  assert.equal(await ports.isPortFree(P(0), { exceptServerId: 'srv_a' }), true);
});

test('a server keeps its own Bedrock and extra ports while it moves its game port', async () => {
  seed('srv_a', P(0), { bedrock: P(2), extraPorts: [{ hostPort: P(1), containerPort: 8100, protocol: 'tcp' }] });
  assert.equal(await ports.isPortFree(P(1), { exceptServerId: 'srv_a' }), false);
  assert.equal(await ports.isPortFree(P(2), { exceptServerId: 'srv_a' }), false);
});

test('host ports other Docker containers publish are never suggested', async (t) => {
  t.mock.method(containers, 'publishedHostPorts', async () => new Set([P(0), R(1)]));
  assert.equal((await ports.suggestPorts()).game, P(2)); // P(1)'s RCON port is taken
});

test('an unreachable Docker daemon falls back to the DB and OS checks', async (t) => {
  t.mock.method(containers, 'publishedHostPorts', async () => {
    throw new Error('connect ENOENT /var/run/docker.sock');
  });
  assert.equal((await ports.suggestPorts()).game, P(0));
});

test('the Docker snapshot is reused for a few seconds, failures included', async (t) => {
  const spy = t.mock.method(containers, 'publishedHostPorts', async () => {
    throw new Error('Docker did not list its containers in time.');
  });
  await ports.isPortFree(P(0));
  await ports.isPortFree(P(1));
  await ports.suggestPorts();
  assert.equal(spy.mock.callCount(), 1);
});

test('checkGamePort explains why a port is unusable', async () => {
  seed('srv_a', P(0));
  seed('srv_b', P(20));
  assert.equal((await ports.checkGamePort(P(20), { exceptServerId: 'srv_a' })).reason, 'taken');
  assert.equal((await ports.checkGamePort(65000, { exceptServerId: 'srv_a', isAdmin: true })).reason, 'range');
  const low = await ports.checkGamePort(BASE - 50, { exceptServerId: 'srv_a' });
  assert.deepEqual([low.reason, low.min], ['range', BASE]);
});

// ---- changing it ------------------------------------------------------------------

test('a stopped server gets a new container on the new port, and is not started', async (t) => {
  const docker = mockDocker(t);
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.changed, r.json.restarted], [true, false]);
  assert.deepEqual(docker.built, [{ game: P(50), rcon: R(50), bedrock: null }]);
  assert.equal(docker.calls.start, 0);
  assert.deepEqual([row('srv_a').port_game, row('srv_a').port_rcon], [P(50), R(50)]);
  // (The fixture row has a fake RCON password, so a rebuild also logs its regeneration.)
  assert.deepEqual(
    summaries('srv_a').filter((x) => x.startsWith('Game port')),
    [`Game port changed from ${P(0)} to ${P(50)}.`]
  );
});

test('a running server is restarted on the new port', async (t) => {
  const docker = mockDocker(t, { running: true });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.changed, r.json.restarted], [true, true]);
  assert.equal(docker.calls.stop, 1);
  assert.deepEqual(docker.built.at(-1), { game: P(50), rcon: R(50), bedrock: null });
  assert.ok(docker.isUp());
  assert.equal(row('srv_a').port_game, P(50));
  assert.ok(summaries('srv_a').includes(`Game port changed from ${P(0)} to ${P(50)}. The server restarted on it.`));
});

test('a restart that cannot bind the new port puts the server back up on the old one', async (t) => {
  const docker = mockDocker(t, {
    running: true,
    failOn: (built) =>
      built.game === P(50) ? 'driver failed programming external connectivity: bind: address already in use' : null,
  });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.equal(r.status, 500);
  assert.equal(r.json.error, 'That port is already in use by another program on this machine.');
  assert.deepEqual(docker.built.at(-1), { game: P(0), rcon: R(0), bedrock: null });
  assert.ok(docker.isUp(), 'running again');
  assert.deepEqual([row('srv_a').port_game, row('srv_a').port_rcon], [P(0), R(0)]);
  assert.ok(
    summaries('srv_a').includes(
      `Game port change to ${P(50)} failed while starting on the new port, so the server is back on ${P(0)}.`
    )
  );
  assert.ok(!summaries('srv_a').some((s) => s.startsWith('Game port changed')));
});

test('a clash on another port (Bedrock) is reported as itself, and the server is back as it was', async (t) => {
  const docker = mockDocker(t, {
    running: true,
    failOn: (built) => (built.game === P(50) ? 'Bind for 0.0.0.0:19132 failed: port is already allocated' : null),
  });
  seed('srv_a', P(0), { bedrock: 19132 });
  const r = await putPort('srv_a', P(50));
  assert.equal(r.json.error, 'That port is already taken by another container.');
  assert.ok(docker.isUp());
  assert.equal(row('srv_a').port_game, P(0));
});

test('if even the old port will not start, history says so honestly', async (t) => {
  mockDocker(t, { running: true, failOn: () => 'port is already allocated' });
  seed('srv_a', P(0));
  await putPort('srv_a', P(50));
  assert.equal(row('srv_a').port_game, P(0));
  assert.ok(
    summaries('srv_a').includes(
      `Game port change to ${P(50)} failed while starting on the new port, and putting the server back on ${P(0)} failed too. Start it from the panel once the cause is fixed.`
    )
  );
});

test('a failed image pull changes nothing and claims no change', async (t) => {
  mockDocker(t);
  let pulls = 0;
  t.mock.method(images, 'ensureImage', async () => {
    if (++pulls === 1) throw new Error('getaddrinfo ENOTFOUND registry-1.docker.io');
  });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.notEqual(r.status, 200);
  assert.equal(row('srv_a').port_game, P(0));
  assert.ok(!summaries('srv_a').some((s) => s.startsWith('Game port changed')));
});

test("anyone who may edit a server's settings can change its port, running server included", async (t) => {
  const docker = mockDocker(t, { running: true });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50), opCookie);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.restarted, true);
  assert.ok(docker.isUp());
});

test('while a change restarts the server, neither its old nor its new port can be handed out', async (t) => {
  let release;
  const gate = new Promise((r) => (release = r));
  const docker = mockDocker(t, { running: true });
  t.mock.method(containers, 'startContainer', async () => {
    await gate; // the new container is starting
    docker.calls.start++;
  });
  seed('srv_a', P(0));
  const changing = putPort('srv_a', P(1));
  try {
    while (!docker.built.length) await new Promise((r) => setImmediate(r));
    assert.equal((await ports.suggestPorts()).game, P(2), 'P(0) is still the live port, P(1) is reserved');
  } finally {
    release(); // never leave the change (and the server's lock) hanging for the next tests
  }
  assert.equal((await changing).status, 200);
  ports.clearPortCache();
  assert.equal((await ports.suggestPorts()).game, P(0), 'the old port is free once the change is done');
});

test('saving the current port changes nothing', async (t) => {
  const docker = mockDocker(t, { running: true });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(0));
  assert.deepEqual([r.status, r.json.changed, r.json.restarted], [200, false, false]);
  assert.equal(docker.calls.stop, 0);
});

test('a hand-set RCON port goes back to game + offset on a change', async (t) => {
  mockDocker(t);
  seed('srv_a', P(0), { rcon: P(999) });
  await putPort('srv_a', P(50));
  assert.equal(row('srv_a').port_rcon, R(50));
});

test('a port another server holds, as game or as derived RCON, is refused', async (t) => {
  mockDocker(t);
  seed('srv_a', P(0));
  seed('srv_b', P(20));
  for (const port of [P(20), P(20) - 1000]) {
    const r = await putPort('srv_a', port);
    assert.equal(r.status, 400, `port ${port}`);
  }
  assert.equal(row('srv_a').port_game, P(0));
});

test('a game port whose RCON port something outside the panel holds is refused', async (t) => {
  mockDocker(t);
  seed('srv_a', P(0));
  const close = await hold(R(70));
  try {
    const r = await putPort('srv_a', P(70));
    assert.equal(r.status, 400);
    assert.equal(
      r.json.error,
      `Port ${P(70)} or its RCON port ${R(70)} is already in use. Pick another, or use the next free port.`
    );
  } finally {
    await close();
  }
});

test('non-admins stay inside the game port range; admins may go below it', async (t) => {
  mockDocker(t);
  seed('srv_a', P(0));
  const low = BASE - 3000; // RCON at BASE - 2000, both below the runway
  const op = await putPort('srv_a', low, opCookie);
  assert.equal(op.status, 400);
  assert.equal(op.json.error, `Pick a game port from ${BASE} to ${65535 - 1000}.`);
  const admin = await putPort('srv_a', low, cookie);
  assert.equal(admin.status, 200, admin.text);
});

test('a game port too high for its RCON port, or not a number, is refused', async (t) => {
  mockDocker(t);
  seed('srv_a', P(0));
  const r = await putPort('srv_a', 65000);
  assert.equal(r.json.error, 'Pick a game port from 1024 to 64535.');
  assert.equal((await putPort('srv_a', 'abc')).status, 400);
});

test('a port change while another action runs on the server answers 409', async (t) => {
  mockDocker(t);
  seed('srv_a', P(0));
  let release;
  const held = guardOp('restart', () => new Promise((r) => (release = r)))('srv_a');
  const r = await putPort('srv_a', P(50));
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'Another action is running on this server. Try again when it finishes.');
  release();
  await held;
});

test('viewers can neither change, check, nor suggest ports', async () => {
  seed('srv_a', P(0));
  for (const [method, path] of [
    ['PUT', '/api/servers/srv_a/port'],
    ['GET', `/api/servers/srv_a/port/check?port=${P(50)}`],
    ['GET', '/api/servers/srv_a/port/suggest'],
    ['GET', `/api/ports/check?port=${P(50)}`],
    ['GET', '/api/ports/suggest'],
  ]) {
    const body = method === 'PUT' ? { port: P(50) } : undefined;
    const r = await app.req(method, path, { cookie: viewerCookie, body });
    assert.ok([403, 404].includes(r.status), `${method} ${path} answered ${r.status}`);
  }
  assert.equal(row('srv_a').port_game, P(0));
});

test('the server-scoped check and suggest routes treat its own ports as free', async () => {
  seed('srv_a', P(0));
  const check = await app.req('GET', `/api/servers/srv_a/port/check?port=${P(0)}`, { cookie });
  assert.equal(check.json.free, true);
  assert.equal((await app.req('GET', `/api/ports/check?port=${P(0)}`, { cookie })).json.free, false);
  assert.equal((await app.req('GET', '/api/servers/srv_a/port/suggest', { cookie })).json.ports.game, P(0));
});

// ---- start / rebuild ----------------------------------------------------------------

test('starting a running server that has pending changes rebuilds it once, without a second start', async (t) => {
  const docker = mockDocker(t, { running: true });
  seed('srv_a', P(0));
  db.run("UPDATE servers SET pending_recreate = 1 WHERE id = 'srv_a'");
  await servers.startServer('srv_a', { actor: 'test' });
  assert.equal(docker.built.length, 1);
  assert.equal(docker.calls.start, 1);
});

test('rebuilding a running server starts what it just built, even if a setting changed mid-way', async (t) => {
  const docker = mockDocker(t, { running: true });
  t.mock.method(containers, 'createContainer', async (spec) => {
    docker.built.push(spec.ports);
    db.run("UPDATE servers SET heap_mb = 2048, pending_recreate = 1 WHERE id = 'srv_a'"); // a save lands mid-way
    return 'cid';
  });
  seed('srv_a', P(0));
  await servers.recreateServer('srv_a', { actor: 'test' });
  assert.equal(docker.built.length, 1);
  assert.equal(row('srv_a').pending_recreate, 1); // that change still waits for the next rebuild
});

test('a slow server create never blocks a port change', async (t) => {
  mockDocker(t);
  let finishPull;
  t.mock.method(images, 'ensureImage', () => new Promise((r) => (finishPull = r)));
  // A new server seeds a backup schedule, whose cron timer would keep this process alive.
  t.mock.method(require('../src/services/scheduler'), 'createSchedule', () => {});
  seed('srv_a', P(0));
  const creating = servers.createServer({ name: 'Slow', type: 'VANILLA', mcVersion: '1.21.1' }, { actor: 'test' });
  while (!finishPull) await new Promise((r) => setImmediate(r)); // the create is now pulling its image
  const pullForCreate = finishPull;
  t.mock.method(images, 'ensureImage', async () => {});
  const r = await putPort('srv_a', P(50));
  assert.equal(r.status, 200, r.text);
  pullForCreate();
  const created = await creating;
  assert.notEqual(created.port_game, P(50));
});

// ---- the Docker listing itself -------------------------------------------------------

test('publishedHostPorts reads live and stopped bindings, skipping the server itself', async (t) => {
  const docker = require('../src/docker/connect').getDocker();
  t.mock.method(docker, 'listContainers', async () => [
    { Id: 'own', State: 'running', Labels: { 'msm.id': 'srv_a' }, Ports: [{ PublicPort: P(0) }] },
    { Id: 'other', State: 'running', Labels: { 'msm.id': 'srv_b' }, Ports: [{ PublicPort: P(20) }, {}] },
    { Id: 'outside', State: 'exited', Labels: {}, Ports: [] },
    { Id: 'managed-stopped', State: 'exited', Labels: { 'msm.id': 'srv_c' }, Ports: [] },
  ]);
  const inspected = [];
  t.mock.method(docker, 'getContainer', (id) => ({
    inspect: async () => {
      inspected.push(id);
      const binds =
        id === 'outside'
          ? { '25565/tcp': [{ HostIp: '', HostPort: String(P(30)) }], '8080/tcp': null }
          : { '7000/udp': [{ HostPort: `${P(40)}-${P(42)}` }] };
      return { HostConfig: { PortBindings: binds } };
    },
  }));
  const used = await realPublishedHostPorts({ exceptServerId: 'srv_a' });
  assert.deepEqual(
    [...used].sort((a, b) => a - b),
    [P(20), P(30), P(40), P(41), P(42)]
  );
  assert.deepEqual(inspected.sort(), ['managed-stopped', 'outside']); // never the server itself
});

test('publishedHostPorts keeps running containers ports when an inspect hangs', async (t) => {
  const docker = require('../src/docker/connect').getDocker();
  t.mock.method(docker, 'listContainers', async () => [
    { Id: 'live', State: 'running', Labels: {}, Ports: [{ PublicPort: P(20) }] },
    { Id: 'stuck', State: 'exited', Labels: {}, Ports: [] },
  ]);
  t.mock.method(docker, 'getContainer', () => ({ inspect: () => new Promise(() => {}) }));
  assert.deepEqual([...(await realPublishedHostPorts({ deadlineMs: 50 }))], [P(20)]);
});

test('publishedHostPorts gives up, and cancels the request, when the list never answers', async (t) => {
  const docker = require('../src/docker/connect').getDocker();
  let signal;
  t.mock.method(docker, 'listContainers', (opts) => {
    signal = opts.abortSignal;
    return new Promise(() => {});
  });
  await assert.rejects(realPublishedHostPorts({ deadlineMs: 50 }), /did not list/);
  assert.equal(signal.aborted, true);
});

test('a port held by a host program reads as a friendly error', async () => {
  const { friendlyError } = require('../src/web/middleware/jsonErrorHandler');
  const err = new Error('driver failed programming external connectivity: bind: address already in use');
  assert.equal(friendlyError(err), 'That port is already in use by another program on this machine.');
});

// ---- round 8: pre-flight, confirmation, write-first, remove failures --------------

test('a running server is not restarted without restart: true (409 NEEDS_CONFIRM), nothing touched', async (t) => {
  const docker = mockDocker(t, { running: true });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50), cookie, {});
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'NEEDS_CONFIRM');
  assert.equal(r.json.error, 'This server is running. Changing its port restarts it.');
  assert.equal(docker.calls.stop, 0);
  assert.equal(row('srv_a').port_game, P(0));
});

test('removing the old container failing after the stop still puts the server back up', async (t) => {
  const docker = mockDocker(t, { running: true });
  let removes = 0;
  t.mock.method(containers, 'removeContainer', async () => {
    if (++removes === 1)
      throw Object.assign(new Error('removal of container is already in progress'), { statusCode: 409 });
  });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.notEqual(r.status, 200);
  assert.ok(docker.isUp(), 'running again');
  assert.deepEqual([row('srv_a').port_game, row('srv_a').port_rcon], [P(0), R(0)]);
  assert.ok(
    summaries('srv_a').includes(
      `Game port change to ${P(50)} failed while removing the old container, so the server is back on ${P(0)}.`
    )
  );
});

test("an image that can't be pulled stops the change before the server is touched", async (t) => {
  const docker = mockDocker(t, { running: true });
  t.mock.method(images, 'ensureImage', async () => {
    throw new Error('getaddrinfo ENOTFOUND registry-1.docker.io');
  });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.notEqual(r.status, 200);
  assert.equal(docker.calls.stop, 0, 'never stopped');
  assert.ok(docker.isUp());
  assert.equal(row('srv_a').port_game, P(0));
});

test('a custom container name taken by another container stops the change before the server is touched', async (t) => {
  const docker = mockDocker(t, { running: true });
  t.mock.method(containers, 'nameTakenByOther', async () => true);
  seed('srv_a', P(0));
  db.run("UPDATE servers SET container_name = 'mc-kids' WHERE id = 'srv_a'");
  const r = await putPort('srv_a', P(50));
  assert.equal(r.status, 409);
  assert.match(r.json.error, /Container name "mc-kids" is already in use/);
  assert.equal(docker.calls.stop, 0);
  assert.equal(row('srv_a').port_game, P(0));
});

test('mid-change the row already says the new port and a rebuild is pending (honest after a crash)', async (t) => {
  const docker = mockDocker(t, { running: true });
  let midway;
  t.mock.method(containers, 'createContainer', async (spec) => {
    midway = row('srv_a');
    docker.built.push(spec.ports);
    return 'cid';
  });
  seed('srv_a', P(0));
  assert.equal((await putPort('srv_a', P(50))).status, 200);
  assert.deepEqual([midway.port_game, midway.pending_recreate], [P(50), 1]);
  assert.equal(row('srv_a').pending_recreate, 0);
});

test('a lock collision carries code BUSY', async () => {
  let release;
  const held = guardOp('backup', () => new Promise((r) => (release = r)))('srv_lock');
  await assert.rejects(
    guardOp('restart', async () => {})('srv_lock'),
    (err) => err.code === 'BUSY' && err.status === 409
  );
  release();
  await held;
});

// ---- round 9: other changes waiting, the rebuild flag, timing of the write -------

test('a port change is refused while other changes wait for Apply Changes, nothing touched', async (t) => {
  const docker = mockDocker(t, { running: true });
  seed('srv_a', P(0));
  db.run("UPDATE servers SET heap_mb = 2048, pending_recreate = 1 WHERE id = 'srv_a'");
  const r = await putPort('srv_a', P(50));
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'PENDING_CHANGES');
  assert.equal(
    r.json.error,
    'This server has other changes waiting. Apply them first with Apply Changes, then change the port.'
  );
  assert.equal(docker.calls.stop, 0);
  assert.deepEqual([row('srv_a').port_game, row('srv_a').pending_recreate], [P(0), 1]);
});

test('a settings change saved during a failed port change keeps its rebuild flag', async (t) => {
  const docker = mockDocker(t, {
    running: true,
    failOn: (built) => (built.game === P(50) ? 'port is already allocated' : null),
  });
  const realCreate = containers.createContainer;
  t.mock.method(containers, 'createContainer', async (spec) => {
    if (spec.ports.game === P(50)) db.run("UPDATE servers SET heap_mb = 2048, pending_recreate = 1 WHERE id = 'srv_a'");
    return realCreate(spec);
  });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.notEqual(r.status, 200);
  assert.ok(docker.isUp(), 'back up on the old port');
  const after = db.get("SELECT port_game, heap_mb, pending_recreate FROM servers WHERE id = 'srv_a'");
  assert.deepEqual({ ...after }, { port_game: P(0), heap_mb: 2048, pending_recreate: 1 });
});

test('the row keeps the old port until the server has stopped', async (t) => {
  const docker = mockDocker(t, { running: true });
  let duringStop;
  t.mock.method(containers, 'stopContainer', async () => {
    duringStop = row('srv_a').port_game;
    docker.calls.stop++;
  });
  t.mock.method(containers, 'inspectStatus', async () => ({
    exists: true,
    status: docker.calls.stop ? 'stopped' : 'running',
  }));
  seed('srv_a', P(0));
  await putPort('srv_a', P(50));
  assert.equal(duringStop, P(0));
});

test('a stop that fails leaves the server running on its old port, row untouched', async (t) => {
  const docker = mockDocker(t, { running: true });
  t.mock.method(containers, 'stopContainer', async () => {
    throw new Error('the container did not stop');
  });
  seed('srv_a', P(0));
  const r = await putPort('srv_a', P(50));
  assert.notEqual(r.status, 200);
  assert.ok(docker.isUp());
  assert.deepEqual([row('srv_a').port_game, row('srv_a').pending_recreate], [P(0), 0]);
});

test('restart may be sent as the string "true"; anything else is refused in words', async (t) => {
  mockDocker(t, { running: true });
  seed('srv_a', P(0));
  assert.equal((await putPort('srv_a', P(50), cookie, { restart: 'true' })).status, 200);
  const bad = await putPort('srv_a', P(60), cookie, { restart: 'yes' });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'Send restart as true or false.');
});

test('only panel error codes reach the client', async () => {
  const { makeJsonErrorHandler } = require('../src/web/middleware/jsonErrorHandler');
  const handler = makeJsonErrorHandler('test');
  const send = (err) => {
    let body;
    const res = { headersSent: false, status: () => res, json: (b) => (body = b) };
    handler(err, { method: 'GET', originalUrl: '/x', path: '/x' }, res, () => {});
    return body;
  };
  assert.equal(send(Object.assign(new Error('Busy.'), { status: 409, code: 'BUSY' })).code, 'BUSY');
  assert.equal(send(Object.assign(new Error('Not found.'), { status: 404, code: 'ENOENT' })).code, undefined);
});

test('a failed port change and a crash restart that gave up are alerts', () => {
  const { EVENT_MAP } = require('../src/integrations/discord');
  assert.deepEqual(EVENT_MAP['port-change-failed'], ['alert', 'alerts']);
  assert.deepEqual(EVENT_MAP['auto-restart-gave-up'], ['alert', 'alerts']);
});

test('retryWhileBusy waits out BUSY, gives up in time, and passes anything else straight on', async () => {
  const { retryWhileBusy } = require('../src/services/opLock');
  const busyErr = () => Object.assign(new Error('busy'), { code: 'BUSY', status: 409 });
  let n = 0;
  assert.equal(
    await retryWhileBusy(async () => (++n < 3 ? Promise.reject(busyErr()) : 'done'), { retryMs: 1, maxWaitMs: 100 }),
    'done'
  );
  await assert.rejects(
    retryWhileBusy(async () => Promise.reject(busyErr()), { retryMs: 5, maxWaitMs: 20 }),
    /busy/
  );
  let m = 0;
  await assert.rejects(
    retryWhileBusy(
      async () => {
        m++;
        throw new Error('disk full');
      },
      { retryMs: 1, maxWaitMs: 100 }
    ),
    /disk full/
  );
  assert.equal(m, 1);
});

test('starting a server that is already running does nothing', async (t) => {
  const docker = mockDocker(t, { running: true });
  seed('srv_a', P(0));
  await servers.startServer('srv_a', { actor: 'test' });
  assert.deepEqual([docker.built.length, docker.calls.start], [0, 0]);
});
