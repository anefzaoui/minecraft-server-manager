'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createKeyedMutex } = require('../src/utils/keyedMutex');

const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test('same key runs operations one at a time, in order', async () => {
  const m = createKeyedMutex();
  const log = [];
  const a = m.withLock('k', async () => {
    log.push('a-start');
    await tick(30);
    log.push('a-end');
  });
  const b = m.withLock('k', async () => {
    log.push('b-start');
    await tick(1);
    log.push('b-end');
  });
  await Promise.all([a, b]);
  assert.deepEqual(log, ['a-start', 'a-end', 'b-start', 'b-end']);
});

test('different keys run concurrently', async () => {
  const m = createKeyedMutex();
  const log = [];
  const a = m.withLock('x', async () => {
    log.push('x-start');
    await tick(30);
    log.push('x-end');
  });
  const b = m.withLock('y', async () => {
    log.push('y-start');
    await tick(1);
    log.push('y-end');
  });
  await Promise.all([a, b]);
  assert.deepEqual(log, ['x-start', 'y-start', 'y-end', 'x-end']);
});

test('a rejection does not wedge the queue and propagates to the caller', async () => {
  const m = createKeyedMutex();
  await assert.rejects(
    () =>
      m.withLock('k', async () => {
        throw new Error('boom');
      }),
    /boom/
  );
  const val = await m.withLock('k', async () => 42);
  assert.equal(val, 42);
});
