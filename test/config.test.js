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
