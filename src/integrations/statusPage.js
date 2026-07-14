'use strict';

// Public status page config (MP9). Opt-in per server; the slug is the only
// thing exposed publicly, stored in plain config_json (nothing secret here).

const httpError = require('../utils/httpError');
const db = require('../db');

const KIND = 'status-page';
const SLUG_RE = /^[a-z0-9-]{3,40}$/;

function getStatusPage(serverId) {
  const r = db.get('SELECT * FROM integrations WHERE server_id = ? AND kind = ?', serverId, KIND);
  const cfg = r ? JSON.parse(r.config_json || '{}') : {};
  return {
    enabled: Boolean(r && r.enabled),
    slug: cfg.slug || null,
    path: cfg.slug ? `/status/${cfg.slug}` : null,
  };
}

function setStatusPage(serverId, { enabled, slug }) {
  // Disabling never needs a slug — keep the stored one so re-enabling
  // restores the same address.
  if (!enabled && !slug) {
    const existing = getStatusPage(serverId);
    db.run(
      `INSERT INTO integrations (server_id, kind, enabled, config_json, updated_at)
       VALUES (?, ?, 0, ?, datetime('now'))
       ON CONFLICT(server_id, kind) DO UPDATE SET enabled = 0, updated_at = excluded.updated_at`,
      serverId,
      KIND,
      JSON.stringify({ slug: existing.slug || null })
    );
    return getStatusPage(serverId);
  }
  if (!SLUG_RE.test(slug)) throw httpError(400, 'Slug must be 3–40 chars of lowercase letters, digits, or dashes');
  const clash = db
    .all('SELECT server_id, config_json FROM integrations WHERE kind = ?', KIND)
    .find((r) => r.server_id !== serverId && JSON.parse(r.config_json || '{}').slug === slug);
  if (clash) throw httpError(409, `The slug "${slug}" is already used by another server`);

  db.run(
    `INSERT INTO integrations (server_id, kind, enabled, config_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(server_id, kind) DO UPDATE SET
       enabled = excluded.enabled, config_json = excluded.config_json, updated_at = excluded.updated_at`,
    serverId,
    KIND,
    enabled ? 1 : 0,
    JSON.stringify({ slug })
  );
  return getStatusPage(serverId);
}

/** Resolve an ENABLED status page by slug → server_id, or null. */
function findBySlug(slug) {
  if (!SLUG_RE.test(String(slug))) return null;
  const r = db
    .all('SELECT server_id, config_json FROM integrations WHERE kind = ? AND enabled = 1', KIND)
    .find((row) => JSON.parse(row.config_json || '{}').slug === slug);
  return r ? r.server_id : null;
}

module.exports = { getStatusPage, setStatusPage, findBySlug, SLUG_RE };
