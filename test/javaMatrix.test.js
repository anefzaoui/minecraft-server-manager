'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pickJavaTag, parseVersion } = require('../src/services/javaMatrix');

test('parseVersion parses releases and rejects snapshots', () => {
  assert.deepEqual(parseVersion('1.20.4'), { major: 1, minor: 20, patch: 4 });
  assert.deepEqual(parseVersion('1.21'), { major: 1, minor: 21, patch: 0 });
  assert.equal(parseVersion('26w02a'), null);
  assert.equal(parseVersion('garbage'), null);
});

test('pickJavaTag maps MC versions to the right image tag', () => {
  assert.equal(pickJavaTag('LATEST'), 'latest');
  assert.equal(pickJavaTag('SNAPSHOT'), 'latest');
  assert.equal(pickJavaTag('26w02a'), 'latest');
  assert.equal(pickJavaTag('1.8.9'), 'java8');
  assert.equal(pickJavaTag('1.12.2', 'FORGE'), 'java8');
  assert.equal(pickJavaTag('1.16.5', 'PAPER'), 'java16');
  assert.equal(pickJavaTag('1.16.5', 'VANILLA'), 'java8');
  assert.equal(pickJavaTag('1.17.1'), 'java16');
  assert.equal(pickJavaTag('1.18.2'), 'java17');
  assert.equal(pickJavaTag('1.19.4'), 'java17');
  assert.equal(pickJavaTag('1.20.1'), 'java17');
  assert.equal(pickJavaTag('1.20.6'), 'java21');
  assert.equal(pickJavaTag('1.21.4'), 'java21');
});

test('pickJavaTag treats the 25.x/26.x era as latest', () => {
  assert.equal(pickJavaTag('26.2'), 'latest');
});
