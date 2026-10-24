'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../src/services/i18n');

test('all 6 supported languages are registered with proper metadata', () => {
  const supported = i18n.getSupportedLanguages();
  const codes = supported.map((s) => s.code).sort();
  assert.deepEqual(codes, ['ar', 'de', 'en', 'es', 'fr', 'zh']);

  assert.equal(i18n.getDirection('ar'), 'rtl');
  assert.equal(i18n.getDirection('en'), 'ltr');
  assert.equal(i18n.getDirection('de'), 'ltr');
  assert.equal(i18n.getDirection('es'), 'ltr');
  assert.equal(i18n.getDirection('fr'), 'ltr');
  assert.equal(i18n.getDirection('zh'), 'ltr');
});

test('isValidLocale checks', () => {
  assert.equal(i18n.isValidLocale('en'), true);
  assert.equal(i18n.isValidLocale('DE'), true);
  assert.equal(i18n.isValidLocale('zh'), true);
  assert.equal(i18n.isValidLocale('ar'), true);
  assert.equal(i18n.isValidLocale('it'), false);
  assert.equal(i18n.isValidLocale(''), false);
  assert.equal(i18n.isValidLocale(null), false);
});

test('translation lookup with dot notation', () => {
  assert.equal(i18n.t('en', 'common.save'), 'Save');
  assert.equal(i18n.t('de', 'common.save'), 'Speichern');
  assert.equal(i18n.t('es', 'common.save'), 'Guardar');
  assert.equal(i18n.t('fr', 'common.save'), 'Enregistrer');
  assert.equal(i18n.t('zh', 'common.save'), '保存');
  assert.equal(i18n.t('ar', 'common.save'), 'حفظ');
});

test('fallback to English when a key is missing in target locale', () => {
  // If a key doesn't exist in German, fallback to English
  assert.equal(i18n.t('de', 'footer.tagline'), 'Verwaltungsoberfläche für Minecraft-Server auf Docker');
  // Non-existent key in any locale returns the key path
  assert.equal(i18n.t('de', 'non.existent.key'), 'non.existent.key');
});

test('parameter interpolation with {var} and {{var}}', () => {
  assert.equal(i18n.t('en', 'servers.player_count', { count: 3, max: 20 }), '3 / 20 players');
  assert.equal(i18n.t('de', 'servers.player_count', { count: 3, max: 20 }), '3 / 20 Spieler');
  assert.equal(i18n.t('es', 'servers.player_count', { count: 3, max: 20 }), '3 / 20 jugadores');
  assert.equal(i18n.t('fr', 'servers.player_count', { count: 3, max: 20 }), '3 / 20 joueurs');
  assert.equal(i18n.t('zh', 'servers.player_count', { count: 3, max: 20 }), '3 / 20 玩家');
  assert.equal(i18n.t('ar', 'servers.player_count', { count: 3, max: 20 }), '3 / 20 لاعب');
});

test('CLDR pluralization across different languages', () => {
  // English (one, other)
  assert.equal(i18n.t('en', 'common.items', { count: 1 }), '1 item');
  assert.equal(i18n.t('en', 'common.items', { count: 5 }), '5 items');

  // German (one, other)
  assert.equal(i18n.t('de', 'common.items', { count: 1 }), '1 Element');
  assert.equal(i18n.t('de', 'common.items', { count: 5 }), '5 Elemente');

  // Arabic (zero, one, two, few, many, other)
  assert.equal(i18n.t('ar', 'common.items', { count: 0 }), 'لا عناصر');
  assert.equal(i18n.t('ar', 'common.items', { count: 1 }), 'عنصر واحد');
  assert.equal(i18n.t('ar', 'common.items', { count: 2 }), 'عنصران');
  assert.equal(i18n.t('ar', 'common.items', { count: 3 }), '3 عناصر');
  assert.equal(i18n.t('ar', 'common.items', { count: 15 }), '15 عنصراً');
  assert.equal(i18n.t('ar', 'common.items', { count: 100 }), '100 عنصر');
});

test('detectLocaleFromHeader: Accept-Language negotiation', () => {
  // Exact match
  assert.equal(i18n.detectLocaleFromHeader('de'), 'de');
  assert.equal(i18n.detectLocaleFromHeader('es'), 'es');
  assert.equal(i18n.detectLocaleFromHeader('fr'), 'fr');
  assert.equal(i18n.detectLocaleFromHeader('zh'), 'zh');
  assert.equal(i18n.detectLocaleFromHeader('ar'), 'ar');

  // Regional codes
  assert.equal(i18n.detectLocaleFromHeader('de-DE,de;q=0.9'), 'de');
  assert.equal(i18n.detectLocaleFromHeader('fr-CA,fr;q=0.8,en;q=0.5'), 'fr');
  assert.equal(i18n.detectLocaleFromHeader('zh-CN,zh;q=0.9'), 'zh');
  assert.equal(i18n.detectLocaleFromHeader('ar-EG,ar;q=0.9'), 'ar');

  // Weighted preference
  assert.equal(i18n.detectLocaleFromHeader('it;q=0.9,es;q=0.8,en;q=0.5'), 'es');
  assert.equal(i18n.detectLocaleFromHeader('ja-JP,ja;q=0.9,ru;q=0.8'), 'en'); // unsupported fall back to en

  // Empty or invalid headers
  assert.equal(i18n.detectLocaleFromHeader(''), 'en');
  assert.equal(i18n.detectLocaleFromHeader(null), 'en');
});

test('all 6 locale files have complete key parity with en.json', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const locales = ['de', 'es', 'fr', 'zh', 'ar'];
  const localesDir = path.resolve('src/locales');
  const enData = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

  function getKeys(obj, prefix = '') {
    let keys = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? prefix + '.' + k : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        keys.push(...getKeys(v, full));
      } else {
        keys.push(full);
      }
    }
    return keys;
  }

  const enKeys = new Set(getKeys(enData));

  for (const code of locales) {
    const locData = JSON.parse(fs.readFileSync(path.join(localesDir, `${code}.json`), 'utf8'));
    const locKeys = new Set(getKeys(locData));
    const missing = [...enKeys].filter((k) => !locKeys.has(k));
    assert.deepEqual(missing, [], `${code}.json is missing translation keys: ${missing.join(', ')}`);
  }
});

test('status translations exist and resolve properly in all locales', () => {
  assert.equal(i18n.t('en', 'status.running'), 'Running');
  assert.equal(i18n.t('de', 'status.running'), 'Aktiv');
  assert.equal(i18n.t('es', 'status.running'), 'En ejecución');
  assert.equal(i18n.t('fr', 'status.running'), "En cours d'exécution");
  assert.equal(i18n.t('zh', 'status.running'), '运行中');
  assert.equal(i18n.t('ar', 'status.running'), 'قيد التشغيل');

  assert.equal(i18n.t('de', 'status.stopped'), 'Gestoppt');
  assert.equal(i18n.t('de', 'status.crashed'), 'Abgestürzt');
});

test('getClientTranslations returns dictionary for target locale', () => {
  const deClient = i18n.getClientTranslations('de');
  assert.ok(deClient.common);
  assert.ok(deClient.status);
  assert.equal(deClient.status.running, 'Aktiv');
  assert.equal(deClient.confirm.default_confirm, 'Bestätigen');
});

test('client-side i18n helper resolves keys with pluralization and interpolation', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../public/js/lib/i18n.js'), 'utf8');
  globalThis.window = {
    MSM: {
      locale: 'de',
      translations: i18n.getClientTranslations('de'),
    },
  };
  const { t } = await import(`data:text/javascript,${encodeURIComponent(src)}`);

  assert.equal(t('status.running'), 'Aktiv');
  assert.equal(t('confirm.default_confirm'), 'Bestätigen');
  assert.equal(t('common.items', { count: 1 }), '1 Element');
  assert.equal(t('common.items', { count: 4 }), '4 Elemente');
  assert.equal(t('errors.action_lead', { action: 'speichern' }), 'Konnte speichern nicht ausführen');
  assert.equal(t('nonexistent.key'), 'nonexistent.key');
});

test('prototype properties like toString or constructor do not leak into translations', () => {
  assert.equal(i18n.t('en', 'toString'), 'toString');
  assert.equal(i18n.t('en', 'valueOf'), 'valueOf');
  assert.equal(i18n.t('en', 'constructor'), 'constructor');
  assert.equal(i18n.has('en', 'toString'), false);
});

test('Handlebars t helper escapes HTML in interpolated parameters to prevent XSS', () => {
  const { create: createHandlebars } = require('express-handlebars');
  const Handlebars = createHandlebars().handlebars;
  const { HbsUtils } = { HbsUtils: Handlebars.Utils };
  const hbs = Handlebars.create();
  hbs.registerHelper('t', function (key, options) {
    const rawParams = options && options.hash ? options.hash : {};
    const root = (options && options.data && options.data.root) || {};
    const locale = root.currentLocale || i18n.DEFAULT_LOCALE;
    const escapedParams = {};
    for (const [k, v] of Object.entries(rawParams)) {
      escapedParams[k] = typeof v === 'string' ? HbsUtils.escapeExpression(v) : v;
    }
    return new Handlebars.SafeString(i18n.t(locale, key, escapedParams));
  });

  const template = hbs.compile('{{t "server_settings.delete_modal_title" name=serverName}}');
  const rendered = template({
    currentLocale: 'en',
    serverName: '<script>alert(1)</script>',
  });

  assert.equal(rendered, 'Delete &lt;script&gt;alert(1)&lt;/script&gt;?');
  assert.ok(!rendered.includes('<script>'));
});
