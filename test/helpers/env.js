'use strict';

// Require this FIRST in every test file — before any src/ module — so config
// resolves DATA_DIR/SESSION_SECRET to throwaway test values instead of the real
// panel data. node:test runs each file in its own process, so this is isolated.

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-test-'));
process.env.DATA_DIR = dir;
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
}

// Best-effort cleanup when the test process exits.
process.on('exit', () => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

module.exports = { dir };
