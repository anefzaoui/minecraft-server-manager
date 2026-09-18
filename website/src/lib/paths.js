// getStaticPaths helper: one route per locale. English is the root (param
// undefined), every other locale gets its /<code>/ prefix.
import { LOCALES, DEFAULT_LOCALE } from '../i18n/locales.js';

export function localePaths() {
  return LOCALES.map((l) => ({ params: { locale: l.code === DEFAULT_LOCALE ? undefined : l.code } }));
}

export function localeFromParams(params) {
  return params.locale || DEFAULT_LOCALE;
}
