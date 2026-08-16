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

test('pickJavaTag picks the newest Java a GTNH pack version allows', () => {
  assert.equal(pickJavaTag('1.7.10', 'GTNH', { maxJavaVersion: 25 }), 'java25');
  assert.equal(pickJavaTag('1.7.10', 'GTNH', { maxJavaVersion: 21 }), 'java21');
  // No java24/java20 image is published — ladder down to the next tag that exists.
  assert.equal(pickJavaTag('1.7.10', 'GTNH', { maxJavaVersion: 24 }), 'java21');
  assert.equal(pickJavaTag('1.7.10', 'GTNH', { maxJavaVersion: 20 }), 'java17');
  // Ancient caps fall back to the legacy pack.
  assert.equal(pickJavaTag('1.7.10', 'GTNH', { maxJavaVersion: 8 }), 'java8');
});

test('pickJavaTag defaults GTNH to java17 when the cap is unknown', () => {
  // No pin yet, or the index was unreachable. Every indexed GTNH version
  // supports at least Java 17, so this always boots.
  assert.equal(pickJavaTag('1.7.10', 'GTNH'), 'java17');
  assert.equal(pickJavaTag('1.7.10', 'GTNH', { maxJavaVersion: null }), 'java17');
});

test('pickJavaTag ignores maxJavaVersion for non-GTNH types', () => {
  assert.equal(pickJavaTag('1.7.10', 'FORGE', { maxJavaVersion: 25 }), 'java8');
  assert.equal(pickJavaTag('1.21.4', 'PAPER', { maxJavaVersion: 17 }), 'java21');
});
