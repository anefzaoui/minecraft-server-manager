'use strict';

// express-session Store backed by the panel's SQLite (sessions table).

const { Store } = require('express-session');
const db = require('../db');

// Server-side TTL for a row whose cookie carries no expiry of its own - i.e. the
// "don't remember me" case, a pure browser-session cookie. rolling:true rewrites
// this on every authenticated request, so an active tab is never pruned
// mid-session; the row is only reclaimed after ~a day of inactivity (vs. the
// week it used to linger).
const SESSION_FALLBACK_MS = 24 * 3600 * 1000;

// rolling:true asks the store to touch() the row on every authenticated request
// so the expiry keeps sliding forward. Writing the full row every time is one
// SQLite write per request per active user; instead only rewrite when the new
// expiry advances the stored one by more than this. The cookie the browser
// holds is refreshed by express-session regardless - this just coarsens the
// server-side bookkeeping, and an active session still touches well inside its
// TTL.
const TOUCH_MIN_ADVANCE_MS = 60 * 60 * 1000;

class SqliteSessionStore extends Store {
  get(sid, cb) {
    try {
      const row = db.get('SELECT data_json, expires_at FROM sessions WHERE sid = ?', sid);
      if (!row) return cb(null, null);
      if (Date.parse(row.expires_at) < Date.now()) {
        db.run('DELETE FROM sessions WHERE sid = ?', sid);
        return cb(null, null);
      }
      const session = JSON.parse(row.data_json);
      // JSON has no Date type, so cookie.expires comes back as a plain ISO
      // string - but express-session's Cookie class requires a real Date
      // instance (its maxAge getter, and the underlying `cookie` package's
      // serialize(), both check `instanceof Date`; serialize() throws
      // "option expires is invalid" otherwise). With rolling:true, that throw
      // happens on the very next request after every reload from this store,
      // breaking the cookie refresh that "remember me" depends on. Revive it.
      if (session.cookie && typeof session.cookie.expires === 'string') {
        session.cookie.expires = new Date(session.cookie.expires);
      }
      cb(null, session);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, session, cb) {
    try {
      const expires =
        session.cookie && session.cookie.expires
          ? new Date(session.cookie.expires).toISOString()
          : new Date(Date.now() + SESSION_FALLBACK_MS).toISOString();
      // Persisted alongside data_json (which also carries userId) so a
      // credential/2FA change can revoke every OTHER session for that user
      // without deserializing every row in the table - see auth.js
      // revokeOtherSessions().
      db.run(
        `INSERT INTO sessions (sid, data_json, expires_at, user_id) VALUES (?, ?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET data_json = excluded.data_json, expires_at = excluded.expires_at, user_id = excluded.user_id`,
        sid,
        JSON.stringify(session),
        expires,
        session.userId || null
      );
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      db.run('DELETE FROM sessions WHERE sid = ?', sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, session, cb) {
    try {
      const nextExpiry =
        session.cookie && session.cookie.expires
          ? new Date(session.cookie.expires).getTime()
          : Date.now() + SESSION_FALLBACK_MS;
      const row = db.get('SELECT expires_at FROM sessions WHERE sid = ?', sid);
      if (row) {
        const stored = Date.parse(row.expires_at);
        if (Number.isFinite(stored) && Number.isFinite(nextExpiry) && nextExpiry - stored < TOUCH_MIN_ADVANCE_MS) {
          return cb(null); // expiry hasn't moved enough to be worth a write
        }
      }
      this.set(sid, session, cb);
    } catch (err) {
      cb(err);
    }
  }
}

module.exports = { SqliteSessionStore };
