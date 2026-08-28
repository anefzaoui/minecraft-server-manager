'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const loggerModule = require('../src/logger');
const { createLogger, formatMessage, makeFailureThrottle } = loggerModule;

test('default export is a label-keyed factory returning a cached logger', () => {
  const a = loggerModule('example.js');
  assert.equal(typeof a.info, 'function');
  assert.equal(typeof a.warn, 'function');
  assert.equal(typeof a.error, 'function');
  assert.equal(typeof a.debug, 'function');
  assert.equal(typeof a.trace, 'function');
  assert.equal(typeof a.fatal, 'function');
  assert.ok(a._pino);
  assert.equal(loggerModule('example.js'), a, 'same label returns the cached instance');
  assert.notEqual(loggerModule('other.js'), a);
});

test('formatMessage trims and gives terminal punctuation', () => {
  assert.equal(formatMessage('hi'), 'hi.');
  assert.equal(formatMessage('  hi.  '), 'hi.');
  assert.equal(formatMessage('really?'), 'really?');
  assert.equal(formatMessage('stop!'), 'stop!');
  assert.equal(formatMessage(''), '');
});

test('writes structured JSON with uppercase level, label, terminal period, and redaction', () => {
  const lines = [];
  const sink = { write: (s) => lines.push(JSON.parse(s)) };
  const getLogger = createLogger({ level: 'trace', destination: sink });
  const log = getLogger('unit');

  log.info('did a thing', { serverId: 's1', password: 'hunter2', nested: { token: 'abc' } });

  assert.equal(lines.length, 1);
  const rec = lines[0];
  assert.equal(rec.level, 'INFO');
  assert.equal(rec.label, 'unit');
  assert.equal(rec.msg, 'did a thing.');
  assert.equal(rec.serverId, 's1');
  assert.equal(rec.password, '[REDACTED]');
  assert.equal(rec.nested.token, '[REDACTED]');
});

test('respects the level threshold', () => {
  const lines = [];
  const sink = { write: (s) => lines.push(JSON.parse(s)) };
  const log = createLogger({ level: 'warn', destination: sink })('unit');
  log.debug('quiet');
  log.info('quiet');
  log.warn('loud');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].msg, 'loud.');
});

test('makeFailureThrottle logs the first failure, throttles repeats, and reports recovery', () => {
  const calls = [];
  const logFn = (msg, meta) => calls.push({ msg, meta });
  const t = makeFailureThrottle({ everyMs: 60_000 });

  t.fail(logFn, 'It failed.', { x: 1 });
  t.fail(logFn, 'It failed.', { x: 1 });
  t.fail(logFn, 'It failed.', { x: 1 });
  assert.equal(calls.length, 1, 'only the first failure inside the window is logged');
  assert.equal(calls[0].meta.consecutiveFailures, 1);

  t.ok(logFn, 'It recovered.');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].meta.afterFailures, 3);

  t.ok(logFn, 'Still fine.');
  assert.equal(calls.length, 2, 'no recovery line when there was no failure');
});

test('the core modules load without a circular require', () => {
  const res = spawnSync(
    process.execPath,
    ['-e', "require('./src/logger'); require('./src/config'); require('./src/instrument');"],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', env: { ...process.env, LOG_LEVEL: 'silent' } }
  );
  assert.equal(res.status, 0, res.stderr);
});
