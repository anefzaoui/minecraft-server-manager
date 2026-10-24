'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LOCALE = 'en';

const SUPPORTED_LOCALES = {
  en: { code: 'en', name: 'English', dir: 'ltr' },
  de: { code: 'de', name: 'Deutsch', dir: 'ltr' },
  es: { code: 'es', name: 'Español', dir: 'ltr' },
  fr: { code: 'fr', name: 'Français', dir: 'ltr' },
  zh: { code: 'zh', name: '简体中文', dir: 'ltr' },
  ar: { code: 'ar', name: 'العربية', dir: 'rtl' },
};

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

// In-memory cache of loaded translations per locale
const translations = {};
const pluralRulesCache = new Map();

function getPluralRules(locale) {
  let rule = pluralRulesCache.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rule);
  }
  return rule;
}

function loadTranslations() {
  for (const code of Object.keys(SUPPORTED_LOCALES)) {
    try {
      const file = path.join(LOCALES_DIR, `${code}.json`);
      if (fs.existsSync(file)) {
        translations[code] = JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch {
      translations[code] = {};
    }
  }
}

// Initial load
loadTranslations();

/**
 * Deep merge two JSON-like dictionary objects, base first with override on top.
 */
function deepMerge(base, override) {
  if (!base || typeof base !== 'object') return override;
  if (!override || typeof override !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === 'object' &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Navigate a dot-separated path in an object.
 * Returns undefined if any step is missing or not an own property.
 */
function resolvePath(obj, keyPath) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = String(keyPath).split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Interpolate `{var}` and `{{var}}` placeholders with values from params.
 */
function interpolate(template, params) {
  if (typeof template !== 'string') return '';
  if (!params || typeof params !== 'object') return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, p1, p2) => {
    const key = p1 || p2;
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

/**
 * Translate a key for a given locale, with automatic fallback to English and CLDR pluralization.
 *
 * @param {string} locale e.g. 'de', 'en', 'ar'
 * @param {string} key e.g. 'settings.language.label'
 * @param {Record<string, any>} [params] e.g. { count: 5, max: 20 }
 * @returns {string}
 */
function t(locale, key, params = {}) {
  const normLocale = SUPPORTED_LOCALES[locale] ? locale : DEFAULT_LOCALE;

  // 1. Look up in the target locale
  let val = resolvePath(translations[normLocale], key);

  // 2. If missing, look up in default locale (en)
  if (val === undefined && normLocale !== DEFAULT_LOCALE) {
    val = resolvePath(translations[DEFAULT_LOCALE], key);
  }

  // 3. If still missing, return the key itself
  if (val === undefined) {
    return key;
  }

  // 4. Handle pluralization if value is an object with plural forms
  if (typeof val === 'object' && val !== null) {
    if (typeof params?.count === 'number') {
      try {
        const rules = getPluralRules(normLocale);
        const rule = rules.select(params.count);
        val = val[rule] ?? val.other ?? val.one ?? '';
      } catch {
        val = val.other ?? val.one ?? '';
      }
    } else {
      val = val.other ?? val.one ?? '';
    }
  }

  return interpolate(val, params);
}

/**
 * Parse an HTTP Accept-Language header (RFC 4647) and return the best supported locale.
 *
 * @param {string} [header] e.g. "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
 * @returns {string} Supported locale code (e.g. 'de', 'en')
 */
function detectLocaleFromHeader(header) {
  if (!header || typeof header !== 'string') return DEFAULT_LOCALE;

  const entries = header
    .split(',')
    .map((item) => {
      const parts = item.trim().split(';');
      const tag = parts[0].trim().toLowerCase();
      let q = 1.0;
      if (parts[1]) {
        const qMatch = /q=([0-9.]+)/i.exec(parts[1]);
        if (qMatch) {
          const parsed = parseFloat(qMatch[1]);
          if (!isNaN(parsed)) q = parsed;
        }
      }
      const primary = tag.split('-')[0];
      return { tag, primary, q };
    })
    .filter((e) => e.tag && e.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    if (SUPPORTED_LOCALES[entry.primary]) {
      return entry.primary;
    }
    if (SUPPORTED_LOCALES[entry.tag]) {
      return entry.tag;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Return the text direction ('ltr' or 'rtl') for a locale.
 */
function getDirection(locale) {
  return SUPPORTED_LOCALES[locale]?.dir || 'ltr';
}

/**
 * Check if a locale code is supported.
 */
function isValidLocale(locale) {
  return typeof locale === 'string' && Boolean(SUPPORTED_LOCALES[locale.toLowerCase()]);
}

/**
 * List all supported languages for dropdown rendering.
 */
function getSupportedLanguages() {
  return Object.values(SUPPORTED_LOCALES);
}

/**
 * Returns translations used by the client browser with English fallback merged underneath.
 */
function getClientTranslations(locale) {
  const norm = SUPPORTED_LOCALES[locale] ? locale : DEFAULT_LOCALE;
  if (norm === DEFAULT_LOCALE) {
    return translations[DEFAULT_LOCALE] || {};
  }
  return deepMerge(translations[DEFAULT_LOCALE] || {}, translations[norm] || {});
}

/**
 * Check if a key exists in target or default locale.
 */
function has(locale, key) {
  const normLocale = SUPPORTED_LOCALES[locale] ? locale : DEFAULT_LOCALE;
  return (
    resolvePath(translations[normLocale], key) !== undefined ||
    resolvePath(translations[DEFAULT_LOCALE], key) !== undefined
  );
}

module.exports = {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  t,
  has,
  detectLocaleFromHeader,
  getDirection,
  isValidLocale,
  getSupportedLanguages,
  getClientTranslations,
  loadTranslations,
};
