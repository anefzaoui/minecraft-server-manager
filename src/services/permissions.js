'use strict';

// Per-server permissions. Answers one question everywhere: "may this user do
// CAP on server X?"
//
// Model (see docs/users-and-roles.md):
//   - The global role is the default on every server: admin and operator hold
//     every capability, viewer holds `view` only. An admin is never overridden.
//   - A row in `user_server_permissions` replaces that default for one
//     (user, server) pair. Its `perms` column is a JSON array of capability
//     names; `[]` means the server is hidden from that user entirely.
//   - Every capability implies `view` - you cannot act on what you cannot see.
//
// Storage is the `user_server_permissions` table created in migration 001
// (dormant until this module): PRIMARY KEY (user_id, server_id), user rows
// cascade on user delete, server rows are filtered through `deleted_at IS NULL`
// on read and pruned by `forgetServer()` on hard delete.
//
// Panel-wide actions (creating servers, storage, users, global settings) are
// NOT covered here - those stay on the global role, see web/middleware/auth.js.

const db = require('../db');
const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');
const logger = require('../logger')(require('node:path').basename(__filename));

/** @typedef {'view'|'power'|'console'|'players'|'content'|'backups'|'files'|'settings'|'delete'} Capability */

/** Every capability, in display order. Order matters for the UI and for `normalize()`. */
const CAPABILITIES = /** @type {const} */ ([
  'view',
  'power',
  'console',
  'players',
  'content',
  'backups',
  'files',
  'settings',
  'delete',
]);

/** Human labels + one-line help for the Permissions page and the docs. */
const CAPABILITY_INFO = {
  view: { label: 'View', help: 'See the server, its status, console output, players, history, and stats.' },
  power: { label: 'Power', help: 'Start, stop, restart, kill, and rebuild the server.' },
  console: { label: 'Console', help: 'Run console commands, send chat, and manage chat commands.' },
  players: { label: 'Players', help: 'Kick, ban, whitelist, op, and edit player notes.' },
  content: { label: 'Content', help: 'Install and remove mods, plugins, packs, worlds, datapacks, and edit inventories.' },
  backups: { label: 'Backups', help: 'Create, restore, download, and delete backups.' },
  files: { label: 'Files', help: 'Browse, edit, upload, and download server files and log bundles.' },
  settings: { label: 'Settings', help: 'Change server settings, properties, integrations, icon, and upgrade versions.' },
  delete: { label: 'Delete', help: 'Delete the server.' },
};

const CAP_SET = new Set(CAPABILITIES);
const ALL = /** @type {Capability[]} */ ([...CAPABILITIES]);

/** Global-role defaults. Admin is handled before this is consulted. */
const ROLE_DEFAULTS = Object.freeze({
  admin: ALL,
  operator: ALL,
  viewer: /** @type {Capability[]} */ (['view']),
});

/**
 * Canonical form of a capability list: known names only, deduplicated, in
 * catalog order, and `view` implied by any other capability. Throws 400 on an
 * unknown name so a typo in an API call can never be silently stored.
 * @param {unknown} input
 * @returns {Capability[]}
 */
function normalize(input) {
  if (!Array.isArray(input)) throw httpError(400, 'Permissions must be a list of capability names.');
  const set = new Set();
  for (const raw of input) {
    const cap = String(raw);
    if (!CAP_SET.has(cap)) throw httpError(400, `Unknown permission "${cap}".`);
    set.add(cap);
  }
  if (set.size > 0) set.add('view');
  return CAPABILITIES.filter((c) => set.has(c));
}

/** Parse a stored `perms` cell defensively (the column predates this module). */
function parseStored(text) {
  if (text == null) return null;
  const s = String(text).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return CAPABILITIES.filter((c) => parsed.includes(c));
  } catch {
    // Not JSON - fall through to the legacy comma form.
  }
  const parts = s.split(',').map((p) => p.trim());
  return CAPABILITIES.filter((c) => parts.includes(c));
}

/** @param {{ id: string, role: string } | null | undefined} user */
function roleDefault(user) {
  return ROLE_DEFAULTS[user && user.role] || [];
}

/**
 * The explicit grant row for one pair, or null when the role default applies.
 * @returns {Capability[] | null}
 */
function getGrant(userId, serverId) {
  const row = db.get(
    'SELECT perms FROM user_server_permissions WHERE user_id = ? AND server_id = ?',
    userId,
    serverId
  );
  if (!row) return null;
  const parsed = parseStored(row.perms);
  return parsed && parsed.length ? normalize(parsed) : [];
}

/**
 * Effective capabilities for a user on one server.
 * @param {{ id: string, role: string } | null | undefined} user
 * @param {string} serverId
 * @returns {Capability[]}
 */
function effective(user, serverId) {
  if (!user) return [];
  if (user.role === 'admin') return ALL;
  const grant = getGrant(user.id, serverId);
  return grant === null ? roleDefault(user) : grant;
}

/**
 * @param {{ id: string, role: string } | null | undefined} user
 * @param {string} serverId
 * @param {Capability} cap
 */
function can(user, serverId, cap) {
  if (!CAP_SET.has(cap)) throw new Error(`Unknown capability: ${cap}`);
  return effective(user, serverId).includes(cap);
}

/**
 * Ids of every live server the user may see, as a Set. Admins and users with
 * no grant rows short-circuit to "all" so the fleet-wide pages pay nothing for
 * the common case.
 * @param {{ id: string, role: string } | null | undefined} user
 * @returns {Set<string>}
 */
function visibleServerIds(user) {
  const all = new Set(db.all('SELECT id FROM servers WHERE deleted_at IS NULL').map((r) => r.id));
  if (!user) return new Set();
  if (user.role === 'admin') return all;
  const rows = db.all('SELECT server_id, perms FROM user_server_permissions WHERE user_id = ?', user.id);
  const defaultSees = roleDefault(user).includes('view');
  if (rows.length === 0) return defaultSees ? all : new Set();
  const overridden = new Map(rows.map((r) => [r.server_id, parseStored(r.perms) || []]));
  const out = new Set();
  for (const id of all) {
    const grant = overridden.get(id);
    if (grant === undefined ? defaultSees : grant.length > 0) out.add(id);
  }
  return out;
}

/**
 * Filter any array of server-ish rows (`id` field) to the ones the user may see.
 * @template {{ id: string }} T
 * @param {{ id: string, role: string } | null | undefined} user
 * @param {T[]} rows
 * @returns {T[]}
 */
function filterVisible(user, rows) {
  if (user && user.role === 'admin') return rows;
  const ids = visibleServerIds(user);
  return rows.filter((r) => ids.has(r.id));
}

/**
 * True when the user holds at least one capability beyond `view` on ANY live
 * server - i.e. the global write gate must let them through to the per-route
 * checks. Cheap (one indexed query) and only consulted for viewers.
 * @param {{ id: string, role: string } | null | undefined} user
 */
function hasAnyGrantBeyondView(user) {
  if (!user) return false;
  const rows = db.all(
    `SELECT p.perms FROM user_server_permissions p
       JOIN servers s ON s.id = p.server_id AND s.deleted_at IS NULL
      WHERE p.user_id = ?`,
    user.id
  );
  return rows.some((r) => (parseStored(r.perms) || []).some((c) => c !== 'view'));
}

/**
 * The full matrix for the Permissions page: every non-admin user × every live
 * server, with the explicit grant (or null = role default) and the effective
 * capability list already resolved.
 */
function listMatrix() {
  const users = db
    .all("SELECT id, username, role FROM users WHERE role != 'admin' ORDER BY username COLLATE NOCASE")
    .map((u) => ({ id: u.id, username: u.username, role: u.role }));
  const servers = db
    .all('SELECT id, display_name, icon, accent FROM servers WHERE deleted_at IS NULL ORDER BY display_name COLLATE NOCASE')
    .map((s) => ({ id: s.id, name: s.display_name, icon: s.icon, accent: s.accent }));
  const grants = new Map(
    db
      .all('SELECT user_id, server_id, perms FROM user_server_permissions')
      .map((r) => [`${r.user_id}|${r.server_id}`, parseStored(r.perms) || []])
  );
  const cells = users.map((u) => ({
    user: u,
    roleDefault: roleDefault(u),
    servers: servers.map((s) => {
      const grant = grants.get(`${u.id}|${s.id}`);
      return {
        serverId: s.id,
        grant: grant === undefined ? null : grant,
        effective: grant === undefined ? roleDefault(u) : grant,
      };
    }),
  }));
  return { capabilities: CAPABILITIES.map((c) => ({ key: c, ...CAPABILITY_INFO[c] })), users, servers, rows: cells };
}

/**
 * Set (or with `perms === null`, clear) the explicit grant for one pair.
 * @param {string} userId
 * @param {string} serverId
 * @param {unknown} perms  capability list, `[]` = hidden, `null` = use role default
 * @param {{ actor?: string }} [opts]
 * @returns {{ grant: Capability[] | null, effective: Capability[] }}
 */
function setGrant(userId, serverId, perms, { actor = 'system' } = {}) {
  const user = db.get('SELECT id, username, role FROM users WHERE id = ?', userId);
  if (!user) throw httpError(404, 'That user no longer exists.');
  if (user.role === 'admin') throw httpError(409, 'Admins always have every permission. Change their role first.');
  const server = db.get('SELECT id, display_name FROM servers WHERE id = ? AND deleted_at IS NULL', serverId);
  if (!server) throw httpError(404, 'That server no longer exists.');

  if (perms === null) {
    db.run('DELETE FROM user_server_permissions WHERE user_id = ? AND server_id = ?', userId, serverId);
    recordEvent({
      serverId,
      actor,
      type: 'permissions-changed',
      summary: `Permissions for ${user.username} on ${server.display_name} reset to the ${user.role} default.`,
      details: { userId, serverId, grant: null },
    });
    logger.info('Cleared a per-server permission grant.', { userId, serverId, actor });
    return { grant: null, effective: roleDefault(user) };
  }

  const list = normalize(perms);
  db.run(
    `INSERT INTO user_server_permissions (user_id, server_id, perms) VALUES (?, ?, ?)
       ON CONFLICT(user_id, server_id) DO UPDATE SET perms = excluded.perms`,
    userId,
    serverId,
    JSON.stringify(list)
  );
  recordEvent({
    serverId,
    actor,
    type: 'permissions-changed',
    summary: list.length
      ? `Permissions for ${user.username} on ${server.display_name} set to ${list.join(', ')}.`
      : `${server.display_name} hidden from ${user.username}.`,
    details: { userId, serverId, grant: list },
  });
  logger.info('Set a per-server permission grant.', { userId, serverId, count: list.length, actor });
  return { grant: list, effective: list };
}

/** Drop every grant row for a server that is being removed for good. */
function forgetServer(serverId) {
  db.run('DELETE FROM user_server_permissions WHERE server_id = ?', serverId);
}

module.exports = {
  CAPABILITIES,
  CAPABILITY_INFO,
  ROLE_DEFAULTS,
  normalize,
  getGrant,
  effective,
  can,
  visibleServerIds,
  filterVisible,
  hasAnyGrantBeyondView,
  listMatrix,
  setGrant,
  forgetServer,
};
