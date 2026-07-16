'use strict';

const path = require('node:path');
const express = require('express');
const { engine } = require('express-handlebars');

const config = require('../config');
const routes = require('./routes');
const { icon } = require('./icons');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

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

// The 8 icons bundled in public/icons/servers. Icon names are free text in the
// schemas, so anything unknown falls back to grass instead of a broken image.
const BUNDLED_ICONS = new Set(['chest', 'creeper', 'diamond', 'grass', 'portal', 'potion', 'sword', 'tnt']);

function iconSrc(name) {
  if (typeof name === 'string' && name.startsWith('custom:')) {
    return `/api/icons/custom/${encodeURIComponent(name.slice('custom:'.length))}`;
  }
  return `/icons/servers/${BUNDLED_ICONS.has(name) ? name : 'grass'}.png`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log2(Math.abs(bytes)) / 10), units.length - 1);
  const value = bytes / 2 ** (10 * i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

// Serialize a value for embedding inside a <script> island. JSON.stringify does
// NOT escape <, >, & or the JS line separators U+2028/U+2029, so a string field
// containing "</script>" would break out of the tag (stored XSS). Escape those
// code points to \uXXXX — still valid JSON and valid JS.
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
        platformName: (p) => ({ modrinth: 'Modrinth', curseforge: 'CurseForge' })[p] || p,
        // Handlebars {{#if}} treats 0 as falsy, which silently drops min="0"
        // attributes and zero defaults — this helper exists for those tests.
        isDefined: (v) => v !== undefined && v !== null && v !== '',
      },
    })
  );
  app.set('view engine', 'hbs');
  app.set('views', path.join(config.root, 'views'));

  app.use(express.static(path.join(config.root, 'public')));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

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
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600 * 1000,
      // Default false (plain-HTTP localhost/LAN). Set COOKIE_SECURE=true (or 'auto'
      // with TRUST_PROXY set) when serving over HTTPS behind a TLS proxy.
      secure: config.cookieSecure,
    },
  });
  app.use(sessionMiddleware);
  app.set('sessionMiddleware', sessionMiddleware);
  app.use(originGuard);
  app.use(require('./routes/auth'));
  app.use('/status', require('./routes/status')); // public, read-only, opt-in per server
  app.use(requireAuth);
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
    console.error(err);
    res.status(500).render('error', {
      title: 'Something broke',
      code: 500,
      message: 'The panel hit an unexpected error. Check the panel logs for details.',
    });
  });

  return app;
}

module.exports = { createApp };
