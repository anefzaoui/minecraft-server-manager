'use strict';

// Public read-only API tokens (Bearer) for GET /api/v1. Admin-generated,
// scopable, revocable, optionally time-limited. Storage is `api_tokens`
// (migration 015) - NOT `api_keys`, which is the outbound CurseForge key.
//
// Only the sha256 hash of the secret is stored. The token is 256-bit
// high-entropy, so a fast hash is the right choice here: it allows an indexed
// O(1) lookup by hash. bcrypt (used for USER PASSWORDS in services/auth.js)
// would force a full-table scan on every request and buys nothing against a
// value that cannot be guessed. The verify lookup below is a plain SQL equality
// on that hash, not a constant-time compare - acceptable because a fixed-length
// hex compare of a non-guessable digest is ~constant work and there is no
// per-candidate loop to time.

const crypto = require('node:crypto');
const nodePath = require('node:path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { recordEvent } = require('../events');
const { generatePassword } = require('./secrets');
const { serializeError } = require('../utils/logSanitize');
const logger = require('../logger')(nodePath.basename(__filename));

const TOKEN_PREFIX = 'msm_';
const TOKEN_BYTES = 32; // 256-bit secret
const PREFIX_STORE_LEN = 12; // 'msm_' + 8 chars kept for display
const LAST_USED_THROTTLE_MS = 60_000;

/**
 * @typedef {{ all: boolean, serverIds: string[] }} ApiTokenScope
 * @typedef {{
 *   id: string, label: string, tokenPrefix: string, scope: ApiTokenScope,
 *   permissions: string[], createdAt: string, createdBy: string,
 *   lastUsedAt: string | null, expiresAt: string | null, revokedAt: string | null,
 *   status: 'active' | 'revoked' | 'expired'
 * }} PublicApiToken
 * @typedef {{ ok: true, token: PublicApiToken, scope: ApiTokenScope, permissions: string[] }} VerifiedApiToken
 */

/**
 * @param {string} plaintext
 * @returns {string} sha256 hex digest
 */
function hashToken(plaintext) {
  return crypto.createHash('sha256').update(String(plaintext)).digest('hex');
}

/** Parse a stored timestamp to epoch ms. Accepts the SQLite `datetime('now')`
 *  "YYYY-MM-DD HH:MM:SS" (UTC, no marker) form AND the ISO-8601 "…T…Z" value
 *  the UI sends for an expiry; a naive `T` vs space compare would rank one
 *  always above the other and make expiries never fire. */
function sqlTimeToMs(ts) {
  const s = String(ts);
  return Date.parse(/^\d{4}-\d{2}-\d{2} /.test(s) ? s.replace(' ', 'T') + 'Z' : s);
}

/** True when an absolute expiry has passed. NaN-safe so a malformed value can
 *  never disable expiry checking. */
function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const ms = sqlTimeToMs(expiresAt);
  return Number.isFinite(ms) && ms <= Date.now();
}

/**
 * Shape a DB row for callers. Never includes `token_hash`.
 * @param {Record<string, any>} row
 * @returns {PublicApiToken}
 */
function toPublic(row) {
  const expired = isExpired(row.expires_at);
  return {
    id: row.id,
    label: row.label,
    tokenPrefix: row.token_prefix,
    scope: {
      all: Boolean(row.scope_all),
      serverIds: safeJsonArray(row.scope_server_ids_json),
    },
    permissions: safeJsonArray(row.permissions_json),
    createdAt: row.created_at,
    createdBy: row.created_by,
    lastUsedAt: row.last_used_at || null,
    expiresAt: row.expires_at || null,
    revokedAt: row.revoked_at || null,
    status: row.revoked_at ? 'revoked' : expired ? 'expired' : 'active',
  };
}

/** @returns {string[]} */
function safeJsonArray(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Mint a new token. The plaintext `token` is returned exactly once here and
 * never stored or logged.
 * @param {{ label: string, scopeAll?: boolean, serverIds?: string[], expiresAt?: string | null }} spec
 * @param {{ actor: string }} ctx
 * @returns {PublicApiToken & { token: string }}
 */
function createToken({ label, scopeAll = false, serverIds = [], expiresAt = null }, { actor }) {
  const secret = TOKEN_PREFIX + generatePassword(TOKEN_BYTES);
  const id = `pat_${nanoid(8)}`;
  const ids = scopeAll ? [] : serverIds;
  db.run(
    `INSERT INTO api_tokens
       (id, label, token_hash, token_prefix, scope_all, scope_server_ids_json, permissions_json, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    label,
    hashToken(secret),
    secret.slice(0, PREFIX_STORE_LEN),
    scopeAll ? 1 : 0,
    JSON.stringify(ids),
    JSON.stringify(['read']),
    actor,
    expiresAt || null
  );
  recordEvent({
    actor,
    type: 'api-token-created',
    summary: `Public API token "${label}" created.`,
    details: { tokenId: id, scopeAll: Boolean(scopeAll), serverCount: ids.length },
  });
  logger.info('Created a read-only API token.', {
    tokenId: id,
    scopeAll: Boolean(scopeAll),
    serverCount: ids.length,
    actor,
  });
  const row = db.get('SELECT * FROM api_tokens WHERE id = ?', id);
  return { ...toPublic(row), token: secret };
}

/** @returns {PublicApiToken[]} newest first */
function listTokens() {
  return db.all('SELECT * FROM api_tokens ORDER BY created_at DESC').map(toPublic);
}

/**
 * Soft-revoke a token. Throws a 404-tagged error when the id is unknown or the
 * token is already revoked.
 * @param {string} id
 * @param {{ actor: string }} ctx
 */
function revokeToken(id, { actor }) {
  const res = db.run("UPDATE api_tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL", id);
  if (Number(res.changes) === 0) {
    throw Object.assign(new Error('API token not found'), { status: 404 });
  }
  recordEvent({ actor, type: 'api-token-revoked', summary: 'Public API token revoked.', details: { tokenId: id } });
  logger.info('Revoked a read-only API token.', { tokenId: id, actor });
}

/**
 * Look a presented Bearer value up by hash and check it is live.
 * @param {unknown} plaintext
 * @returns {null | VerifiedApiToken | { ok: false, reason: 'revoked' | 'expired' }}
 */
function verifyToken(plaintext) {
  if (typeof plaintext !== 'string' || !plaintext) return null;
  const row = db.get('SELECT * FROM api_tokens WHERE token_hash = ?', hashToken(plaintext));
  if (!row) return null;
  if (row.revoked_at) return { ok: false, reason: 'revoked' };
  if (isExpired(row.expires_at)) return { ok: false, reason: 'expired' };
  const pub = toPublic(row);
  return { ok: true, token: pub, scope: pub.scope, permissions: pub.permissions };
}

/**
 * Record that a token was just used. Throttled to at most one write per minute
 * per token and swallows its own errors - a failed bookkeeping write must never
 * fail the request.
 * @param {string} id
 * @param {string | null} currentLastUsedAt  the value from the verified token
 */
function touchLastUsed(id, currentLastUsedAt) {
  if (currentLastUsedAt) {
    const age = Date.now() - sqlTimeToMs(currentLastUsedAt);
    if (Number.isFinite(age) && age < LAST_USED_THROTTLE_MS) return;
  }
  try {
    db.run("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?", id);
  } catch (err) {
    logger.debug('Could not update API token last-used timestamp.', {
      tokenId: id,
      err: serializeError(err, { includeStack: false }),
    });
  }
}

/**
 * @param {ApiTokenScope | null | undefined} scope
 * @param {string} serverId
 * @returns {boolean}
 */
function scopeAllowsServer(scope, serverId) {
  return Boolean(scope) && (scope.all || scope.serverIds.includes(serverId));
}

module.exports = {
  createToken,
  listTokens,
  revokeToken,
  verifyToken,
  touchLastUsed,
  scopeAllowsServer,
};
