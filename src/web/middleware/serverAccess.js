'use strict';

// Per-server permission gates. Two pieces:
//
//   serverScope        - mounted on every `/servers/:id` prefix (API and pages).
//                        Resolves the user's effective capabilities on that
//                        server once per request (req.serverPerms), and turns a
//                        server the user may not `view` into a plain 404 so a
//                        hidden server is indistinguishable from a missing one.
//   requireCap(cap)    - per-route check. 403 with the capability named when
//                        the user can see the server but lacks the bit.
//
// Admins short-circuit inside services/permissions.js. Paths whose `:id`
// segment is not a live server (e.g. /api/servers/live, /servers/new) pass
// straight through so the static routes behind them keep working.
//
// A structural test (test/permissions-routes.test.js) walks the router stacks
// and fails if any non-GET route under /servers/:id lacks a requireCap layer,
// so a new endpoint cannot ship unguarded by accident.

const db = require('../../db');
const permissions = require('../../services/permissions');
const logger = require('../../logger')('server-access');

const CAP_LABEL = Object.fromEntries(
  Object.entries(permissions.CAPABILITY_INFO).map(([k, v]) => [k, v.label.toLowerCase()])
);

function wantsJson(req) {
  return req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/ws/');
}

function notFound(req, res) {
  if (wantsJson(req)) return res.status(404).json({ ok: false, error: 'Server not found' });
  return res.status(404).render('error', { title: 'Not found', code: 404, message: 'That page does not exist.' });
}

function forbidden(req, res, cap) {
  const message = `You don't have the ${CAP_LABEL[cap] || cap} permission on this server.`;
  if (wantsJson(req)) return res.status(403).json({ ok: false, error: message });
  return res.status(403).render('error', { title: 'Forbidden', code: 403, message });
}

/** Effective capability list for this request's server, memoised on req. */
function permsFor(req, serverId) {
  if (req.serverPerms && req.serverPermsId === serverId) return req.serverPerms;
  const perms = permissions.effective(req.user, serverId);
  req.serverPerms = perms;
  req.serverPermsId = serverId;
  return perms;
}

/** `{ view: true, power: false, … }` for templates and client code. */
function permsObject(list) {
  const out = {};
  for (const c of permissions.CAPABILITIES) out[c] = list.includes(c);
  return out;
}

/**
 * Prefix middleware for `/servers/:id`. Skips ids that are not live servers.
 * @param {import('express').Request & { user?: any }} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function serverScope(req, res, next) {
  const serverId = req.params && req.params.id;
  if (!serverId) return next();
  // Existence only: the route fetches and parses the row itself.
  if (!db.get('SELECT 1 AS x FROM servers WHERE id = ? AND deleted_at IS NULL', serverId)) return next();
  const perms = permsFor(req, serverId);
  if (!perms.includes('view')) {
    logger.debug('Hid a server the user may not view.', { userId: req.user && req.user.id, serverId });
    return notFound(req, res);
  }
  res.locals.perms = permsObject(perms);
  next();
}

/**
 * Route middleware requiring one capability on the request's server.
 * @param {import('../../services/permissions').Capability} cap
 * @param {{ resolve?: (req: any) => string | null | undefined }} [opts]
 *   `resolve` derives the server id when it is not `req.params.id` (e.g. a
 *   backup id → its server). Returning a falsy id yields a 404.
 */
function requireCap(cap, { resolve } = {}) {
  if (!permissions.CAPABILITIES.includes(cap)) throw new Error(`Unknown capability: ${cap}`);
  const mw = (req, res, next) => {
    const serverId = resolve ? resolve(req) : req.params && req.params.id;
    if (!serverId) {
      // The target (e.g. a backup id) does not exist, so there is no server to
      // resolve against. Keep the pre-permissions contract: admins reach the
      // route (which answers 404 or idempotently), a role whose default lacks
      // the capability is refused outright, anyone else sees "not found".
      if (req.user && req.user.role === 'admin') return next();
      const roleCaps = permissions.ROLE_DEFAULTS[req.user && req.user.role] || [];
      if (!roleCaps.includes(cap)) return forbidden(req, res, cap);
      return notFound(req, res);
    }
    const perms = permsFor(req, serverId);
    if (!perms.includes('view')) {
      logger.debug('Hid a server the user may not view.', { userId: req.user && req.user.id, serverId, cap });
      return notFound(req, res);
    }
    if (!perms.includes(cap)) {
      logger.warn('Blocked an action the user lacks the permission for.', {
        userId: req.user && req.user.id,
        serverId,
        cap,
        path: req.originalUrl.split('?')[0],
        method: req.method,
      });
      return forbidden(req, res, cap);
    }
    res.locals.perms = permsObject(perms);
    next();
  };
  // Named so the structural route test can find it on the router stack.
  Object.defineProperty(mw, 'name', { value: `requireCap_${cap}` });
  mw.capability = cap;
  return mw;
}

/**
 * Like requireCap but only for state-changing methods; GETs fall through to
 * the surrounding serverScope (`view`). For nested routers that mix reads and
 * writes under one mount.
 * @param {import('../../services/permissions').Capability} cap
 */
function requireCapForWrites(cap) {
  const inner = requireCap(cap);
  const mw = (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    return inner(req, res, next);
  };
  Object.defineProperty(mw, 'name', { value: `requireCap_${cap}` });
  mw.capability = cap;
  mw.writesOnly = true;
  return mw;
}

/** Server id behind a backup id, for the `/backups/:backupId` routes. */
function backupServerId(req) {
  const row = db.get('SELECT server_id FROM backups WHERE id = ?', req.params.backupId);
  return row ? row.server_id : null;
}

module.exports = { serverScope, requireCap, requireCapForWrites, backupServerId, permsObject };
