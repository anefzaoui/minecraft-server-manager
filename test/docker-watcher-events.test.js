'use strict';

// The Docker events watcher: stream framing and reconnect, every event kind it
// maps to server state and history, crash diagnosis, and the crash-loop backoff
// that stops a broken server from restarting forever.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
require('../src/db/migrate').migrate();
const db = require('../src/db');

// Stub collaborators BEFORE watcher.js destructures them.
const connect = require('../src/docker/connect');
const streams = [];
let eventsErr = null;
connect.getDocker = () => ({
  getEvents: async (opts) => {
    if (eventsErr) throw eventsErr;
    const s = new PassThrough();
    s.opts = opts;
    streams.push(s);
    return s;
  },
});
const logs = require('../src/docker/logs');
let logText = '';
logs.fetchLogs = async () => {
  if (logText instanceof Error) throw logText;
  return logText;
};
const containers = require('../src/docker/containers');
let inspectResult = { exists: true, status: 'crashed' };
containers.inspectStatus = async () => {
  if (inspectResult instanceof Error) throw inspectResult;
  return inspectResult;
};
const serversService = require('../src/services/servers');
const started = [];
let startImpl = async () => {};
serversService.startServer = async (id, o) => {
  started.push([id, o]);
  return startImpl();
};

const watcher = require('../src/docker/watcher');
const { LABEL } = containers;

// Make the restart backoff and stream-retry timers fire immediately.
const realSetTimeout = globalThis.setTimeout;
const delays = [];
test.before(() => {
  globalThis.setTimeout = (fn, ms) => {
    delays.push(ms);
    return realSetTimeout(fn, 0);
  };
});
test.after(() => {
  globalThis.setTimeout = realSetTimeout;
});

let n = 0;
function seed({ status = 'running', autoRestart = 1 } = {}) {
  n += 1;
  const id = `srv_wt${n}`;
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, auto_restart)
     VALUES (?, ?, 'PAPER', ?, ?, 'x', 1024, 1536, ?, ?)`,
    id,
    id,
    28900 + n * 2,
    28901 + n * 2,
    status,
    autoRestart
  );
  return id;
}
const evt = (id, action, attrs = {}) => ({ Action: action, Actor: { Attributes: { [LABEL]: id, ...attrs } } });
const status = (id) => db.get('SELECT status FROM servers WHERE id = ?', id).status;
const events = (id, type) => db.all('SELECT * FROM events WHERE server_id = ? AND type = ?', id, type);
const settle = () => new Promise((r) => realSetTimeout(r, 30));
function stopRequested(id, type = 'stop-requested') {
  db.run("INSERT INTO events (server_id, actor, type, summary) VALUES (?, 'u', ?, 's')", id, type);
}

test.beforeEach(() => {
  logText = '';
  inspectResult = { exists: true, status: 'crashed' };
  started.length = 0;
  startImpl = async () => {};
});

test('events with no label, an unknown server, or a soft-deleted server are ignored', async () => {
  const id = seed();
  await watcher.handleEvent({ Action: 'die', Actor: { Attributes: {} } });
  await watcher.handleEvent({ Action: 'die' });
  await watcher.handleEvent(evt('srv_nobody', 'die', { exitCode: '1' }));
  db.run("UPDATE servers SET deleted_at = datetime('now') WHERE id = ?", id);
  await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
  assert.equal(status(id), 'running', 'a tombstone is not touched');
});

test('start marks the server starting; a healthy probe marks it running', async () => {
  const id = seed({ status: 'stopped' });
  await watcher.handleEvent(evt(id, 'start'));
  assert.equal(status(id), 'starting');
  assert.ok(db.get('SELECT last_started_at FROM servers WHERE id = ?', id).last_started_at);
  await watcher.handleEvent({ status: 'health_status: healthy', Actor: { Attributes: { [LABEL]: id } } });
  assert.equal(status(id), 'running');
});

test('an unhealthy probe flags the server once per 15 minutes and diagnoses the log', async () => {
  const id = seed();
  logText = 'java.lang.OutOfMemoryError: Java heap space';
  await watcher.handleEvent(evt(id, 'health_status: unhealthy'));
  assert.equal(status(id), 'unhealthy');
  const [ev] = events(id, 'unhealthy');
  assert.match(ev.summary, /ran out of memory/);
  assert.equal(JSON.parse(ev.details_json).diagnosis, 'oom');
  await watcher.handleEvent(evt(id, 'health_status: unhealthy'));
  assert.equal(events(id, 'unhealthy').length, 1, 'no alert spam');
});

test('an unhealthy probe with no diagnosable log gives the generic message and survives a log failure', async () => {
  const id = seed();
  logText = new Error('docker gone');
  await watcher.handleEvent(evt(id, 'health_status: unhealthy'));
  assert.match(events(id, 'unhealthy')[0].summary, /stopped responding to health checks/);
});

test('an unhealthy probe is ignored during a requested stop or for a server that is not up', async () => {
  const stopping = seed();
  stopRequested(stopping, 'restart-requested');
  await watcher.handleEvent(evt(stopping, 'health_status: unhealthy'));
  assert.equal(status(stopping), 'running');
  const down = seed({ status: 'stopped' });
  await watcher.handleEvent(evt(down, 'health_status: unhealthy'));
  assert.equal(status(down), 'stopped');
  assert.equal(events(down, 'unhealthy').length, 0);
});

test('an out-of-memory event is recorded in plain language', async () => {
  const id = seed();
  await watcher.handleEvent(evt(id, 'oom'));
  assert.match(events(id, 'oom')[0].summary, /running out of memory/);
});

test('other event kinds (exec, attach, ...) do nothing', async () => {
  const id = seed();
  await watcher.handleEvent(evt(id, 'exec_start: rcon-cli list'));
  assert.equal(status(id), 'running');
  assert.equal(db.all('SELECT 1 FROM events WHERE server_id = ?', id).length, 0);
});

test('clean exits (0, 143, 130) are stops; the event is only recorded when the panel did not ask for it', async () => {
  for (const code of ['0', '143', '130']) {
    const id = seed();
    await watcher.handleEvent(evt(id, 'die', { exitCode: code }));
    assert.equal(status(id), 'stopped', code);
    assert.equal(events(id, 'stopped').length, 1);
    assert.equal(events(id, 'crashed').length, 0);
  }
  const asked = seed();
  stopRequested(asked);
  await watcher.handleEvent(evt(asked, 'die', { exitCode: '0' }));
  assert.equal(events(asked, 'stopped').length, 0, 'the stop request already explains it');
});

test('SIGKILL (137) during a requested stop is a stop; without a request it is a crash that is not auto-restarted', async () => {
  const asked = seed();
  stopRequested(asked, 'kill-requested');
  await watcher.handleEvent(evt(asked, 'die', { exitCode: '137' }));
  assert.equal(status(asked), 'stopped');

  const id = seed();
  await watcher.handleEvent(evt(id, 'die', { exitCode: '137' }));
  assert.equal(status(id), 'crashed');
  assert.equal(JSON.parse(events(id, 'crashed')[0].details_json).armedRestart, false);
  await settle();
  assert.deepEqual(started, []);
});

test('a missing exit code counts as a crash', async () => {
  const id = seed({ autoRestart: 0 });
  await watcher.handleEvent(evt(id, 'die'));
  assert.equal(status(id), 'crashed');
  assert.match(events(id, 'crashed')[0].summary, /exit code -1/);
});

test('a crash inside a stop window is still recorded, flagged, and not restarted', async () => {
  const id = seed();
  stopRequested(id);
  await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
  const ev = events(id, 'crashed')[0];
  assert.match(ev.summary, /while a stop or restart was in progress/);
  assert.equal(JSON.parse(ev.details_json).duringStopWindow, true);
  await settle();
  assert.deepEqual(started, []);
});

test('a diagnosed config error is reported with the fix and never auto-restarted', async () => {
  const id = seed();
  logText = 'You need to agree to the EULA in order to run the server.';
  await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
  const ev = events(id, 'crashed')[0];
  assert.match(ev.summary, /EULA was not accepted/);
  assert.equal(JSON.parse(ev.details_json).diagnosis, 'eula');
  await settle();
  assert.deepEqual(started, []);
});

test('a plain crash on an auto_restart server restarts it after the backoff and records it', async () => {
  const id = seed();
  delays.length = 0;
  await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
  await settle();
  assert.deepEqual(started, [[id, { actor: 'watcher' }]]);
  assert.match(events(id, 'auto-restarted')[0].summary, /1\/3/);
  assert.ok(delays.includes(5000));
});

test('auto-restart is skipped when the server is no longer crashed, missing, or inspect fails', async () => {
  for (const r of [{ exists: true, status: 'running' }, { exists: false }, new Error('docker down')]) {
    const id = seed();
    inspectResult = r;
    await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
    await settle();
  }
  assert.deepEqual(started, []);
});

test('a failing auto-restart does not throw out of the timer', async () => {
  const id = seed();
  startImpl = async () => {
    throw new Error('port in use');
  };
  await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
  await settle();
  assert.equal(started.length, 1);
  assert.equal(events(id, 'auto-restarted').length, 0);
});

test('crash-loop protection: backoff doubles, then restarts are suspended and reported once', async () => {
  const id = seed();
  delays.length = 0;
  for (let i = 0; i < 3; i++) {
    await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
    await settle();
  }
  assert.deepEqual(
    delays.filter((d) => [5000, 10000, 20000].includes(d)),
    [5000, 10000, 20000]
  );
  assert.equal(started.length, 3);
  assert.equal(watcher.inCrashLoopBackoff(id), false);

  await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
  await settle();
  assert.equal(started.length, 3, 'the fourth crash is not restarted');
  assert.equal(events(id, 'crash-loop').length, 1);
  assert.match(events(id, 'crash-loop')[0].summary, /4 crashes within 10 minutes/);
  assert.equal(watcher.inCrashLoopBackoff(id), true);
  await watcher.handleEvent(evt(id, 'die', { exitCode: '1' }));
  assert.equal(events(id, 'crash-loop').length, 1, 'the suspension is not re-announced');
});

test('inCrashLoopBackoff is true on an explicit suspension event alone, false for a quiet server', () => {
  const quiet = seed();
  assert.equal(watcher.inCrashLoopBackoff(quiet), false);
  const held = seed();
  db.run("INSERT INTO events (server_id, actor, type, summary) VALUES (?, 'w', 'crash-loop', 's')", held);
  assert.equal(watcher.inCrashLoopBackoff(held), true);
});

test('diagnoseFatal recognises each known startup failure and only scans the newest tail', () => {
  const cases = {
    'cf-api-key': 'API key is not set. Set CF_API_KEY',
    eula: 'You need to agree to the EULA',
    'java-version': 'java.lang.UnsupportedClassVersionError: class file version 65',
    'world-downgrade': 'Failed: created by a newer version of Minecraft',
    'port-bind': 'Failed to bind to port',
    oom: 'java.lang.OutOfMemoryError',
  };
  for (const [key, text] of Object.entries(cases)) assert.equal(watcher.diagnoseFatal(`x\n${text}\n`).key, key, key);
  assert.equal(watcher.diagnoseFatal(''), null);
  assert.equal(watcher.diagnoseFatal(null), null);
  assert.equal(watcher.diagnoseFatal('everything is fine'), null);
  const old = `You need to agree to the EULA${'.'.repeat(200 * 1024)}`;
  assert.equal(watcher.diagnoseFatal(old), null, 'a match older than the scan window is ignored');
});

// ---- stream handling (runs last: the watcher holds one module-level stream) ----

test('startWatcher subscribes to managed container events only, parses lines split across chunks, and drops junk', async () => {
  const id = seed({ status: 'stopped' });
  await watcher.startWatcher();
  assert.equal(streams.length, 1);
  assert.deepEqual(streams[0].opts.filters, { type: ['container'], label: ['msm.managed=true'] });
  await watcher.startWatcher();
  assert.equal(streams.length, 1, 'a second call does not open a second stream');

  const line = JSON.stringify(evt(id, 'start'));
  streams[0].write(line.slice(0, 15));
  streams[0].write(`${line.slice(15)}\n\nnot json at all\n`);
  await settle();
  assert.equal(status(id), 'starting');
});

test('a stream that never sends a newline cannot grow the buffer without bound, and recovers on the next full line', async () => {
  const id = seed({ status: 'stopped' });
  streams[0].write('x'.repeat(200 * 1024));
  streams[0].write(`\n${JSON.stringify(evt(id, 'start'))}\n`);
  await settle();
  assert.equal(status(id), 'starting');
});

test('when the stream drops the watcher reconnects, backing off and resetting once connected', async () => {
  const before = streams.length;
  eventsErr = new Error('daemon restarting');
  delays.length = 0;
  streams[0].emit('error', new Error('socket hang up'));
  await settle();
  await settle();
  assert.ok(delays.includes(5000), 'first retry after 5s');
  assert.ok(
    delays.some((d) => d > 5000),
    'backs off after a failed retry'
  );
  eventsErr = null;
  await new Promise((r) => realSetTimeout(r, 400));
  assert.ok(streams.length > before, 'reconnected to a fresh stream');
  // A late event from the dead stream must not tear down the live one.
  const live = streams.length;
  streams[0].emit('end');
  await settle();
  assert.equal(streams.length, live);
  streams.at(-1).emit('end');
  await new Promise((r) => realSetTimeout(r, 200));
  assert.ok(streams.length > live, 'reconnects again after the live stream ends');
});
