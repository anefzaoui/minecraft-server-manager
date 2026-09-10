'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMemMb, isTrue, heapPlan } = require('../src/services/jvm');

test('parseMemMb reads every spelling the image accepts, bare numbers as MB', () => {
  assert.equal(parseMemMb('512M'), 512);
  assert.equal(parseMemMb('4G'), 4096);
  assert.equal(parseMemMb('2g'), 2048);
  assert.equal(parseMemMb('4096'), 4096);
  assert.equal(parseMemMb(' 1024m '), 1024);
  assert.equal(parseMemMb('75%'), null);
  assert.equal(parseMemMb(''), null);
  assert.equal(parseMemMb(undefined), null);
  assert.equal(parseMemMb('lots'), null);
});

test("isTrue matches the image's own flag spellings", () => {
  for (const v of ['true', 'TRUE', '1', 'yes', 'on']) assert.equal(isTrue(v), true, v);
  for (const v of ['false', '0', 'no', '', undefined, 'truthy']) assert.equal(isTrue(v), false, String(v));
});

test('an equal starting and maximum heap (the default) gets the "given up front" note, flags or not', () => {
  const plain = heapPlan({}, 12288);
  assert.equal(plain.growsOnDemand, false);
  assert.match(plain.note, /whole 12288 MB heap up front/);
  assert.match(plain.note, /Initial heap/);
  const aikar = heapPlan({ USE_AIKAR_FLAGS: 'true' }, 12288);
  assert.equal(aikar.preTouch, true);
  assert.equal(aikar.note, plain.note, 'the preset does not change the message: the heap fills either way');
});

test('a smaller INIT_MEMORY flips the note to "grows on demand"', () => {
  const p = heapPlan({ INIT_MEMORY: '4G', USE_AIKAR_FLAGS: 'true' }, 12288);
  assert.equal(p.initMb, 4096);
  assert.equal(p.growsOnDemand, true);
  assert.match(p.note, /starts with 4096 MB and grows toward its 12288 MB heap/);
});

test('MAX_MEMORY overrides the panel heap; INIT_MEMORY above it never counts as growth', () => {
  const p = heapPlan({ MAX_MEMORY: '8G', INIT_MEMORY: '8G' }, 12288);
  assert.equal(p.heapMb, 8192);
  assert.equal(p.growsOnDemand, false);
  assert.equal(heapPlan({ INIT_MEMORY: '16G' }, 12288).growsOnDemand, false);
});

test('no heap at all yields no note', () => {
  assert.equal(heapPlan({}, 0).note, null);
  assert.equal(heapPlan(undefined, undefined).note, null);
});
