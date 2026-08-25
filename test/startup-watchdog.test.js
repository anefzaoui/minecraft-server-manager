'use strict';

// refreshStatuses() must eventually flag a server that never prints "Done ("
// as 'stalled' instead of silently re-writing 'starting' forever - see
// src/services/servers.js's STARTUP_STALL_MS. This has to mock Docker (no
// real daemon in CI), and servers.js destructures `fetchLogs` from
// docker/logs at require time, so that module must be patched BEFORE
// anything requires servers.js. node:test runs each file in its own process
// (see helpers/env.js), so this ordering is safe within this file.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');

const logs = require('../src/docker/logs');
let logTail = 'some boring boot log line\n'; // no "Done (" - simulates a hang
let fetchLogsCalls = 0;
logs.fetchLogs = async () => {
  fetchLogsCalls++;
  return logTail;
};

const containers = require('../src/docker/containers');
containers.inspectStatus = async () => ({ exists: true, status: 'running', health: null });

const servers = require('../src/services/servers');
const events = require('../src/events');

function seedStartingServer(id, minutesAgo) {
  const startedAt = new Date(Date.now() - minutesAgo * 60_000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, '');
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, last_started_at)
     VALUES (?, ?, 'PAPER', 25599, 26599, 'x', 1024, 1536, 'starting', ?)`,
    id,
    'Watchdog Test',
    startedAt
  );
}

test('refreshStatuses flags a healthcheck-less server as stalled once STARTUP_STALL_MS passes with no "Done ("', async () => {
  const id = 'srv_wd_stall';
  seedStartingServer(id, 15);
  fetchLogsCalls = 0;

  await servers.refreshStatuses();

  assert.equal(db.get('SELECT status FROM servers WHERE id = ?', id).status, 'stalled');
  assert.equal(fetchLogsCalls, 1);
  const evs = events.listEvents({ serverId: id });
  assert.equal(evs.length, 1);
  assert.equal(evs[0].type, 'startup-stalled');
});

test('refreshStatuses does not re-fire the stalled event on subsequent polls', async () => {
  const id = 'srv_wd_no_dupe';
  seedStartingServer(id, 20);
  fetchLogsCalls = 0;

  await servers.refreshStatuses();
  await servers.refreshStatuses();
  await servers.refreshStatuses();

  assert.equal(db.get('SELECT status FROM servers WHERE id = ?', id).status, 'stalled');
  assert.equal(events.listEvents({ serverId: id }).length, 1);
});

test('refreshStatuses recovers a stalled server to running once "Done (" appears', async () => {
  const id = 'srv_wd_recover';
  seedStartingServer(id, 15);
  logTail = 'still nothing\n';

  await servers.refreshStatuses();
  assert.equal(db.get('SELECT status FROM servers WHERE id = ?', id).status, 'stalled');

  logTail = 'Done (12.345s)! For help, type "help"\n';
  await servers.refreshStatuses();
  assert.equal(db.get('SELECT status FROM servers WHERE id = ?', id).status, 'running');
});

test('refreshStatuses does not flag a server still within the 2-minute grace window', async () => {
  const id = 'srv_wd_grace';
  seedStartingServer(id, 1);
  fetchLogsCalls = 0;

  await servers.refreshStatuses();

  assert.equal(db.get('SELECT status FROM servers WHERE id = ?', id).status, 'starting');
  assert.equal(fetchLogsCalls, 0); // no log fetch this early - see the 2-minute check
  assert.equal(events.listEvents({ serverId: id }).length, 0);
});
