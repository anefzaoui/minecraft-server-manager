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

test('secret-key matching is on word-parts, not raw substrings', () => {
  // Redacted: the word-part really is a credential.
  assert.ok(isSecretKey('sessionSecret'));
  assert.ok(isSecretKey('accessToken'));
  assert.ok(isSecretKey('cfApiKey'));
  assert.ok(isSecretKey('client_secret'));
  assert.ok(isSecretKey('totpSecret'));
  // NOT redacted: substring collisions that used to be caught.
  assert.ok(!isSecretKey('sessionId'));
  assert.ok(!isSecretKey('sessionCount'));
  assert.ok(!isSecretKey('passedChecks'));
  assert.ok(!isSecretKey('bypassLogin'));
  assert.ok(!isSecretKey('compassBearing'));
  assert.ok(!isSecretKey('tokensUsed')); // 'tokens' !== 'token'

  const out = sanitizeLogMeta({ sessionId: 'abc123', sessionSecret: 's', tokensUsed: 5 });
  assert.equal(out.sessionId, 'abc123');
  assert.equal(out.sessionSecret, '[REDACTED]');
  assert.equal(out.tokensUsed, 5);
});

test('redacts the path of webhook URLs (secret is in the path, not the query)', () => {
  const discord = stripUrlQuery('https://discord.com/api/webhooks/123456789/S3cr3tTok3nValue');
  assert.equal(discord, 'https://discord.com/[REDACTED]');
  const slack = stripUrlQuery('https://hooks.slack.com/services/T00/B00/XXXXtokenXXXX');
  assert.equal(slack, 'https://hooks.slack.com/[REDACTED]');
  // A generic URL with a ".../webhooks/..." path is caught by shape too.
  assert.equal(stripUrlQuery('https://example.test/api/webhooks/abc/def'), 'https://example.test/[REDACTED]');
  // Ordinary URLs keep their path.
  assert.equal(stripUrlQuery('https://example.test/a/b?x=1'), 'https://example.test/a/b');
});

test('one throwing getter costs only its own field, not the whole meta object', () => {
  const meta = { ok: 1 };
  Object.defineProperty(meta, 'boom', {
    enumerable: true,
    get() {
      throw new Error('nope');
    },
  });
  let out;
  assert.doesNotThrow(() => {
    out = sanitizeLogMeta(meta);
  });
  assert.equal(out.ok, 1);
  assert.equal(out.boom, '[Unreadable]');
  assert.notEqual(out.sanitizeError, true);
});

test('passes primitives and nullish through untouched', () => {
  assert.equal(sanitizeLogMeta(null), null);
  assert.equal(sanitizeLogMeta(undefined), undefined);
  assert.equal(sanitizeLogMeta(42), 42);
  assert.equal(sanitizeLogMeta('hi'), 'hi');
});
