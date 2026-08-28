'use strict';

// Coarse per-IP request-rate ceilings. These are a volume backstop, not the
// primary auth defense (that's bcrypt cost + the per-account lockout in
// auth.js) - they stop a hammering script from monopolising the event loop and
// the single SQLite connection.
//
// Caveat, same as the login lockout: the counters live in this process only
// (not shared across replicas, reset on restart) and key on `req.ip`, so behind
// a reverse proxy you must set TRUST_PROXY for the real client IP to be seen -
// otherwise every client collapses onto the proxy's address and shares one
// bucket. Raise RATE_LIMIT_API_PER_MIN (or set it to 0) if that bites.

const { rateLimit } = require('express-rate-limit');
const config = require('../../config');

function jsonHandler(req, res) {
  res.status(429).json({ ok: false, error: 'Too many requests - slow down and try again shortly.' });
}

// express-rate-limit warns when it can't trust the proxy chain; TRUST_PROXY is a
// deliberate operator choice here, so quiet those specific validations.
const validate = { trustProxy: false, xForwardedForHeader: false };

const passthrough = (req, res, next) => next();

/** Broad ceiling on every /api call. */
const apiLimiter = config.rateLimit.apiPerMin
  ? rateLimit({
      windowMs: 60_000,
      limit: config.rateLimit.apiPerMin,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: jsonHandler,
      validate,
    })
  : passthrough;

/**
 * Tighter ceiling on the credential front door (login, 2FA, first-run setup).
 * GET (rendering the form) is exempt; only the POSTs count.
 */
const authLimiter = config.rateLimit.authPer15Min
  ? rateLimit({
      windowMs: 15 * 60_000,
      limit: config.rateLimit.authPer15Min,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req) => req.method === 'GET' || req.method === 'HEAD',
      handler: jsonHandler,
      validate,
    })
  : passthrough;

module.exports = { apiLimiter, authLimiter };
