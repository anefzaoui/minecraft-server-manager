'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { fields, getField, SECTIONS } = require('../src/config/field-catalog');

test('every field key is unique within its scope', () => {
  const seen = new Set();
  for (const f of fields) {
    const id = `${f.scope}:${f.key}`;
    assert.equal(seen.has(id), false, `duplicate catalog entry: ${id}`);
    seen.add(id);
  }
});

test('every field lands in a declared section', () => {
  const ids = new Set(SECTIONS.map((s) => s.id));
  for (const f of fields) {
    assert.equal(ids.has(f.section), true, `${f.key} has unknown section "${f.section}"`);
  }
});

test('the GTNH pack vars are catalogued and panel-managed', () => {
  const version = getField('env', 'GTNH_PACK_VERSION');
  assert.ok(version, 'GTNH_PACK_VERSION missing from the catalog');
  assert.equal(version.section, 'packs');
  // Panel-managed: the installer UI owns it, so it must never render as a form field.
  assert.equal(version.hidden, true);
  assert.equal(getField('env', 'SKIP_GTNH_UPDATE_CHECK').hidden, true);
  assert.equal(getField('env', 'GTNH_DELETE_BACKUPS').type, 'boolean');
});
