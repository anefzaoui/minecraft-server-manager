'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { detectOptions, versionIsPodman } = require('../src/docker/connect');
const { bindString, serverBinds } = require('../src/docker/containers');

// Run `fn` with process.env patched (undefined deletes a key), then restore the
// exact prior environment so suites stay order-independent.
function withEnv(patch, fn) {
  const prev = { ...process.env };
  try {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in prev)) delete process.env[k];
    Object.assign(process.env, prev);
  }
}

// A throwaway "socket" file the existence probe can actually find.
function tempSocket() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-podman-test-'));
  const sock = path.join(dir, 'podman.sock');
  fs.writeFileSync(sock, '');
  return { dir, sock };
}

const unixOnly = { skip: process.platform === 'win32' ? 'socket detection is unix-only' : false };

// ---- socket detection -------------------------------------------------------

test('detectOptions: PODMAN_HOST as a unix:// URL is stripped to a path and wins', unixOnly, () => {
  const { dir, sock } = tempSocket();
  try {
    withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: `unix://${sock}` }, () => {
      assert.deepEqual(detectOptions(), { socketPath: sock });
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detectOptions: PODMAN_HOST as a bare socket path is used as-is', unixOnly, () => {
  const { dir, sock } = tempSocket();
  try {
    withEnv({ DOCKER_HOST: undefined, PODMAN_HOST: sock }, () => {
      assert.deepEqual(detectOptions(), { socketPath: sock });
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

test('detectOptions: DOCKER_HOST still wins over PODMAN_HOST (dockerode reads it)', unixOnly, () => {
  const { dir, sock } = tempSocket();
  try {
    withEnv({ DOCKER_HOST: 'unix:///var/run/docker.sock', PODMAN_HOST: sock }, () => {
      assert.deepEqual(detectOptions(), {});
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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
