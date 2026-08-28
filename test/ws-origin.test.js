'use strict';

// The WebSocket upgrade path bypasses all Express middleware, so it re-checks
// the same same-origin rule as web/middleware/auth.js#originGuard before
// handing the socket to `ws`. Guards against cross-site WebSocket hijacking of
// the console log stream.

const test = require('node:test');
const assert = require('node:assert/strict');
const { originAllowed } = require('../src/ws/index');

const withHeaders = (headers) => ({ headers });

test('a browser Origin matching the Host is allowed', () => {
  assert.equal(originAllowed(withHeaders({ origin: 'https://panel.example', host: 'panel.example' })), true);
});

test('a cross-site Origin is rejected', () => {
  assert.equal(originAllowed(withHeaders({ origin: 'https://evil.example', host: 'panel.example' })), false);
});

test('a mismatched port counts as cross-origin', () => {
  assert.equal(originAllowed(withHeaders({ origin: 'http://panel.example:8080', host: 'panel.example' })), false);
});

test('no Origin and no Referer is allowed (non-browser client; the cookie still gates)', () => {
  assert.equal(originAllowed(withHeaders({ host: 'panel.example' })), true);
});

test('falls back to Referer when Origin is absent', () => {
  assert.equal(originAllowed(withHeaders({ referer: 'https://panel.example/servers/x', host: 'panel.example' })), true);
  assert.equal(originAllowed(withHeaders({ referer: 'https://evil.example/', host: 'panel.example' })), false);
});

test('a malformed Origin is rejected', () => {
  assert.equal(originAllowed(withHeaders({ origin: 'not a url', host: 'panel.example' })), false);
});
