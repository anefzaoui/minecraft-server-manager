'use strict';

// Shared, zero-dependency helper for validating the LOG_LEVEL env var. Kept in
// its own leaf module so both config/index.js (fail-fast at boot) and logger.js
// (defensive fallback) can use it without either one requiring the other.

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/**
 * Normalize a raw LOG_LEVEL value against the allowlist above.
 * @param {unknown} raw - the env value (or anything).
 * @param {{ strict?: boolean }} [opts] - when strict, a set-but-invalid value throws.
 * @returns {string|null} a valid lowercase level, or null when unset/blank (or invalid and not strict).
 */
function normalizeLogLevel(raw, { strict = false } = {}) {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (value === '') return null;
  if (LOG_LEVELS.includes(value)) return value;
  if (strict) {
    throw new Error(
      `LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')} - got "${raw}". ` +
        'Fix it in your .env (or leave it blank for the default info).'
    );
  }
  return null;
}

module.exports = { LOG_LEVELS, normalizeLogLevel };
