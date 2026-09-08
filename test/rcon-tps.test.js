'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTps } = require('../src/utils/rconTps');

test('parses Paper/Purpur `tps`', () => {
  const r = parseTps('TPS from last 1m, 5m, 15m: 19.98, 20.0, *20.0');
  assert.equal(r.source, 'paper');
  assert.equal(r.tps1, 19.98);
  assert.equal(r.tps5, 20.0);
  assert.equal(r.tps15, 20.0);
});

test('parses spark `spark tps` (five windows -> keep 1m/5m/15m)', () => {
  const r = parseTps('TPS from last 5s, 10s, 1m, 5m, 15m: 20, 20, 19.9, 19.95, 20');
  assert.equal(r.source, 'spark');
  assert.equal(r.tps1, 19.9);
  assert.equal(r.tps5, 19.95);
  assert.equal(r.tps15, 20);
});

test('parses Forge `forge tps` overall line', () => {
  const r = parseTps('Overall: Mean tick time: 3.456 ms. Mean TPS: 20.000');
  assert.equal(r.source, 'forge');
  assert.equal(r.tps1, 20);
  assert.equal(r.mspt, 3.456);
  assert.equal(r.tps5, null);
});

test('parses Paper `mspt` avg from the "from last 5s" group', () => {
  const r = parseTps(
    'Server tick times (avg/min/max) from last 5s, 10s, 1m:\n1.23/0.90/4.50, 1.30/0.88/6.0, 1.4/0.9/9.9'
  );
  assert.equal(r.mspt, 1.23);
});

test('returns null for vanilla / unknown output', () => {
  assert.equal(parseTps('Unknown command or insufficient permissions'), null);
  assert.equal(parseTps(''), null);
});
