'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const totp = require('../src/services/totp');

let adminCookie;

test.before(async () => {
  await app.start();
  adminCookie = await app.adminCookie();
});
test.after(async () => {
  await app.stop();
});

/**
 * Re-login as admin and return the fresh session cookie. Needed after any
 * step that disables/rotates 2FA via a DIFFERENT session than `adminCookie`
 * (e.g. the one just created by completing a /login/2fa flow): that now
 * correctly revokes every OTHER session for the same user (see
 * auth.js revokeOtherSessions), which includes the shared `adminCookie`
 * fixture set up once in test.before - without a fresh login here, every
 * later test in this file would find `adminCookie` already logged out.
 */
async function relogin(password = 'supersecret123') {
  const r = await app.req('POST', '/login', { body: { username: 'admin', password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

/** Enroll 2FA on the given (already-authenticated) account and return its secret + backup codes. */
async function enroll(cookie, password = 'supersecret123') {
  const setup = await app.req('POST', '/api/account/totp/setup', { cookie, body: {} });
  assert.equal(setup.status, 200);
  const code = totp.codeAt(setup.json.secret);
  const confirm = await app.req('POST', '/api/account/totp/confirm', {
    cookie,
    body: { secret: setup.json.secret, code, password },
  });
  assert.equal(confirm.status, 200);
  return { secret: setup.json.secret, backupCodes: confirm.json.backupCodes };
}

test('self-service setup/confirm rejects a wrong code and never persists the secret', async () => {
  const setup = await app.req('POST', '/api/account/totp/setup', { cookie: adminCookie, body: {} });
  assert.equal(setup.status, 200);
  assert.match(setup.json.otpauthUrl, /^otpauth:\/\/totp\//);
  assert.ok(setup.json.qrDataUrl.startsWith('data:image/'));

  const bad = await app.req('POST', '/api/account/totp/confirm', {
    cookie: adminCookie,
    body: { secret: setup.json.secret, code: '000000', password: 'supersecret123' },
  });
  assert.equal(bad.status, 400);

  // Never confirmed - logging in still needs only a password, no /login/2fa hop.
  const login = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  assert.equal(login.status, 302);
});

test('enabling 2FA requires the account password (blocks a session-only enroll takeover)', async () => {
  const setup = await app.req('POST', '/api/account/totp/setup', { cookie: adminCookie, body: {} });
  assert.equal(setup.status, 200);
  const code = totp.codeAt(setup.json.secret);
  // Valid secret + valid code but WRONG password must not enable 2FA.
  const wrong = await app.req('POST', '/api/account/totp/confirm', {
    cookie: adminCookie,
    body: { secret: setup.json.secret, code, password: 'not-the-password' },
  });
  assert.equal(wrong.status, 401);
  // And the account is still 2FA-less: a password login fully authenticates
  // (a protected route returns 200), rather than parking on a pending 2FA step.
  const login = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  assert.equal(login.status, 302);
  const cookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  const authed = await app.req('GET', '/api/servers/live', { cookie });
  assert.equal(authed.status, 200);
});

test('enrolling forks the login flow onto /login/2fa, and a correct code completes it', async () => {
  const { secret } = await enroll(adminCookie);

  const login = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  assert.equal(login.status, 302);
  const pendingCookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  assert.ok(pendingCookie, 'expected a session cookie to carry the pending 2FA state');

  // The half-authenticated session must not pass requireAuth yet.
  const blocked = await app.req('GET', '/api/servers/live', { cookie: pendingCookie });
  assert.equal(blocked.status, 401);

  const wrongCode = await app.req('POST', '/login/2fa', { cookie: pendingCookie, body: { code: '000000' } });
  assert.equal(wrongCode.status, 401);

  const code = totp.codeAt(secret);
  const ok = await app.req('POST', '/login/2fa', { cookie: pendingCookie, body: { code } });
  assert.equal(ok.status, 302);
  const fullCookie = (ok.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  const authed = await app.req('GET', '/api/servers/live', { cookie: fullCookie });
  assert.equal(authed.status, 200);

  // Clean up - disable so later tests in this file start from a known state.
  await app.req('POST', '/api/account/totp/disable', { cookie: fullCookie, body: { password: 'supersecret123' } });
  // That disable just revoked every other admin session, including the
  // shared `adminCookie` fixture - refresh it for later tests.
  adminCookie = await relogin();
});

test('a backup code completes login and is single-use', async () => {
  const { backupCodes } = await enroll(adminCookie);
  const code = backupCodes[0];

  const login = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  const pendingCookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  const first = await app.req('POST', '/login/2fa', { cookie: pendingCookie, body: { code } });
  assert.equal(first.status, 302);
  const fullCookie = (first.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  // Reused backup code must fail on a second login attempt.
  const login2 = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  const pendingCookie2 = (login2.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  const replay = await app.req('POST', '/login/2fa', { cookie: pendingCookie2, body: { code } });
  assert.equal(replay.status, 401);

  await app.req('POST', '/api/account/totp/disable', { cookie: fullCookie, body: { password: 'supersecret123' } });
  // Same as above: that disable revoked the shared adminCookie session too.
  adminCookie = await relogin();
});

test('confirm refuses to silently replace an already-enabled secret', async () => {
  const { secret: originalSecret } = await enroll(adminCookie);

  // Even a valid setup+code for a NEW secret must not overwrite the live one
  // without disabling first - this is the path a hijacked session (no
  // password) could otherwise use to take over 2FA undetected.
  const setup = await app.req('POST', '/api/account/totp/setup', { cookie: adminCookie, body: {} });
  const code = totp.codeAt(setup.json.secret);
  const confirm = await app.req('POST', '/api/account/totp/confirm', {
    cookie: adminCookie,
    body: { secret: setup.json.secret, code, password: 'supersecret123' },
  });
  assert.equal(confirm.status, 409);

  // The original secret must still be the one that logs in.
  const login = await app.req('POST', '/login', { body: { username: 'admin', password: 'supersecret123' } });
  const pendingCookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  const ok = await app.req('POST', '/login/2fa', {
    cookie: pendingCookie,
    body: { code: totp.codeAt(originalSecret) },
  });
  assert.equal(ok.status, 302);
  const fullCookie = (ok.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  await app.req('POST', '/api/account/totp/disable', { cookie: fullCookie, body: { password: 'supersecret123' } });
  // Same as above: that disable revoked the shared adminCookie session too.
  adminCookie = await relogin();
});

test('disable requires the current password', async () => {
  await enroll(adminCookie);
  const wrongPassword = await app.req('POST', '/api/account/totp/disable', {
    cookie: adminCookie,
    body: { password: 'not-the-password' },
  });
  assert.equal(wrongPassword.status, 401);

  const ok = await app.req('POST', '/api/account/totp/disable', {
    cookie: adminCookie,
    body: { password: 'supersecret123' },
  });
  assert.equal(ok.status, 200);
});

test('a viewer (read-only role) can still manage their own 2FA', async () => {
  const create = await app.req('POST', '/api/users', {
    cookie: adminCookie,
    body: { username: 'viewer2fa', password: 'viewerpass123', role: 'viewer' },
  });
  assert.equal(create.status, 201);
  const login = await app.req('POST', '/login', { body: { username: 'viewer2fa', password: 'viewerpass123' } });
  const viewerCookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  const setup = await app.req('POST', '/api/account/totp/setup', { cookie: viewerCookie, body: {} });
  assert.equal(setup.status, 200);
  const code = totp.codeAt(setup.json.secret);
  const confirm = await app.req('POST', '/api/account/totp/confirm', {
    cookie: viewerCookie,
    body: { secret: setup.json.secret, code, password: 'viewerpass123' },
  });
  assert.equal(confirm.status, 200);
});

test("an admin can force-reset another user's 2FA without their password", async () => {
  const create = await app.req('POST', '/api/users', {
    cookie: adminCookie,
    body: { username: 'resetme', password: 'resetmepass123', role: 'operator' },
  });
  const userId = create.json.user.id;
  const login = await app.req('POST', '/login', { body: { username: 'resetme', password: 'resetmepass123' } });
  const userCookie = (login.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  await enroll(userCookie, 'resetmepass123');

  // Non-admin cannot reset their own (or anyone's) 2FA through the admin route.
  const denied = await app.req('POST', `/api/users/${userId}/totp/disable`, { cookie: userCookie, body: {} });
  assert.equal(denied.status, 403);

  const reset = await app.req('POST', `/api/users/${userId}/totp/disable`, { cookie: adminCookie, body: {} });
  assert.equal(reset.status, 200);

  // 2FA is off again - a plain password login now succeeds without a /login/2fa hop.
  const relogin = await app.req('POST', '/login', { body: { username: 'resetme', password: 'resetmepass123' } });
  assert.equal(relogin.status, 302);
  const cookie2 = (relogin.setCookie || []).map((c) => c.split(';')[0]).join('; ');
  const authed = await app.req('GET', '/api/servers/live', { cookie: cookie2 });
  assert.equal(authed.status, 200);
});

test('an admin cannot use the force-reset route on their own account (no password-free self-disable)', async () => {
  const users = await app.req('GET', '/api/users', { cookie: adminCookie });
  const adminId = users.json.users.find((u) => u.username === 'admin').id;
  await enroll(adminCookie);

  const selfReset = await app.req('POST', `/api/users/${adminId}/totp/disable`, { cookie: adminCookie, body: {} });
  assert.equal(selfReset.status, 400);

  // Still enabled - must go through the password-gated self-service path instead.
  const stillOn = await app.req('POST', '/api/account/totp/disable', {
    cookie: adminCookie,
    body: { password: 'wrong' },
  });
  assert.equal(stillOn.status, 401);
  await app.req('POST', '/api/account/totp/disable', { cookie: adminCookie, body: { password: 'supersecret123' } });
});

test('repeated wrong passwords against the self-service disable route get locked out', async () => {
  await enroll(adminCookie);
  let last;
  for (let i = 0; i < 9; i++) {
    last = await app.req('POST', '/api/account/totp/disable', { cookie: adminCookie, body: { password: 'wrong' } });
  }
  assert.equal(last.status, 429);
  // Even the CORRECT password is refused while locked out.
  const correctButLocked = await app.req('POST', '/api/account/totp/disable', {
    cookie: adminCookie,
    body: { password: 'supersecret123' },
  });
  assert.equal(correctButLocked.status, 429);
});
