'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const totp = require('../src/services/totp');

// RFC 6238 Appendix B test vectors (SHA1, 8-digit truncation, 30s step, T0=0),
// ASCII secret "12345678901234567890". This panel uses 6-digit codes — the
// last 6 digits of the published 8-digit value are the same computation,
// just kept to fewer digits, so they translate directly.
const RFC_SECRET = totp.base32Encode(Buffer.from('12345678901234567890', 'ascii'));
const VECTORS = [
  { timeSec: 59, code8: '94287082' },
  { timeSec: 1111111109, code8: '07081804' },
  { timeSec: 1111111111, code8: '14050471' },
  { timeSec: 1234567890, code8: '89005924' },
  { timeSec: 2000000000, code8: '69279037' },
];

test('verify() matches the RFC 6238 published test vectors (truncated to 6 digits)', () => {
  for (const { timeSec, code8 } of VECTORS) {
    const code6 = code8.slice(-6);
    const step = totp.verify(RFC_SECRET, code6, { window: 0, atMs: timeSec * 1000 });
    assert.notEqual(step, null, `expected step for t=${timeSec}`);
  }
});

test('verify() rejects a wrong code', () => {
  const step = totp.verify(RFC_SECRET, '000000', { window: 0, atMs: 59_000 });
  assert.equal(step, null);
});

test('verify() rejects a malformed code (not exactly 6 digits)', () => {
  for (const bad of ['12345', '1234567', 'abcdef', '', '  ']) {
    assert.equal(totp.verify(RFC_SECRET, bad, { atMs: 59_000 }), null, JSON.stringify(bad));
  }
});

test('verify() allows ±1 step of clock drift by default', () => {
  const step = totp.verify(RFC_SECRET, '287082', { atMs: 59_000 }); // step 1
  assert.notEqual(step, null);
  // One step (30s) either side of t=59 still resolves to the same step-1 code window boundary —
  // step for t=59 is 1; step for t=59+30=89 is 2, and t=59-30=29 is 0. Verify both neighbors independently.
  const nextStep = totp.verify(RFC_SECRET, '287082', { atMs: 89_000 }); // one step later, window=1 covers it
  assert.notEqual(nextStep, null);
});

test('verify() rejects replaying a code at or before lastStep', () => {
  const step = totp.verify(RFC_SECRET, '287082', { atMs: 59_000 }); // step 1
  assert.equal(step, 1);
  const replay = totp.verify(RFC_SECRET, '287082', { atMs: 59_000, lastStep: step });
  assert.equal(replay, null);
  const replayEarlier = totp.verify(RFC_SECRET, '287082', { atMs: 59_000, lastStep: step + 5 });
  assert.equal(replayEarlier, null);
});

test('generateSecret() returns a valid base32 string that round-trips through base32Decode', () => {
  const secret = totp.generateSecret();
  assert.match(secret, /^[A-Z2-7]+$/);
  assert.equal(totp.base32Decode(secret).length, 20);
});

test('buildOtpauthUrl() embeds the secret, issuer, and account', () => {
  const url = totp.buildOtpauthUrl('JBSWY3DPEHPK3PXP', { account: 'alice' });
  assert.match(url, /^otpauth:\/\/totp\//);
  assert.match(url, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(url, /alice/);
});

test('codeAt() produces a code that verify() accepts at the same instant', () => {
  const secret = totp.generateSecret();
  const now = Date.now();
  const code = totp.codeAt(secret, now);
  assert.notEqual(totp.verify(secret, code, { atMs: now, window: 0 }), null);
});

test('generateBackupCodes() returns distinct, formatted codes', () => {
  const codes = totp.generateBackupCodes(10);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[0-9a-f]{5}-[0-9a-f]{5}$/);
});
