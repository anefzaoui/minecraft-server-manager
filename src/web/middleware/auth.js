'use strict';

// Auth middleware: session gate, role checks, login rate limiting, and
// cross-site request protection (SameSite=Strict cookie + Origin check on
// state-changing requests - appropriate for a self-hosted LAN panel).

const authService = require('../../services/auth');
const config = require('../../config');
const logger = require('../../logger')('auth');

const PUBLIC_PREFIXES = ['/css/', '/js/', '/fonts/', '/icons/', '/vendor/'];
const PUBLIC_PATHS = new Set(['/login', '/setup', '/favicon.ico']);

// "username|ip" -> {count, until}. Keyed by IP too so one attacker cannot lock a
// victim's account out from anywhere, and bounded so a flood of unique keys can't
// grow it without limit.
const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 10 * 60 * 1000;
const MAX_TRACKED = 5000;

// Second, account-global counter keyed on the username alone, to blunt a
// DISTRIBUTED brute-force (many IPs, each staying under the per-IP budget above).
// Deliberately soft: a high threshold that a real user never reaches, a short
// cooldown, and (like the per-IP lock) no extension of an active lock - so the
// worst an attacker can inflict by spraying a known username is a rolling 5-min
// pause that clears the moment they stop. Real protection is still bcrypt cost +
// the per-IP lock; this just caps the aggregate guess rate.
const globalAttempts = new Map(); // "username" -> {count, until}
const GLOBAL_MAX_ATTEMPTS = 100;
const GLOBAL_LOCK_MS = 5 * 60 * 1000;

function attemptKey(username, ip) {
  return `${(username || '').toLowerCase()}|${ip || ''}`;
}

function globalKey(username) {
  return (username || '').toLowerCase();
}

function requireAuth(req, res, next) {
  const path = req.path;
  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return next();

  if (authService.firstRunNeeded()) {
    if (path.startsWith('/api/')) {
      logger.debug('Rejected an API request while first-run setup is incomplete.', { path });
      return res.status(401).json({ ok: false, error: 'Panel setup incomplete' });
    }
    return res.redirect('/setup');
  }
  if (req.session && req.session.userId) {
    const user = authService.getUser(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.user = user;
      return next();
    }
    logger.warn('Ignored a session whose user no longer exists.', { userId: req.session.userId });
  }
  if (path.startsWith('/api/') || path.startsWith('/ws/')) {
    logger.debug('Rejected an unauthenticated API request.', { path, ip: req.ip });
    return res.status(401).json({ ok: false, error: 'Not signed in' });
  }
  logger.debug('Redirected an unauthenticated visitor to the login page.', { path });
  return res.redirect(`/login${path !== '/' ? `?next=${encodeURIComponent(req.originalUrl)}` : ''}`);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn('Blocked an action the role does not allow.', {
        userId: req.user ? req.user.id : undefined,
        role: req.user ? req.user.role : undefined,
        path: req.path,
        method: req.method,
      });
      if (req.path.startsWith('/api/')) return res.status(403).json({ ok: false, error: 'Insufficient permissions' });
      return res
        .status(403)
        .render('error', { title: 'Forbidden', code: 403, message: 'Your role does not allow this.' });
    }
    next();
  };
}

/**
 * Block state-changing requests (anything but GET/HEAD/OPTIONS) from read-only
 * viewer accounts. Applied globally right after requireAuth so the documented
 * "viewer = read-only" contract is enforced by the backend, not just the UI.
 */
function requireWrite(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.user && req.user.role === 'viewer') {
    const verdict = viewerServerVerdict(req);
    if (verdict === 'allow') return next();
    if (verdict === 'hidden') {
      // The path names a server this viewer may not see: answer exactly like
      // a missing server so the refusal never confirms it exists.
      logger.debug('Hid a server the viewer may not view.', { userId: req.user.id, path: req.path });
      return res.status(404).json({ ok: false, error: 'Server not found' });
    }
    logger.warn('Blocked a write from a read-only viewer.', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ ok: false, error: 'Your role (Viewer) is read-only.' });
  }
  next();
}

// Server-scoped API paths where a viewer may hold a per-server grant. The
// global gate only opens for the ONE server named in the path, and only when
// the grant carries a capability beyond `view`; the route's own requireCap()
// then decides which action is allowed. Every other write stays a 403 for
// viewers, so panel-wide actions (create server, storage, users) never open up.
const SERVER_SCOPED = /^\/api\/servers\/([^/]+)(?:\/|$)/;
const BACKUP_SCOPED = /^\/api\/backups\/([^/]+)(?:\/|$)/;
// Writes that name their server in the body or via a row lookup rather than the
// path. Each of these routes carries its own per-server capability check; this
// list only decides whether a viewer reaches it at all.
const BODY_SCOPED = [
  { re: /^\/api\/schedules$/, id: (req) => req.body && req.body.serverId },
  {
    re: /^\/api\/schedules\/([^/]+)(?:\/|$)/,
    id: (req, m) => {
      const row = require('../../db').get('SELECT server_id FROM schedules WHERE id = ?', m[1]);
      return row ? row.server_id : null;
    },
  },
  { re: /^\/api\/worlds\/extract$/, id: (req) => req.body && req.body.serverId },
  { re: /^\/api\/worlds\/[^/]+\/install$/, id: (req) => req.body && req.body.serverId },
  { re: /^\/api\/blueprints\/export$/, id: (req) => req.body && req.body.serverId },
];

/** 'allow' | 'hidden' | 'deny' for a viewer's write, based on the server in the path or body. */
function viewerServerVerdict(req) {
  const permissions = require('../../services/permissions');
  let serverId = null;
  const m = SERVER_SCOPED.exec(req.path);
  if (m) serverId = m[1];
  else {
    const b = BACKUP_SCOPED.exec(req.path);
    if (b) serverId = require('./serverAccess').backupServerId({ params: { backupId: b[1] } });
    else {
      for (const entry of BODY_SCOPED) {
        const bm = entry.re.exec(req.path);
        if (!bm) continue;
        const id = entry.id(req, bm);
        serverId = typeof id === 'string' && id ? id : null;
        break;
      }
    }
  }
  if (!serverId || !require('../../services/servers').getServer(serverId)) return 'deny';
  const perms = permissions.effective(req.user, serverId);
  if (!perms.includes('view')) return 'hidden';
  return perms.some((c) => c !== 'view') ? 'allow' : 'deny';
}

/** Reject cross-origin state changes (defense in depth next to the SameSite cookie). */
function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  let originHost;
  try {
    const rawOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    if (!rawOrigin) {
      // Neither header present. With the default SameSite=lax/strict cookie the
      // browser already withholds the session on a cross-site write, so this is
      // a non-browser client (curl / a script) and is allowed. But SameSite=none
      // gives no such protection, so there this MUST be rejected - a browser
      // fetch/XHR always sends Origin on a POST anyway.
      if (config.cookieSameSite === 'none') {
        logger.warn('Rejected a state-changing request with no Origin header while SameSite is none.', {
          host: req.headers.host,
          path: req.path,
          method: req.method,
        });
        return res
          .status(403)
          .json({ ok: false, error: 'Cross-origin request rejected. An Origin header is required.' });
      }
      return next();
    }
    originHost = new URL(rawOrigin).host;
  } catch {
    // A malformed Origin/Referer on a state-changing request is not trustworthy.
    logger.warn('Rejected a state-changing request with a malformed Origin or Referer.', {
      host: req.headers.host,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ ok: false, error: 'Cross-origin request rejected.' });
  }
  if (originHost !== req.headers.host) {
    logger.warn('Rejected a cross-origin state-changing request.', {
      host: req.headers.host,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ ok: false, error: 'Cross-origin request rejected.' });
  }
  next();
}

function locked(entry, max) {
  return Boolean(entry && entry.count >= max && Date.now() < entry.until);
}

function checkLoginAllowed(username, ip) {
  const entry = loginAttempts.get(attemptKey(username, ip));
  const global = globalAttempts.get(globalKey(username));
  const until = Math.max(
    locked(entry, MAX_ATTEMPTS) ? entry.until : 0,
    locked(global, GLOBAL_MAX_ATTEMPTS) ? global.until : 0
  );
  if (until > Date.now()) {
    const mins = Math.ceil((until - Date.now()) / 60000);
    const err = new Error(`Too many failed attempts. Try again in ${mins} min.`);
    err.status = 429;
    throw err;
  }
}

function bump(map, key, lockMs, max) {
  const now = Date.now();
  const entry = map.get(key) || { count: 0, until: 0, windowStart: now };
  // Rolling window: once a lock has elapsed AND a full lock-period has passed
  // since counting began, forget the old failures. Without this `count` only
  // ever climbs, so after one burst reaches the threshold every later failure
  // re-arms the lock indefinitely - a permanent targeted lockout by a sprayer
  // doing one attempt per cooldown.
  if (now >= entry.until && now - entry.windowStart >= lockMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  const wasLocked = entry.count >= max && now < entry.until;
  entry.count += 1;
  // Do NOT extend an already-active lock - otherwise repeated attempts keep a
  // valid account locked forever (targeted-lockout DoS).
  if (now >= entry.until) entry.until = now + lockMs;
  map.set(key, entry);
  return !wasLocked && entry.count >= max && now < entry.until; // true = lock just tripped
}

/**
 * Record one failed attempt. Returns { lockedNow, scope } - scope is 'ip' or
 * 'account' when THIS failure is the one that crossed a threshold, so the caller
 * can write a single audit event (locks themselves live only in memory).
 */
function recordLoginFailure(username, ip) {
  // Bound memory: evict the oldest quarter if the map grows past the cap.
  if (loginAttempts.size >= MAX_TRACKED) {
    let toEvict = Math.floor(MAX_TRACKED / 4);
    for (const k of loginAttempts.keys()) {
      loginAttempts.delete(k);
      if (--toEvict <= 0) break;
    }
  }
  if (globalAttempts.size >= MAX_TRACKED) {
    let toEvict = Math.floor(MAX_TRACKED / 4);
    for (const k of globalAttempts.keys()) {
      globalAttempts.delete(k);
      if (--toEvict <= 0) break;
    }
  }
  const ipTripped = bump(loginAttempts, attemptKey(username, ip), LOCK_MS, MAX_ATTEMPTS);
  const acctTripped = bump(globalAttempts, globalKey(username), GLOBAL_LOCK_MS, GLOBAL_MAX_ATTEMPTS);
  return { lockedNow: ipTripped || acctTripped, scope: acctTripped ? 'account' : ipTripped ? 'ip' : null };
}

function clearLoginFailures(username, ip) {
  loginAttempts.delete(attemptKey(username, ip));
  globalAttempts.delete(globalKey(username));
}

/** Every lock that is active right now, newest-expiring last. Admin view only. */
function listActiveLockouts() {
  const now = Date.now();
  const out = [];
  for (const [key, entry] of loginAttempts) {
    if (!locked(entry, MAX_ATTEMPTS)) continue;
    const [username, ip] = key.split('|');
    out.push({
      scope: 'ip',
      username,
      ip,
      count: entry.count,
      until: entry.until,
      minutesLeft: Math.ceil((entry.until - now) / 60000),
    });
  }
  for (const [username, entry] of globalAttempts) {
    if (!locked(entry, GLOBAL_MAX_ATTEMPTS)) continue;
    out.push({
      scope: 'account',
      username,
      ip: null,
      count: entry.count,
      until: entry.until,
      minutesLeft: Math.ceil((entry.until - now) / 60000),
    });
  }
  return out.sort((a, b) => a.until - b.until);
}

/**
 * Admin unlock. { all: true } wipes every counter; otherwise clears the given
 * username's account-global lock plus its per-IP entry (all IPs when `ip` is
 * omitted). Returns the number of entries removed.
 * @param {{ username?: string, ip?: string, all?: boolean }} [opts]
 */
function clearLockouts({ username, ip, all = false } = {}) {
  if (all) {
    const n = loginAttempts.size + globalAttempts.size;
    loginAttempts.clear();
    globalAttempts.clear();
    return n;
  }
  const uname = (username || '').toLowerCase();
  let n = 0;
  if (globalAttempts.delete(uname)) n++;
  if (ip) {
    if (loginAttempts.delete(attemptKey(uname, ip))) n++;
  } else {
    for (const k of [...loginAttempts.keys()]) {
      if (k.startsWith(`${uname}|`) && loginAttempts.delete(k)) n++;
    }
  }
  return n;
}

/**
 * For the few side-effecting GETs (world-download staging, .mrpack build,
 * events export): originGuard exempts GET, and the SameSite=lax default means
 * a cross-site top-level navigation still carries the session cookie - so an
 * attacker page could trigger the server-side work. Browsers stamp such
 * navigations with Sec-Fetch-Site: cross-site; reject exactly that. Same-origin
 * clicks, bookmarks (none/same-origin), and non-browser clients (header absent)
 * all still work, and these stay plain GETs so res.download keeps working.
 */
function rejectCrossSiteGet(req, res, next) {
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    logger.warn('Blocked a cross-site navigation to a side-effecting GET.', {
      path: req.path,
      userId: req.user ? req.user.id : undefined,
    });
    return res.status(403).json({ ok: false, error: 'Cross-site request rejected.' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireRole,
  requireWrite,
  originGuard,
  rejectCrossSiteGet,
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
  listActiveLockouts,
  clearLockouts,
};
