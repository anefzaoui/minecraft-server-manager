// The single source of truth for which languages the site ships. Every other
// piece (Astro i18n routing, Starlight locales, sitemap hreflang, the
// language switcher, the translate script) derives from this table.
//
// `code` is the URL prefix and BCP-47 `lang` attribute. English is the root
// locale (no prefix). `dir` marks right-to-left scripts. `label` is the
// language's own name, which is what a language switcher should show.
export const DEFAULT_LOCALE = 'en';

export const LOCALES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'pt-br', label: 'Português (Brasil)', dir: 'ltr', lang: 'pt-BR' },
  { code: 'it', label: 'Italiano', dir: 'ltr' },
  { code: 'nl', label: 'Nederlands', dir: 'ltr' },
  { code: 'pl', label: 'Polski', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'uk', label: 'Українська', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'ko', label: '한국어', dir: 'ltr' },
  { code: 'zh-cn', label: '简体中文', dir: 'ltr', lang: 'zh-CN' },
  { code: 'zh-tw', label: '繁體中文', dir: 'ltr', lang: 'zh-TW' },
  { code: 'id', label: 'Bahasa Indonesia', dir: 'ltr' },
  { code: 'vi', label: 'Tiếng Việt', dir: 'ltr' },
  { code: 'th', label: 'ไทย', dir: 'ltr' },
  { code: 'sv', label: 'Svenska', dir: 'ltr' },
  { code: 'da', label: 'Dansk', dir: 'ltr' },
  { code: 'nb', label: 'Norsk bokmål', dir: 'ltr' },
  { code: 'fi', label: 'Suomi', dir: 'ltr' },
  { code: 'cs', label: 'Čeština', dir: 'ltr' },
  { code: 'hu', label: 'Magyar', dir: 'ltr' },
  { code: 'ro', label: 'Română', dir: 'ltr' },
  { code: 'el', label: 'Ελληνικά', dir: 'ltr' },
  { code: 'he', label: 'עברית', dir: 'rtl' },
  { code: 'fa', label: 'فارسی', dir: 'rtl' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

/** @param {string} code */
export function getLocale(code) {
  return LOCALES.find((l) => l.code === code) || LOCALES[0];
}

/**
 * The locale code (URL prefix) for what Astro.currentLocale returns, which is
 * the BCP-47 tag on Starlight pages ('pt-BR' for the 'pt-br' locale).
 * @param {string | undefined} current
 */
export function localeCode(current) {
  if (!current) return DEFAULT_LOCALE;
  const found = LOCALES.find((l) => l.code === current || (l.lang || l.code).toLowerCase() === current.toLowerCase());
  return found ? found.code : DEFAULT_LOCALE;
}

/** BCP-47 tag for the `lang` attribute and hreflang. */
export function langTag(code) {
  const l = getLocale(code);
  return l.lang || l.code;
}

/**
 * Starlight's `locales` option, derived from the table (root = English).
 * @returns {Record<string, { label: string, lang: string, dir: 'ltr' | 'rtl' }>}
 */
export function starlightLocales() {
  /** @type {Record<string, { label: string, lang: string, dir: 'ltr' | 'rtl' }>} */
  const out = {};
  for (const l of LOCALES) {
    const entry = { label: l.label, lang: langTag(l.code), dir: /** @type {'ltr' | 'rtl'} */ (l.dir) };
    out[l.code === DEFAULT_LOCALE ? 'root' : l.code] = entry;
  }
  return out;
}

/** Path prefix for a locale: '' for English, '/ar' for Arabic, ... */
export function localePrefix(code) {
  return code === DEFAULT_LOCALE ? '' : `/${code}`;
}
