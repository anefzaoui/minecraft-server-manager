// Client-side i18n lookup using window.MSM.translations.

const pluralRulesCache = new Map();

function getPluralRules(locale) {
  let rule = pluralRulesCache.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rule);
  }
  return rule;
}

function resolve(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, p)) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function t(key, params = {}) {
  const msm = (typeof window !== 'undefined' && window.MSM) || {};
  const trans = msm.translations || {};
  const locale = msm.locale || 'en';

  let val = resolve(trans, key);

  if (val === undefined || val === null) {
    return key;
  }

  // Handle plural forms if val is an object
  if (typeof val === 'object') {
    if (typeof params?.count === 'number') {
      try {
        const pr = getPluralRules(locale);
        const form = pr.select(params.count);
        val = val[form] ?? val.other ?? val.one ?? '';
      } catch {
        val = val.other ?? val.one ?? '';
      }
    } else {
      val = val.other ?? val.one ?? '';
    }
  }

  if (typeof val !== 'string') {
    return String(val);
  }

  if (!params || typeof params !== 'object') {
    return val;
  }

  return val.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, p1, p2) => {
    const p = p1 || p2;
    return params[p] !== undefined ? String(params[p]) : match;
  });
}

if (typeof window !== 'undefined') {
  window.MSM = window.MSM || {};
  window.MSM.t = t;
}
