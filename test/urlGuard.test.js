'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isBlockedIp, assertPublicUrl } = require('../src/utils/urlGuard');

test('isBlockedIp blocks private, loopback, and link-local IPv4', () => {
  for (const ip of [
    '127.0.0.1',
    '10.1.2.3',
    '192.168.0.5',
    '172.16.9.9',
    '172.31.255.255',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '224.0.0.1',
  ]) {
    assert.equal(isBlockedIp(ip), true, `${ip} should be blocked`);
  }
});

test('isBlockedIp allows public IPv4', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1']) {
    assert.equal(isBlockedIp(ip), false, `${ip} should be allowed`);
  }
});

test('isBlockedIp blocks loopback/link-local/ULA IPv6 and maps ::ffff:', () => {
  assert.equal(isBlockedIp('::1'), true);
  assert.equal(isBlockedIp('fe80::1'), true);
  assert.equal(isBlockedIp('fc00::1'), true);
  assert.equal(isBlockedIp('fd12::1'), true);
  assert.equal(isBlockedIp('::ffff:127.0.0.1'), true);
  assert.equal(isBlockedIp('2606:4700:4700::1111'), false);
});

test('assertPublicUrl rejects non-http(s) schemes', async () => {
  await assert.rejects(() => assertPublicUrl('file:///etc/passwd'), /http/);
  await assert.rejects(() => assertPublicUrl('ftp://example.com/x'), /http/);
  await assert.rejects(() => assertPublicUrl('not a url'), /Invalid URL/);
});

test('assertPublicUrl rejects literal private/loopback hosts without DNS', async () => {
  await assert.rejects(() => assertPublicUrl('http://127.0.0.1/x'), /private or internal/);
  await assert.rejects(() => assertPublicUrl('http://169.254.169.254/latest/meta-data/'), /private or internal/);
  await assert.rejects(() => assertPublicUrl('http://[::1]:8080/'), /private or internal/);
  await assert.rejects(() => assertPublicUrl('http://192.168.1.1/'), /private or internal/);
});

test('assertPublicUrl accepts a public literal IP', async () => {
  const u = await assertPublicUrl('https://8.8.8.8/');
  assert.equal(u.hostname, '8.8.8.8');
});
