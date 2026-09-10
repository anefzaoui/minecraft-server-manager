'use strict';

// The security-header middleware. Guards the CSP directives other features
// depend on - notably img-src blob:, without which the client-side
// profile-picture cropper (public/js/lib/imageCrop.js) can't preview the
// chosen image and the whole crop/upload flow silently fails.

require('./helpers/env'); // first: points DATA_DIR at a throwaway dir before any src/ module loads
const test = require('node:test');
const assert = require('node:assert/strict');
const { securityHeaders } = require('../src/web/middleware/securityHeaders');

function run() {
  const headers = {};
  const res = {
    locals: {},
    setHeader: (k, v) => {
      headers[k] = v;
    },
  };
  let nexted = false;
  securityHeaders({ secure: false }, res, () => {
    nexted = true;
  });
  return { headers, nexted, csp: headers['Content-Security-Policy'] || '' };
}

test('calls next and sets a Content-Security-Policy', () => {
  const { nexted, csp } = run();
  assert.equal(nexted, true);
  assert.ok(csp.length > 0);
});

test('img-src allows blob: (cropper preview) and data: (inline SVGs)', () => {
  const { csp } = run();
  const imgSrc = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('img-src'));
  assert.ok(imgSrc, 'no img-src directive');
  assert.match(imgSrc, /\bblob:/, `img-src is missing blob:  (${imgSrc})`);
  assert.match(imgSrc, /\bdata:/, `img-src is missing data:  (${imgSrc})`);
});

test('script-src carries a per-request nonce and no unsafe-inline', () => {
  const { csp } = run();
  const scriptSrc = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('script-src'));
  assert.match(scriptSrc, /'nonce-[A-Za-z0-9+/=]+'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
});
