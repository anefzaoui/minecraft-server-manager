'use strict';

const env = require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const connect = require('../src/docker/connect');
const containers = require('../src/docker/containers');
const { detectOptions, versionIsPodman } = connect;
const { bindString, serverBinds } = containers;

// Run `fn` with process.env patched (undefined deletes a key), then restore the
// exact prior environment so suites stay order-independent. Awaits async fns
// before restoring.
async function withEnv(patch, fn) {
  const prev = { ...process.env };
  try {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return await fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
    Object.assign(process.env, prev);
  }
}

// A throwaway UNIX socket the probe can actually find (a regular file is not a
// socket and must be rejected).
async function tempSocket() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-podman-test-'));
  const sock = path.join(dir, 'podman.sock');
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(sock, resolve);
  });
  return {
    dir,
    sock,
    cleanup: async () => {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

const unixOnly = { skip: process.platform === 'win32' ? 'socket detection is unix-only' : false };

// ---- socket detection -------------------------------------------------------

test('detectOptions: PODMAN_HOST as a unix:// URL is stripped to a path and wins', unixOnly, async () => {
  const s = await tempSocket();
  try {
    await withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: `unix://${s.sock}` }, () => {
      assert.deepEqual(detectOptions(), { socketPath: s.sock });
    });
  } finally {
    await s.cleanup();
  }
});

test('detectOptions: PODMAN_HOST as a bare socket path is used as-is', unixOnly, async () => {
  const s = await tempSocket();
  try {
    await withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: s.sock }, () => {
      assert.deepEqual(detectOptions(), { socketPath: s.sock });
    });
  } finally {
    await s.cleanup();
  }
});

test('detectOptions: a non-unix PODMAN_HOST URL is never probed as a path', unixOnly, () => {
  withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: 'tcp://127.0.0.1:2375' }, () => {
    const opts = detectOptions();
    assert.notEqual(opts.socketPath, 'tcp://127.0.0.1:2375');
    assert.ok(typeof opts.socketPath === 'string' && opts.socketPath.startsWith('/'));
  });
});

test('detectOptions: a PODMAN_HOST pointing at a missing socket falls through', unixOnly, () => {
  const missing = path.join(os.tmpdir(), 'msm-podman-test-does-not-exist.sock');
  withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: `unix://${missing}` }, () => {
    assert.notEqual(detectOptions().socketPath, missing);
  });
});

test('detectOptions: a regular file or folder at PODMAN_HOST is not a socket', unixOnly, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-podman-test-'));
  const file = path.join(dir, 'not-a-socket');
  fs.writeFileSync(file, '');
  try {
    withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: file }, () => {
      assert.notEqual(detectOptions().socketPath, file);
    });
    withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: dir }, () => {
      assert.notEqual(detectOptions().socketPath, dir);
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detectOptions: DOCKER_HOST still wins over PODMAN_HOST (dockerode reads it)', unixOnly, async () => {
  const s = await tempSocket();
  try {
    await withEnv({ DOCKER_HOST: 'unix:///var/run/docker.sock', PODMAN_HOST: s.sock }, () => {
      assert.deepEqual(detectOptions(), {});
    });
  } finally {
    await s.cleanup();
  }
});

// ---- daemon identification --------------------------------------------------

test('versionIsPodman: recognizes the Podman Engine component', () => {
  assert.equal(versionIsPodman({ Components: [{ Name: 'Podman Engine', Version: '6.1.3' }] }), true);
  assert.equal(versionIsPodman({ Components: [{ Name: 'podman' }] }), true); // case-insensitive
});

test('versionIsPodman: Docker engine components are not Podman', () => {
  assert.equal(versionIsPodman({ Components: [{ Name: 'Engine', Version: '27.0.0' }] }), false);
});

test('versionIsPodman: missing or malformed version payloads are not Podman', () => {
  assert.equal(versionIsPodman(null), false);
  assert.equal(versionIsPodman(undefined), false);
  assert.equal(versionIsPodman({}), false);
  assert.equal(versionIsPodman({ Components: null }), false);
  assert.equal(versionIsPodman({ Components: [{ Version: '6.1.3' }] }), false); // no Name
});

test('isPodmanDaemon: a failed lookup is retried, a successful one is cached', async () => {
  const real = connect.getDocker;
  let calls = 0;
  const answers = [
    () => {
      throw new Error('socket not up yet');
    },
    () => ({ Components: [{ Name: 'Podman Engine' }] }),
    () => {
      throw new Error('cached answer must not hit the daemon again');
    },
  ];
  connect.getDocker = () => ({ version: async () => answers[calls++]() });
  try {
    assert.equal(await connect.isPodmanDaemon(), false); // failure: not cached
    assert.equal(await connect.isPodmanDaemon(), true); // retry succeeds
    assert.equal(await connect.isPodmanDaemon(), true); // cached, no third call
    assert.equal(calls, 2);
  } finally {
    connect.getDocker = real;
  }
});

// ---- bind strings -----------------------------------------------------------

test('bindString: plain bind has no options suffix', () => {
  assert.equal(bindString('/host/data', '/data'), '/host/data:/data');
});

test('bindString: read-only mode is a single ro option', () => {
  assert.equal(bindString('/host/cfg', '/cfg', { ro: true }), '/host/cfg:/cfg:ro');
});

test('bindString: SELinux label is a single option', () => {
  assert.equal(bindString('/host/data', '/data', { label: 'z' }), '/host/data:/data:z');
  assert.equal(bindString('/host/data', '/data', { label: 'Z' }), '/host/data:/data:Z');
});

test('bindString: ro + label are comma-joined, never colon-stacked', () => {
  // host:ctr:ro:Z would parse as a four-part bind and fail under Podman.
  assert.equal(bindString('/host/cfg', '/cfg', { ro: true, label: 'z' }), '/host/cfg:/cfg:ro,z');
});

const extras = [
  { hostPath: '/opt/mods', containerPath: '/mods', mode: 'rw' },
  { hostPath: '/opt/cfg', containerPath: '/cfg', mode: 'ro' },
];

test('serverBinds: Podman labels /data with shared :z and leaves extra binds unlabelled', () => {
  assert.deepEqual(serverBinds('/host/msm/servers/abc', extras, true), [
    '/host/msm/servers/abc:/data:z',
    '/opt/mods:/mods',
    '/opt/cfg:/cfg:ro',
  ]);
});

test('serverBinds: Docker gets no SELinux labels at all', () => {
  assert.deepEqual(serverBinds('/host/msm/servers/abc', extras, false), [
    '/host/msm/servers/abc:/data',
    '/opt/mods:/mods',
    '/opt/cfg:/cfg:ro',
  ]);
});

test('serverBinds: extra binds never carry a relabel option under Podman', () => {
  const binds = serverBinds('/host/msm/servers/abc', extras, true);
  for (const b of binds.slice(1)) {
    assert.doesNotMatch(b, /:[zZ](,|$)/, `extra bind must not relabel its host path: ${b}`);
  }
});

test('serverBinds: no extra binds yields just the /data bind', () => {
  assert.deepEqual(serverBinds('/host/msm/servers/abc', undefined, true), ['/host/msm/servers/abc:/data:z']);
  assert.deepEqual(serverBinds('/host/msm/servers/abc', [], false), ['/host/msm/servers/abc:/data']);
});

// ---- cleanup / chown container binds ----------------------------------------

test('removeDataDir/chownDataDir: shared :z under Podman, no label under Docker', async () => {
  const realDocker = connect.getDocker;
  const realPodman = connect.isPodmanDaemon;
  const captured = [];
  connect.getDocker = () => ({
    createContainer: async (opts) => {
      captured.push(opts);
      return {
        start: async () => {},
        wait: async () => ({ StatusCode: 0 }),
        remove: async () => {},
      };
    },
  });
  const dir = path.join(env.dir, 'servers', 'abc');
  const parent = path.dirname(dir);
  try {
    connect.isPodmanDaemon = async () => true;
    await containers.removeDataDir(dir, 'itzg/minecraft-server:latest');
    await containers.chownDataDir(dir, 'itzg/minecraft-server:latest', 1000, 1000);
    connect.isPodmanDaemon = async () => false;
    await containers.removeDataDir(dir, 'itzg/minecraft-server:latest');
    await containers.chownDataDir(dir, 'itzg/minecraft-server:latest', 1000, 1000);
  } finally {
    connect.getDocker = realDocker;
    connect.isPodmanDaemon = realPodman;
  }
  assert.equal(captured.length, 4);
  // removeDataDir mounts the parent (rm must remove the dir entry itself),
  // with the SHARED label so running servers keep their worlds.
  assert.deepEqual(captured[0].HostConfig.Binds, [`${parent}:/work:z`]);
  assert.deepEqual(captured[0].Entrypoint, ['rm', '-rf', '/work/abc']);
  // chownDataDir mounts only this server's dir: one world relabelled, not the tree.
  assert.deepEqual(captured[1].HostConfig.Binds, [`${dir}:/work:z`]);
  assert.deepEqual(captured[1].Entrypoint, ['chown', '-R', '1000:1000', '/work']);
  // Docker: exactly the same binds without any label.
  assert.deepEqual(captured[2].HostConfig.Binds, [`${parent}:/work`]);
  assert.deepEqual(captured[3].HostConfig.Binds, [`${dir}:/work`]);
  for (const opts of captured) {
    for (const b of opts.HostConfig.Binds) {
      assert.doesNotMatch(b, /:Z(,|$)/, `private :Z relabel must never come back: ${b}`);
    }
  }
});
