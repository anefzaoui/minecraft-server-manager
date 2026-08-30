'use strict';

// Deep-sanitizes the structured metadata object attached to every log line
// before it is written or forwarded anywhere. Two jobs: redact secret-bearing
// keys, and strip query strings off URL-shaped values (tokens hide there). It
// must never throw - a logging helper that can crash the caller is worse than
// no logging - so every branch is defensive and bounded.

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;
const MAX_STRING = 2000;
const MAX_ARRAY = 100;

// Key looks like it holds a credential. Matched on whole word-parts, not a raw
// substring: `sessionId`, `passedChecks`, `bypassLogin`, `compassBearing` must
// NOT be redacted, while `sessionSecret`, `accessToken`, `cfApiKey` must.
const SECRET_WORDS = new Set([
  'password',
  'passwd',
  'pass',
  'passphrase',
  'secret',
  'token',
  'authorization',
  'auth',
  'cookie',
  'bearer',
  'credential',
  'credentials',
  'creds',
  'otp',
  'totp',
  'mfa',
  'dsn',
  'pat',
]);
// Adjacent word-part pairs that together mean "credential".
const SECRET_PAIRS = new Set(['apikey', 'privatekey', 'secretkey', 'accesskey', 'clientsecret']);

// Key looks like it holds a URL - value gets its query string stripped.
const URL_KEY_RE = /(url|uri|href|endpoint|webhook|dsn)$/i;

// Hosts whose webhook URLs carry the secret token in the PATH, not the query.
const WEBHOOK_HOST_RE = /(^|\.)(discord(app)?\.com|slack\.com)$/i;

/**
 * Break a key into lowercase word-parts across camelCase, snake_case, kebab, dots.
 * @param {string} key
 * @returns {string[]}
 */
function keyParts(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // fooBar -> foo Bar
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // XApiKey -> X ApiKey
    .split(/[^a-zA-Z0-9]+/)
    .map((s) => s.toLowerCase())
    .filter(Boolean);
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isSecretKey(key) {
  if (typeof key !== 'string') return false;
  const parts = keyParts(key);
  if (parts.some((p) => SECRET_WORDS.has(p))) return true;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (SECRET_PAIRS.has(parts[i] + parts[i + 1])) return true;
  }
  return false;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isUrlKey(key) {
  return typeof key === 'string' && URL_KEY_RE.test(key);
}

/**
 * Remove the query string, credentials, and hash noise from a URL-shaped string.
 * For webhook URLs (Discord/Slack) the secret lives in the PATH, not the query,
 * so the path is redacted too. Falls back to a plain split on parse failure.
 * Never throws.
 * @param {string} value
 * @returns {string}
 */
function stripUrlQuery(value) {
  if (typeof value !== 'string' || value === '') return value;
  try {
    const u = new URL(value);
    u.search = '';
    u.hash = '';
    u.username = '';
    u.password = '';
    if (WEBHOOK_HOST_RE.test(u.hostname) || /\/webhooks?\//i.test(u.pathname)) {
      u.pathname = '/[REDACTED]';
    }
    return u.toString();
  } catch {
    const q = value.indexOf('?');
    return q === -1 ? value : value.slice(0, q);
  }
}

/**
 * Compact an Error into a plain, log-safe object.
 * @param {any} err
 * @param {{ includeStack?: boolean }} [opts]
 * @returns {Record<string, unknown>}
 */
function serializeError(err, { includeStack = true } = {}) {
  if (!err || typeof err !== 'object') {
    return { errorMessage: err === undefined ? 'undefined' : String(err) };
  }
  const out = {
    errorName: typeof err.name === 'string' ? err.name : 'Error',
    errorMessage: typeof err.message === 'string' ? err.message : String(err),
  };
  const status = err.status ?? err.statusCode ?? err.httpStatus;
  if (status !== undefined && status !== null) out.httpStatus = status;
  if (err.code !== undefined && err.code !== null) out.code = err.code;
  if (includeStack && typeof err.stack === 'string') {
    out.stack = err.stack.split('\n').slice(0, 8).join('\n');
  }
  return out;
}

/**
 * Reduce an attachment-ish value to a bare, path-free label.
 * @param {any} name
 * @returns {string}
 */
function safeAttachmentLabel(name) {
  const s = typeof name === 'string' ? name : name && typeof name === 'object' ? name.name || name.filename || '' : '';
  const base = String(s)
    .replace(/^.*[\\/]/, '')
    .trim();
  if (!base) return 'attachment';
  return base.length > 120 ? base.slice(0, 120) + '…' : base;
}

function looksLikeError(v) {
  return v && typeof v === 'object' && typeof v.message === 'string' && typeof v.stack === 'string';
}

function sanitizeValue(key, value, depth, seen) {
  if (value === null || value === undefined) return value;
  if (isSecretKey(key)) return REDACTED;

  const t = typeof value;
  if (t === 'string') {
    if (isUrlKey(key)) return stripUrlQuery(value);
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…[truncated]' : value;
  }
  if (t === 'number' || t === 'boolean' || t === 'bigint') return value;
  if (t === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (t === 'symbol') return value.toString();

  if (looksLikeError(value)) return serializeError(value, { includeStack: key === 'err' || key === 'error' });

  if (depth >= MAX_DEPTH) return '[Truncated]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const arr = value.slice(0, MAX_ARRAY).map((item, i) => sanitizeValue(String(i), item, depth + 1, seen));
    if (value.length > MAX_ARRAY) arr.push(`…[${value.length - MAX_ARRAY} more]`);
    seen.delete(value);
    return arr;
  }

  const out = {};
  for (const k of Object.keys(value)) {
    // A throwing getter must cost only its own field, not the whole meta object.
    let v;
    try {
      v = value[k];
    } catch {
      out[k] = '[Unreadable]';
      continue;
    }
    out[k] = sanitizeValue(k, v, depth + 1, seen);
  }
  seen.delete(value);
  return out;
}

/**
 * Deep-clone `meta` with secrets redacted and URL query strings stripped.
 * Bounded in depth, string length, and array length; cycle-safe. Never throws.
 * @param {any} meta
 * @returns {any}
 */
function sanitizeLogMeta(meta) {
  try {
    if (meta === null || meta === undefined || typeof meta !== 'object') return meta;
    return sanitizeValue('', meta, 0, new WeakSet());
  } catch {
    return { sanitizeError: true };
  }
}

module.exports = {
  REDACTED,
  sanitizeLogMeta,
  serializeError,
  stripUrlQuery,
  safeAttachmentLabel,
  isSecretKey,
  isUrlKey,
};
