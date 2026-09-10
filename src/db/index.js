'use strict';

// SQLite via Node's built-in node:sqlite (synchronous, zero native deps).
// This thin wrapper is the only module that touches the driver, so swapping
// to libsql/better-sqlite3 later means changing this file alone.

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');
const logger = require('../logger')('db');

let db = null;

// Prepared statements are reusable across calls in node:sqlite, so cache them
// keyed on the SQL text instead of re-parsing on every run/get/all. The set of
// distinct SQL strings in the panel is small and static, so this stays bounded
// without eviction; it's cleared alongside the connection in close().
const stmtCache = new Map();

function open() {
  if (db) return db;
  db = new DatabaseSync(path.join(config.dataDir, 'panel.db'));
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  logger.debug('Opened the panel database.');
  return db;
}

function prepare(sql) {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = open().prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

/** Prepared-statement helpers. All synchronous - node:sqlite mirrors better-sqlite3. */
function run(sql, ...params) {
  return prepare(sql).run(...params);
}
function get(sql, ...params) {
  return prepare(sql).get(...params);
}
function all(sql, ...params) {
  return prepare(sql).all(...params);
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
    stmtCache.clear();
    db.close();
    db = null;
  }
}

/**
 * Hot snapshot of the whole database to `destPath`. Checkpoints the WAL first so
 * the copy is fully self-contained, then `VACUUM INTO` writes a consistent,
 * defragmented single-file copy. The rewrite runs in a worker thread so the
 * event loop is never blocked by it (VACUUM INTO can be slow on a large DB).
 * Resolves with the elapsed milliseconds.
 */
function backupTo(destPath) {
  return new Promise((resolve, reject) => {
    const { Worker } = require('node:worker_threads');
    const worker = new Worker(path.join(__dirname, 'vacuum-worker.js'), {
      workerData: { dbPath: path.join(config.dataDir, 'panel.db'), destPath },
    });
    worker.once('message', (msg) => {
      try {
        worker.terminate();
      } catch {}
      if (msg && msg.ok) resolve(msg.blockedMs);
      else reject(new Error((msg && msg.error) || 'Panel DB backup failed'));
    });
    worker.once('error', (err) => reject(err));
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Panel DB backup worker exited with code ${code}`));
    });
  });
}

module.exports = { open, run, get, all, exec, transaction, close, backupTo };
