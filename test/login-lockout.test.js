'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
  listActiveLockouts,
  clearLockouts,
} = require('../src/web/middleware/auth');

const rejects429 = (fn) => assert.throws(fn, (e) => e.status === 429);
const allows = (fn) => assert.doesNotThrow(fn);

test('per-IP lockout: 8 failures from one IP locks that (user, IP) pair', () => {
  const u = `u_${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < 8; i++) recordLoginFailure(u, '10.0.0.1');
  rejects429(() => checkLoginAllowed(u, '10.0.0.1'));
  // a different IP for the same user still has its own budget
  allows(() => checkLoginAllowed(u, '10.0.0.2'));
  clearLoginFailures(u, '10.0.0.1');
  clearLoginFailures(u, '10.0.0.2');
});

test('account-global lockout: many failures spread across IPs still trips on the username alone', () => {
  const u = `u_${Math.random().toString(36).slice(2)}`;
  // 100 failures, each from a unique IP so no per-IP bucket ever reaches 8.
  for (let i = 0; i < 100; i++) recordLoginFailure(u, `192.168.${Math.floor(i / 256)}.${i % 256}`);
  // A brand-new IP that has never failed is still refused because the account
  // global counter is over its threshold.
  rejects429(() => checkLoginAllowed(u, '203.0.113.9'));
  clearLoginFailures(u, '203.0.113.9');
  // clearLoginFailures wipes the global counter too, so the account is usable again.
  allows(() => checkLoginAllowed(u, '203.0.113.9'));
});

test('the account-global counter decays: a slow sprayer cannot hold an account locked forever', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const u = `u_${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < 100; i++) recordLoginFailure(u, `172.16.${Math.floor(i / 256)}.${i % 256}`);
  rejects429(() => checkLoginAllowed(u, '198.51.100.1'));

  // Past the 5-min global cooldown with no fresh failures in between.
  t.mock.timers.tick(6 * 60 * 1000);
  // A single lone failure after the cooldown must NOT instantly re-lock the
  // account (old behaviour: count was still 100, so bump -> 101 -> re-locked).
  recordLoginFailure(u, '198.51.100.2');
  allows(() => checkLoginAllowed(u, '198.51.100.3'));
  clearLoginFailures(u, '198.51.100.1');
});

test('a successful login (clearLoginFailures) frees both the per-IP and the global counter', () => {
  const u = `u_${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < 100; i++) recordLoginFailure(u, `10.1.${Math.floor(i / 256)}.${i % 256}`);
  rejects429(() => checkLoginAllowed(u, '10.9.9.9'));
  clearLoginFailures(u, '10.9.9.9');
  allows(() => checkLoginAllowed(u, '10.9.9.9'));
});

test('recordLoginFailure reports the failure that trips a lock (for the audit event)', () => {
  const u = `u_${Math.random().toString(36).slice(2)}`;
  let last;
  for (let i = 0; i < 8; i++) last = recordLoginFailure(u, '10.5.5.5');
  assert.equal(last.lockedNow, true);
  assert.equal(last.scope, 'ip');
  // A 9th failure while already locked is not a fresh trip.
  assert.equal(recordLoginFailure(u, '10.5.5.5').lockedNow, false);
  clearLockouts({ username: u });
});

test('listActiveLockouts surfaces active locks; clearLockouts unlocks them', () => {
  const u = `u_${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < 8; i++) recordLoginFailure(u, '10.7.7.7');
  const locks = listActiveLockouts().filter((l) => l.username === u);
  assert.equal(locks.length, 1);
  assert.equal(locks[0].scope, 'ip');
  assert.equal(locks[0].ip, '10.7.7.7');
  assert.ok(locks[0].minutesLeft > 0 && locks[0].minutesLeft <= 10);

  const removed = clearLockouts({ username: u });
  assert.ok(removed >= 1);
  assert.equal(listActiveLockouts().filter((l) => l.username === u).length, 0);
  allows(() => checkLoginAllowed(u, '10.7.7.7'));
});

test('clearLockouts({ all: true }) wipes every counter', () => {
  const u = `u_${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < 8; i++) recordLoginFailure(u, '10.8.8.8');
  assert.ok(listActiveLockouts().length >= 1);
  clearLockouts({ all: true });
  assert.equal(listActiveLockouts().length, 0);
});
