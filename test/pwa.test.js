'use strict';

// "Add to Home Screen" support on iOS/Android: a web app manifest plus the
// apple-specific meta tags iOS needs (it ignores manifest.json entirely).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');

const PUBLIC = path.join(__dirname, '..', 'public');

let adminCookie;
test.before(async () => {
  await app.start();
  adminCookie = await app.adminCookie();
});
test.after(async () => {
  await app.stop();
});

test('manifest.json is valid, self-consistent, and every referenced icon exists on disk', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    const abs = path.join(PUBLIC, icon.src.replace(/^\//, ''));
    assert.ok(fs.existsSync(abs), `manifest references missing icon: ${icon.src}`);
  }
});

test('the generated PNG icons are well-formed and match their declared sizes', () => {
  for (const [file, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['apple-touch-icon.png', 180],
  ]) {
    const buf = fs.readFileSync(path.join(PUBLIC, 'icons', file));
    assert.ok(buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${file}: bad PNG signature`);
    assert.equal(buf.readUInt32BE(16), size, `${file}: width`);
    assert.equal(buf.readUInt32BE(20), size, `${file}: height`);
  }
});

test('GET /manifest.json serves without authentication, with the right content type', async () => {
  const r = await app.req('GET', '/manifest.json');
  assert.equal(r.status, 200);
  assert.equal(r.json.short_name, 'MSM');
});

test('both the authenticated and login layouts link the manifest and apple-touch-icon', async () => {
  const dashboard = await app.req('GET', '/', { cookie: adminCookie });
  const login = await app.req('GET', '/login');
  for (const page of [dashboard, login]) {
    assert.match(page.text, /<link rel="manifest" href="\/manifest\.json">/);
    assert.match(page.text, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png">/);
    assert.match(page.text, /<meta name="apple-mobile-web-app-capable" content="yes">/);
    assert.match(page.text, /<meta name="theme-color" content="#2f8520">/);
  }
});
