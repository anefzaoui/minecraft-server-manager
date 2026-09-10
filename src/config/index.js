'use strict';

// quiet: true - dotenv 17 prints an "injected env / tip: ..." banner to
// stdout by default; this is a server process, not a CLI, so suppress it.
require('dotenv').config({ quiet: true });

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

const { normalizeLogLevel } = require('./logLevel');

const root = path.resolve(__dirname, '..', '..');
const dataDir = path.resolve(root, process.env.DATA_DIR || './data');

const MB = 1024 * 1024;

/**
 * Read a numeric env var, validating it when set. An unset/blank var falls back
 * to the default; a set-but-invalid var (typo, out of range) throws a clear
 * error instead of silently becoming the default - which would mask the mistake.
 */
function numFromEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max} - got "${raw}". Fix it in your .env (or leave it blank for the default ${fallback}).`
    );
  }
  return n;
}

/**
 * Like numFromEnv but accepts non-integers (e.g. a 0..1 sample rate). Same
 * fail-fast contract: set-but-out-of-range throws rather than silently defaulting.
 */
function numFloatFromEnv(name, fallback, { min = 0, max = Number.MAX_VALUE } = {}) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(
      `${name} must be a number between ${min} and ${max} - got "${raw}". Fix it in your .env (or leave it blank for the default ${fallback}).`
    );
  }
  return n;
}

/**
 * Pino log level. Allowlisted (fatal|error|warn|info|debug|trace|silent); a
 * set-but-bogus value fails fast at boot. Default 'info'.
 */
function resolveLogLevel() {
  return normalizeLogLevel(process.env.LOG_LEVEL, { strict: true }) || 'info';
}

/**
 * Error/trace reporting settings. Inert unless SENTRY_DSN is set - the panel
 * ships with Pino logging only, and this block is a forward-looking mirror of
 * what src/instrument.js would consume.
 */
function resolveSentry() {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  return {
    dsn,
    enabled: dsn !== '',
    environment: (process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development').trim(),
    tracesSampleRate: numFloatFromEnv('SENTRY_TRACES_SAMPLE_RATE', 0, { min: 0, max: 1 }),
  };
}

/**
 * Resolve the session secret. Priority:
 *   1. SESSION_SECRET from the environment (must be >= 16 chars).
 *   2. A previously generated secret at $DATA_DIR/.session-secret.
 *   3. A freshly generated strong secret, persisted for next boot.
 * This makes a fresh `pnpm start` secure with zero configuration, while still
 * letting operators pin the value via .env (e.g. to share across replicas).
 */
function resolveSessionSecret() {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.trim().length > 0) {
    if (fromEnv.trim().length < 16) {
      throw new Error(
        'SESSION_SECRET is set but too short - use at least 16 characters (e.g. `openssl rand -base64 48`).'
      );
    }
    return fromEnv.trim();
  }
  const secretFile = path.join(dataDir, '.session-secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf8').trim();
    if (existing.length >= 16) return existing;
  } catch {
    /* not created yet - fall through and generate */
  }

  const generated = crypto.randomBytes(48).toString('base64url');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(secretFile, generated + '\n', { mode: 0o600 });
  } catch (err) {
    throw new Error(
      `Could not write the panel secret to ${secretFile}: ${err.message}. ` +
        `Check that DATA_DIR (${dataDir}) exists and is writable, or set SESSION_SECRET in your .env.`,
      { cause: err }
    );
  }
  console.log(
    `[boot] No SESSION_SECRET was set, so the panel generated one and saved it to ${secretFile}. Keep it private; delete it to rotate.`
  );
  return generated;
}

/**
 * Starting per-instance resource defaults. Each is env-overridable; when unset,
 * heap/container scale to a fraction of detected host RAM so the out-of-the-box
 * defaults fit a modest VPS as well as a big workstation.
 */
function resolveDefaults() {
  const envHeap = numFromEnv('DEFAULT_HEAP_MB', 0, { min: 0, max: 1024 * 1024 });
  const envContainer = numFromEnv('DEFAULT_CONTAINER_MEMORY_MB', 0, { min: 0, max: 1024 * 1024 });
  const envQuota = numFromEnv('DEFAULT_DISK_QUOTA_GB', 0, { min: 0, max: 1024 * 1024 });
  // DEFAULT_DISK_QUOTA_GB=0 is meaningful ("quotas off") and must survive,
  // unlike the memory pair where 0 means "auto". So decide from the variable's
  // presence, not the parsed value.
  const quotaRaw = process.env.DEFAULT_DISK_QUOTA_GB;
  const quotaExplicitlySet = quotaRaw !== undefined && String(quotaRaw).trim() !== '';

  const hostMb = os.totalmem() / MB;
  // ~25% of host RAM for the heap, rounded to 512 MB, clamped to [1024, 8192].
  const autoHeap = Math.min(8192, Math.max(1024, Math.round((hostMb * 0.25) / 512) * 512));
  const heapMb = envHeap || autoHeap;
  // Container limit sits ~50% above the heap (headroom before the OOM killer).
  const containerMemoryMb = envContainer || Math.round((heapMb * 1.5) / 512) * 512;

  return {
    heapMb,
    containerMemoryMb,
    cpus: 0, // 0 = unlimited
    diskQuotaGb: quotaExplicitlySet ? envQuota : 25,
    quotaWarnPct: 80,
    quotaCriticalPct: 95,
  };
}

/**
 * Parse the `trust proxy` setting for Express. Accepts a hop count (`1`), an
 * explicit `loopback`/`uniquelocal`, or a comma-separated IP/subnet list that
 * names the actual proxy(es). Unset → false (trust nothing), the safe default
 * for a directly-exposed panel.
 *
 * A bare `true` is deprecated (treated as one hop, with a boot warning): it
 * trusts the FIRST (left-most) entry of an attacker-supplied `X-Forwarded-For`,
 * which lets any client spoof `req.ip` and dodge every per-IP control that keys
 * on it (the per-account+per-IP login lockout and the API/auth rate limiters).
 * Trust nothing unless the operator names the real proxy hop count or its IPs.
 */
function resolveTrustProxy() {
  const raw = (process.env.TRUST_PROXY || '').trim();
  if (!raw) return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  const low = raw.toLowerCase();
  if (low === 'true') {
    // Accepted for one more release so an existing .env keeps booting, but
    // downgraded to "one hop" (the only thing a bare `true` can sensibly mean
    // for a single reverse proxy) with a loud warning. A later release refuses it.
    console.warn(
      '[boot] TRUST_PROXY=true is deprecated and treated as TRUST_PROXY=1. A bare true trusts an attacker-supplied ' +
        'X-Forwarded-For and defeats the per-IP login lockout and rate limiters. Set the proxy hop count ' +
        '(TRUST_PROXY=1) or a comma-separated list of proxy IPs/CIDRs (TRUST_PROXY=192.168.1.10) before the next upgrade.'
    );
    return 1;
  }
  if (low === 'false') return false;
  return raw; // 'loopback' | 'uniquelocal' | comma-list of IPs - Express parses these
}

/**
 * Whether the session cookie should carry the Secure flag. `true` when served
 * over HTTPS (directly or behind a TLS-terminating proxy); `'auto'` lets Express
 * decide from the connection/`X-Forwarded-Proto` (needs trust proxy set).
 * Default false so a plain-HTTP LAN/localhost session still works.
 */
function resolveCookieSecure() {
  const raw = (process.env.COOKIE_SECURE || '').trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'auto') return 'auto';
  return false;
}

/**
 * SameSite attribute for the session cookie. Default 'lax' - the conventional
 * choice for a session cookie: it still withholds the cookie from cross-site
 * POST/PATCH/DELETE (every state-changing route here), so CSRF stays covered,
 * but unlike 'strict' it IS sent on top-level navigations that originate from
 * another site (a link from chat/email, a bookmark via a redirector, an
 * SSO/reverse-proxy round-trip). 'strict' drops the cookie on those, so the
 * user lands on /login every time and it looks like "remember me" is broken.
 * 'none' is only for embedding the panel cross-site and requires Secure.
 */
function resolveCookieSameSite() {
  const raw = (process.env.COOKIE_SAMESITE || '').trim().toLowerCase();
  if (raw === 'strict' || raw === 'none') return raw;
  return 'lax';
}

/**
 * Host-side location of the data directory, for when the panel itself runs in
 * a container. Bind mounts handed to the Docker daemon are resolved against the
 * HOST filesystem, so a containerized panel (which sees its data at DATA_DIR,
 * e.g. /data) must describe that same directory in host terms when creating
 * server containers. Unset - the bare-metal case - it equals dataDir and the
 * translation is a no-op.
 */
function resolveDataDirHost() {
  const raw = (process.env.DATA_DIR_HOST || '').trim();
  if (!raw) return dataDir;
  const isAbsolute = raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw);
  if (!isAbsolute) {
    throw new Error(
      `DATA_DIR_HOST must be an absolute host path (e.g. /opt/msm/data or C:\\msm\\data) - got "${raw}". ` +
        'It is the host-side path of the directory mounted at DATA_DIR inside the panel container.'
    );
  }
  const trimmed = raw.replace(/[\\/]+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Address the panel uses to reach OTHER containers' host-published ports (e.g.
 * BlueMap's map webserver) - used by the /map proxy. Bare metal, the panel's
 * own '127.0.0.1' IS the host's, so no translation is needed. Containerized
 * (same signal as resolveDataDirHost - DATA_DIR_HOST set), '127.0.0.1' is the
 * PANEL container's own loopback, not the host's, so sibling containers'
 * published ports are unreachable through it; 'host.docker.internal' is
 * Docker's own mechanism for "reach the host from inside a container" (needs
 * `extra_hosts: host.docker.internal:host-gateway` on plain Linux Engine -
 * see docker-compose.yml - Docker Desktop resolves it natively, but
 * containerized-panel deployment targets Linux).
 */
function resolveMapProxyHost() {
  const raw = (process.env.MAP_PROXY_HOST || '').trim();
  if (raw) return raw;
  return resolveDataDirHost() === dataDir ? '127.0.0.1' : 'host.docker.internal';
}

const host = process.env.PANEL_HOST || '127.0.0.1';

/**
 * Central panel configuration. Every value has a sane default; .env overrides.
 * DATA_DIR is resolved to an absolute path once, here - all storage code must
 * import it from this module and never re-derive it.
 */
const config = {
  root,
  dataDir,
  dataDirHost: resolveDataDirHost(),
  // Bind to localhost only by default - the panel is reachable just from this
  // machine out of the box. Set PANEL_HOST=0.0.0.0 to expose it to your LAN,
  // and only put it on the internet behind a reverse proxy with TLS.
  host,
  // 25564 - one below the game-port runway (PORT_GAME_START, 25565) so game
  // instances number cleanly upward from 25565 without the panel taking a slot
  // in the middle of the sequence.
  port: numFromEnv('PANEL_PORT', 25564, { min: 1, max: 65535 }),
  // True when bound to a non-loopback address - used to warn about the open
  // first-run setup window on an exposed panel.
  isExposedBind: host !== '127.0.0.1' && host !== 'localhost' && host !== '::1',
  sessionSecret: resolveSessionSecret(),
  cfApiKeySeed: process.env.CF_API_KEY || '',
  trustProxy: resolveTrustProxy(),
  cookieSecure: resolveCookieSecure(),
  cookieSameSite: resolveCookieSameSite(),
  logLevel: resolveLogLevel(),
  sentry: resolveSentry(),
  mapProxyHost: resolveMapProxyHost(),

  // Docker image repository for Minecraft servers. Override for a private mirror
  // or air-gapped registry; the panel is otherwise an itzg/minecraft-server front-end.
  mcImageRepo: (process.env.MC_IMAGE_REPO || 'itzg/minecraft-server').trim(),

  // Port allocation scheme: game ports first-free from PORT_GAME_START,
  // RCON host port = game + PORT_RCON_OFFSET, Bedrock/Geyser UDP from PORT_BEDROCK_START.
  ports: {
    gameStart: numFromEnv('PORT_GAME_START', 25565, { min: 1, max: 65535 }),
    rconOffset: numFromEnv('PORT_RCON_OFFSET', 1000, { min: 1, max: 64000 }),
    bedrockStart: numFromEnv('PORT_BEDROCK_START', 19132, { min: 1, max: 65535 }),
  },

  // Default per-instance resources (host-aware unless overridden via env).
  defaults: resolveDefaults(),

  // Coarse request-rate ceilings (per client IP, per process - see the note on
  // TRUST_PROXY). These sit on top of the per-account login lockout; they cap
  // raw request volume so a hammering script can't tie the panel up. Set
  // RATE_LIMIT_API_PER_MIN=0 to turn the API limiter off (e.g. when a reverse
  // proxy already does this).
  rateLimit: {
    apiPerMin: numFromEnv('RATE_LIMIT_API_PER_MIN', 1200, { min: 0, max: 1_000_000 }),
    authPer15Min: numFromEnv('RATE_LIMIT_AUTH_PER_15MIN', 100, { min: 0, max: 1_000_000 }),
    // Per-token ceiling on the public /api/v1 surface (keyed on the token, IP
    // fallback when absent). 0 = off.
    publicApiPerMin: numFromEnv('RATE_LIMIT_PUBLIC_API_PER_MIN', 120, { min: 0, max: 1_000_000 }),
  },
};

// resolveSessionSecret() guarantees a strong secret, so downstream code can rely
// on config.sessionSecret being set - no hardcoded dev fallback anywhere.
if (!config.sessionSecret || config.sessionSecret.length < 16) {
  throw new Error('Failed to resolve a session secret.');
}

// Browsers silently reject `SameSite=None` unless the cookie is also `Secure`,
// which would leave the panel with no working session cookie at all.
if (config.cookieSameSite === 'none' && config.cookieSecure === false) {
  throw new Error(
    'COOKIE_SAMESITE=none requires a secure cookie - also set COOKIE_SECURE=true (or COOKIE_SECURE=auto with TRUST_PROXY).'
  );
}

// COOKIE_SECURE=auto lets Express decide from `req.secure`, which ONLY becomes
// true when `trust proxy` is set (the panel itself serves plain HTTP; the TLS
// hop dies at the reverse proxy). With no TRUST_PROXY the cookie silently ships
// WITHOUT the Secure flag - readable/forgeable in transit - which is exactly
// the downgrade `auto` exists to prevent. This booted silently before, so warn
// loudly for one release rather than refusing to start; a later release fails.
if (config.cookieSecure === 'auto' && config.trustProxy === false) {
  console.warn(
    '[boot] COOKIE_SECURE=auto has no effect without TRUST_PROXY: Express cannot see the proxy-terminated HTTPS hop, so the ' +
      'session cookie is sent WITHOUT the Secure flag. Set TRUST_PROXY (the hop count or the proxy IP/CIDR list) if the panel ' +
      'is behind a TLS proxy, or COOKIE_SECURE=false if it is genuinely plain HTTP. A future release will refuse to start like this.'
  );
}

module.exports = config;
