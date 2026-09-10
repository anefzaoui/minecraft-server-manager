'use strict';

// On an exposed (non-loopback) bind, first-run /setup is gated behind a PIN
// printed only to the server console, so a network peer can't race the operator
// to claim the admin account.

require('./helpers/env');
process.env.PANEL_HOST = '0.0.0.0'; // must be set before ../src/config is first required

const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();

const db = require('../src/db');
const setupGate = require('../src/services/setupGate');

test('a PIN is required while no user exists on an exposed bind', () => {
  assert.equal(setupGate.required(), true);
  const pin = setupGate.ensurePin();
  assert.match(pin, /^\d{6}$/);
  assert.equal(setupGate.ensurePin(), pin, 'PIN is stable for the process');
});

test('check() accepts the right PIN and rejects everything else', () => {
  const pin = setupGate.ensurePin();
  assert.equal(setupGate.check(pin), true);
  assert.equal(setupGate.check('000000'), false);
  assert.equal(setupGate.check(''), false);
  assert.equal(setupGate.check(undefined), false);
  assert.equal(setupGate.check(pin + '0'), false); // length mismatch, no throw
});

test('after enough wrong PINs the gate locks out even correct PINs', () => {
  const pin = setupGate.ensurePin();
  // The first wrong attempt was already counted above; add enough more.
  for (let i = 0; i < 10; i++) setupGate.check('123456');
  assert.equal(setupGate.isLocked(), true);
  // Correct PIN is rejected while locked.
  assert.equal(setupGate.check(pin), false);
});

test('once an admin exists the gate is inert (setup is closed anyway)', () => {
  db.run("INSERT INTO users (id, username, password_hash, role) VALUES ('usr_seed', 'seed', 'x', 'admin')");
  assert.equal(setupGate.required(), false);
  assert.equal(setupGate.check('anything'), true);
});

test('one address is locked out on its own after a handful of wrong PINs; other addresses still get through', (t) => {
  db.run("DELETE FROM users WHERE id = 'usr_seed'");
  setupGate.resetForTests();
  const pin = setupGate.ensurePin();
  for (let i = 0; i < 5; i++) setupGate.check('000001', '203.0.113.9');
  assert.equal(setupGate.isLocked('203.0.113.9'), true, 'the noisy address is locked');
  assert.equal(setupGate.check(pin, '203.0.113.9'), false, 'even the right PIN is refused from that address');
  assert.equal(setupGate.isLocked('198.51.100.4'), false, 'a different address is untouched');
  assert.equal(setupGate.isLocked(), false, 'no global lock yet (5 < 10)');
  assert.equal(setupGate.check(pin, '198.51.100.4'), true, 'the operator on another address still claims setup');
  t.diagnostic('per-ip lockout independent of the global counter');
});

test('a global lockout expires into a fresh counter, so an attacker needs another full round to re-lock', (t) => {
  setupGate.resetForTests();
  t.mock.timers.enable({ apis: ['Date'], now: 1_700_000_000_000 });
  const pin = setupGate.ensurePin();
  for (let i = 0; i < 10; i++) setupGate.check('000001', `10.0.0.${i}`); // ten addresses, one wrong PIN each
  assert.equal(setupGate.isLocked(), true, 'ten wrong PINs from anywhere lock the gate for everyone');
  t.mock.timers.tick(16_000); // first lockout is 15 s
  assert.equal(setupGate.isLocked(), false, 'the window expired');
  // One more wrong PIN must NOT re-lock: the counter restarted at zero.
  setupGate.check('000001', '10.0.0.99');
  assert.equal(setupGate.isLocked(), false, 'a single failure after expiry does not re-lock the gate');
  assert.equal(setupGate.check(pin, '10.0.0.100'), true, 'the operator gets in');
  t.mock.timers.reset();
});
