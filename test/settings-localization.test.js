'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate(); // settings live in the DB
const settings = require('../src/services/settings');

test('timezone defaults to auto-detection, accepts valid IANA zones, rejects junk', () => {
  // Auto: whatever the host resolves to (a non-empty IANA-ish string).
  assert.ok(settings.getTimezone().length > 0);
  assert.equal(settings.localization().timezoneAuto, true);

  assert.equal(settings.setTimezone('Europe/Paris'), 'Europe/Paris');
  assert.equal(settings.getTimezone(), 'Europe/Paris');
  assert.equal(settings.localization().timezoneAuto, false);

  assert.throws(() => settings.setTimezone('Mars/Phobos'), /Unknown time zone/);

  // Clearing returns to auto.
  settings.setTimezone('auto');
  assert.equal(settings.localization().timezoneAuto, true);
});

test('country stores a 2-letter code, uppercases, rejects junk, and feeds the locale', () => {
  assert.equal(settings.setCountry('gb'), 'GB');
  assert.equal(settings.getCountry(), 'GB');
  assert.match(settings.resolveLocale(), /-GB$/);

  assert.throws(() => settings.setCountry('USA'), /2-letter/);
  assert.throws(() => settings.setCountry('1'), /2-letter/);

  settings.setCountry('');
  assert.equal(settings.localization().countryAuto, true);
});

test('isValidTimezone / isValidCountry', () => {
  assert.equal(settings.isValidTimezone('America/New_York'), true);
  assert.equal(settings.isValidTimezone('Nowhere/Nope'), false);
  assert.equal(settings.isValidCountry('US'), true);
  assert.equal(settings.isValidCountry('United States'), false);
});

test('clientLocalization exposes just timezone + locale', () => {
  const c = settings.clientLocalization();
  assert.deepEqual(Object.keys(c).sort(), ['locale', 'timezone']);
});
