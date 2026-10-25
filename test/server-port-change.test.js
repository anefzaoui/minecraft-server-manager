'use strict';

// Changing a server's game port after creation, and the free-port rules it
// shares with create: a server's own ports are free for itself, and host ports
// other Docker containers publish are taken. A high port runway keeps the OS
// probe away from anything a developer machine is really running.
process.env.PORT_GAME_START = '47100';
const { start, stop, req, adminCookie } = require('./helpers/app');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const containers = require('../src/docker/containers');
const ports = require('../src/services/ports');

const realPublishedHostPorts = containers.publishedHostPorts;

let cookie;

function seed(id, game, { extraPorts = [] } = {}) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, extra_ports_json)
     VALUES (?, ?, 'VANILLA', ?, ?, 'x', 1024, 1536, ?)`,
    id,
    id,
    game,
    game + 1000,
    JSON.stringify(extraPorts)
  );
}

test.before(async () => {
  await start();
  cookie = await adminCookie();
});
test.after(stop);
test.beforeEach((t) => {
  db.run('DELETE FROM servers');
  // No real Docker in unit tests: nothing else publishes ports, nothing runs.
  t.mock.method(containers, 'publishedHostPorts', async () => new Set());
  t.mock.method(containers, 'inspectStatus', async () => ({ exists: true, status: 'stopped' }));
});

test('suggestPorts skips other servers but may hand a server its own current ports', async () => {
  seed('srv_a', 47100);
  assert.equal((await ports.suggestPorts()).game, 47101);
  assert.deepEqual(await ports.suggestPorts({ exceptServerId: 'srv_a' }), { game: 47100, rcon: 48100, bedrock: null });
  assert.equal(await ports.isPortFree(47100), false);
  assert.equal(await ports.isPortFree(47100, { exceptServerId: 'srv_a' }), true);
});

test('a server keeps its own extra ports while it moves its game port', async () => {
  seed('srv_a', 47100, { extraPorts: [{ hostPort: 47101, containerPort: 8100, protocol: 'tcp' }] });
  assert.equal(await ports.isPortFree(47101, { exceptServerId: 'srv_a' }), false);
});

test('host ports other Docker containers publish are never suggested', async (t) => {
  t.mock.method(containers, 'publishedHostPorts', async () => new Set([47100, 48101]));
  // 47100 is taken outright; 47101 is free but its RCON port 48101 is not.
  assert.equal((await ports.suggestPorts()).game, 47102);
  assert.equal(await ports.isPortFree(47100), false);
});

test('an unreachable Docker daemon falls back to the DB and OS checks', async (t) => {
  t.mock.method(containers, 'publishedHostPorts', async () => {
    throw new Error('connect ENOENT /var/run/docker.sock');
  });
  assert.equal((await ports.suggestPorts()).game, 47100);
});

test('PUT /servers/:id/port moves the game and RCON ports and flags the change', async () => {
  seed('srv_a', 47100);
  const r = await req('PUT', '/api/servers/srv_a/port', { cookie, body: { port: 47150 } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.changed, true);
  assert.equal(r.json.running, false);
  const row = db.get('SELECT port_game, port_rcon, pending_recreate FROM servers WHERE id = ?', 'srv_a');
  assert.deepEqual({ ...row }, { port_game: 47150, port_rcon: 48150, pending_recreate: 1 });
  const ev = db.get("SELECT summary FROM events WHERE server_id = 'srv_a' ORDER BY id DESC LIMIT 1");
  assert.equal(ev.summary, 'Game port changed from 47100 to 47150.');
});

test('PUT /servers/:id/port reports a running server so the UI can offer a restart', async (t) => {
  t.mock.method(containers, 'inspectStatus', async () => ({ exists: true, status: 'running' }));
  seed('srv_a', 47100);
  const r = await req('PUT', '/api/servers/srv_a/port', { cookie, body: { port: 47150 } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.running, true);
});

test('PUT /servers/:id/port refuses a port another server holds, for game or RCON', async () => {
  seed('srv_a', 47100);
  seed('srv_b', 47120);
  // srv_b's game port as-is, and 46120 whose derived RCON port (47120) is srv_b's game port.
  for (const port of [47120, 46120]) {
    const r = await req('PUT', '/api/servers/srv_a/port', { cookie, body: { port } });
    assert.equal(r.status, 400, `port ${port}`);
    assert.match(r.json.error, /already in use/);
  }
  // srv_b's RCON port (48120) as srv_a's game port.
  const rcon = await req('PUT', '/api/servers/srv_a/port', { cookie, body: { port: 48120 } });
  assert.equal(rcon.status, 400);
  assert.equal(db.get('SELECT port_game FROM servers WHERE id = ?', 'srv_a').port_game, 47100);
});

test('PUT /servers/:id/port validates the range and is a no-op for the current port', async () => {
  seed('srv_a', 47100);
  assert.equal((await req('PUT', '/api/servers/srv_a/port', { cookie, body: { port: 80 } })).status, 400);
  const same = await req('PUT', '/api/servers/srv_a/port', { cookie, body: { port: 47100 } });
  assert.equal(same.status, 200);
  assert.equal(same.json.changed, false);
  assert.equal(db.get('SELECT pending_recreate FROM servers WHERE id = ?', 'srv_a').pending_recreate, 0);
});

test('the server-scoped check and suggest routes treat its own ports as free', async () => {
  seed('srv_a', 47100);
  const check = await req('GET', '/api/servers/srv_a/port/check?port=47100', { cookie });
  assert.deepEqual(check.json, { ok: true, port: 47100, rcon: 48100, free: true });
  const global = await req('GET', '/api/ports/check?port=47100', { cookie });
  assert.equal(global.json.free, false);
  const suggest = await req('GET', '/api/servers/srv_a/port/suggest', { cookie });
  assert.equal(suggest.json.ports.game, 47100);
});

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
      return { HostConfig: { PortBindings: { '25565/tcp': [{ HostIp: '', HostPort: '47130' }], '8080/tcp': null } } };
    },
  }));
  // The real function (beforeEach mocks it), over a stubbed Docker client.
  const used = await realPublishedHostPorts({ exceptServerId: 'srv_a' });
  assert.deepEqual([...used].sort(), [47120, 47130]);
  assert.deepEqual(inspected, ['outside']); // managed stopped servers are already in the DB
});
