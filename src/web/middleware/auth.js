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
    logger.warn('Blocked a write from a read-only viewer.', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ ok: false, error: 'Your role (Viewer) is read-only.' });
  }
  next();
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
        return res.status(403).json({ ok: false, error: 'Cross-origin request rejected (Origin header required)' });
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
    return res.status(403).json({ ok: false, error: 'Cross-origin request rejected' });
  }
  if (originHost !== req.headers.host) {
    logger.warn('Rejected a cross-origin state-changing request.', {
      host: req.headers.host,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({ ok: false, error: 'Cross-origin request rejected' });
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

function bump(map, key, lockMs) {
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
  entry.count += 1;
  // Do NOT extend an already-active lock - otherwise repeated attempts keep a
  // valid account locked forever (targeted-lockout DoS).
  if (now >= entry.until) entry.until = now + lockMs;
  map.set(key, entry);
}

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
  bump(loginAttempts, attemptKey(username, ip), LOCK_MS);
  bump(globalAttempts, globalKey(username), GLOBAL_LOCK_MS);
}

function clearLoginFailures(username, ip) {
  loginAttempts.delete(attemptKey(username, ip));
  globalAttempts.delete(globalKey(username));
}

module.exports = {
  requireAuth,
  requireRole,
  requireWrite,
  originGuard,
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
};
