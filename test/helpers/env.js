'use strict';

// Require this FIRST in every test file - before any src/ module - so config
// resolves DATA_DIR/SESSION_SECRET to throwaway test values instead of the real
// panel data. node:test runs each file in its own process, so this is isolated.

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

// Loud failure instead of silent damage: if any src/ module is already loaded,
// config has bound DATA_DIR to the REAL data directory and everything below is
// too late - the test would run migrations and DELETEs against a developer's
// live panel database. (This happened: a test that required
// src/storage/pathGuard before this helper wiped the servers in ./data.)
const early = Object.keys(require.cache).find((k) => /[\\/]src[\\/]/.test(k) && !/[\\/]node_modules[\\/]/.test(k));
if (early) {
  throw new Error(
    `test/helpers/env must be required before any src/ module, but ${path.relative(process.cwd(), early)} is already loaded. ` +
      "Move `require('./helpers/env')` (or './helpers/app') to the top of the test file."
  );
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-test-'));
process.env.DATA_DIR = dir;
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
}

// Silence the structured logger for the whole suite. node:test runs each file in
// its own process, so this is isolated. Tests that assert on logging build their
// own logger against a sink (see test/logger.test.js).
if (!process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = 'silent';
}
process.env.LOG_PRETTY = 'false';
// Never let a developer's real SENTRY_DSN forward telemetry from a test run.
delete process.env.SENTRY_DSN;

// Unit tests never reach a real Docker daemon. Free-port checks also ask Docker
// which host ports other containers publish; with a developer's Docker running,
// that made results depend on their containers. Every suite sees "none"; a test
// of the real function opts back in through `realPublishedHostPorts`. Patched
// when src/docker/containers first loads, not here: requiring it now would bind
// config before a test file sets its own env vars.
const Module = require('node:module');
const containersFile = path.resolve(__dirname, '../../src/docker/containers.js');
let realPublished = null;
// @ts-ignore - Module._load is internal, but the stable seam for this.
const origLoad = Module._load;
// @ts-ignore
Module._load = function load(request, parent, isMain) {
  const exported = origLoad.call(this, request, parent, isMain);
  if (!realPublished && exported && typeof exported.publishedHostPorts === 'function') {
    // @ts-ignore
    if (Module._resolveFilename(request, parent, isMain) === containersFile) {
      realPublished = exported.publishedHostPorts;
      exported.publishedHostPorts = async () => new Set();
    }
  }
  return exported;
};
/** @param {any[]} args */
const realPublishedHostPorts = (...args) => realPublished(...args);

// Best-effort cleanup when the test process exits.
process.on('exit', () => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

module.exports = { dir, realPublishedHostPorts };
