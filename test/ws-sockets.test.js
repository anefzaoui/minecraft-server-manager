'use strict';

// The /ws/console and /ws/stats sockets end-to-end (real upgrade handling,
// stubbed Docker): auth and permission gates, log fan-out with replay, RCON
// command handling, and broker teardown when the last tab leaves.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { PassThrough } = require('node:stream');
const WebSocket = require('ws');
const app = require('./helpers/app');

// Stub Docker-facing modules BEFORE ws/index.js destructures them.
const logsMod = require('../src/docker/logs');
const statsMod = require('../src/docker/stats');
const containers = require('../src/docker/containers');
const followers = [];
let followErr = null;
logsMod.followLogs = async () => {
  if (followErr) throw followErr;
  const f = { stream: new PassThrough(), stopped: false };
  f.stop = () => {
    f.stopped = true;
  };
  followers.push(f);
  return f;
};
const statsFeeds = [];
let statsErr = null;
statsMod.statsStream = async (serverId, onSample) => {
  if (statsErr) throw statsErr;
  const f = { serverId, onSample, stopped: false, stop: () => (f.stopped = true) };
  statsFeeds.push(f);
  return f.stop;
};
let inspect = { exists: true, status: 'running' };
const rconCalls = [];
let rconImpl = async () => 'There are 0 of a max of 20 players online';
containers.inspectStatus = async () => inspect;
containers.execCapture = async (id, args) => {
  rconCalls.push(args);
  return rconImpl(args);
};

let admin;
let viewer;
let port;
const SERVER = 'srv_ws01';

test.before(async () => {
  const base = await app.start();
  port = new URL(base).port;
  admin = await app.adminCookie();
  app.seedServer(SERVER);
  const authService = require('../src/services/auth');
  await authService.createUser({ username: 'watcher', password: 'watchpass123', role: 'viewer' }, { actor: 'test' });
  const login = await app.req('POST', '/login', { body: { username: 'watcher', password: 'watchpass123' } });
  viewer = login.setCookie.map((c) => c.split(';')[0]).join('; ');
  require('../src/ws').attachWebSockets(app.httpServer());
});
test.after(async () => {
  await app.stop();
});

/** Open a socket; resolves { ws, msgs } once open, or { status/closeCode } on refusal. */
function open(path, { cookie, origin } = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
    });
    const msgs = [];
    ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
    ws.on('open', () => resolve({ ws, msgs }));
    ws.on('unexpected-response', (_req, res) => resolve({ status: res.statusCode }));
    ws.on('error', () => resolve({ failed: true }));
  });
}

function closed(ws) {
  return new Promise((resolve) => ws.on('close', (code) => resolve(code)));
}
async function shut(...tabs) {
  await Promise.all(
    tabs.map((t) => {
      const done = closed(t.ws);
      t.ws.close();
      return done;
    })
  );
  await tick(40);
}
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 1500) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await tick(10);
  }
  return false;
}

test('an unauthenticated upgrade is refused with 401', async () => {
  const r = await open(`/ws/console/${SERVER}`);
  assert.equal(r.status, 401);
});

test('a forged or unsigned session cookie is refused', async () => {
  for (const cookie of ['msm.sid=s:forged.deadbeef', 'msm.sid=plainvalue', 'msm.sid=']) {
    const r = await open(`/ws/console/${SERVER}`, { cookie });
    assert.equal(r.status, 401, cookie);
  }
});

test('a cross-site Origin is refused with 403 even with a valid session', async () => {
  const r = await open(`/ws/console/${SERVER}`, { cookie: admin, origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('paths that are not console/stats sockets are dropped', async () => {
  for (const p of ['/ws/other/x', '/ws/console/', '/ws/console/a/b', '/socket']) {
    const r = await open(p, { cookie: admin });
    assert.ok(r.failed || r.status, p);
  }
});

test('an unknown server closes with 4404, exactly like one the user cannot view', async () => {
  const { ws } = await open('/ws/console/srv_missing', { cookie: admin });
  assert.equal(await closed(ws), 4404);
  const stats = await open('/ws/stats/srv_missing', { cookie: admin });
  assert.equal(await closed(stats.ws), 4404);
});

test('console: log lines fan out to every tab, and a late tab gets the replay', async () => {
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => followers.length === 1));
  const f = followers[0];
  f.stream.write('[12:00:00] first\n');
  assert.ok(await until(() => a.msgs.length === 1));
  assert.deepEqual(a.msgs[0], { kind: 'log', text: '[12:00:00] first\n' });

  const b = await open(`/ws/console/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => b.msgs.length === 1));
  assert.equal(b.msgs[0].text, '[12:00:00] first\n', 'replayed');
  assert.equal(followers.length, 1, 'one shared upstream, not one per tab');

  f.stream.write('second\n');
  assert.ok(await until(() => a.msgs.length === 2 && b.msgs.length === 2));

  a.ws.close();
  await tick(60);
  assert.equal(f.stopped, false, 'still followed while a tab remains');
  b.ws.close();
  assert.ok(await until(() => f.stopped), 'upstream is stopped when the last tab leaves');
});

test('console: when the upstream ends, tabs are told and the next tab starts a fresh follow', async () => {
  followers.length = 0;
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => followers.length === 1));
  followers[0].stream.end();
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'log-end')));
  const b = await open(`/ws/console/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => followers.length === 2));
  await shut(a, b);
});

test('console: an upstream stream error is reported to the tab', async () => {
  followers.length = 0;
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => followers.length === 1));
  followers[0].stream.destroy(new Error('pipe broke'));
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'error' && /pipe broke/.test(m.message))));
  await shut(a);
});

test('console: a missing container ends quietly; other failures surface a message', async () => {
  followErr = Object.assign(new Error('no such container'), { statusCode: 404 });
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'log-end')));
  await shut(a);
  followErr = new Error('daemon unreachable');
  const b = await open(`/ws/console/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => b.msgs.some((m) => m.kind === 'error' && /unavailable/.test(m.message))));
  await shut(b);
  followErr = null;
});

test('console: a command runs through rcon-cli, strips the slash, and returns the output', async () => {
  rconCalls.length = 0;
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  a.ws.send(JSON.stringify({ kind: 'cmd', command: '  /list  ' }));
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'cmd-result')));
  const res = a.msgs.find((m) => m.kind === 'cmd-result');
  assert.equal(res.command, 'list');
  assert.match(res.output, /players online/);
  assert.deepEqual(rconCalls[0], ['rcon-cli', '--', 'list']);
  const db = require('../src/db');
  assert.ok(db.get("SELECT 1 FROM events WHERE server_id = ? AND type = 'rcon'", SERVER));
  await shut(a);
});

test('console: malformed frames, wrong kinds, and blank commands are ignored', async () => {
  rconCalls.length = 0;
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  a.ws.send('not json');
  a.ws.send(JSON.stringify({ kind: 'nope', command: 'list' }));
  a.ws.send(JSON.stringify({ kind: 'cmd', command: 42 }));
  a.ws.send(JSON.stringify({ kind: 'cmd', command: '  /  ' }));
  await tick(100);
  assert.equal(rconCalls.length, 0);
  assert.equal(a.msgs.filter((m) => m.kind === 'cmd-result').length, 0);
  await shut(a);
});

test('console: a stop command is recorded as an operator-requested stop first', async () => {
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  a.ws.send(JSON.stringify({ kind: 'cmd', command: 'stop' }));
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'cmd-result')));
  const db = require('../src/db');
  assert.ok(db.get("SELECT 1 FROM events WHERE server_id = ? AND type = 'stop-requested'", SERVER));
  await shut(a);
});

test('console: commands are refused when the server is not running', async () => {
  rconCalls.length = 0;
  inspect = { exists: true, status: 'stopped' };
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  a.ws.send(JSON.stringify({ kind: 'cmd', command: 'list' }));
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'cmd-result')));
  assert.equal(a.msgs.find((m) => m.kind === 'cmd-result').error, 'Server is not running.');
  assert.equal(rconCalls.length, 0);
  inspect = { exists: true, status: 'running' };
  await shut(a);
});

test('console: an RCON failure is reported back, and secrets are redacted from the history', async () => {
  rconImpl = async () => {
    throw new Error('rcon timed out');
  };
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  a.ws.send(JSON.stringify({ kind: 'cmd', command: 'list' }));
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'cmd-result')));
  assert.equal(a.msgs.find((m) => m.kind === 'cmd-result').error, 'rcon timed out');
  rconImpl = async () => 'ok';
  a.ws.send(JSON.stringify({ kind: 'cmd', command: 'whitelist password hunter2' }));
  assert.ok(await until(() => a.msgs.filter((m) => m.kind === 'cmd-result').length === 2));
  const db = require('../src/db');
  const rows = db.all("SELECT summary FROM events WHERE server_id = ? AND type = 'rcon'", SERVER);
  assert.ok(!rows.some((r) => r.summary.includes('hunter2')));
  assert.ok(rows.some((r) => r.summary.includes('●●●')));
  rconImpl = async () => 'There are 0 of a max of 20 players online';
  await shut(a);
});

test('console: a viewer can watch the log but cannot run commands', async () => {
  rconCalls.length = 0;
  const v = await open(`/ws/console/${SERVER}`, { cookie: viewer });
  assert.ok(v.ws, 'viewer may connect');
  v.ws.send(JSON.stringify({ kind: 'cmd', command: 'op evil' }));
  assert.ok(await until(() => v.msgs.some((m) => m.kind === 'cmd-result')));
  assert.match(v.msgs.find((m) => m.kind === 'cmd-result').error, /console permission/);
  assert.equal(rconCalls.length, 0);
  await shut(v);
});

test('console: a configured label announces the command in game chat via tellraw', async () => {
  const db = require('../src/db');
  db.run('UPDATE servers SET console_label = ? WHERE id = ?', 'Admin', SERVER);
  rconCalls.length = 0;
  const a = await open(`/ws/console/${SERVER}`, { cookie: admin });
  a.ws.send(JSON.stringify({ kind: 'cmd', command: 'say hi' }));
  assert.ok(await until(() => rconCalls.length === 2));
  const tellraw = rconCalls[1];
  assert.deepEqual(tellraw.slice(0, 4), ['rcon-cli', '--', 'tellraw', '@a']);
  assert.equal(JSON.parse(tellraw[4]).extra[0].text, '[Admin] ');
  db.run('UPDATE servers SET console_label = NULL WHERE id = ?', SERVER);
  await shut(a);
});

test('stats: samples fan out with perf folded in, one shared upstream, stopped after the last tab', async () => {
  statsFeeds.length = 0;
  const a = await open(`/ws/stats/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => statsFeeds.length === 1));
  const b = await open(`/ws/stats/${SERVER}`, { cookie: admin });
  await tick(50);
  assert.equal(statsFeeds.length, 1, 'one upstream for two tabs');
  statsFeeds[0].onSample({ cpuPct: 12.5, memUsedBytes: 1, memLimitBytes: 2, netRx: 0, netTx: 0 });
  assert.ok(await until(() => a.msgs.length === 1 && b.msgs.length === 1));
  assert.equal(a.msgs[0].kind, 'stats');
  assert.equal(a.msgs[0].cpuPct, 12.5);
  assert.equal(a.msgs[0].perf, null);
  assert.equal(a.msgs[0].perfSupported, true);
  a.ws.close();
  await tick(50);
  assert.equal(statsFeeds[0].stopped, false);
  b.ws.close();
  assert.ok(await until(() => statsFeeds[0].stopped));
});

test('stats: an upstream failure is reported to the tab', async () => {
  statsErr = new Error('stats denied');
  const a = await open(`/ws/stats/${SERVER}`, { cookie: admin });
  assert.ok(await until(() => a.msgs.some((m) => m.kind === 'error' && m.message === 'stats denied')));
  statsErr = null;
  await shut(a);
});

test('the server survives a client that drops mid-handshake', async () => {
  await new Promise((resolve) => {
    const sock = net.connect(Number(port), '127.0.0.1', () => {
      sock.write(`GET /ws/console/${SERVER} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\n`);
      sock.destroy();
      resolve();
    });
  });
  await tick(50);
  const r = await app.req('GET', '/api/servers', { cookie: admin });
  assert.notEqual(r.status, 500);
});
