'use strict';

// Session-cookie behaviour: "remember me" produces a long-lived cookie that the
// rolling refresh keeps at ~30 days out (not silently downgraded to the 7-day
// middleware default), the unchecked path is a pure browser-session cookie, the
// cookie is SameSite=Lax, and logout clears it + records the real username.
//
// express-session serialises the cookie lifetime as `Expires=<date>` (not
// `Max-Age`), so the assertions here read the Expires attribute.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');

const REMEMBER_MS = 30 * 24 * 3600 * 1000;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Raw Set-Cookie string for msm.sid. */
function sidSetCookie(res) {
  return (res.setCookie || []).find((c) => c.startsWith('msm.sid='));
}

/** "msm.sid=..." (name=value only) for replay on a follow-up request. */
function sidPair(res) {
  const raw = sidSetCookie(res);
  return raw ? raw.split(';')[0] : null;
}

/** Attribute map from a Set-Cookie string, lower-cased keys. */
function cookieAttrs(setCookie) {
  const attrs = {};
  setCookie
    .split(';')
    .slice(1)
    .forEach((part) => {
      const [k, v] = part.trim().split('=');
      attrs[k.toLowerCase()] = v === undefined ? true : v;
    });
  return attrs;
}

/** ms from now until the cookie's Expires, or null if it's a session cookie. */
function msUntilExpiry(setCookie) {
  const exp = cookieAttrs(setCookie).expires;
  return typeof exp === 'string' ? new Date(exp).getTime() - Date.now() : null;
}

test.before(async () => {
  await app.start();
  await app.adminCookie(); // side effect: creates the first admin (username "admin")
});

test.after(async () => {
  await app.stop();
});

test('remember me => ~30-day Expires, HttpOnly, SameSite=Lax', async () => {
  const res = await app.req('POST', '/login', {
    body: { username: 'admin', password: 'supersecret123', remember: true },
  });
  const sc = sidSetCookie(res);
  assert.ok(sc, 'login should set msm.sid');
  const attrs = cookieAttrs(sc);
  assert.ok(attrs.httponly, 'HttpOnly');
  assert.equal(String(attrs.samesite).toLowerCase(), 'lax');
  const left = msUntilExpiry(sc);
  assert.ok(left !== null, 'a persistent cookie has an Expires');
  assert.ok(Math.abs(left - REMEMBER_MS) < 5 * 60 * 1000, `Expires ~30 days out, got ${left}ms`);
});

test('rolling refresh keeps the 30-day window (no downgrade to 7 days)', async () => {
  const login = await app.req('POST', '/login', {
    body: { username: 'admin', password: 'supersecret123', remember: true },
  });
  const pair = sidPair(login);

  const next = await app.req('GET', '/', { cookie: pair });
  const sc = sidSetCookie(next);
  assert.ok(sc, 'rolling:true should re-send msm.sid on the next request');
  const left = msUntilExpiry(sc);
  assert.ok(left !== null, 'refreshed cookie still persistent');
  assert.ok(
    left > REMEMBER_MS - 5 * 60 * 1000,
    `refreshed Expires should still be ~30 days out (not ~7), got ${left}ms`
  );
  assert.ok(left > WEEK_MS + 24 * 3600 * 1000, 'clearly beyond the 7-day default');
});

test('without remember me => a pure session cookie (no Expires / Max-Age)', async () => {
  const res = await app.req('POST', '/login', {
    body: { username: 'admin', password: 'supersecret123', remember: false },
  });
  const sc = sidSetCookie(res);
  const attrs = cookieAttrs(sc);
  assert.equal(attrs.expires, undefined, 'no Expires');
  assert.equal(attrs['max-age'], undefined, 'no Max-Age');
  assert.equal(String(attrs.samesite).toLowerCase(), 'lax');

  // ...and the rolling refresh keeps it a session cookie too.
  const next = await app.req('GET', '/', { cookie: sidPair(res) });
  assert.equal(cookieAttrs(sidSetCookie(next)).expires, undefined, 'still no Expires after refresh');
});

test('logout: clears the cookie, drops the row, records the real username', async () => {
  const login = await app.req('POST', '/login', {
    body: { username: 'admin', password: 'supersecret123', remember: true },
  });
  const pair = sidPair(login);
  const rawVal = decodeURIComponent(pair.split('=').slice(1).join('='));
  const sid = rawVal.replace(/^s:/, '').split('.')[0];
  assert.ok(db.get('SELECT 1 AS x FROM sessions WHERE sid = ?', sid), 'session row exists after login');

  const out = await app.req('POST', '/logout', { cookie: pair });
  assert.equal(out.status, 302);

  assert.equal(db.get('SELECT 1 AS x FROM sessions WHERE sid = ?', sid), undefined, 'row gone after logout');

  const cleared = sidSetCookie(out);
  assert.ok(cleared, 'logout should send a clearing Set-Cookie');
  const left = msUntilExpiry(cleared);
  assert.ok(left !== null && left <= 0, `cookie should be expired, got: ${cleared}`);

  const ev = db.get("SELECT actor FROM events WHERE type = 'logout' ORDER BY id DESC LIMIT 1");
  assert.ok(ev, 'a logout event was recorded');
  assert.equal(ev.actor, 'admin', 'logout is attributed to the user, not "unknown"');

  // The stale cookie no longer authenticates - requireAuth bounces to /login.
  const after = await app.req('GET', '/', { cookie: pair });
  assert.equal(after.status, 302);
});
