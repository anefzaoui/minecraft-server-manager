'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePlayerList } = require('../src/utils/rconList');

test('parses the pre-26.2 phrasing ("of a max of")', () => {
  assert.deepEqual(parsePlayerList('There are 0 of a max of 20 players online:'), {
    online: 0,
    max: 20,
    names: [],
  });
  assert.deepEqual(parsePlayerList('There are 2 of a max of 20 players online: Steve, Alex'), {
    online: 2,
    max: 20,
    names: ['Steve', 'Alex'],
  });
});

test('parses the Paper 26.2 phrasing ("out of maximum")', () => {
  assert.deepEqual(parsePlayerList('There are 0 out of maximum 20 players online.'), {
    online: 0,
    max: 20,
    names: [],
  });
  assert.deepEqual(parsePlayerList('There are 2 out of maximum 20 players online. Steve, Alex'), {
    online: 2,
    max: 20,
    names: ['Steve', 'Alex'],
  });
});

test('filters out names that are not valid Minecraft usernames (e.g. stray ANSI/§ leftovers)', () => {
  const parsed = parsePlayerList('There are 2 of a max of 20 players online: Steve, [0m');
  assert.deepEqual(parsed.names, ['Steve']);
});

test('returns null for unrecognized output instead of guessing', () => {
  assert.equal(parsePlayerList('Unknown command'), null);
  assert.equal(parsePlayerList(''), null);
});
