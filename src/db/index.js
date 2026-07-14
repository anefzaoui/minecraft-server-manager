'use strict';

// SQLite via Node's built-in node:sqlite (synchronous, zero native deps).
// This thin wrapper is the only module that touches the driver, so swapping
// to libsql/better-sqlite3 later means changing this file alone.

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let db = null;

function open() {
  if (db) return db;
  db = new DatabaseSync(path.join(config.dataDir, 'panel.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

/** Prepared-statement helpers. All synchronous — node:sqlite mirrors better-sqlite3. */
function run(sql, ...params) {
  return open()
    .prepare(sql)
    .run(...params);
}
function get(sql, ...params) {
  return open()
    .prepare(sql)
    .get(...params);
}
function all(sql, ...params) {
  return open()
    .prepare(sql)
    .all(...params);
}
function exec(sql) {
  return open().exec(sql);
}

/** Run `fn` inside a transaction; rolls back on throw. */
function transaction(fn) {
  const d = open();
  d.exec('BEGIN');
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { open, run, get, all, exec, transaction, close };
