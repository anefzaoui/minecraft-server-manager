'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Load config in a clean child process with a controlled env, so we can assert
// on the fail-fast behavior without contaminating this process's module cache.
function loadConfig(extraEnv) {
  return spawnSync(process.execPath, ['-e', "require('./src/config')"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: process.env.DATA_DIR,
      SESSION_SECRET: 'valid-session-secret-abcdef123456',
      PANEL_PORT: '',
      ...extraEnv,
    },
    encoding: 'utf8',
  });
}

test('config exposes validated defaults', () => {
  const config = require('../src/config');
  assert.equal(config.port, 25564);
  assert.equal(config.mcImageRepo, 'itzg/minecraft-server');
  assert.equal(config.trustProxy, false);
  assert.equal(config.cookieSecure, false);
  assert.equal(config.cookieSameSite, 'lax');
  assert.ok(config.defaults.heapMb >= 1024 && config.defaults.heapMb <= 8192);
  assert.ok(config.defaults.containerMemoryMb >= config.defaults.heapMb);
  assert.equal(config.defaults.diskQuotaGb, 25);
});

test('a non-numeric PANEL_PORT fails fast with a clear message', () => {
  const res = loadConfig({ PANEL_PORT: 'not-a-port' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /PANEL_PORT/);
});

test('an out-of-range port fails fast', () => {
  const res = loadConfig({ PANEL_PORT: '70000' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /PANEL_PORT/);
});

test('a too-short SESSION_SECRET fails fast', () => {
  const res = loadConfig({ SESSION_SECRET: 'short' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /SESSION_SECRET/);
});

test('a bogus LOG_LEVEL fails fast with a clear message', () => {
  const res = loadConfig({ LOG_LEVEL: 'verbose' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /LOG_LEVEL/);
});

test('LOG_LEVEL=silent is accepted', () => {
  const res = loadConfig({ LOG_LEVEL: 'silent' });
  assert.equal(res.status, 0, res.stderr);
});

test('config exposes a normalized logLevel and an inert sentry block', () => {
  const config = require('../src/config');
  assert.ok(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].includes(config.logLevel));
  assert.equal(typeof config.sentry.enabled, 'boolean');
  assert.equal(config.sentry.enabled, false);
});

function loadMapProxyHost(extraEnv) {
  const res = spawnSync(process.execPath, ['-e', "process.stdout.write(require('./src/config').mapProxyHost)"], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: process.env.DATA_DIR,
      SESSION_SECRET: 'valid-session-secret-abcdef123456',
      PANEL_PORT: '',
      DATA_DIR_HOST: '',
      MAP_PROXY_HOST: '',
      ...extraEnv,
    },
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  return res.stdout;
}

test('mapProxyHost is 127.0.0.1 on bare metal (no DATA_DIR_HOST)', () => {
  assert.equal(loadMapProxyHost({}), '127.0.0.1');
});

test('mapProxyHost switches to host.docker.internal once DATA_DIR_HOST is set (containerized panel)', () => {
  assert.equal(loadMapProxyHost({ DATA_DIR_HOST: '/opt/msm/data' }), 'host.docker.internal');
});

test('MAP_PROXY_HOST always wins, containerized or not', () => {
  assert.equal(loadMapProxyHost({ MAP_PROXY_HOST: '10.0.0.5' }), '10.0.0.5');
  assert.equal(loadMapProxyHost({ DATA_DIR_HOST: '/opt/msm/data', MAP_PROXY_HOST: '10.0.0.5' }), '10.0.0.5');
});

test('COOKIE_SAMESITE resolves lax/strict/none, defaulting to lax', () => {
  const read = (extraEnv) => {
    const res = spawnSync(process.execPath, ['-e', "process.stdout.write(require('./src/config').cookieSameSite)"], {
      cwd: ROOT,
      env: {
        ...process.env,
        DATA_DIR: process.env.DATA_DIR,
        SESSION_SECRET: 'valid-session-secret-abcdef123456',
        PANEL_PORT: '',
        COOKIE_SECURE: '',
        COOKIE_SAMESITE: '',
        ...extraEnv,
      },
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, res.stderr);
    return res.stdout;
  };
  assert.equal(read({}), 'lax');
  assert.equal(read({ COOKIE_SAMESITE: 'Strict' }), 'strict');
  assert.equal(read({ COOKIE_SAMESITE: 'bogus' }), 'lax');
  assert.equal(read({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' }), 'none');
});

test('COOKIE_SAMESITE=none without a secure cookie fails fast', () => {
  const res = loadConfig({ COOKIE_SAMESITE: 'none', COOKIE_SECURE: '' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /COOKIE_SAMESITE=none/);
});

test('TRUST_PROXY / COOKIE_SECURE resolve to usable values', () => {
  const res = spawnSync(
    process.execPath,
    [
      '-e',
      "const c=require('./src/config'); process.stdout.write(JSON.stringify({tp:c.trustProxy,cs:c.cookieSecure,exposed:c.isExposedBind}))",
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        SESSION_SECRET: 'valid-session-secret-abcdef123456',
        TRUST_PROXY: '1',
        COOKIE_SECURE: 'auto',
        PANEL_HOST: '0.0.0.0',
      },
      encoding: 'utf8',
    }
  );
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.tp, 1);
  assert.equal(out.cs, 'auto');
  assert.equal(out.exposed, true);
});
