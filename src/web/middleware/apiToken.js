'use strict';

// Auth for the public read-only API (/api/v1): a Bearer token minted by an
// admin (services/apiTokens.js). No session, no cookie - this middleware runs
// BEFORE requireAuth in web/app.js.

const apiTokens = require('../../services/apiTokens');
const { bearerToken } = require('./bearer');
const logger = require('../../logger')('api-token');

/**
 * Verify `Authorization: Bearer <token>` and attach `req.apiToken` /
 * `req.apiTokenScope`. Responds 401 (JSON, like requireAuth) on any failure.
 */
function bearerAuth(req, res, next) {
  const raw = bearerToken(req);
  if (!raw) {
    logger.debug('Rejected a public API request with no bearer token.', { path: req.path, ip: req.ip });
    return res.status(401).json({ ok: false, error: 'The Authorization header is missing or malformed.' });
  }
  const result = apiTokens.verifyToken(raw);
  if (!result || result.ok !== true) {
    const reason = result && result.ok === false ? result.reason : 'unknown';
    logger.debug('Rejected a public API request with an invalid token.', { path: req.path, ip: req.ip, reason });
    return res.status(401).json({ ok: false, error: 'Invalid or expired API token' });
  }
  req.apiToken = result.token;
  req.apiTokenScope = result.scope;
  req.apiTokenPermissions = result.permissions;
  apiTokens.touchLastUsed(result.token.id, result.token.lastUsedAt);
  next();
}

/**
 * v1 is GET-only; reject everything else with 405 + Allow before any token or
 * DB work runs. Leaves room for write scopes later.
 */
function readOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  return res.status(405).set('Allow', 'GET').json({ ok: false, error: 'This API is read-only.' });
}

module.exports = { bearerAuth, readOnly };
