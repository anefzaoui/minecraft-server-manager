'use strict';

// docker/containers.js against a stubbed daemon: the exact container spec the
// panel builds, Docker state to panel status mapping, the graceful/forced stop
// ladder (never report a stop that did not happen), stale-name self-healing,
// the throwaway root containers, and exec output / exit-code capture.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
require('../src/db/migrate').migrate();
const db = require('../src/db');

const connect = require('../src/docker/connect');
const created = [];
const fake = { container: {}, byName: {}, createErr: null };
connect.getDocker = () => ({
  createContainer: async (spec) => {
    created.push(spec);
    if (fake.createErr) throw fake.createErr;
    const c = {
      id: 'new-id',
      started: false,
      removed: false,
      start: async () => {
        c.started = true;
        if (fake.startErr) throw fake.startErr;
      },
      wait: async () => fake.waitResult ?? { StatusCode: 0 },
      remove: async () => {
        c.removed = true;
      },
    };
    fake.lastCreated = c;
    return c;
  },
  getContainer: (ref) => fake.byName[ref] || fake.container,
  modem: {
    demuxStream: (stream, out) => stream.on('data', (d) => out.write(d)),
  },
});
const containers = require('../src/docker/containers');

const statusErr = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const inspectOf = (State, extra = {}) => ({ Id: 'cid', Image: 'sha256:img', State, ...extra });

test.beforeEach(() => {
  created.length = 0;
  fake.container = {};
  fake.byName = {};
  fake.createErr = null;
  fake.startErr = null;
  fake.waitResult = null;
});

test('containerName and containerRef: the stored id wins, then the stored name, then the default', () => {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, container_id, container_name)
     VALUES ('srv_cn1', 'a', 'PAPER', 29001, 29002, 'x', 1024, 1536, 'abc123', 'custom')`
  );
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, container_name)
     VALUES ('srv_cn2', 'b', 'PAPER', 29003, 29004, 'x', 1024, 1536, 'named')`
  );
  assert.equal(containers.containerRef('srv_cn1'), 'abc123');
  assert.equal(containers.containerRef('srv_cn2'), 'named');
  assert.equal(containers.containerRef('srv_unknown'), 'msm-srv_unknown');
  assert.equal(containers.containerName('srv_x'), 'msm-srv_x');
});

test('createContainer builds the full spec: ports, limits, labels, healthcheck, binds', async () => {
  const id = await containers.createContainer({
    serverId: 'srv_spec',
    image: 'itzg/minecraft-server:java21',
    env: { EULA: 'TRUE', MEMORY: '2G' },
    dataDir: require('../src/storage/pathGuard').dataPath('servers', 'srv_spec'),
    ports: { game: 25570, rcon: 26570, bedrock: 19140 },
    extraPorts: [{ container: '8100/tcp', host: 8123 }],
    resources: { memoryMb: 2048, swapMb: 512, cpus: 1.5 },
    extraBinds: [
      { hostPath: '/srv/a', containerPath: '/a', mode: 'ro' },
      { hostPath: '/srv/b', containerPath: '/b', mode: 'rw' },
    ],
  });
  assert.equal(id, 'new-id');
  const spec = created[0];
  assert.equal(spec.name, 'msm-srv_spec');
  assert.equal(spec.Image, 'itzg/minecraft-server:java21');
  assert.deepEqual(spec.Env, ['EULA=TRUE', 'MEMORY=2G']);
  assert.deepEqual(spec.Labels, { 'msm.id': 'srv_spec', 'msm.managed': 'true' });
  assert.deepEqual(spec.HostConfig.PortBindings['25565/tcp'], [{ HostPort: '25570' }]);
  assert.deepEqual(spec.HostConfig.PortBindings['25565/udp'], [{ HostPort: '25570' }], 'query shares the game port');
  assert.deepEqual(spec.HostConfig.PortBindings['25575/tcp'], [{ HostPort: '26570' }]);
  assert.deepEqual(spec.HostConfig.PortBindings['19132/udp'], [{ HostPort: '19140' }]);
  assert.deepEqual(spec.HostConfig.PortBindings['8100/tcp'], [{ HostPort: '8123' }]);
  assert.ok('8100/tcp' in spec.ExposedPorts && '19132/udp' in spec.ExposedPorts);
  assert.equal(spec.HostConfig.Memory, 2048 * 1024 * 1024);
  assert.equal(spec.HostConfig.MemorySwap, 2560 * 1024 * 1024, 'swap is memory + swap');
  assert.equal(spec.HostConfig.NanoCpus, 1.5e9);
  assert.deepEqual(spec.HostConfig.RestartPolicy, { Name: 'no' }, 'the panel owns restarts');
  assert.ok(spec.HostConfig.Binds.includes('/srv/a:/a:ro'));
  assert.ok(spec.HostConfig.Binds.includes('/srv/b:/b'));
  assert.match(spec.HostConfig.Binds[0], /:\/data$/);
  assert.deepEqual(spec.Healthcheck.Test, ['CMD-SHELL', 'mc-health']);
  assert.equal(spec.Healthcheck.StartPeriod, 2 * 3600 * 1e9);
  assert.equal(spec.Tty, false);
  assert.equal('NetworkMode' in spec.HostConfig, false);
});

test('createContainer omits optional ports and limits, and honours a custom container name', async () => {
  await containers.createContainer({
    serverId: 'srv_min',
    image: 'img',
    env: {},
    dataDir: require('../src/storage/pathGuard').dataPath('servers', 'srv_min'),
    ports: { game: 25571, rcon: 26571 },
    resources: { memoryMb: 1024 },
    containerName: 'my-mc',
  });
  const spec = created[0];
  assert.equal(spec.name, 'my-mc');
  assert.ok(!('19132/udp' in spec.ExposedPorts));
  assert.equal(spec.HostConfig.NanoCpus, 0);
  assert.equal(spec.HostConfig.MemorySwap, spec.HostConfig.Memory, 'no swap');
});

test('inspectStatus maps Docker state to the panel status vocabulary', async () => {
  const cases = [
    [{ Running: true, Health: { Status: 'starting' } }, 'starting'],
    [{ Running: true, Health: { Status: 'unhealthy' } }, 'unhealthy'],
    [{ Running: true, Health: { Status: 'healthy' } }, 'running'],
    [{ Running: true }, 'running'],
    [{ Running: false, Status: 'created', ExitCode: 0 }, 'stopped'],
    [{ Running: false, Status: 'exited', ExitCode: 0 }, 'stopped'],
    [{ Running: false, Status: 'exited', ExitCode: 137 }, 'crashed'],
  ];
  for (const [State, expected] of cases) {
    fake.container = { inspect: async () => inspectOf(State) };
    assert.equal((await containers.inspectStatus('srv_a')).status, expected, JSON.stringify(State));
  }
});

test('inspectStatus carries health, exit code, image id, and OOM flag; a running container has no exit code', async () => {
  fake.container = {
    inspect: async () =>
      inspectOf({ Running: false, Status: 'exited', ExitCode: 137, OOMKilled: true, FinishedAt: 'f' }),
  };
  const dead = await containers.inspectStatus('srv_a');
  assert.deepEqual(
    [dead.exists, dead.exitCode, dead.oomKilled, dead.imageId, dead.containerId, dead.startedAt],
    [true, 137, true, 'sha256:img', 'cid', null]
  );
  fake.container = { inspect: async () => inspectOf({ Running: true, StartedAt: 's', Health: { Status: 'healthy' } }) };
  const live = await containers.inspectStatus('srv_a');
  assert.deepEqual([live.exitCode, live.startedAt, live.health], [null, 's', 'healthy']);
});

test('inspectStatus: a missing container is "does not exist", other errors propagate', async () => {
  fake.container = {
    inspect: async () => {
      throw statusErr('gone', 404);
    },
  };
  assert.deepEqual(await containers.inspectStatus('srv_a'), { exists: false, status: 'stopped' });
  fake.container = {
    inspect: async () => {
      throw statusErr('daemon down', 500);
    },
  };
  await assert.rejects(() => containers.inspectStatus('srv_a'), /daemon down/);
});

test('start, kill, and remove tolerate the benign Docker answers only', async () => {
  const calls = [];
  fake.container = {
    start: async () => calls.push('start'),
    kill: async () => {
      throw statusErr('not running', 409);
    },
    remove: async (o) => {
      calls.push(['remove', o]);
      throw statusErr('gone', 404);
    },
  };
  await containers.startContainer('srv_a');
  await containers.killContainer('srv_a'); // 409 = not running: fine
  await containers.removeContainer('srv_a'); // 404 = already gone: fine
  assert.deepEqual(calls, ['start', ['remove', { force: true }]]);
  fake.container = {
    kill: async () => {
      throw statusErr('boom', 500);
    },
    remove: async () => {
      throw statusErr('boom', 500);
    },
  };
  await assert.rejects(() => containers.killContainer('srv_a'), /boom/);
  await assert.rejects(() => containers.removeContainer('srv_a'), /boom/);
});

test('removeStaleNameConflict only removes a container that carries OUR label for this server', async () => {
  const removed = [];
  const mk = (labels) => ({
    inspect: async () => ({ Config: { Labels: labels } }),
    remove: async (o) => removed.push(o),
  });
  fake.byName = { ours: mk({ 'msm.id': 'srv_a' }), theirs: mk({ 'msm.id': 'srv_other' }), foreign: mk({}) };
  assert.equal(await containers.removeStaleNameConflict('ours', 'srv_a'), true);
  assert.equal(await containers.removeStaleNameConflict('theirs', 'srv_a'), false);
  assert.equal(await containers.removeStaleNameConflict('foreign', 'srv_a'), false);
  assert.deepEqual(removed, [{ force: true }], 'only our own orphan was removed');
  fake.byName.gone = {
    inspect: async () => {
      throw statusErr('nope', 404);
    },
  };
  assert.equal(await containers.removeStaleNameConflict('gone', 'srv_a'), false);
  fake.byName.broken = {
    inspect: async () => {
      throw statusErr('bad', 500);
    },
  };
  await assert.rejects(() => containers.removeStaleNameConflict('broken', 'srv_a'), /bad/);
});

// ---- stopContainer ----------------------------------------------------------

/** A container that walks through a scripted list of inspect() States. */
function scripted(states, extra = {}) {
  let i = 0;
  const log = [];
  return {
    log,
    inspect: async () => inspectOf(states[Math.min(i++, states.length - 1)]),
    exec: async () => {
      log.push('exec');
      throw new Error('rcon unavailable');
    },
    wait: async () => log.push('wait'),
    stop: async (o) => log.push(['stop', o]),
    ...extra,
  };
}
const RUNNING = { Running: true };
const EXITED = { Running: false, Status: 'exited', ExitCode: 0 };

test('stopContainer: a container that exits after the rcon stop needs no docker stop', async () => {
  fake.container = scripted([EXITED, EXITED]);
  await containers.stopContainer('srv_a', { graceSeconds: 1 });
  assert.ok(!fake.container.log.some((l) => Array.isArray(l) && l[0] === 'stop'));
});

test('stopContainer: falls back to docker stop with the grace period when it is still running', async () => {
  fake.container = scripted([RUNNING, EXITED]);
  await containers.stopContainer('srv_a', { graceSeconds: 1 });
  assert.deepEqual(fake.container.log.at(-1), ['stop', { t: 1 }]);
});

test('stopContainer: 304 and 404 from docker stop are fine; a real error propagates', async () => {
  for (const code of [304, 404]) {
    fake.container = scripted([RUNNING, EXITED], {
      stop: async () => {
        throw statusErr('x', code);
      },
    });
    await containers.stopContainer('srv_a', { graceSeconds: 1 });
  }
  fake.container = scripted([RUNNING, RUNNING], {
    stop: async () => {
      throw statusErr('daemon error', 500);
    },
  });
  await assert.rejects(() => containers.stopContainer('srv_a', { graceSeconds: 1 }), /daemon error/);
});

test('stopContainer never reports success while the container is still running', async () => {
  fake.container = scripted([RUNNING, RUNNING, RUNNING]);
  await assert.rejects(() => containers.stopContainer('srv_a', { graceSeconds: 1 }), /did not stop in time/);
});

test('stopContainer on a container that is already gone succeeds', async () => {
  fake.container = {
    inspect: async () => {
      throw statusErr('gone', 404);
    },
    exec: async () => {
      throw statusErr('gone', 404);
    },
    wait: async () => {},
    stop: async () => {},
  };
  await containers.stopContainer('srv_a', { graceSeconds: 1 });
});

// ---- exec capture -----------------------------------------------------------

function execContainer({ chunks = [], exitCode = 0, inspectErr = null, hang = false } = {}) {
  const stream = new PassThrough();
  return {
    exec: async () => ({
      start: async () => {
        setImmediate(() => {
          if (hang) return;
          chunks.forEach((c) => stream.write(c));
          stream.end();
        });
        return stream;
      },
      inspect: async () => {
        if (inspectErr) throw inspectErr;
        return { ExitCode: exitCode };
      },
    }),
  };
}

test('execCapture returns the demuxed output', async () => {
  fake.container = execContainer({ chunks: ['There are ', '0 players'] });
  assert.equal(await containers.execCapture('srv_a', ['rcon-cli', 'list']), 'There are 0 players');
});

test('execCaptureChecked also returns the exit code, and null (unknown) when inspect fails', async () => {
  fake.container = execContainer({ chunks: ['ok'], exitCode: 1 });
  assert.deepEqual(await containers.execCaptureChecked('srv_a', ['x']), { stdout: 'ok', exitCode: 1 });
  fake.container = execContainer({ chunks: ['ok'], inspectErr: new Error('daemon slow') });
  assert.deepEqual(await containers.execCaptureChecked('srv_a', ['x']), { stdout: 'ok', exitCode: null });
});

test('an exec that never finishes times out instead of hanging', async () => {
  fake.container = execContainer({ hang: true });
  await assert.rejects(() => containers.execCapture('srv_a', ['x'], { timeoutMs: 100 }), /timed out after/);
});

test('an exec stream error is surfaced', async () => {
  const stream = new PassThrough();
  fake.container = {
    exec: async () => ({
      start: async () => {
        setImmediate(() => stream.destroy(new Error('socket reset')));
        return stream;
      },
    }),
  };
  await assert.rejects(() => containers.execCapture('srv_a', ['x']), /socket reset/);
});

// ---- throwaway root containers ---------------------------------------------

test('removeDataDir and chownDataDir mount the PARENT, run as root with no network, and always clean up', async () => {
  const dir = require('../src/storage/pathGuard').dataPath('servers', 'srv_gone');
  await containers.removeDataDir(dir, 'img');
  let spec = created.at(-1);
  assert.deepEqual(spec.Entrypoint, ['rm', '-rf', '/work/srv_gone']);
  assert.deepEqual(spec.Cmd, []);
  assert.equal(spec.User, '0:0');
  assert.equal(spec.HostConfig.NetworkMode, 'none');
  assert.equal(spec.Labels['msm.role'], 'cleanup');
  assert.equal(fake.lastCreated.removed, true);

  await containers.chownDataDir(dir, 'img', 1000, 1001);
  spec = created.at(-1);
  assert.deepEqual(spec.Entrypoint, ['chown', '-R', '1000:1001', '/work/srv_gone']);
  assert.equal(spec.Labels['msm.role'], 'chown');
});

test('a throwaway container that exits non-zero fails the operation but is still removed', async () => {
  fake.waitResult = { StatusCode: 1 };
  await assert.rejects(() => containers.removeDataDir('/x/srv_a', 'img'), /exited 1/);
  assert.equal(fake.lastCreated.removed, true);
  await assert.rejects(() => containers.chownDataDir('/x/srv_a', 'img', 1, 1), /exited 1/);
  assert.equal(fake.lastCreated.removed, true);
  fake.waitResult = null;
  fake.startErr = new Error('cannot start');
  await assert.rejects(() => containers.removeDataDir('/x/srv_a', 'img'), /cannot start/);
  assert.equal(fake.lastCreated.removed, true);
});
