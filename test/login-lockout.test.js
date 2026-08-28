'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkLoginAllowed, recordLoginFailure, clearLoginFailures } = require('../src/web/middleware/auth');

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

test('a successful login (clearLoginFailures) frees both the per-IP and the global counter', () => {
  const u = `u_${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < 100; i++) recordLoginFailure(u, `10.1.${Math.floor(i / 256)}.${i % 256}`);
  rejects429(() => checkLoginAllowed(u, '10.9.9.9'));
  clearLoginFailures(u, '10.9.9.9');
  allows(() => checkLoginAllowed(u, '10.9.9.9'));
});
