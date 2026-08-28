'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { engine } = require('express-handlebars');

const config = require('../config');
const routes = require('./routes');
const { icon } = require('./icons');
const { avatarSrc } = require('../config/avatars');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const logger = require('../logger')('web');
const { captureError } = require('../instrument');
const { serializeError } = require('../utils/logSanitize');

function markdown(text) {
  if (!text) return '';
  return sanitizeHtml(marked.parse(String(text), { async: false }), {
    allowedTags: ['p', 'b', 'strong', 'i', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'br', 'blockquote', 'h3', 'h4'],
    allowedAttributes: { a: ['href', 'rel', 'target'] },
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener', target: '_blank' }) },
  });
}

const STATUS_META = {
  running: { label: 'Running', color: 'grass', pulse: true },
  starting: { label: 'Starting', color: 'gold', pulse: true },
  stalled: { label: 'Stalled', color: 'redstone', pulse: false },
  unhealthy: { label: 'Unhealthy', color: 'gold', pulse: true },
  updating: { label: 'Updating', color: 'diamond', pulse: true },
  stopped: { label: 'Stopped', color: 'stone', pulse: false },
  crashed: { label: 'Crashed', color: 'redstone', pulse: false },
  'over-quota': { label: 'Over quota', color: 'redstone', pulse: false },
};
const STATUS_TEXT = {
  grass: 'text-ok',
  gold: 'text-warn',
  diamond: 'text-link',
  redstone: 'text-danger',
  stone: 'text-ink-faint',
};
// Full literal classes on purpose: Tailwind's scanner only generates utilities
// it can see verbatim in source. Assembling `bg-${color}-500` in a template
// produces a class the build never emits (bg-gold-500 was missing for exactly
// this reason, rendering the Starting/Unhealthy dot invisible).
const STATUS_DOT = {
  grass: 'bg-grass-500',
  gold: 'bg-gold-500',
  diamond: 'bg-diamond-500',
  redstone: 'bg-redstone-500',
  stone: 'bg-stone-500',
};

// The 8 icons bundled in public/icons/servers - original pixel-art SVGs drawn
// specifically for server identity (block/world motifs), deliberately distinct
// artwork from the profile-picture presets (config/avatars.js) even where the
// concept overlaps (diamond, chest, sword, potion, TNT). Icon names are free
// text in the schemas, so anything unknown falls back to grass instead of a
// broken image.
const BUNDLED_ICONS = new Set(['chest', 'creeper', 'diamond', 'grass', 'portal', 'potion', 'sword', 'tnt']);

function iconSrc(name) {
  if (typeof name === 'string' && name.startsWith('custom:')) {
    return `/api/icons/custom/${encodeURIComponent(name.slice('custom:'.length))}`;
  }
  return `/icons/servers/${BUNDLED_ICONS.has(name) ? name : 'grass'}.svg`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!Number.isFinite(bytes)) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log2(Math.abs(bytes)) / 10), units.length - 1);
  const value = bytes / 2 ** (10 * i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

// Serialize a value for embedding inside a <script> island. JSON.stringify does
// NOT escape <, >, & or the JS line separators U+2028/U+2029, so a string field
// containing "</script>" would break out of the tag (stored XSS). Escape those
// code points to \uXXXX - still valid JSON and valid JS.
function jsonForScript(v) {
  return (JSON.stringify(v) ?? 'null').replace(
    /[<>&\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
}

function createApp() {
  const app = express();

  // Package version, exposed to every template (footer) so it never goes stale.
  app.locals.appVersion = require('../../package.json').version;

  // Behind a TLS-terminating reverse proxy, trust the configured hops so req.ip
  // (login rate-limiting) and secure-cookie 'auto' see the real client + scheme.
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

  app.use(require('./middleware/securityHeaders').securityHeaders);

  app.engine(
    'hbs',
    engine({
      extname: '.hbs',
      defaultLayout: 'main',
      layoutsDir: path.join(config.root, 'views', 'layouts'),
      partialsDir: path.join(config.root, 'views', 'partials'),
      helpers: {
        icon,
        markdown,
        eq: (a, b) => a === b,
        startsWith: (s, p) => typeof s === 'string' && s.startsWith(p),
        ne: (a, b) => a !== b,
        gt: (a, b) => a > b,
        and: (a, b) => a && b,
        or: (a, b) => a || b,
        not: (a) => !a,
        json: jsonForScript,
        urlq: (s) => encodeURIComponent(s ?? ''),
        iconSrc,
        avatarSrc,
        bytes: formatBytes,
        pct: (used, total) => (total ? Math.min(100, Math.round((used / total) * 100)) : 0),
        statusLabel: (s) => (STATUS_META[s] || STATUS_META.stopped).label,
        statusDot: (s) => STATUS_DOT[(STATUS_META[s] || STATUS_META.stopped).color],
        statusPulse: (s) => (STATUS_META[s] || STATUS_META.stopped).pulse,
        // Status *text* goes through the theme-aware semantic tokens (the raw
        // 400-step palette classes fail contrast on the light canvas).
        statusText: (s) => STATUS_TEXT[(STATUS_META[s] || STATUS_META.stopped).color],
        // Quota bar color by usage percentage against the configured thresholds.
        meterColor: (used, total) => {
          if (!total) return 'bg-diamond-400';
          const p = (used / total) * 100;
          if (p >= config.defaults.quotaCriticalPct) return 'bg-redstone-500';
          if (p >= config.defaults.quotaWarnPct) return 'bg-gold-400';
          return 'bg-grass-500';
        },
        capitalize: (s) => (typeof s === 'string' && s ? s[0].toUpperCase() + s.slice(1) : s),
        initial: (s) => (typeof s === 'string' && s ? s[0].toUpperCase() : '?'),
        default: (v, fallback) => (v === undefined || v === null || v === '' ? fallback : v),
        concat: (...args) => args.slice(0, -1).join(''),
        inc: (v) => Number(v) + 1,
        mul: (a, b) => Number(a) * Number(b),
        plural: (n, one, many) => (Number(n) === 1 ? one : many),
        platformName: (p) =>
          ({ modrinth: 'Modrinth', curseforge: 'CurseForge', gtnh: 'GT New Horizons', ftb: 'FTB' })[p] || p,
        // Handlebars {{#if}} treats 0 as falsy, which silently drops min="0"
        // attributes and zero defaults - this helper exists for those tests.
        isDefined: (v) => v !== undefined && v !== null && v !== '',
      },
    })
  );
  app.set('view engine', 'hbs');
  app.set('views', path.join(config.root, 'views'));

  // Default: force a revalidation round-trip (still 304s when nothing changed -
  // this isn't `no-store`) so a new deploy of an HTML page or an API change is
  // visible on the very next request, no matter what a browser or reverse proxy
  // (Pangolin, NGINX, Traefik…) would otherwise decide on its own. express.static
  // below overrides this for the asset classes it serves.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    next();
  });
  // Static assets opt out of the blanket revalidation:
  //  - fonts + the pixel-art icon sets (icons/mc-items alone is ~1500 PNGs /
  //    9.5 MB) are content-stable - their bytes never change without a new
  //    filename - so cache them hard and skip the conditional-GET storm those
  //    directories otherwise trigger on every page load.
  //  - app-owned css/js still only gets a 1-hour max-age (not `immutable`), so a
  //    deploy is picked up within the hour even before the hashed-bundle step.
  const ONE_YEAR = 31536000;

  // Serve the minified esbuild bundles from public/dist/js in place of the raw
  // /js/**.js source when a build exists (see scripts/build-js.js). No build
  // (fresh `pnpm start`, or `pnpm dev`) -> this falls straight through to the
  // raw source below, so nothing breaks without a build step.
  const DIST_JS_DIR = path.join(config.root, 'public', 'dist', 'js');
  const hasJsBundle = fs.existsSync(DIST_JS_DIR);
  if (hasJsBundle) {
    app.use('/js', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const rel = decodeURIComponent(req.path.replace(/^\/+/, ''));
      if (!rel.endsWith('.js') || rel.includes('..') || rel.includes('\0')) return next();
      const built = path.join(DIST_JS_DIR, rel);
      if (!built.startsWith(DIST_JS_DIR + path.sep)) return next();
      fs.access(built, fs.constants.R_OK, (err) => {
        if (err) return next();
        res.type('application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(built);
      });
    });
  }

  // Static assets opt out of the blanket revalidation:
  //  - fonts + the pixel-art icon sets (icons/mc-items alone is ~1500 PNGs /
  //    9.5 MB) are content-stable - their bytes never change without a new
  //    filename - so cache them hard and skip the conditional-GET storm those
  //    directories otherwise trigger on every page load.
  //  - app-owned css/js still only gets a 1-hour max-age (not `immutable`), so a
  //    deploy is picked up within the hour even before the hashed-bundle step.
  app.use(
    express.static(path.join(config.root, 'public'), {
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (/[\\/](fonts|icons)[\\/]/.test(filePath)) {
          res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
        }
      },
    })
  );
  // Explicit body-size cap. 256 kb comfortably covers every JSON/form payload
  // the panel sends; upload paths use multer, not these. The one exception is
  // the 2 MB text-file editor - skip the global JSON parser for it so its own
  // 3 MB parser (routes/files.js) reads the body instead of this one rejecting
  // it first.
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  const jsonParser = express.json({ limit: '256kb' });
  app.use((req, res, next) => {
    if (req.method === 'POST' && /\/files\/write$/.test(req.path)) return next();
    jsonParser(req, res, next);
  });

  // Access log: one line per request on `res` finish (static assets + /healthz
  // skipped). Placed after trust-proxy so req.ip is right, and it reads req.user
  // set later by requireAuth by the time 'finish' fires.
  app.use(require('./middleware/requestLog'));

  // Unauthenticated liveness/readiness probe for uptime monitors and
  // orchestrators. Exposes nothing - just whether the process is up and the
  // database is answering (the version string is deliberately not published
  // here; it's available to any signed-in user in the footer).
  app.get('/healthz', (req, res) => {
    try {
      require('../db').get('SELECT 1');
      res.json({ ok: true });
    } catch (err) {
      logger.warn('The health check could not reach the database.', {
        err: serializeError(err, { includeStack: false }),
      });
      res.status(503).json({ ok: false, error: 'database unavailable' });
    }
  });

  const session = require('express-session');
  const { SqliteSessionStore } = require('./sessionStore');
  const { requireAuth, originGuard, requireWrite } = require('./middleware/auth');
  const sessionMiddleware = session({
    store: new SqliteSessionStore(),
    secret: config.sessionSecret,
    name: 'msm.sid',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      // 'lax' by default (see config.resolveCookieSameSite) - 'strict' withholds
      // the cookie on cross-site top-level navigations, which reads as "remember
      // me is broken". Override with COOKIE_SAMESITE.
      sameSite: config.cookieSameSite,
      maxAge: 7 * 24 * 3600 * 1000,
      // Default false (plain-HTTP localhost/LAN). Set COOKIE_SECURE=true (or 'auto'
      // with TRUST_PROXY set) when serving over HTTPS behind a TLS proxy.
      secure: config.cookieSecure,
    },
  });
  app.use(sessionMiddleware);
  app.set('sessionMiddleware', sessionMiddleware);
  app.use(originGuard);

  const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
  app.use(['/login', '/login/2fa', '/setup'], authLimiter);
  app.use(require('./routes/auth'));
  app.use('/status', require('./routes/status')); // public, read-only, opt-in per server
  // Cap /api request volume before any auth/DB work runs on a flood.
  app.use('/api', apiLimiter);
  app.use(requireAuth);
  // Account security (2FA) is self-service for every role, including viewer -
  // mounted ahead of the viewer-read-only gate below since protecting your own
  // account isn't a server-management action.
  app.use('/api/account', require('./routes/account'));
  // Read-only roles (viewer) may never perform state changes. Admin-only areas
  // (users, storage, API keys, global files) add their own requireRole on top.
  app.use(requireWrite);

  app.use('/api', require('./routes/api'));
  app.use('/api/tasks', require('./routes/tasks'));
  app.use('/api/solver', require('./routes/solver'));
  app.use('/map', require('./routes/mapProxy'));
  app.use(routes);

  // 404 + error pages (kept friendly; detailed errors go to the server log only)
  app.use((req, res) =>
    res.status(404).render('error', { title: 'Not found', code: 404, message: 'That page does not exist.' })
  );

  app.use((err, req, res, next) => {
    // Honor a well-formed HTTP status when the error carries one (e.g.
    // body-parser's 413 PayloadTooLargeError, a 400 from a malformed JSON body) -
    // those are client errors, not a panel fault, and shouldn't read as a 500.
    const code = Number(err.status || err.statusCode) || 500;
    if (code >= 500) {
      logger.error('Unhandled error in the web layer.', {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: code,
        userId: req.user ? req.user.id : undefined,
        requestId: req.requestId,
        err: serializeError(err),
      });
      captureError(err, { scope: 'web-html', path: req.path });
    }
    if (req.path.startsWith('/api/') || req.xhr) {
      return res.status(code).json({ ok: false, error: code === 413 ? 'Request body too large' : 'Request failed' });
    }
    res.status(code).render('error', {
      title: code >= 500 ? 'Something broke' : 'Request rejected',
      code,
      message:
        code >= 500
          ? 'The panel hit an unexpected error. Check the panel logs for details.'
          : 'That request was rejected. Check what you sent and try again.',
    });
  });

  return app;
}

module.exports = { createApp };
