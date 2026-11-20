// Marketing-copy loader. Each locale is a JSON file next to this one; English is
// the source of truth and every other file is a translation of it (produced by
// scripts/translate.js and committed). Missing keys fall back to English so a
// half-translated locale still renders a complete page.
import { DEFAULT_LOCALE, LOCALE_CODES } from './locales.js';

const files = import.meta.glob('./*.json', { eager: true, import: 'default' });

function load(code) {
  return files[`./${code}.json`] || null;
}

function merge(base, over) {
  if (Array.isArray(base))
    return Array.isArray(over) && over.length === base.length ? over.map((v, i) => merge(base[i], v)) : base;
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) out[k] = over && k in over ? merge(base[k], over[k]) : base[k];
    return out;
  }
  return typeof over === 'string' && over.trim() ? over : base;
}

/** Full copy object for a locale, English-backed. */
export function getCopy(code) {
  const en = load(DEFAULT_LOCALE);
  if (code === DEFAULT_LOCALE || !LOCALE_CODES.includes(code)) return en;
  return merge(en, load(code));
}

/** True when the locale has its own translation file. */
export function hasTranslation(code) {
  return Boolean(load(code));
}
