'use strict';

// Public read-only API tokens (Bearer) for GET /api/v1. Admin-generated, scopable
// to all servers or a subset, revocable, optionally time-limited.
//
// Deliberately its OWN table + service (src/services/apiTokens.js), NOT the
// `api_keys` table - that one stores the panel's OUTBOUND CurseForge key.
//
//   - id prefix `pat_` (personal access token), matching usr_/srv_ (nanoid).
//   - only the sha256 hash of the secret is stored; the plaintext is shown once.
//   - `token_prefix` keeps the first 12 chars for display in the admin list.
//   - scope is a JSON id array, not a join table: it matches the `_json`
//     convention, the subset is small, and a token is meant to outlive a server
//     (a stale id just drops out because every read filters `deleted_at IS NULL`).
//   - revocation is a soft `revoked_at` timestamp so the audit trail and the
//     UNIQUE hash survive; expiry is `expires_at` compared to datetime('now').

function up(db) {
  db.exec(`
    CREATE TABLE api_tokens (
      id                    TEXT PRIMARY KEY,                 -- 'pat_' + nanoid(8)
      label                 TEXT NOT NULL,
      token_hash            TEXT NOT NULL UNIQUE,             -- sha256 hex of the full secret
      token_prefix          TEXT NOT NULL,                    -- first 12 chars of the secret, display only
      scope_all             INTEGER NOT NULL DEFAULT 0,       -- 1 = every server (present + future)
      scope_server_ids_json TEXT NOT NULL DEFAULT '[]',       -- subset when scope_all = 0
      permissions_json      TEXT NOT NULL DEFAULT '["read"]', -- future-proofing; only 'read' in v1
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      created_by            TEXT NOT NULL,                    -- admin username
      expires_at            TEXT,                             -- ISO-8601 UTC; NULL = never
      last_used_at          TEXT,                             -- throttled write (<= 1/min/token)
      revoked_at            TEXT                              -- non-NULL = revoked (soft delete)
    );
    CREATE INDEX idx_api_tokens_active ON api_tokens(revoked_at, expires_at);
  `);
}

module.exports = { up };
