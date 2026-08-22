'use strict';

// SSRF guard for server-side fetches of user-influenced URLs (direct mod
// downloads, remote mod icons). Blocks non-HTTP(S) schemes and any URL that
// resolves to a private, loopback, link-local, or otherwise-reserved address -
// the ranges an attacker would target to reach cloud metadata
// (169.254.169.254) or services bound to the panel host.
//
// Redirects are followed manually so every hop is re-validated: a public URL can
// still 302 to http://127.0.0.1/. Caveat: this validates the resolved address
// before each connection but can't pin the socket to that exact address, so a
// determined DNS-rebind retains a narrow window. That's acceptable
// defense-in-depth here (the caller is already an authenticated operator).

const dns = require('node:dns').promises;
const net = require('node:net');
const httpError = require('./httpError');

const MAX_REDIRECTS = 5;

function isBlockedIpv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/** Expand a (possibly `::`-compressed) IPv6 address to 8 explicit hex groups. */
function expandIpv6(ip) {
  let s = ip.toLowerCase();
  // A trailing dotted-quad ("…:ffff:127.0.0.1") is two groups' worth of bits -
  // fold it into two hex groups first, or the ':'-split below yields 7 parts
  // and the mapped-v4 check silently gives up (an SSRF bypass).
  const dq = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dq) {
    const [, prefix, a, b, c, d] = dq;
    const g = (x, y) => ((Number(x) << 8) | Number(y)).toString(16);
    s = `${prefix}${g(a, b)}:${g(c, d)}`;
  }
  if (s.includes('::')) {
    const [head, tail] = s.split('::');
    const headParts = head ? head.split(':') : [];
    const tailParts = tail ? tail.split(':') : [];
    const missing = 8 - headParts.length - tailParts.length;
    s = [...headParts, ...Array(Math.max(0, missing)).fill('0'), ...tailParts].join(':');
  }
  return s.split(':');
}

/** IPv4-mapped IPv6 (`::ffff:a.b.c.d` or its fully-expanded hex form) -> dotted v4, else null. */
function ipv6MappedIpv4(groups) {
  if (groups.length !== 8) return null;
  // Compare NUMERICALLY, not by string: a group may be spelled with 1–4 hex
  // digits, so "0", "00", "0000" are all zero and "ffff"/"FFFF" all 0xffff.
  // A leading-zero spelling like "0:00:0:0:0:ffff:7f00:1" must not slip past.
  const hex = (g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN);
  const parts = groups.map(hex);
  if (parts.some(Number.isNaN)) return null;
  if (!parts.slice(0, 5).every((n) => n === 0)) return null;
  if (parts[5] !== 0xffff) return null;
  const hi = parts[6];
  const lo = parts[7];
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
}

function isBlockedIpv6(ip) {
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return true; // unspecified / loopback
  if (s.startsWith('fe80')) return true; // link-local
  if (s.startsWith('fc') || s.startsWith('fd')) return true; // unique-local
  if (s.startsWith('ff')) return true; // multicast
  // Catches every IPv4-mapped spelling, not just the textual "::ffff:a.b.c.d"
  // shorthand - e.g. the fully-expanded "0:0:0:0:0:ffff:7f00:1" (=127.0.0.1).
  const mapped = ipv6MappedIpv4(expandIpv6(s));
  if (mapped) return isBlockedIpv4(mapped);
  return false;
}

// Alternate IPv4 encodings (decimal, octal, hex, short-dotted) that net.isIP()
// doesn't recognize as a literal IP but that some resolvers still parse -
// e.g. 127.0.0.1 written as 2130706433, 0x7f000001, or 127.1. Whether a given
// libc's getaddrinfo actually accepts these is resolver-dependent, so refuse
// outright rather than gamble on it.
//
// A host is "ambiguously numeric" only when EVERY dot-separated label is itself
// a bare number (decimal, C-octal, or 0x-hex) - that's what makes it parseable
// as a packed IPv4. A real domain always has at least one non-numeric label
// (its TLD or a name), so hosts like "cafe.de" or "feed.ac" - all-hex-LETTERS
// but not numbers - are left alone. The earlier /^[0-9a-fx.]+$/ over-matched
// those and 400'd legitimate mod/icon fetches.
const NUMERIC_LABEL_RE = /^(?:0x[0-9a-f]+|\d+)$/i;
function isAmbiguousNumericHost(host) {
  const labels = host.split('.');
  return labels.length > 0 && labels.every((l) => NUMERIC_LABEL_RE.test(l));
}

function isBlockedIp(ip) {
  // Normalize IPv4-mapped IPv6 (::ffff:1.2.3.4) to its v4 form.
  const v4 = ip.toLowerCase().startsWith('::ffff:') ? ip.slice(ip.lastIndexOf(':') + 1) : ip;
  if (net.isIPv4(v4)) return isBlockedIpv4(v4);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return true; // unknown format - block
}

/** Throw unless `rawUrl` is an http(s) URL that resolves only to public addresses. */
async function assertPublicUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw httpError(400, 'Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw httpError(400, `Only http(s) URLs are allowed (got ${u.protocol})`);
  }
  const host = u.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  let addrs;
  if (net.isIP(host)) {
    addrs = [host];
  } else if (isAmbiguousNumericHost(host)) {
    throw httpError(400, `Refusing to resolve an ambiguous numeric host (${host})`);
  } else {
    let results;
    try {
      results = await dns.lookup(host, { all: true });
    } catch {
      throw httpError(502, `Could not resolve host ${host}`);
    }
    addrs = results.map((r) => r.address);
  }
  if (!addrs.length || addrs.some(isBlockedIp)) {
    throw httpError(400, `Refusing to fetch a private or internal address (${host})`);
  }
  return u;
}

/**
 * Like fetch(), but SSRF-guarded: validates the target (and every redirect hop)
 * resolves to a public address before connecting. Options are passed through;
 * `redirect` is forced to manual so hops can be re-checked.
 */
async function safeFetch(rawUrl, options = {}) {
  let current = String(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...options, redirect: 'manual' });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!location) return res;
    current = new URL(location, current).toString();
  }
  throw httpError(502, `Too many redirects (more than ${MAX_REDIRECTS})`);
}

module.exports = { safeFetch, assertPublicUrl, isBlockedIp, isAmbiguousNumericHost };
