'use strict';

// The one logger for the whole panel. Every module does:
//
//   const logger = require('<rel>/logger')(require('node:path').basename(__filename));
//   logger.info('Started a server.', { serverId, actor });
//
// House rules for the message string: plain English, sentence case, ends with
// '.', '!', or '?', and NO colon - every variable goes in the structured meta
// object, never interpolated into the text. `write()` enforces the terminal
// period so callers don't have to think about it.
//
// Deliberately does NOT require ./config - config loads first and must not
// depend on the logger. The level is read straight from the environment via the
// shared allowlist helper.

const pino = require('pino');
const { normalizeLogLevel } = require('./config/logLevel');
const { sanitizeLogMeta } = require('./utils/logSanitize');
const instrument = require('./instrument');

const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
const ENDS_OK = /[.!?]$/;

function resolveLevel() {
  return normalizeLogLevel(process.env.LOG_LEVEL) || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');
}

function usePretty() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'test' &&
    process.env.LOG_PRETTY !== 'false' &&
    Boolean(process.stdout.isTTY)
  );
}

/**
 * Trim a message and give it terminal punctuation if it lacks any.
 * @param {unknown} message
 * @returns {string}
 */
function formatMessage(message) {
  let msg = typeof message === 'string' ? message.trim() : String(message);
  if (msg && !ENDS_OK.test(msg)) msg += '.';
  return msg;
}

/**
 * Build a Pino instance plus a label-keyed getLogger bound to it. The module
 * default export calls this with no arguments; tests call it with a sink.
 * @param {{ level?: string, destination?: import('pino').DestinationStream }} [opts]
 */
function createLogger({ level = resolveLevel(), destination } = {}) {
  const options = {
    level,
    redact: {
      paths: [
        'password',
        'newPassword',
        'currentPassword',
        'secret',
        'sessionSecret',
        'token',
        'accessToken',
        'refreshToken',
        'authorization',
        'cookie',
        'apiKey',
        'cfApiKey',
        'rconPassword',
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.secret',
        '*.token',
        '*.apiKey',
        '*.authorization',
        '*.cookie',
      ],
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (!destination && usePretty()) {
    options.transport = {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    };
  }

  const base = destination ? pino(options, destination) : pino(options);

  function write(child, label, lvl, message, meta) {
    if (!child.isLevelEnabled(lvl)) return; // hot-path + test-silence early-out
    const msg = formatMessage(message);
    const safe = meta === null || meta === undefined ? undefined : sanitizeLogMeta(meta);
    if (safe === undefined) child[lvl](msg);
    else child[lvl](safe, msg);

    const slog = instrument.Sentry && instrument.Sentry.logger;
    if (slog && typeof slog[lvl] === 'function') {
      try {
        const extra = safe && typeof safe === 'object' && !Array.isArray(safe) ? safe : {};
        slog[lvl](msg, { label, ...extra });
      } catch {
        // Telemetry must never break logging.
      }
    }
  }

  const cache = new Map();

  /**
   * @param {string} [label]
   * @returns {{ info: Function, warn: Function, error: Function, debug: Function, trace: Function, fatal: Function, _pino: import('pino').Logger }}
   */
  function getLogger(label) {
    const key = label || 'app';
    let api = cache.get(key);
    if (!api) {
      const child = base.child({ label: key });
      api = { _pino: child };
      for (const lvl of LEVELS) {
        api[lvl] = (message, meta) => write(child, key, lvl, message, meta);
      }
      cache.set(key, api);
    }
    return api;
  }

  getLogger.base = base;
  return getLogger;
}

/**
 * Failure throttle for high-frequency background loops. Logs the first failure,
 * then at most one per `everyMs`, plus a single "recovered" line when the loop
 * succeeds again after failing.
 * @param {{ everyMs?: number }} [opts]
 */
function makeFailureThrottle({ everyMs = 5 * 60_000 } = {}) {
  let fails = 0;
  let lastLogged = 0;
  return {
    /** @param {Function} logFn @param {string} message @param {Record<string, unknown>} [meta] */
    fail(logFn, message, meta) {
      fails += 1;
      const now = Date.now();
      if (fails === 1 || now - lastLogged >= everyMs) {
        lastLogged = now;
        logFn(message, { ...meta, consecutiveFailures: fails });
      }
    },
    /** @param {Function} logFn @param {string} message @param {Record<string, unknown>} [meta] */
    ok(logFn, message, meta) {
      if (fails > 0) logFn(message, { ...meta, afterFailures: fails });
      fails = 0;
      lastLogged = 0;
    },
  };
}

const getLogger = createLogger();

// Callable factory with the helpers hung off it. Object.assign keeps the return
// type an intersection so `require('./logger').makeFailureThrottle` type-checks.
module.exports = Object.assign(getLogger, {
  getLogger,
  createLogger,
  formatMessage,
  makeFailureThrottle,
  baseLogger: getLogger.base,
});
