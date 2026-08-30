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

test('once an admin exists the gate is inert (setup is closed anyway)', () => {
  db.run("INSERT INTO users (id, username, password_hash, role) VALUES ('usr_seed', 'seed', 'x', 'admin')");
  assert.equal(setupGate.required(), false);
  assert.equal(setupGate.check('anything'), true);
});
