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

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../../config');
const { tokenRateKey } = require('./bearer');

function jsonHandler(req, res) {
  res.status(429).json({ ok: false, error: 'Too many requests. Slow down and try again shortly.' });
}

// TRUST_PROXY=true is refused at boot (src/config) precisely because it would
// let a client spoof req.ip and dodge these per-IP limits (and the login
// lockout). Leave express-rate-limit's own trust-proxy validation enabled so a
// genuinely misconfigured chain still warns loudly in production logs.
const validate = undefined;

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

/**
 * Per-token ceiling on the public /api/v1 surface. Buckets on the SHA-256 of
 * the presented Bearer token; a missing/malformed token falls back to the
 * IPv6-safe per-IP key so a pre-auth flood is still capped (needs TRUST_PROXY
 * behind a proxy, same caveat as above).
 */
const publicApiLimiter = config.rateLimit.publicApiPerMin
  ? rateLimit({
      windowMs: 60_000,
      limit: config.rateLimit.publicApiPerMin,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: jsonHandler,
      validate,
      keyGenerator: (req) => tokenRateKey(req) || ipKeyGenerator(req.ip),
    })
  : passthrough;

module.exports = { apiLimiter, authLimiter, publicApiLimiter };
