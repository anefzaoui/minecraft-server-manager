'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const auth = require('../src/services/auth');
const catalog = require('../src/config/field-catalog');

let deCookie;

test.before(async () => {
  await app.start();
  await auth.createUser({ username: 'germanuser', password: 'password123', role: 'admin' }, { actor: 'test' });
  const db = require('../src/db');
  db.run("UPDATE users SET language = 'de' WHERE username = 'germanuser'");
  const r = await app.req('POST', '/login', { body: { username: 'germanuser', password: 'password123' } });
  deCookie = (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
});

test.after(async () => {
  await app.stop();
});

test('catalog localization helper translates sections and fields for German', () => {
  const SIMPLE_SECTIONS = new Set(['identity', 'flavor', 'resources']);
  const adv = catalog.SECTIONS.filter((s) => !SIMPLE_SECTIONS.has(s.id))
    .map((s) => ({ ...s, fields: catalog.forSection(s.id, 'advanced').filter((f) => f.scope === 'env') }))
    .filter((s) => s.fields.length);

  const localizedDe = catalog.localizeSections(adv, 'de');
  const jvmSection = localizedDe.find((s) => s.id === 'jvm');
  assert.equal(jvmSection.label, 'Java- / JVM-Tuning');

  const aikarField = jvmSection.fields.find((f) => f.key === 'USE_AIKAR_FLAGS');
  assert.equal(aikarField.label, 'Aikar-Optimierungs-Flags');
  assert.match(aikarField.help, /Bewährte Garbage-Collection-Optimierung/);
  assert.equal(aikarField.note, 'Empfohlen für gemoddete Server');

  const worldSection = localizedDe.find((s) => s.id === 'world');
  assert.equal(worldSection.label, 'Welt');
  const levelTypeField = worldSection.fields.find((f) => f.key === 'LEVEL_TYPE');
  assert.equal(levelTypeField.label, 'Welttyp');
  const flatOption = levelTypeField.options.find((o) => o.value === 'FLAT');
  assert.equal(flatOption.label, 'Flachwelt');

  // English fallback stays untouched
  const localizedEn = catalog.localizeSections(adv, 'en');
  const enJvm = localizedEn.find((s) => s.id === 'jvm');
  assert.equal(enJvm.label, 'Java / JVM Tuning');
});

test('wizard view renders German advanced section headers and localized fields for German user', async () => {
  const res = await app.req('GET', '/servers/new', { cookie: deCookie, headers: { Accept: 'text/html' } });
  assert.equal(res.status, 200);

  // Section headers
  assert.match(res.text, /Java- \/ JVM-Tuning/);
  assert.match(res.text, /Gameplay-Regeln/);
  assert.match(res.text, /Modpacks &amp; Inhalte/);
  assert.match(res.text, /Auto-Pause \/ Auto-Stopp/);

  // Field labels and notes
  assert.match(res.text, /Aikar-Optimierungs-Flags/);
  assert.match(res.text, /Empfohlen für gemoddete Server/);
  assert.match(res.text, /MeowIce-Flags/);
  assert.match(res.text, /Inkompatibel mit Aikar-Flags/);
  assert.match(res.text, /Standardwert verwenden/);
  assert.match(res.text, /Ein Eintrag pro Zeile/);
});

test('server settings view renders German advanced section headers and localized fields for German user', async () => {
  const serverId = app.seedServer('srv_de_test');
  const res = await app.req('GET', `/servers/${serverId}/settings`, {
    cookie: deCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(res.status, 200);

  // Section headers
  assert.match(res.text, /Java- \/ JVM-Tuning/);
  assert.match(res.text, /Gameplay-Regeln/);

  // Field labels and notes
  assert.match(res.text, /Aikar-Optimierungs-Flags/);
  assert.match(res.text, /Empfohlen für gemoddete Server/);
});
