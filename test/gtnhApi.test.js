'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const raw = require('./fixtures/gtnh-versions.json');
const gtnh = require('../src/services/gtnhApi');

test('normalizeIndex preserves the index order (newest first)', () => {
  const entries = gtnh.normalizeIndex(raw);
  assert.deepEqual(
    entries.map((e) => e.version),
    ['2.9.0-beta-2', '2.8.4', '2.7.4', '2.4.0', '9.9.9-synthetic-nojava', '9.9.8-synthetic-badlink']
  );
});

test('normalizeIndex maps title to a channel', () => {
  const byVersion = Object.fromEntries(gtnh.normalizeIndex(raw).map((e) => [e.version, e]));
  assert.equal(byVersion['2.9.0-beta-2'].channel, 'beta');
  assert.equal(byVersion['2.8.4'].channel, 'stable');
});

test('normalizeIndex carries maxJavaVersion, null when absent', () => {
  const byVersion = Object.fromEntries(gtnh.normalizeIndex(raw).map((e) => [e.version, e]));
  assert.equal(byVersion['2.8.4'].maxJavaVersion, 25);
  assert.equal(byVersion['2.7.4'].maxJavaVersion, 21);
  assert.equal(byVersion['9.9.9-synthetic-nojava'].maxJavaVersion, null);
});

test('normalizeIndex accepts only https github changelog links', () => {
  const byVersion = Object.fromEntries(gtnh.normalizeIndex(raw).map((e) => [e.version, e]));
  assert.match(byVersion['2.8.4'].changelogUrl, /^https:\/\/github\.com\//);
  assert.equal(byVersion['9.9.8-synthetic-badlink'].changelogUrl, null);
});

test('normalizeIndex prefers the modern server pack url', () => {
  const byVersion = Object.fromEntries(gtnh.normalizeIndex(raw).map((e) => [e.version, e]));
  assert.match(byVersion['2.8.4'].serverUrl, /Server_Java_17-25\.zip$/);
  assert.match(byVersion['9.9.9-synthetic-nojava'].serverUrl, /Java_8\.zip$/);
});

test('normalizeIndex tolerates junk input', () => {
  assert.deepEqual(gtnh.normalizeIndex(null), []);
  assert.deepEqual(gtnh.normalizeIndex('nope'), []);
});

test('filterVersions hides betas unless asked', () => {
  const entries = gtnh.normalizeIndex(raw);
  assert.equal(
    gtnh.filterVersions(entries, { includeBeta: false }).some((e) => e.channel === 'beta'),
    false
  );
  assert.equal(gtnh.filterVersions(entries, { includeBeta: true }).length, entries.length);
});

test('pickLatest respects the channel filter', () => {
  const entries = gtnh.normalizeIndex(raw);
  assert.equal(gtnh.pickLatest(entries, { includeBeta: false }).version, '2.8.4');
  assert.equal(gtnh.pickLatest(entries, { includeBeta: true }).version, '2.9.0-beta-2');
  assert.equal(gtnh.pickLatest([], { includeBeta: true }), null);
});
