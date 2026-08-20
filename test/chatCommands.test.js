'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { DANGEROUS_RE } = require('../src/services/chatCommands');

test('DANGEROUS_RE flags dangerous commands at the start of the string', () => {
  for (const cmd of ['stop', '/stop', 'op Notch', 'deop Notch', 'ban Notch', 'whitelist add Notch']) {
    assert.equal(DANGEROUS_RE.test(cmd), true, `${cmd} should be flagged`);
  }
});

test('DANGEROUS_RE flags a dangerous command nested behind execute ... run', () => {
  for (const cmd of [
    'execute as @a at @s run stop',
    'execute as @a run op Notch',
    'execute as @a at @s run execute as @s run stop',
  ]) {
    assert.equal(DANGEROUS_RE.test(cmd), true, `${cmd} should be flagged`);
  }
});

test('DANGEROUS_RE does not flag ordinary commands', () => {
  for (const cmd of ['say hello', 'give @a diamond 1', "say don't stop believing", 'tell Notch stop by']) {
    assert.equal(DANGEROUS_RE.test(cmd), false, `${cmd} should not be flagged`);
  }
});
