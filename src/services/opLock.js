'use strict';

// Shared per-server "lifecycle/destructive operation in flight" guard. Every
// operation that mutates a server's container OR its on-disk world data must
// run through guardOp so two of them can never interleave on the same server:
// e.g. a backup restore's wipe-then-extract racing a concurrent start is
// exactly how a live world gets corrupted (the container looks stopped when
// the restore checks, then a second request starts it mid-extraction).
//
// Semantics match the original lifecycle mutex this was factored out of
// (src/services/servers.js): first caller for a serverId wins and runs
// immediately; any other op for that same serverId is rejected with 409
// while the first is in flight, except a second 'start' which piggybacks on
// the same in-flight promise instead of failing.

const httpError = require('../utils/httpError');

const inFlightOps = new Map(); // serverId -> { op, promise }

/**
 * @param {string} op        label used in the 409 conflict message
 * @param {Function} fn      the function to guard
 * @param {Function} [getId] extracts the serverId (the lock key) from fn's
 *                           argument list; defaults to the first argument,
 *                           which covers every guarded function except those
 *                           where the serverId isn't the first parameter
 *                           (e.g. worlds.installToServer(libraryId, serverId)).
 */
function guardOp(op, fn, getId = (id) => id) {
  return async function guarded(...args) {
    const id = getId(...args);
    const existing = inFlightOps.get(id);
    if (existing) {
      if (existing.op === op && op === 'start') return existing.promise; // piggyback on the same start
      // code BUSY: callers that wait and retry (scheduler, crash restarts) test the
      // code, never this wording.
      const err = httpError(409, `Cannot ${op}: a ${existing.op} operation is already in progress for this server`);
      err.code = 'BUSY';
      throw err;
    }
    const promise = Promise.resolve().then(() => fn(...args));
    const entry = { op, promise };
    inFlightOps.set(id, entry);
    try {
      return await promise;
    } finally {
      if (inFlightOps.get(id) === entry) inFlightOps.delete(id);
    }
  };
}

/**
 * Run `fn` (a guarded operation); while another action holds the server (409
 * BUSY), wait `retryMs` and try again, for up to `maxWaitMs`. Multi-step flows
 * whose steps are locked one at a time (a pack update: stop, rebuild, start)
 * use it so a short action landing between steps - a port change, a backup
 * cleanup - delays them instead of breaking them halfway.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retryMs?: number, maxWaitMs?: number }} [opts]
 * @returns {Promise<T>}
 */
async function retryWhileBusy(fn, { retryMs = 20_000, maxWaitMs = 30 * 60_000 } = {}) {
  const giveUpAt = Date.now() + maxWaitMs;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!err || err.code !== 'BUSY' || Date.now() + retryMs > giveUpAt) throw err;
      await new Promise((resolve) => setTimeout(resolve, retryMs).unref());
    }
  }
}

module.exports = { guardOp, retryWhileBusy };
