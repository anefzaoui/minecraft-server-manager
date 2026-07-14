'use strict';

/**
 * Wrap an async (or sync) route handler so a thrown error or rejected promise
 * is forwarded to Express's error handling — no hand-written try/catch needed.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
