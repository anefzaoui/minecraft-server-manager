'use strict';

// execRaw must give up on a wedged Docker daemon within its timeout even when
// the hang is in creating/starting the exec (not just in the output stream) -
// otherwise every route that runs an rcon-cli command hangs with it.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate(); // containerRef() reads the servers table

// Stub the Docker client BEFORE containers.js destructures getDocker at load.
const connect = require('../src/docker/connect');
let mode = 'hang-exec';
connect.getDocker = () => ({
  getContainer: () => ({
    exec: async () => {
      if (mode === 'hang-exec') return new Promise(() => {});
      return { start: async () => new Promise(() => {}), inspect: async () => ({ ExitCode: 0 }) };
    },
  }),
  modem: { demuxStream() {} },
});
const containers = require('../src/docker/containers');

test('a daemon that never answers exec creation times out', async () => {
  mode = 'hang-exec';
  const t0 = Date.now();
  await assert.rejects(() => containers.execCapture('srv_x', ['rcon-cli', 'list'], { timeoutMs: 300 }), /timed out/);
  assert.ok(Date.now() - t0 < 2000, 'gave up promptly');
});

test('a daemon that never starts the exec stream times out', async () => {
  mode = 'hang-start';
  const t0 = Date.now();
  await assert.rejects(
    () => containers.execCaptureChecked('srv_x', ['rcon-cli', 'list'], { timeoutMs: 300 }),
    /timed out/
  );
  assert.ok(Date.now() - t0 < 2000, 'gave up promptly');
});
