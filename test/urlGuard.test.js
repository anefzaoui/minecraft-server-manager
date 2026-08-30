'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { isBlockedIp, assertPublicUrl, isAmbiguousNumericHost } = require('../src/utils/urlGuard');

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

test('isBlockedIp maps a fully-expanded IPv4-mapped IPv6 literal', () => {
  // 0:0:0:0:0:ffff:7f00:1 == ::ffff:127.0.0.1 == 127.0.0.1
  assert.equal(isBlockedIp('0:0:0:0:0:ffff:7f00:1'), true);
  assert.equal(isBlockedIp('0000:0000:0000:0000:0000:ffff:7f00:0001'), true);
  // 0:0:0:0:0:ffff:0808:0808 == 8.8.8.8 (public - must not be blocked)
  assert.equal(isBlockedIp('0:0:0:0:0:ffff:808:808'), false);
});

test('isBlockedIp maps IPv4-mapped IPv6 spelled with leading-zero groups or a dotted tail', () => {
  // Leading-zero group spelling: "00" is still zero - must not defeat the check.
  assert.equal(isBlockedIp('0:00:0:0:0:ffff:7f00:1'), true);
  assert.equal(isBlockedIp('00:00:00:00:00:ffff:7f00:1'), true);
  // Embedded dotted-quad tail (not `::`-compressed) must fold to two groups.
  assert.equal(isBlockedIp('0:0:0:0:0:ffff:127.0.0.1'), true);
  assert.equal(isBlockedIp('0:0:0:0:0:ffff:169.254.169.254'), true);
  // Same spellings of a PUBLIC address must stay allowed.
  assert.equal(isBlockedIp('0:00:0:0:0:ffff:8.8.8.8'), false);
  assert.equal(isBlockedIp('0:0:0:0:0:ffff:808:808'), false);
});

test('isAmbiguousNumericHost flags all-numeric encodings but leaves hex-letter domains alone', () => {
  for (const h of ['2130706433', '0x7f000001', '127.1', '017700000001', '127.0.0.1']) {
    assert.equal(isAmbiguousNumericHost(h), true, h);
  }
  // Real domains whose labels merely happen to be hex letters must NOT be flagged.
  for (const h of ['cafe.de', 'dead.be', 'feed.ac', 'example.com', 'a1b2.net', 'my-mod.io']) {
    assert.equal(isAmbiguousNumericHost(h), false, h);
  }
});

test('assertPublicUrl rejects alternate IPv4 encodings of a private address', async () => {
  // 2130706433 / 0x7f000001 / 017700000001 / 127.1 are all alternate spellings of
  // 127.0.0.1. WHATWG URL parsing normalizes these to a literal dotted-quad before
  // assertPublicUrl ever sees them (net.isIP() then catches it directly) - this
  // guards that property, since a future URL-parsing change could silently regress it.
  for (const url of ['http://2130706433/', 'http://0x7f000001/', 'http://127.1/', 'http://017700000001/']) {
    await assert.rejects(() => assertPublicUrl(url), /private or internal|ambiguous numeric host/, url);
  }
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

// The allowPrivate option is what the self-hosted-LLM guard (wizard.js) relies
// on: LAN and loopback are reachable, but the addresses that are never a valid
// target stay blocked so it cannot be turned into a metadata-server SSRF.
test('isBlockedIp with allowPrivate keeps LAN and loopback but still blocks the dangerous ranges', () => {
  for (const ip of [
    '127.0.0.1',
    '10.0.0.25',
    '192.168.1.50',
    '172.16.5.5',
    '100.64.0.1',
    '::1',
    'fc00::1',
    'fd12::1',
  ]) {
    assert.equal(isBlockedIp(ip, { allowPrivate: true }), false, `${ip} should be allowed on a LAN`);
  }
  for (const ip of ['0.0.0.0', '169.254.169.254', '224.0.0.1', '239.255.255.250', '::', 'fe80::1', 'ff02::1']) {
    assert.equal(isBlockedIp(ip, { allowPrivate: true }), true, `${ip} must stay blocked even on a LAN`);
  }
  // An IPv4-mapped IPv6 spelling of the cloud-metadata address must not sneak past.
  assert.equal(isBlockedIp('::ffff:169.254.169.254', { allowPrivate: true }), true);
  assert.equal(isBlockedIp('0:0:0:0:0:ffff:169.254.169.254', { allowPrivate: true }), true);
});

test('assertPublicUrl with allowPrivate reaches a LAN host but rejects the metadata address', async () => {
  const lan = await assertPublicUrl('http://192.168.1.50:11434/', { allowPrivate: true });
  assert.equal(lan.hostname, '192.168.1.50');
  const loopback = await assertPublicUrl('http://127.0.0.1:11434/', { allowPrivate: true });
  assert.equal(loopback.hostname, '127.0.0.1');
  await assert.rejects(
    () => assertPublicUrl('http://169.254.169.254/latest/meta-data/', { allowPrivate: true }),
    /link-local, multicast, or unspecified/
  );
});
