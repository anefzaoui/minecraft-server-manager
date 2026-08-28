'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeLogMeta,
  serializeError,
  stripUrlQuery,
  safeAttachmentLabel,
  isSecretKey,
  isUrlKey,
} = require('../src/utils/logSanitize');

test('redacts secret-bearing keys, including nested ones', () => {
  const out = sanitizeLogMeta({
    password: 'p',
    apiKey: 'k',
    nested: { token: 't', ok: 1 },
    keep: 'visible',
  });
  assert.equal(out.password, '[REDACTED]');
  assert.equal(out.apiKey, '[REDACTED]');
  assert.equal(out.nested.token, '[REDACTED]');
  assert.equal(out.nested.ok, 1);
  assert.equal(out.keep, 'visible');
});

test('strips the query string off URL-shaped keys', () => {
  const out = sanitizeLogMeta({ apiUrl: 'https://h/p?secret=1&x=2', webhookUrl: 'https://d/abc?token=zzz' });
  assert.equal(out.apiUrl, 'https://h/p');
  assert.equal(out.webhookUrl, 'https://d/abc');
});

test('serializeError captures name, message, capped stack, and http status', () => {
  const s = serializeError(new Error('boom'));
  assert.equal(s.errorName, 'Error');
  assert.equal(s.errorMessage, 'boom');
  assert.ok(s.stack.split('\n').length <= 8);

  const withStatus = serializeError(Object.assign(new Error('nf'), { status: 404 }));
  assert.equal(withStatus.httpStatus, 404);

  assert.equal(serializeError(new Error('x'), { includeStack: false }).stack, undefined);
});

test('is cycle-safe', () => {
  const a = { name: 'a' };
  a.self = a;
  let out;
  assert.doesNotThrow(() => {
    out = sanitizeLogMeta(a);
  });
  assert.equal(out.name, 'a');
  assert.equal(out.self, '[Circular]');
});

test('is depth-bounded', () => {
  let deep = { v: 0 };
  let cur = deep;
  for (let i = 1; i < 12; i++) {
    cur.child = { v: i };
    cur = cur.child;
  }
  let out;
  assert.doesNotThrow(() => {
    out = sanitizeLogMeta(deep);
  });
  // Walk down until we hit the truncation marker.
  let node = out;
  let hops = 0;
  while (node && typeof node === 'object' && node.child !== undefined) {
    node = node.child;
    hops++;
    if (hops > 20) break;
  }
  assert.equal(node, '[Truncated]');
});

test('stripUrlQuery and safeAttachmentLabel handle non-URLs and paths', () => {
  assert.equal(stripUrlQuery('not a url'), 'not a url');
  assert.equal(stripUrlQuery('a?b'), 'a');
  assert.equal(safeAttachmentLabel('/etc/passwd'), 'passwd');
  assert.equal(safeAttachmentLabel('C:\\Users\\me\\world.zip'), 'world.zip');
  assert.equal(safeAttachmentLabel(''), 'attachment');
});

test('key classifiers', () => {
  assert.ok(isSecretKey('password'));
  assert.ok(isSecretKey('rconPassword'));
  assert.ok(isSecretKey('X-Api-Key'.replace(/-/g, '')));
  assert.ok(!isSecretKey('serverId'));
  assert.ok(isUrlKey('webhookUrl'));
  assert.ok(!isUrlKey('name'));
});

test('passes primitives and nullish through untouched', () => {
  assert.equal(sanitizeLogMeta(null), null);
  assert.equal(sanitizeLogMeta(undefined), undefined);
  assert.equal(sanitizeLogMeta(42), 42);
  assert.equal(sanitizeLogMeta('hi'), 'hi');
});
