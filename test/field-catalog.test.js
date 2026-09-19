'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fields,
  getField,
  SECTIONS,
  LIVE_MANAGED_ENV_KEYS,
  SETTINGS_EXCLUDED_ENV_KEYS,
  propEnvMap,
} = require('../src/config/field-catalog');

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
  // NOT panel-set and NOT hidden: the image's check doubles as its installer,
  // so this is a user-visible advanced toggle with an off default.
  const skip = getField('env', 'SKIP_GTNH_UPDATE_CHECK');
  assert.equal(skip.hidden, undefined);
  assert.equal(skip.default, false);
  assert.equal(getField('env', 'GTNH_DELETE_BACKUPS').type, 'boolean');
});

test('every Settings-excluded env field is real, gameplay-scoped, and property-backed', () => {
  // The Settings tab never renders these keys (routes/index.js), so each one
  // must have a live/own channel. `prop` is that contract: a direct
  // server.properties edit of the key must always be able to un-set the env
  // var, or the itzg image re-asserts the value on every start and the edit
  // silently reverts (issue #39). This makes hiding an env field WITHOUT an
  // unlockable property structurally impossible.
  assert.ok(SETTINGS_EXCLUDED_ENV_KEYS.size >= 3, 'the exclusion set must not slim down without intent');
  for (const key of SETTINGS_EXCLUDED_ENV_KEYS) {
    const f = getField('env', key);
    assert.ok(f, `${key} excluded from Settings but missing from the catalog`);
    assert.equal(f.section, 'gameplay');
    assert.ok(f.prop, `${key} is hidden from Settings but has no server.properties prop to unlock`);
  }
});

test('live-managed env keys are the gameplay pair, a subset of the excluded set', () => {
  // These env vars are STRIPPED at creation and un-set on direct edit - the
  // image would otherwise re-assert them on every start, reverting the panel's
  // World Controls/file edits.
  assert.deepEqual([...LIVE_MANAGED_ENV_KEYS].sort(), ['DIFFICULTY', 'PVP']);
  for (const key of LIVE_MANAGED_ENV_KEYS) {
    assert.ok(SETTINGS_EXCLUDED_ENV_KEYS.has(key), `${key} is live-managed but not render-excluded`);
    assert.ok(getField('env', key).prop, `${key} is live-managed but not property-backed`);
  }
  // MOTD is the documented exception: render-excluded because it has its own
  // Settings field that writes env, but NOT live-managed (never stripped at
  // creation). A direct `motd` file edit still un-sets MOTD via propEnvMap so
  // the last write wins. Lock it in so nobody sweeps MOTD into the live-managed
  // set by mistake.
  assert.equal(SETTINGS_EXCLUDED_ENV_KEYS.has('MOTD'), true);
  assert.equal(LIVE_MANAGED_ENV_KEYS.has('MOTD'), false);
  assert.equal(getField('env', 'MOTD').prop, 'motd');
});

test('property-backed env fields have unique kebab-case props that propEnvMap resolves', () => {
  const seen = new Map();
  for (const f of fields) {
    if (f.scope !== 'env' || !f.prop) continue;
    assert.match(f.prop, /^[a-z0-9-]+$/, `${f.key}: prop "${f.prop}" must be lowercase kebab-case`);
    assert.equal(seen.has(f.prop), false, `duplicate server.properties prop: ${f.prop}`);
    seen.set(f.prop, f.key);
    assert.equal(propEnvMap.get(f.prop), f.key, `propEnvMap misaligned for ${f.prop}`);
  }
  assert.ok(seen.has('pvp'), 'PVP must stay property-backed (pvp)');
  assert.ok(seen.has('difficulty'), 'DIFFICULTY must stay property-backed (difficulty)');
  assert.ok(seen.has('gamemode'), 'MODE must map to the gamemode property');
  assert.ok(seen.has('level-name'), 'LEVEL must map to the level-name property');
});
