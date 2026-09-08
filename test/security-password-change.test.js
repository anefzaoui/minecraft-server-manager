'use strict';

// Regression tests for the admin password-change gate:
//   - changing ANY user's password re-verifies the acting admin's own password
//     (shared login lockout) - a hijacked-but-live session cannot set passwords
//   - changing your OWN password also revokes the acting session so the
//     attacker's preserved session cannot survive adopting the new password

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const authService = require('../src/services/auth');

let adminCookie;
let adminId;

test.before(async () => {
  await app.start();
  adminCookie = await app.adminCookie();
  adminId = authService.listUsers().find((u) => u.username === 'admin').id;
});
test.after(async () => {
  await app.stop();
});

async function login(username, password) {
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test('changing any password without the current password is rejected', async () => {
  const r = await app.req('POST', `/api/users/${adminId}/password`, {
    cookie: adminCookie,
    body: { password: 'brandnewpass123' },
  });
  assert.equal(r.status, 400);
});

test('a wrong current password cannot reset another user (401, takes no effect)', async () => {
  const target = await authService.createUser(
    { username: 'pwtarget', password: 'oldpass123', role: 'operator' },
    { actor: 'test' }
  );

  const r = await app.req('POST', `/api/users/${target.id}/password`, {
    cookie: adminCookie,
    body: { password: 'hijacked123', currentPassword: 'wrong-current' },
  });
  assert.equal(r.status, 401);

  // The target's old password still authenticates - nothing was tampered with.
  const relogin = await app.req('POST', '/login', { body: { username: 'pwtarget', password: 'oldpass123' } });
  assert.equal(relogin.status, 302);
});

test('a wrong current password cannot change your own password (401)', async () => {
  const r = await app.req('POST', `/api/users/${adminId}/password`, {
    cookie: adminCookie,
    body: { password: 'newadminpass123', currentPassword: 'wrong-current' },
  });
  assert.equal(r.status, 401);
});

test('a correct password change for another user works and keeps the acting session', async () => {
  const target = authService.listUsers().find((u) => u.username === 'pwtarget');
  const r = await app.req('POST', `/api/users/${target.id}/password`, {
    cookie: adminCookie,
    body: { password: 'pwnewpass123', currentPassword: 'supersecret123' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.signedOutAll, false);

  // New password authenticates the target.
  const newLogin = await app.req('POST', '/login', { body: { username: 'pwtarget', password: 'pwnewpass123' } });
  assert.equal(newLogin.status, 302);
  // The admin session that made the change is still valid.
  const stillAdmin = await app.req('GET', '/api/users', { cookie: adminCookie });
  assert.equal(stillAdmin.status, 200);
});

test('a SELF password change revokes the acting session too (exceptSid=null)', async () => {
  const r = await app.req('POST', `/api/users/${adminId}/password`, {
    cookie: adminCookie,
    body: { password: 'brandnewadmin123', currentPassword: 'supersecret123' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.signedOutAll, true);

  // The session that performed the change is now dead - re-auth required.
  const oldSid = await app.req('GET', '/api/users', { cookie: adminCookie });
  assert.equal(oldSid.status, 401);

  // The new password gets a fresh, working session.
  adminCookie = await login('admin', 'brandnewadmin123');
  const ok = await app.req('GET', '/api/users', { cookie: adminCookie });
  assert.equal(ok.status, 200);
});
