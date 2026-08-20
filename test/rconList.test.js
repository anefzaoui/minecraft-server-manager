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

test('keeps a Bedrock name\'s leading "." when it lands right after the colon with no space', () => {
  assert.deepEqual(parsePlayerList('There are 1 of a max of 20 players online:.Steve').names, ['.Steve']);
  assert.deepEqual(parsePlayerList('There are 1 out of maximum 20 players online:.Steve').names, ['.Steve']);
});

test('keeps a Bedrock name glued to the 26.2 sentence period ("online..Steve")', () => {
  assert.deepEqual(parsePlayerList('There are 1 out of maximum 20 players online..Steve').names, ['.Steve']);
  // The sentence period before a space is still consumed as punctuation.
  assert.deepEqual(parsePlayerList('There are 1 out of maximum 20 players online. .Steve').names, ['.Steve']);
});

test('parses the 1.7.10-era Forge phrasing ("N/M") that every GTNH server speaks', () => {
  // Verified against a live GTNH 2.7.4 server: `rcon-cli list` answers
  // "There are 0/20 players online:".
  assert.deepEqual(parsePlayerList('There are 0/20 players online:'), {
    online: 0,
    max: 20,
    names: [],
  });
  assert.deepEqual(parsePlayerList('There are 2/20 players online: Steve, Alex'), {
    online: 2,
    max: 20,
    names: ['Steve', 'Alex'],
  });
});
