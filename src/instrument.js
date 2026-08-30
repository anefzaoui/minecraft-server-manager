'use strict';

// Error-reporting seam. Required on the very first line of src/server.js - before
// preflight, config, or anything else - so that if/when Sentry is wired in here
// it patches the runtime before other modules load.
//
// Right now this is a deliberate no-op: the panel ships with Pino logging only.
// Every call site already routes failures through captureError() and the logger
// already checks `Sentry`/`Sentry.logger`, so turning Sentry on later is a
// change to THIS FILE ALONE:
//   1. add `@sentry/node` to dependencies
//   2. if (process.env.SENTRY_DSN) { Sentry = require('@sentry/node'); Sentry.init({...}); }
//   3. implement captureError / record* against it
// No other file needs to change.

require('dotenv').config({ quiet: true });

/** @type {any} */
const Sentry = null;

/**
 * Report a caught error to the error tracker. No-op until Sentry is wired in.
 * @param {unknown} _err
 * @param {Record<string, unknown>} [_tags]
 */
function captureError(_err, _tags) {
  // no-op
}

/**
 * Flush and close the error tracker before the process exits. No-op for now.
 * @param {number} [_timeoutMs]
 * @returns {Promise<void>}
 */
async function closeSentry(_timeoutMs = 2000) {
  // no-op
}

function recordCount(_name, _value, _tags) {}
function recordGauge(_name, _value, _tags) {}
function recordDistribution(_name, _value, _tags) {}

/**
 * Run `fn` inside a tracing span when a tracer is present; otherwise just run it.
 * @template T
 * @param {Record<string, unknown>} _opts
 * @param {() => T} fn
 * @returns {T}
 */
function startSpan(_opts, fn) {
  return typeof fn === 'function' ? fn() : undefined;
}

module.exports = {
  Sentry,
  captureError,
  closeSentry,
  recordCount,
  recordGauge,
  recordDistribution,
  startSpan,
};
