'use strict';

// express-session Store backed by the panel's SQLite (sessions table).

const { Store } = require('express-session');
const db = require('../db');

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
          : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      db.run(
        `INSERT INTO sessions (sid, data_json, expires_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET data_json = excluded.data_json, expires_at = excluded.expires_at`,
        sid,
        JSON.stringify(session),
        expires
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
    this.set(sid, session, cb);
  }
}

module.exports = { SqliteSessionStore };
