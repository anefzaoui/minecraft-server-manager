'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { stripAnsi, cleanText } = require('../src/utils/ansi');

test('stripAnsi removes escape sequences and bare SGR fragments', () => {
  assert.equal(stripAnsi('\x1b[0mhello\x1b[31mworld\x1b[0m'), 'helloworld');
  assert.equal(stripAnsi('[0;39mNotch[0m'), 'Notch');
  assert.equal(stripAnsi('plain'), 'plain');
});

test('stripAnsi tolerates null/undefined', () => {
  assert.equal(stripAnsi(null), '');
  assert.equal(stripAnsi(undefined), '');
});

test('cleanText also strips Minecraft § formatting codes', () => {
  assert.equal(cleanText('§aGreen §lBold text'), 'Green Bold text');
  assert.equal(cleanText('\x1b[32m§bAqua'), 'Aqua');
});
