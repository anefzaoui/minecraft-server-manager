'use strict';

// Auth middleware: session gate, role checks, login rate limiting, and
// cross-site request protection (SameSite=Strict cookie + Origin check on
// state-changing requests — appropriate for a self-hosted LAN panel).

const authService = require('../../services/auth');

const PUBLIC_PREFIXES = ['/css/', '/js/', '/fonts/', '/icons/', '/vendor/'];
const PUBLIC_PATHS = new Set(['/login', '/setup', '/favicon.ico']);

// "username|ip" -> {count, until}. Keyed by IP too so one attacker cannot lock a
// victim's account out from anywhere, and bounded so a flood of unique keys can't
// grow it without limit.
const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const LOCK_MS = 10 * 60 * 1000;
const MAX_TRACKED = 5000;

function attemptKey(username, ip) {
  return `${(username || '').toLowerCase()}|${ip || ''}`;
}

function requireAuth(req, res, next) {
  const path = req.path;
  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return next();

  if (authService.firstRunNeeded()) {
    if (path.startsWith('/api/')) return res.status(401).json({ ok: false, error: 'Panel setup incomplete' });
    return res.redirect('/setup');
  }
  if (req.session && req.session.userId) {
    const user = authService.getUser(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.user = user;
      return next();
    }
  }
  if (path.startsWith('/api/') || path.startsWith('/ws/')) {
    return res.status(401).json({ ok: false, error: 'Not signed in' });
  }
  return res.redirect(`/login${path !== '/' ? `?next=${encodeURIComponent(req.originalUrl)}` : ''}`);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
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
    return res.status(403).json({ ok: false, error: 'Your role (viewer) is read-only.' });
  }
  next();
}

/** Reject cross-origin state changes (defense in depth next to SameSite=Strict). */
function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  let originHost;
  try {
    const rawOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    if (!rawOrigin) return next(); // same-origin fetches may omit both; SameSite covers browsers
    originHost = new URL(rawOrigin).host;
  } catch {
    // A malformed Origin/Referer on a state-changing request is not trustworthy.
    return res.status(403).json({ ok: false, error: 'Cross-origin request rejected' });
  }
  if (originHost !== req.headers.host) {
    return res.status(403).json({ ok: false, error: 'Cross-origin request rejected' });
  }
  next();
}

function checkLoginAllowed(username, ip) {
  const entry = loginAttempts.get(attemptKey(username, ip));
  if (entry && entry.count >= MAX_ATTEMPTS && Date.now() < entry.until) {
    const mins = Math.ceil((entry.until - Date.now()) / 60000);
    const err = new Error(`Too many failed attempts — try again in ${mins} min`);
    err.status = 429;
    throw err;
  }
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
  const key = attemptKey(username, ip);
  const entry = loginAttempts.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  // Do NOT extend an already-active lock — otherwise repeated attempts keep a
  // valid account locked forever (targeted-lockout DoS).
  if (Date.now() >= entry.until) entry.until = Date.now() + LOCK_MS;
  loginAttempts.set(key, entry);
}

function clearLoginFailures(username, ip) {
  loginAttempts.delete(attemptKey(username, ip));
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
