'use strict';

// Regression coverage for profile pictures: 12 built-in presets or an
// uploaded image, self-service (own account, any role), plus the shared
// pixel-icon set also used for server icons.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const { AVATAR_PRESETS, avatarSrc } = require('../src/config/avatars');

let adminCookie;

test.before(async () => {
  await app.start();
  adminCookie = await app.adminCookie();
});
test.after(async () => {
  await app.stop();
});

test('exactly 12 presets, each backed by a real SVG file', () => {
  assert.equal(AVATAR_PRESETS.length, 12);
  const keys = new Set();
  for (const p of AVATAR_PRESETS) {
    assert.equal(keys.has(p.key), false, `duplicate preset key: ${p.key}`);
    keys.add(p.key);
    const abs = path.join(__dirname, '..', 'public', 'icons', 'avatars', p.file);
    assert.ok(fs.existsSync(abs), `${p.file} is missing on disk`);
  }
});

test('avatarSrc() resolves presets and custom uploads, and rejects junk', () => {
  assert.equal(avatarSrc(null), null);
  assert.equal(avatarSrc(''), null);
  assert.equal(avatarSrc('preset:pickaxe'), '/icons/avatars/pickaxe.svg');
  assert.equal(avatarSrc('preset:not-a-real-key'), null);
  assert.equal(avatarSrc('custom:usr_abc123.png'), '/api/avatars/custom/usr_abc123.png');
  // avatarSrc() only builds a URL - it's not the safety boundary. A path-traversal-
  // shaped value at least gets its slashes escaped (encodeURIComponent doesn't
  // touch dots), and the real protection is the serving route's filename regex,
  // covered separately below.
  assert.equal(avatarSrc('custom:../../etc/passwd'), '/api/avatars/custom/..%2F..%2Fetc%2Fpasswd');
});

test('GET /api/account/avatar/presets lists all 12 with working URLs', async () => {
  const r = await app.req('GET', '/api/account/avatar/presets', { cookie: adminCookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.presets.length, 12);
  for (const p of r.json.presets) {
    const img = await app.req('GET', p.url, { cookie: adminCookie });
    assert.equal(img.status, 200, `${p.url} should serve`);
  }
});

test('setting and clearing a preset avatar round-trips through the DB', async () => {
  const set = await app.req('POST', '/api/account/avatar/preset', { cookie: adminCookie, body: { key: 'diamond' } });
  assert.equal(set.status, 200);
  assert.equal(set.json.avatar, 'preset:diamond');

  const me = await app.req('GET', '/api/users', { cookie: adminCookie });
  const admin = me.json.users.find((u) => u.username === 'admin');
  assert.equal(admin.avatar, 'preset:diamond');

  const clear = await app.req('DELETE', '/api/account/avatar', { cookie: adminCookie });
  assert.equal(clear.status, 200);
  const me2 = await app.req('GET', '/api/users', { cookie: adminCookie });
  assert.equal(me2.json.users.find((u) => u.username === 'admin').avatar, null);
});

test('rate-limits repeated avatar writes so a hijacked session cannot loop them unbounded', async () => {
  const create = await app.req('POST', '/api/users', {
    cookie: adminCookie,
    body: { username: 'avatarspammer', password: 'spampass123', role: 'viewer' },
  });
  assert.equal(create.status, 201);
  const login = await app.req('POST', '/login', { body: { username: 'avatarspammer', password: 'spampass123' } });
  const cookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  let last;
  for (let i = 0; i < 31; i++) {
    last = await app.req('POST', '/api/account/avatar/preset', { cookie, body: { key: 'torch' } });
  }
  assert.equal(last.status, 429);
});

test('rejects an unknown preset key', async () => {
  const r = await app.req('POST', '/api/account/avatar/preset', {
    cookie: adminCookie,
    body: { key: 'not-a-real-preset' },
  });
  assert.equal(r.status, 400);
});

test('a viewer (read-only role) can still set their own avatar - self-service, not a write-role action', async () => {
  const create = await app.req('POST', '/api/users', {
    cookie: adminCookie,
    body: { username: 'avatarviewer', password: 'viewerpass123', role: 'viewer' },
  });
  assert.equal(create.status, 201);
  const login = await app.req('POST', '/login', { body: { username: 'avatarviewer', password: 'viewerpass123' } });
  const viewerCookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  const r = await app.req('POST', '/api/account/avatar/preset', { cookie: viewerCookie, body: { key: 'torch' } });
  assert.equal(r.status, 200);
});

test('GET /api/avatars/custom/:file rejects a path-traversal-shaped filename', async () => {
  const r = await app.req('GET', '/api/avatars/custom/..%2F..%2Fpanel.db', { cookie: adminCookie });
  assert.equal(r.status, 400);
});

test('server icons are original SVGs in their own directory, distinct artwork from the avatar presets', () => {
  for (const name of ['grass', 'creeper', 'diamond', 'portal', 'chest', 'sword', 'potion', 'tnt']) {
    const abs = path.join(__dirname, '..', 'public', 'icons', 'servers', `${name}.svg`);
    assert.ok(fs.existsSync(abs), `${name}.svg should exist for the server-icon picker`);
  }
  // The 5 overlapping concepts (diamond/chest/sword/potion/tnt) must be genuinely
  // different files between the two pickers, not the same asset referenced twice.
  for (const name of ['diamond', 'chest', 'sword', 'potion', 'tnt']) {
    const serverSvg = fs.readFileSync(path.join(__dirname, '..', 'public', 'icons', 'servers', `${name}.svg`), 'utf8');
    const avatarSvg = fs.readFileSync(path.join(__dirname, '..', 'public', 'icons', 'avatars', `${name}.svg`), 'utf8');
    assert.notEqual(serverSvg, avatarSvg, `${name}: server and avatar icons should be visually distinct artwork`);
  }
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'public', 'icons', 'servers', 'grass.png')), false);
});

test('role names render capitalized in the UI, but the stored/submitted value stays lowercase', async () => {
  const page = await app.req('GET', '/settings', { cookie: adminCookie });
  assert.equal(page.status, 200);
  assert.match(page.text, /<option value="admin"[^>]*>Admin<\/option>/);
  assert.match(page.text, /<option value="operator"[^>]*>Operator<\/option>/);
  assert.match(page.text, /<option value="viewer"[^>]*>Viewer<\/option>/);

  // Role changes still submit/compare the lowercase enum the DB and zod schema expect.
  const setRole = await app.req('POST', '/api/users', {
    cookie: adminCookie,
    body: { username: 'roleuser', password: 'rolepass123', role: 'operator' },
  });
  assert.equal(setRole.status, 201);
  assert.equal(setRole.json.user.role, 'operator');
});
