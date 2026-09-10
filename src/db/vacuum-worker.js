'use strict';

// Defragmented hot DB copy for the nightly panel backup, run off the main
// event loop so the (potentially slow) VACUUM INTO rewrite can't stall the
// panel. Opens its own read/write connection to the same file. VACUUM INTO
// reads a consistent snapshot of the current state (including any committed
// WAL frames the live connection has written) and always emits a fully
// self-contained, defragmented single file, so no manual checkpoint is needed
// — trying to TRUNCATE the WAL from a second connection while the panel's
// connection holds it open is what breaks the copy.

const { parentPort, workerData } = require('node:worker_threads');
const { DatabaseSync } = require('node:sqlite');

const { dbPath, destPath } = workerData || {};
const started = Date.now();
try {
  const d = new DatabaseSync(dbPath);
  d.exec('PRAGMA busy_timeout = 10000');
  d.exec(`VACUUM INTO '${String(destPath).replace(/'/g, "''")}'`);
  d.close();
  parentPort.postMessage({ ok: true, blockedMs: Date.now() - started });
} catch (err) {
  parentPort.postMessage({ ok: false, blockedMs: Date.now() - started, error: String((err && err.message) || err) });
}
