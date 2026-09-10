'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { boolish } = require('../src/utils/boolish');

test('boolish accepts the boolean spellings a form or curl sends and rejects the rest', () => {
  for (const v of [true, 'true', 'TRUE', '1', 1, 'yes', 'on']) assert.equal(boolish.parse(v), true, String(v));
  for (const v of [false, 'false', 'False', '0', 0, 'no', 'off', '']) assert.equal(boolish.parse(v), false, String(v));
  for (const v of ['maybe', 2, null, {}, [], 'tru']) assert.throws(() => boolish.parse(v), String(v));
});
