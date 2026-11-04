'use strict';

// The thin Docker wrappers (images, stats, logs) against a stubbed daemon:
// 404 handling, progress aggregation, stats normalisation, and log demuxing.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
require('../src/db/migrate').migrate();

// Stub the Docker client BEFORE the wrappers destructure getDocker at load.
const connect = require('../src/docker/connect');
const state = { images: {}, pullEvents: [], pullErr: null, followErr: null, container: {} };
connect.getDocker = () => ({
  getImage: (ref) => ({
    inspect: async () => {
      const v = state.images[ref];
      if (v instanceof Error) throw v;
      if (!v) throw Object.assign(new Error('no such image'), { statusCode: 404 });
      return v;
    },
  }),
  pull: (ref, cb) => (state.pullErr ? cb(state.pullErr) : cb(null, { ref })),
  getContainer: () => state.container,
  modem: {
    followProgress: (_stream, done, onEvent) => {
      state.pullEvents.forEach(onEvent);
      done(state.followErr);
    },
    demuxStream: (raw, out) => raw.on('data', (d) => out.write(d)),
  },
});

const images = require('../src/docker/images');
const stats = require('../src/docker/stats');
const logs = require('../src/docker/logs');

function frame(type, text) {
  const body = Buffer.from(text);
  const head = Buffer.alloc(8);
  head[0] = type;
  head.writeUInt32BE(body.length, 4);
  return Buffer.concat([head, body]);
}

function statusErr(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

test('imageRef defaults to :latest and honours a java tag', () => {
  assert.equal(images.imageRef(), `${images.IMAGE_REPO}:latest`);
  assert.equal(images.imageRef('java21'), `${images.IMAGE_REPO}:java21`);
});

test('imageExists: true when present, false on 404, rethrows other errors', async () => {
  state.images = { a: { Id: 'sha256:1' }, boom: statusErr('daemon down', 500) };
  assert.equal(await images.imageExists('a'), true);
  assert.equal(await images.imageExists('missing'), false);
  await assert.rejects(() => images.imageExists('boom'), /daemon down/);
});

test('imageId returns the id, or null when the image is absent or has none', async () => {
  state.images = { a: { Id: 'sha256:1' }, noid: {} };
  assert.equal(await images.imageId('a'), 'sha256:1');
  assert.equal(await images.imageId('noid'), null);
  assert.equal(await images.imageId('missing'), null);
});

test('pullImage sums layer progress and resolves', async () => {
  state.pullErr = null;
  state.followErr = null;
  state.pullEvents = [
    { id: 'l1', status: 'Downloading', progressDetail: { current: 10, total: 100 } },
    { id: 'l2', status: 'Downloading', progressDetail: { current: 5, total: 50 } },
    { id: 'l1', status: 'Downloading', progressDetail: { current: 60, total: 100 } },
    { status: 'Status: done' },
  ];
  const seen = [];
  await images.pullImage('x', (p) => seen.push(p));
  assert.deepEqual(seen[1], { status: 'Downloading', current: 15, total: 150 });
  assert.deepEqual(seen[2], { status: 'Downloading', current: 65, total: 150 });
  assert.equal(seen[3].status, 'Status: done');
});

test('pullImage rejects on a pull error and on a stream error', async () => {
  state.pullErr = new Error('pull denied');
  await assert.rejects(() => images.pullImage('x'), /pull denied/);
  state.pullErr = null;
  state.followErr = new Error('stream broke');
  state.pullEvents = [];
  await assert.rejects(() => images.pullImage('x'), /stream broke/);
  state.followErr = null;
});

test('ensureImage pulls only when the image is missing', async () => {
  state.pullEvents = [{ status: 'pulled' }];
  state.images = { have: { Id: '1' } };
  let calls = 0;
  await images.ensureImage('have', () => calls++);
  assert.equal(calls, 0);
  await images.ensureImage('missing', () => calls++);
  assert.equal(calls, 1);
});

test('stats.normalize: CPU percent, cache-adjusted memory, summed NICs', () => {
  const n = stats.normalize({
    cpu_stats: { cpu_usage: { total_usage: 300 }, system_cpu_usage: 2000, online_cpus: 4 },
    precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000 },
    memory_stats: { usage: 1000, limit: 4096, stats: { inactive_file: 200 } },
    networks: { eth0: { rx_bytes: 10, tx_bytes: 5 }, eth1: { rx_bytes: 1, tx_bytes: 2 } },
  });
  assert.deepEqual(n, { cpuPct: 80, memUsedBytes: 800, memLimitBytes: 4096, netRx: 11, netTx: 7 });
});

test('stats.normalize survives a first sample with missing fields', () => {
  assert.deepEqual(stats.normalize({}), { cpuPct: 0, memUsedBytes: 0, memLimitBytes: 0, netRx: 0, netTx: 0 });
  const n = stats.normalize({ memory_stats: { usage: 10, limit: 100, stats: { cache: 50 } } });
  assert.equal(n.memUsedBytes, 0, 'never negative');
});

test('statsOnce: normalises, maps 404/409 to null, rethrows others', async () => {
  state.container = { stats: async () => ({ memory_stats: { usage: 7, limit: 9 } }) };
  assert.equal((await stats.statsOnce('srv_a')).memUsedBytes, 7);
  for (const code of [404, 409]) {
    state.container = {
      stats: async () => {
        throw statusErr('gone', code);
      },
    };
    assert.equal(await stats.statsOnce('srv_a'), null);
  }
  state.container = {
    stats: async () => {
      throw statusErr('boom', 500);
    },
  };
  await assert.rejects(() => stats.statsOnce('srv_a'), /boom/);
});

test('statsStream parses frames across chunks, ignores junk, survives errors, and stop() destroys', async () => {
  const raw = new PassThrough();
  let destroyed = false;
  raw.destroy = () => {
    destroyed = true;
  };
  state.container = { stats: async () => raw };
  const samples = [];
  const stop = await stats.statsStream('srv_a', (s) => samples.push(s));
  const line = JSON.stringify({ memory_stats: { usage: 42, limit: 100 } });
  raw.write(line.slice(0, 10));
  raw.write(line.slice(10) + '\n\n{not json}\n');
  await new Promise((r) => setImmediate(r));
  assert.equal(samples.length, 1);
  assert.equal(samples[0].memUsedBytes, 42);
  raw.emit('error', new Error('container removed')); // must not throw
  stop();
  assert.equal(destroyed, true);
});

test('demuxBuffer strips frame headers and passes non-buffers through', () => {
  const buf = Buffer.concat([frame(1, 'hello '), frame(2, 'world')]);
  assert.equal(logs.demuxBuffer(buf), 'hello world');
  assert.equal(logs.demuxBuffer('plain'), 'plain');
});

test('demuxBuffer: unframed TTY output is kept, malformed frames are dropped', () => {
  assert.equal(logs.demuxBuffer(Buffer.from('[12:00:00] tty line here')), '[12:00:00] tty line here');
  const huge = Buffer.from([1, 0, 0, 0, 0xff, 0xff, 0xff, 0xff]);
  assert.equal(logs.demuxBuffer(Buffer.concat([frame(1, 'ok'), huge, Buffer.from('zz')])), 'ok');
  assert.equal(logs.demuxBuffer(frame(1, 'abcdef').subarray(0, 12)), '');
});

test('fetchLogs passes options through and treats a missing container as empty', async () => {
  let opts;
  state.container = {
    logs: async (o) => {
      opts = o;
      return frame(1, 'line\n');
    },
  };
  assert.equal(await logs.fetchLogs('srv_a', { tail: 50, timestamps: true, since: 100.9 }), 'line\n');
  assert.deepEqual(opts, { stdout: true, stderr: true, tail: 50, timestamps: true, since: 100 });
  await logs.fetchLogs('srv_a');
  assert.equal('since' in opts, false);
  state.container = {
    logs: async () => {
      throw statusErr('nope', 404);
    },
  };
  assert.equal(await logs.fetchLogs('srv_a'), '');
  state.container = {
    logs: async () => {
      throw statusErr('fail', 500);
    },
  };
  await assert.rejects(() => logs.fetchLogs('srv_a'), /fail/);
});

test('followLogs streams demuxed output, ends when upstream ends, and stop() destroys', async () => {
  const raw = new PassThrough();
  let destroyed = false;
  const origDestroy = raw.destroy.bind(raw);
  raw.destroy = () => {
    destroyed = true;
    return origDestroy();
  };
  state.container = { logs: async () => raw };
  const { stream, stop } = await logs.followLogs('srv_a');
  const chunks = [];
  stream.on('data', (d) => chunks.push(d.toString()));
  const ended = new Promise((r) => stream.on('end', r));
  raw.write('hi');
  raw.emit('end');
  await ended;
  assert.deepEqual(chunks, ['hi']);
  stop();
  assert.equal(destroyed, true);
});
