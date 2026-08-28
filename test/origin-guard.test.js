'use strict';

// originGuard normally lets a state-changing request through when it has neither
// Origin nor Referer (a non-browser client; the SameSite cookie covers
// browsers). Under COOKIE_SAMESITE=none the cookie gives no CSRF protection, so
// that same request must be rejected.

require('./helpers/env');
process.env.COOKIE_SAMESITE = 'none';
process.env.COOKIE_SECURE = 'true'; // SameSite=none requires a secure cookie or config throws

const test = require('node:test');
const assert = require('node:assert/strict');
const { originGuard } = require('../src/web/middleware/auth');

function run({ method = 'POST', headers = {} } = {}) {
  const req = { method, headers };
  let status = null;
  let body = null;
  let nexted = false;
  const res = {
    status(c) {
      status = c;
      return res;
    },
    json(b) {
      body = b;
      return res;
    },
  };
  originGuard(req, res, () => {
    nexted = true;
  });
  return { status, body, nexted };
}

test('SameSite=none: a POST with no Origin/Referer is rejected', () => {
  const r = run({ headers: { host: 'panel.example' } });
  assert.equal(r.nexted, false);
  assert.equal(r.status, 403);
});

test('SameSite=none: a same-origin POST still passes', () => {
  const r = run({ headers: { host: 'panel.example', origin: 'https://panel.example' } });
  assert.equal(r.nexted, true);
});

test('SameSite=none: a cross-origin POST is rejected', () => {
  const r = run({ headers: { host: 'panel.example', origin: 'https://evil.example' } });
  assert.equal(r.nexted, false);
  assert.equal(r.status, 403);
});

test('GET is never gated', () => {
  const r = run({ method: 'GET', headers: { host: 'panel.example' } });
  assert.equal(r.nexted, true);
});
