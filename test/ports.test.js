'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isPortFree } = require('../src/services/ports');

// These inputs short-circuit before any DB/socket work — this is the exact
// validation whose absence once let invalid ports skip RCON collision checks.
test('isPortFree rejects non-integer inputs', async () => {
  for (const bad of [undefined, null, NaN, 1.5, '25565', '25565xyz', {}, []]) {
    assert.equal(await isPortFree(bad), false, `${String(bad)} must not be free`);
  }
});

test('isPortFree rejects out-of-range ports', async () => {
  for (const bad of [0, 80, 1023, 65536, 70000, -1]) {
    assert.equal(await isPortFree(bad), false, `${bad} must not be free`);
  }
});
