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
// cascade on user delete. Server rows are kept across a soft delete on purpose:
// a server hidden from someone stays hidden in history and kept backups after
// it is removed.
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

/**
 * The capability catalog: label and one-line `help` (used in the editor and the
 * docs table), plus the detail the Permissions page explains below the matrix:
 * `covers` (what a person can do, in plain words), `excludes` (what people
 * expect but is a different capability), and `reach` (the exact API routes,
 * sockets, and pages the capability gates). `reach` is checked against the
 * live router stack by test/permissions-routes.test.js, so this text cannot
 * drift from what the middleware enforces. Patterns: `METHOD /path`,
 * `WRITES /prefix/*` (every state-changing method under a mount),
 * `ALL /prefix/*` (reads too).
 */
const CAPABILITY_INFO = {
  view: {
    label: 'View',
    help: 'See the server, its status, console output, players, history, and stats.',
    covers: [
      'See the server in the sidebar, dashboard, and every fleet-wide list (backups, worlds, schedules, activity, updates).',
      'Open every tab: overview, console output, players, mods, worlds, map, backups, history, live stats, settings (read-only).',
      'Watch the live console and stats over the panel sockets and open the live map.',
    ],
    excludes:
      'Any change. Without View the server does not exist for this user: every page, API call, and socket answers "not found".',
    reach: [
      'GET /api/servers/:id/*',
      'WS /ws/console/:id (watch)',
      'WS /ws/stats/:id',
      'GET /map/:id/*',
      'GET /servers/:id/* (pages)',
    ],
  },
  power: {
    label: 'Power',
    help: 'Start, stop, restart, kill, and rebuild the server.',
    covers: [
      'Start, stop, restart, and force stop the server from the header buttons.',
      'Rebuild the container to apply pending settings.',
      'Create, pause, and delete scheduled starts, stops, and restarts for this server.',
    ],
    excludes: 'Running console commands (Console), changing settings (Settings), deleting the server (Delete).',
    reach: [
      'POST /api/servers/:id/start',
      'POST /api/servers/:id/stop',
      'POST /api/servers/:id/restart',
      'POST /api/servers/:id/kill',
      'POST /api/servers/:id/recreate',
      'POST /api/schedules (restart, stop, start)',
    ],
  },
  console: {
    label: 'Console',
    help: 'Run console commands and world quick actions, send chat, and manage chat commands.',
    covers: [
      'Type commands into the console and use the quick-command chips.',
      'Send chat messages to players and use the world quick actions (time, weather, game rules).',
      'Create and edit custom chat commands.',
      'Schedule a console command for this server.',
    ],
    excludes:
      'Kicking, banning, and whitelisting through the Players tab (Players), even though the same could be typed as commands.',
    reach: [
      'WS /ws/console/:id (send commands)',
      'POST /api/servers/:id/chat',
      'POST /api/servers/:id/world/quick',
      'WRITES /api/servers/:id/chat-commands/*',
      'POST /api/schedules (rcon)',
    ],
  },
  players: {
    label: 'Players',
    help: 'Kick, ban, whitelist, op, and edit player notes.',
    covers: [
      'Kick, ban, pardon, whitelist, op, and teleport players from the roster.',
      'Write and delete notes on a player.',
      'Refresh player analytics from the logs.',
    ],
    excludes: 'Editing inventories (Content) and running arbitrary commands (Console).',
    reach: ['WRITES /api/servers/:id/players/*', 'WRITES /api/servers/:id/analytics/*'],
  },
  content: {
    label: 'Content',
    help: 'Install and remove mods, plugins, packs, worlds, datapacks, and edit inventories.',
    covers: [
      'Add, update, disable, and remove mods, plugins, and datapacks; import zips; check for updates.',
      'Install, upgrade, and roll back the managed modpack; export it as an .mrpack.',
      'Install, copy, download, delete, and shrink worlds on this server, and extract a world from it into the library.',
      'Edit player inventories and rebuild the item registry.',
    ],
    excludes: 'Editing raw files (Files), server settings such as versions and memory (Settings).',
    reach: [
      'POST /api/servers/:id/mods',
      'POST /api/servers/:id/mods/upload',
      'POST /api/servers/:id/mods/import-zip',
      'POST /api/servers/:id/mods/import-zip/preview',
      'POST /api/servers/:id/mods/update',
      'POST /api/servers/:id/mods/update-all',
      'POST /api/servers/:id/mods/ignore-update',
      'POST /api/servers/:id/mods/toggle',
      'DELETE /api/servers/:id/mods/:file',
      'POST /api/servers/:id/pack',
      'POST /api/servers/:id/pack/upgrade',
      'POST /api/servers/:id/pack/rollback',
      'POST /api/servers/:id/updates/check',
      'POST /api/servers/:id/pending-downloads/exclude',
      'WRITES /api/servers/:id/worlds/*',
      'GET /api/servers/:id/worlds/:world/download',
      'POST /api/servers/:id/worlds/:world/shrink',
      'GET /api/servers/:id/integrations/invite/modpack.mrpack',
      'WRITES /api/servers/:id/inventory/*',
      'WRITES /api/servers/:id/items/*',
      'POST /api/worlds/extract (this server as source)',
      'POST /api/worlds/:id/install (this server as target)',
    ],
  },
  backups: {
    label: 'Backups',
    help: 'Create, restore, download, and delete backups.',
    covers: [
      'Back up now, restore a backup, download, rename, and delete archives of this server.',
      'Schedule backups for this server.',
    ],
    excludes: 'Retention rules, which stay admin-only.',
    reach: [
      'POST /api/servers/:id/backups',
      'POST /api/servers/:id/backups/:backupId/restore',
      'GET /api/backups/:backupId/download',
      'PATCH /api/backups/:backupId',
      'DELETE /api/backups/:backupId',
      'POST /api/schedules (backup)',
    ],
  },
  files: {
    label: 'Files',
    help: 'Browse, edit, upload, and download server files, archived logs, and log bundles; export blueprints.',
    covers: [
      'Open the Files tab: browse, read, edit, upload, rename, and delete anything in the server folder, server.properties included.',
      'Download archived and game logs and the log bundle; export the history as a file.',
      'Share, delete, and mark crash reports.',
      'Export this server as a blueprint.',
    ],
    excludes: 'The panel-wide data folder (admin-only) and other servers’ files.',
    reach: [
      'ALL /api/servers/:id/files/*',
      'GET /api/servers/:id/logs/archived',
      'GET /api/servers/:id/logs/archived/:file',
      'GET /api/servers/:id/logs/game',
      'GET /api/servers/:id/logs/game/:file',
      'GET /api/servers/:id/logs/bundle.zip',
      'GET /api/servers/:id/events/export',
      'WRITES /api/servers/:id/crashes/*',
      'POST /api/blueprints/export (this server as source)',
    ],
  },
  settings: {
    label: 'Settings',
    help: 'Change server settings, properties, integrations, icon, and upgrade versions.',
    covers: [
      'Save the Configuration tab: name, description, tags, memory, CPU, quota, update policy, environment, and server.properties.',
      'Upgrade the Minecraft version or the container image, set the icon and the console label, turn the live map on or off.',
      'Configure Discord, the public status page, and invites.',
    ],
    excludes:
      'Advanced Docker overrides and the chatbot, which stay admin-only. Rebuilding the container after a change (Power).',
    reach: [
      'PATCH /api/servers/:id',
      'PUT /api/servers/:id/console-label',
      'POST /api/servers/:id/icon',
      'POST /api/servers/:id/image/upgrade',
      'POST /api/servers/:id/mcversion/upgrade',
      'POST /api/servers/:id/map/enable',
      'POST /api/servers/:id/map/disable',
      'WRITES /api/servers/:id/integrations/*',
    ],
  },
  delete: {
    label: 'Delete',
    help: 'Delete the server.',
    covers: ['Remove the server from the panel, optionally with its files and backups.'],
    excludes: 'Creating or cloning servers, which follow the global role.',
    reach: ['DELETE /api/servers/:id'],
  },
};

/** @type {Set<string>} */
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
  /** @type {Set<string>} */
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
  const row = db.get('SELECT perms FROM user_server_permissions WHERE user_id = ? AND server_id = ?', userId, serverId);
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
 * Ids of every server the user may see, as a Set. Soft-deleted servers are
 * included (their history and kept backups stay visible to anyone whose default
 * includes view), so the set is safe to apply to events and backups as well as
 * to live server lists. Admins and users with no grant rows short-circuit to
 * "all" so the fleet-wide pages pay nothing for the common case.
 * @param {{ id: string, role: string } | null | undefined} user
 * @returns {Set<string>}
 */
function visibleServerIds(user) {
  const all = new Set(db.all('SELECT id FROM servers').map((r) => r.id));
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
 * The full matrix for the Permissions page: every non-admin user × every live
 * server, with the explicit grant (or null = role default) and the effective
 * capability list already resolved.
 */
function listMatrix() {
  const users = db
    .all("SELECT id, username, role FROM users WHERE role != 'admin' ORDER BY username COLLATE NOCASE")
    .map((u) => ({ id: u.id, username: u.username, role: u.role }));
  const servers = db
    .all(
      'SELECT id, display_name, icon, accent FROM servers WHERE deleted_at IS NULL ORDER BY display_name COLLATE NOCASE'
    )
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

/**
 * Event types only admins may read in listings and exports. Grant changes are
 * recorded against the server they concern, but who may do what is admin
 * business, not something every viewer of that server should see.
 * @param {{ id: string, role: string } | null | undefined} user
 * @returns {string[]}
 */
function hiddenEventTypes(user) {
  return user && user.role === 'admin' ? [] : ['permissions-changed'];
}

/**
 * True when at least one server is hidden from the user. Callers use it to
 * skip per-row visibility work for the common case where nothing is hidden.
 * @param {{ id: string, role: string } | null | undefined} user
 * @param {Set<string>} [visible] a `visibleServerIds(user)` result, if already computed
 */
function hidesAnyServer(user, visible = visibleServerIds(user)) {
  if (!user) return true;
  if (user.role === 'admin') return false;
  return visible.size < db.get('SELECT COUNT(*) AS n FROM servers').n;
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
  listMatrix,
  setGrant,
  hiddenEventTypes,
  hidesAnyServer,
};
