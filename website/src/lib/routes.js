// Marketing page registry. Keys match `meta.*` in src/i18n/en.json and `nav.*`.
import { localePrefix } from '../i18n/locales.js';

export const PAGES = [
  { key: 'home', path: '/' },
  { key: 'features', path: '/features/' },
  { key: 'screenshots', path: '/screenshots/' },
  { key: 'install', path: '/install/' },
  { key: 'docs', path: '/docs/' },
  { key: 'faq', path: '/faq/' },
  { key: 'changelog', path: '/changelog/' },
];

export const REPO_URL = 'https://github.com/anefzaoui/minecraft-server-manager';
export const DISCORD_URL = 'https://discord.gg/Ud6TrQkbDZ';
export const SITE_URL = 'https://minecraft-server-manager.com';

/** '/features/' for English, '/ar/features/' for Arabic, ... */
export function href(locale, path) {
  return `${localePrefix(locale)}${path}`;
}

/** Locales whose script Press Start 2P can render (Latin without heavy diacritics). */
const PIXEL_TITLE_LOCALES = new Set([
  'en',
  'fr',
  'de',
  'es',
  'pt-br',
  'it',
  'nl',
  'pl',
  'tr',
  'id',
  'sv',
  'da',
  'nb',
  'fi',
  'cs',
  'hu',
  'ro',
]);
export function usesPixelTitles(locale) {
  return PIXEL_TITLE_LOCALES.has(locale);
}
