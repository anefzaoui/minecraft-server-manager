'use strict';

const i18n = require('../../services/i18n');

function i18nMiddleware(req, res, next) {
  let chosenLang = null;

  if (req.user?.language) {
    chosenLang = req.user.language;
  } else if (req.session?.language) {
    chosenLang = req.session.language;
  } else if (req.headers.cookie) {
    const match = /(?:^|;\s*)msm_lang=([a-zA-Z-]+)/.exec(req.headers.cookie);
    if (match && match[1]) {
      chosenLang = match[1];
    }
  }

  let activeLocale;
  if (chosenLang && chosenLang !== 'auto' && i18n.isValidLocale(chosenLang)) {
    activeLocale = chosenLang.toLowerCase();
  } else {
    activeLocale = i18n.detectLocaleFromHeader(req.headers['accept-language']);
  }

  const dir = i18n.getDirection(activeLocale);

  req.locale = activeLocale;
  req.dir = dir;
  req.t = (key, params) => i18n.t(activeLocale, key, params);

  res.locals.currentLocale = activeLocale;
  res.locals.textDirection = dir;
  res.locals.userLanguage = req.user?.language || req.session?.language || 'auto';
  res.locals.supportedLanguages = i18n.getSupportedLanguages();
  res.locals.t = req.t;
  res.locals.panelLocalization = require('../../services/settings').clientLocalization(activeLocale);

  next();
}

module.exports = { i18nMiddleware };
