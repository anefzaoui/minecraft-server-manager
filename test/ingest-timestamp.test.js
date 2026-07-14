'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { splitDockerTimestamp } = require('../src/analytics/ingest');

test('splits a Docker RFC3339Nano timestamp from the log line', () => {
  const line = '2026-07-14T03:04:05.123456789Z [12:34:56] [Server thread/INFO]: Steve joined the game';
  const { ts, rest } = splitDockerTimestamp(line);
  assert.equal(ts, '2026-07-14T03:04:05.123Z');
  assert.equal(rest, '[12:34:56] [Server thread/INFO]: Steve joined the game');
});

test('handles a millisecond (or no-fraction) Docker timestamp', () => {
  assert.equal(splitDockerTimestamp('2026-01-02T00:00:00Z hello').ts, '2026-01-02T00:00:00.000Z');
  assert.equal(splitDockerTimestamp('2026-01-02T00:00:00.500Z hi').ts, '2026-01-02T00:00:00.500Z');
});

test('returns ts:null and the untouched line when no Docker timestamp is present', () => {
  const line = '[12:34:56] [Server thread/INFO]: Steve joined the game';
  const { ts, rest } = splitDockerTimestamp(line);
  assert.equal(ts, null);
  assert.equal(rest, line);
});

test('the parsed time is TZ-independent (always UTC from Docker)', () => {
  // Same wall-clock event, regardless of the container/host TZ, yields one UTC ts.
  const { ts } = splitDockerTimestamp('2026-07-14T22:00:00.000Z [22:00:00] [Server thread/INFO]: x');
  assert.equal(ts, '2026-07-14T22:00:00.000Z');
});
