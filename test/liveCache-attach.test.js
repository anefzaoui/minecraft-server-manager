'use strict';

// liveCache attach/sync/detach with the Docker layer stubbed. The stubs are set
// BEFORE requiring liveCache, which destructures them at load.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');

const containers = require('../src/docker/containers');
const stats = require('../src/docker/stats');
const logs = require('../src/docker/logs');

let startedAt = '2026-01-01T00:00:00Z';
let rconReply = async () => ({ stdout: 'There are 2 of a max of 20 players online: a, b', exitCode: 0 });
let stopped = 0;
let statsCb = null;
containers.inspectStatus = async () => ({ startedAt });
containers.execCaptureChecked = (id, cmd) => rconReply(cmd);
stats.statsStream = async (id, cb) => {
  statsCb = cb;
  return () => {
    stopped++;
  };
};
stats.statsOnce = async () => ({ cpu: 1 });
logs.fetchLogs = async () => 'Preparing spawn area';

const liveCache = require('../src/services/liveCache');

const tick = () => new Promise((r) => setTimeout(r, 20));

function seed(id, status, containerId = 'c1') {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, container_id)
     VALUES (?, 'LC', 'PAPER', ?, ?, 'x', 1024, 1536, ?, ?)`,
    id,
    25800 + Math.floor(Math.random() * 500),
    26800 + Math.floor(Math.random() * 500),
    status,
    containerId
  );
}

test('sync attaches running servers, reads players, and detaches when stopped', async () => {
  seed('srv_lc1', 'running');
  seed('srv_lc2', 'stopped');
  await liveCache.sync();
  await tick();
  const snap = liveCache.get('srv_lc1');
  assert.equal(snap.startedAt, startedAt);
  assert.equal(snap.players.online, 2);
  assert.equal(snap.upConfirmed, false);
  assert.equal(liveCache.statusDetail(snap), null);
  assert.deepEqual(Object.keys(liveCache.getAll()), ['srv_lc1']);
  assert.equal(liveCache.get('srv_lc2').stats, null);

  statsCb({ cpu: 5 });
  assert.equal(liveCache.get('srv_lc1').stats.cpu, 5);

  // Recreate: a new container id forces detach + reattach.
  db.run("UPDATE servers SET container_id = 'c2' WHERE id = 'srv_lc1'");
  await liveCache.sync();
  assert.equal(stopped, 1);

  db.run("UPDATE servers SET status = 'stopped' WHERE id = 'srv_lc1'");
  await liveCache.sync();
  assert.deepEqual(liveCache.getAll(), {});
  assert.equal(stopped, 2);
  liveCache.detach('srv_lc1'); // already gone: no-op
});

test('an unparseable but successful rcon reply latches upConfirmed', async () => {
  rconReply = async () => ({ stdout: 'something odd', exitCode: 0 });
  seed('srv_lc3', 'starting');
  await liveCache.sync();
  await tick();
  const snap = liveCache.get('srv_lc3');
  assert.equal(snap.players, null);
  assert.equal(snap.upConfirmed, true);
  assert.equal(liveCache.statusDetail({ ...snap, phase: null }), 'Player count unavailable');
  liveCache.detach('srv_lc3');
});

test('before rcon answers, the boot phase comes from the log tail', async () => {
  rconReply = async () => {
    throw new Error('refused');
  };
  seed('srv_lc4', 'starting');
  await liveCache.sync();
  await tick();
  const snap = liveCache.get('srv_lc4');
  assert.equal(snap.phase.key, 'world-gen');
  assert.equal(liveCache.statusDetail(snap), 'Generating world');
  liveCache.detach('srv_lc4');
});

test('the periodic timers probe tps and notice a restarted container', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const cmds = [];
  rconReply = async (cmd) => {
    cmds.push(cmd.join(' '));
    if (cmd[1] === 'list') return { stdout: 'There are 1 of a max of 20 players online: a', exitCode: 0 };
    if (cmd[1] === 'tps') return { stdout: 'TPS from last 1m, 5m, 15m: 20.0, 19.5, 19.0', exitCode: 0 };
    if (cmd[1] === 'mspt')
      return { stdout: 'Server tick times (avg/min/max) from last 5s, 10s, 1m: 12.5/3.0/40.0', exitCode: 0 };
    throw new Error('unknown command');
  };
  seed('srv_lc5', 'running');
  await liveCache.sync();
  await tick();
  t.mock.timers.tick(10000); // perf timer
  await tick();
  const snap = liveCache.get('srv_lc5');
  assert.equal(snap.perf.tps1, 20);
  assert.equal(snap.perf.mspt, 12.5);
  assert.equal(snap.perfSupported, true);

  // A different StartedAt means the container restarted: latched state resets.
  startedAt = '2026-02-02T00:00:00Z';
  t.mock.timers.tick(61000);
  await tick();
  assert.equal(liveCache.get('srv_lc5').startedAt, startedAt);
  liveCache.detach('srv_lc5');
});

test('when no tps probe answers the server is marked unsupported', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  rconReply = async (cmd) => {
    if (cmd[1] === 'list') return { stdout: 'There are 0 of a max of 20 players online:', exitCode: 0 };
    throw new Error('nope');
  };
  seed('srv_lc6', 'running');
  await liveCache.sync();
  await tick();
  t.mock.timers.tick(10000);
  await tick();
  assert.equal(liveCache.get('srv_lc6').perfSupported, false);
  liveCache.detach('srv_lc6');
});

test('sampleOnce returns a sample', async () => {
  assert.deepEqual(await liveCache.sampleOnce('x'), { cpu: 1 });
});
