'use strict';

// Minimal per-key async mutex. Operations sharing a key run one at a time, in
// arrival order; different keys run concurrently. Used to serialize per-server
// critical sections (e.g. the save-off/copy/save-on dance) so they can't
// interleave and tear each other's output.

function createKeyedMutex() {
  const tails = new Map();

  function withLock(key, fn) {
    const prev = tails.get(key) || Promise.resolve();
    // Run fn once the previous holder settles, regardless of its outcome.
    const result = prev.then(
      () => fn(),
      () => fn()
    );
    // Track the chain tail without letting a rejection break the next waiter.
    const tail = result.then(
      () => {},
      () => {}
    );
    tails.set(key, tail);
    tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return result; // caller still sees fn's real resolution/rejection
  }

  return { withLock };
}

module.exports = { createKeyedMutex };
