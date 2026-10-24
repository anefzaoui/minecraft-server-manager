'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const auth = require('../src/services/auth');

let cookie;
let adminUser;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  adminUser = auth.listUsers().find((u) => u.role === 'admin');
});

test.after(async () => {
  await app.stop();
});

test('GET /api/settings/language returns current language and supported list', async () => {
  const r = await app.req('GET', '/api/settings/language', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.ok(r.json.supportedLanguages.length >= 6);
});

test('POST /api/settings/language saves user preference in DB and session', async () => {
  // Set to German
  const r = await app.req('POST', '/api/settings/language', {
    cookie,
    body: { language: 'de' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.language, 'de');

  // Verify in DB via auth.getUser
  const updated = auth.getUser(adminUser.id);
  assert.equal(updated.language, 'de');

  // Reset to auto
  const rAuto = await app.req('POST', '/api/settings/language', {
    cookie,
    body: { language: 'auto' },
  });
  assert.equal(rAuto.status, 200);
  assert.equal(auth.getUser(adminUser.id).language, null);
});

test('POST /api/settings/language rejects invalid languages', async () => {
  const r = await app.req('POST', '/api/settings/language', {
    cookie,
    body: { language: 'klingon' },
  });
  assert.equal(r.status, 400);
});

test('HTML rendering reflects language and direction (including Arabic RTL)', async () => {
  // 1. Set language to Arabic
  await app.req('POST', '/api/settings/language', {
    cookie,
    body: { language: 'ar' },
  });

  const rAr = await app.req('GET', '/settings', { cookie });
  assert.equal(rAr.status, 200);
  assert.match(rAr.text, /<html lang="ar" dir="rtl"/);

  // 2. Set language to German
  await app.req('POST', '/api/settings/language', {
    cookie,
    body: { language: 'de' },
  });

  const rDe = await app.req('GET', '/settings', { cookie });
  assert.equal(rDe.status, 200);
  assert.match(rDe.text, /<html lang="de" dir="ltr"/);
  // Check German translations are present
  assert.match(rDe.text, /Zeitzone &amp; Region|Zeitzone/);
  assert.match(rDe.text, /id="set-lang"/);

  // 3. Reset to auto
  await app.req('POST', '/api/settings/language', {
    cookie,
    body: { language: 'auto' },
  });
});

test('Browser Accept-Language header is used when language is auto', async () => {
  // Request with French Accept-Language header
  const r = await app.req('GET', '/login', {
    headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' },
  });
  assert.equal(r.status, 200);
  assert.match(r.text, /<html lang="fr" dir="ltr"/);
  assert.match(r.text, /Se connecter/); // French translation for Sign in button
});

test('viewer role can change language via /api/account/language and /api/settings/language', async () => {
  const viewerUser = await auth.createUser(
    { username: 'test_viewer_lang', password: 'password123', role: 'viewer' },
    { actor: 'test' }
  );
  const loginRes = await app.req('POST', '/login', {
    body: { username: 'test_viewer_lang', password: 'password123' },
  });
  const viewerCookie = (loginRes.setCookie || []).map((c) => c.split(';')[0]).join('; ');

  // 1. Viewer sets language via /api/account/language
  const res1 = await app.req('POST', '/api/account/language', {
    cookie: viewerCookie,
    body: { language: 'de' },
  });
  assert.equal(res1.status, 200);
  assert.equal(auth.getUser(viewerUser.id).language, 'de');

  // 2. Viewer sets language via /api/settings/language (allowed through requireWrite)
  const res2 = await app.req('POST', '/api/settings/language', {
    cookie: viewerCookie,
    body: { language: 'es' },
  });
  assert.equal(res2.status, 200);
  assert.equal(auth.getUser(viewerUser.id).language, 'es');
});

test('login error messages are localized when requested in German', async () => {
  const r = await app.req('POST', '/login', {
    headers: { 'Accept-Language': 'de-DE,de;q=0.9' },
    body: { username: 'nonexistent_user', password: 'badpassword' },
  });
  assert.equal(r.status, 401);
  assert.match(r.text, /Falscher Benutzername oder Passwort\./);
});
