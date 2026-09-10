'use strict';

// Shared Bearer-token helper. A leaf module (no app imports) so middleware can
// use it without a require cycle.

const BEARER_RE = /^Bearer\s+(.+)$/i;

/**
 * Extract the raw token from an `Authorization: Bearer <token>` header.
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function bearerToken(req) {
  const m = BEARER_RE.exec(String(req.get('authorization') || '').trim());
  return m ? m[1].trim() : null;
}

module.exports = { BEARER_RE, bearerToken };
