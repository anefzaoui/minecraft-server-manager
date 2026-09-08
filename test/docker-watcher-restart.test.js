'use strict';

// handleEvent() must drive the auto-restart path from the Docker event stream.
// The historical bug: the handler read only `evt.status`, but newer Docker
// daemons report the event kind as `Action`/`action` (e.g. Action:"die" for a
// crashed container). A SIGSEGV'd Java process emits Action:"die" with no
// `status`, so the old code bailed at the `status !== 'die'` guard and never
// marked the server crashed - let alone restarted it. This file pins that a
// die event reported via Action is treated exactly like a status:"die" one.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');

// Patch the watcher's dependencies BEFORE requiring it: watcher.js destructures
// `fetchLogs` and `inspectStatus` at module load, so a stub set later never
// takes effect (the same ordering constraint startup-watchdog.test.js notes).
const logs = require('../src/docker/logs');
logs.fetchLogs = async () => '';

const containers = require('../src/docker/containers');
let inspectResult = { exists: true, status: 'crashed' };
containers.inspectStatus = async () => inspectResult;

const { LABEL } = containers;

let started = 0;
const serversService = require('../src/services/servers');
serversService.startServer = async () => {
  started++;
};

const watcher = require('../src/docker/watcher');

function seedServer(id, autoRestart) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher,
       heap_mb, container_memory_mb, status, auto_restart)
     VALUES (?, ?, 'PAPER', 25599, 26599, 'x', 1024, 1536, 'running', ?)`,
    id,
    'Watcher Test',
    autoRestart ? 1 : 0
  );
  return id;
}

const dieEvent = (id, { viaAction = true, exitCode = '1' } = {}) => ({
  Actor: { Attributes: { [LABEL]: id, exitCode } },
  ...(viaAction ? { Action: 'die' } : { status: 'die' }),
});

test('a die event reported as Action:"die" marks the container crashed', async () => {
  const id = seedServer('srv_watch_act', 0);

  await watcher.handleEvent(dieEvent(id, { viaAction: true }));

  assert.equal(db.get('SELECT status FROM servers WHERE id = ?', id).status, 'crashed');
});

test('an Action:"die" event actually restarts an auto_restart server (the end-to-end bug)', async (t) => {
  const id = seedServer('srv_watch_ar', 1);
  started = 0;
  // Fake timers so the guarded 5s restart backoff can be driven synchronously.
  t.mock.timers.enable({ apis: ['setTimeout'] });

  await watcher.handleEvent(dieEvent(id, { viaAction: true, exitCode: '1' }));

  const crash = db.get("SELECT * FROM events WHERE server_id = ? AND type = 'crashed' ORDER BY id DESC LIMIT 1", id);
  assert.ok(crash, 'a crashed event was recorded');
  assert.equal(JSON.parse(crash.details_json).armedRestart, true, 'the crash armed a restart');
  assert.equal(started, 0, 'no restart before the backoff elapses');

  t.mock.timers.tick(6_000);
  await new Promise((r) => setImmediate(r)); // let the fired restart settle
  t.mock.timers.reset();

  assert.equal(started, 1, 'the crashed server was restarted after the backoff');
  const restarted = db.get(
    "SELECT * FROM events WHERE server_id = ? AND type = 'auto-restarted' ORDER BY id DESC LIMIT 1",
    id
  );
  assert.ok(restarted, 'an auto-restarted event was recorded');
});

test('status:"die" and Action:"die" both reach the restart path identically', async () => {
  const viaStatus = seedServer('srv_watch_status', 1);
  const viaAction = seedServer('srv_watch_action', 1);
  started = 0;

  await watcher.handleEvent(dieEvent(viaStatus, { viaAction: false }));
  await watcher.handleEvent(dieEvent(viaAction, { viaAction: true }));

  const statusEv = db.get(
    "SELECT * FROM events WHERE server_id = ? AND type = 'crashed' ORDER BY id DESC LIMIT 1",
    viaStatus
  );
  const actionEv = db.get(
    "SELECT * FROM events WHERE server_id = ? AND type = 'crashed' ORDER BY id DESC LIMIT 1",
    viaAction
  );
  assert.equal(JSON.parse(statusEv.details_json).armedRestart, true);
  assert.equal(JSON.parse(actionEv.details_json).armedRestart, true);
});
