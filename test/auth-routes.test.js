'use strict';

// First-run setup + login/logout route behaviour: validation, the open-redirect
// guard on `next`, first-run gating, and the 2FA step's session guards.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');

const jsonHeaders = { Accept: 'application/json' };

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

function cookieOf(res) {
  return (res.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test('before setup: /login and / send visitors to /setup, and /setup renders', async () => {
  const login = await app.req('GET', '/login');
  assert.equal(login.status, 302);
  assert.equal(login.headers.get('location'), '/setup');
  const page = await app.req('GET', '/setup');
  assert.equal(page.status, 200);
});

test('before setup: the environment checks are available and never leak the secret', async () => {
  const r = await app.req('GET', '/setup/checks');
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.ok(['pass', 'warn', 'fail'].includes(r.json.checks.dataDir.level));
  assert.equal(typeof r.json.checks.sessionSecret.set, 'boolean');
  assert.ok(!r.text.includes(require('../src/config').sessionSecret || '\u0000never'));
});

test('setup validates the username and password with friendly messages', async () => {
  const short = await app.req('POST', '/setup', { body: { username: 'a', password: 'supersecret123' } });
  assert.equal(short.status, 400);
  assert.match(short.json.error, /at least 2 characters/);
  const weak = await app.req('POST', '/setup', { body: { username: 'admin', password: 'short' } });
  assert.equal(weak.status, 400);
  assert.match(weak.json.error, /at least 8 characters/);
  const missing = await app.req('POST', '/setup', { body: {} });
  assert.equal(missing.status, 400);
  assert.ok(!/Invalid input|Expected|Required/.test(missing.json.error), 'raw zod text must not leak');
});

test('setup creates the admin, signs them in, and cannot be repeated', async () => {
  const ok = await app.req('POST', '/setup', { body: { username: 'admin', password: 'supersecret123' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.username, 'admin');
  const cookie = cookieOf(ok);
  assert.match(cookie, /msm\.sid=/);

  const again = await app.req('POST', '/setup', { body: { username: 'evil', password: 'supersecret123' } });
  assert.equal(again.status, 409);
  const html = await app.req('POST', '/setup', {
    body: { username: 'evil', password: 'supersecret123' },
    headers: { Accept: 'text/html' },
  });
  assert.equal(html.status, 302);
  assert.equal(html.headers.get('location'), '/login');

  const checks = await app.req('GET', '/setup/checks');
  assert.equal(checks.status, 403);
  const page = await app.req('GET', '/setup');
  assert.equal(page.status, 302);
  assert.equal(page.headers.get('location'), '/login');
});

test('login: bad password and unknown user both read the same 401', async () => {
  const bad = await app.req('POST', '/login', { body: { username: 'admin', password: 'wrongpassword' } });
  const ghost = await app.req('POST', '/login', { body: { username: 'nobody', password: 'wrongpassword' } });
  assert.equal(bad.status, 401);
  assert.equal(ghost.status, 401);
  assert.match(bad.text, /Wrong username or password/);
  assert.match(ghost.text, /Wrong username or password/);
});

test('login: empty fields are rejected with a friendly message', async () => {
  const r = await app.req('POST', '/login', { body: { username: '', password: '' } });
  assert.equal(r.status, 400);
  assert.match(r.text, /Enter your username/);
});

test('login: success redirects home and the session opens the panel', async () => {
  const r = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/');
  const cookie = cookieOf(r);
  const home = await app.req('GET', '/api/servers', { cookie, headers: jsonHeaders });
  assert.notEqual(home.status, 401);
  // An already signed-in visitor skips the login page.
  const again = await app.req('GET', '/login', { cookie });
  assert.equal(again.status, 302);
  assert.equal(again.headers.get('location'), '/');
});

test('login: `next` is honoured only for same-site paths (no open redirect)', async () => {
  const cases = [
    ['/servers/abc', '/servers/abc'],
    ['//evil.example', '/'],
    ['/\\evil.example', '/'],
    ['https://evil.example', '/'],
    ['/a b', '/'],
    ['javascript:alert(1)', '/'],
  ];
  for (const [next, expected] of cases) {
    const r = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123', next } });
    assert.equal(r.status, 302, next);
    assert.equal(r.headers.get('location'), expected, `next=${next}`);
  }
});

test('login: each success rotates the session id (anti-fixation)', async () => {
  const a = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  const b = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  assert.notEqual(cookieOf(a), cookieOf(b));
});

test('2FA step: no pending challenge means redirect back to /login', async () => {
  const get = await app.req('GET', '/login/2fa');
  assert.equal(get.status, 302);
  assert.equal(get.headers.get('location'), '/login');
  const post = await app.req('POST', '/login/2fa', { body: { code: '123456' } });
  assert.equal(post.status, 302);
  assert.equal(post.headers.get('location'), '/login');
});

test('logout: destroys the session and returns to /login', async () => {
  const login = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  const cookie = cookieOf(login);
  const out = await app.req('POST', '/logout', { cookie });
  assert.equal(out.status, 302);
  assert.equal(out.headers.get('location'), '/login');
  const after = await app.req('GET', '/api/servers', { cookie, headers: jsonHeaders });
  assert.equal(after.status, 401);
  // Logging out with no session at all is harmless.
  const anon = await app.req('POST', '/logout');
  assert.equal(anon.status, 302);
});
