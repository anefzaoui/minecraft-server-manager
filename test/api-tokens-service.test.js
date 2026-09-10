'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');

migrate();

const db = require('../src/db');
const apiTokens = require('../src/services/apiTokens');

test('createToken returns an msm_-prefixed plaintext exactly once and stores only a hash', () => {
  const created = apiTokens.createToken({ label: 'unit-all', scopeAll: true }, { actor: 'tester' });
  assert.match(created.token, /^msm_[A-Za-z0-9_-]+$/);
  assert.equal(created.tokenPrefix, created.token.slice(0, 12));
  assert.equal(created.scope.all, true);
  assert.deepEqual(created.scope.serverIds, []);
  assert.deepEqual(created.permissions, ['read']);
  assert.equal(created.status, 'active');

  const row = db.get('SELECT * FROM api_tokens WHERE id = ?', created.id);
  assert.match(row.token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(row.token_hash, created.token);
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'token'), false);
});

test('verifyToken accepts the exact secret and rejects anything else', () => {
  const created = apiTokens.createToken({ label: 'unit-verify', scopeAll: true }, { actor: 'tester' });
  const ok = apiTokens.verifyToken(created.token);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.scope, { all: true, serverIds: [] });
  assert.deepEqual(ok.permissions, ['read']);

  assert.equal(apiTokens.verifyToken('msm_bogus'), null);
  assert.equal(apiTokens.verifyToken(''), null);
  assert.equal(apiTokens.verifyToken(null), null);
  assert.equal(apiTokens.verifyToken(123), null);
});

test('revokeToken makes verifyToken report revoked; a second revoke is a 404', () => {
  const created = apiTokens.createToken({ label: 'unit-revoke', scopeAll: true }, { actor: 'tester' });
  apiTokens.revokeToken(created.id, { actor: 'tester' });
  assert.deepEqual(apiTokens.verifyToken(created.token), { ok: false, reason: 'revoked' });
  assert.throws(
    () => apiTokens.revokeToken(created.id, { actor: 'tester' }),
    (err) => err.status === 404
  );
});

test('an expired token verifies as expired', () => {
  const created = apiTokens.createToken({ label: 'unit-expiry', scopeAll: true }, { actor: 'tester' });
  db.run("UPDATE api_tokens SET expires_at = '2000-01-01 00:00:00' WHERE id = ?", created.id);
  assert.deepEqual(apiTokens.verifyToken(created.token), { ok: false, reason: 'expired' });
});

test('an expiry stored in the ISO-8601 form the UI sends actually expires', () => {
  // The Settings page sends `new Date(x).toISOString()` ("2026-09-06T10:00:00.000Z").
  // The compare must not treat `'T' > ' '` at position 10 as "not yet expired".
  const created = apiTokens.createToken(
    { label: 'unit-expiry-iso', scopeAll: true, expiresAt: '2000-01-01T00:00:00.000Z' },
    { actor: 'tester' }
  );
  assert.deepEqual(apiTokens.verifyToken(created.token), { ok: false, reason: 'expired' });
  const listed = apiTokens.listTokens().find((t) => t.id === created.id);
  assert.equal(listed.status, 'expired');
});

test('scope round-trips and scopeAllowsServer honours the subset', () => {
  const created = apiTokens.createToken(
    { label: 'unit-scope', scopeAll: false, serverIds: ['srv_aaa', 'srv_bbb'] },
    { actor: 'tester' }
  );
  const v = apiTokens.verifyToken(created.token);
  assert.deepEqual(v.scope, { all: false, serverIds: ['srv_aaa', 'srv_bbb'] });
  assert.equal(apiTokens.scopeAllowsServer(v.scope, 'srv_aaa'), true);
  assert.equal(apiTokens.scopeAllowsServer(v.scope, 'srv_zzz'), false);
  assert.equal(apiTokens.scopeAllowsServer({ all: true, serverIds: [] }, 'srv_zzz'), true);
  assert.equal(apiTokens.scopeAllowsServer(null, 'srv_aaa'), false);
});

test('touchLastUsed writes once, then throttles on the returned timestamp', () => {
  const created = apiTokens.createToken({ label: 'unit-touch', scopeAll: true }, { actor: 'tester' });
  assert.equal(db.get('SELECT last_used_at FROM api_tokens WHERE id = ?', created.id).last_used_at, null);

  apiTokens.touchLastUsed(created.id, null);
  const first = db.get('SELECT last_used_at FROM api_tokens WHERE id = ?', created.id).last_used_at;
  assert.ok(first);

  // Second call inside the throttle window is a no-op (no throw, no change).
  apiTokens.touchLastUsed(created.id, first);
  const second = db.get('SELECT last_used_at FROM api_tokens WHERE id = ?', created.id).last_used_at;
  assert.equal(second, first);
});

test('listTokens never exposes the hash or a plaintext token', () => {
  apiTokens.createToken({ label: 'unit-list', scopeAll: true }, { actor: 'tester' });
  const rows = apiTokens.listTokens();
  assert.ok(rows.length >= 1);
  for (const row of rows) {
    assert.ok(row.tokenPrefix);
    assert.ok(['active', 'revoked', 'expired'].includes(row.status));
    assert.equal('token' in row, false);
    assert.equal('token_hash' in row, false);
    assert.equal('tokenHash' in row, false);
  }
});
