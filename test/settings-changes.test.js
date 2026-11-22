'use strict';

// Issue #113: a Settings save wrote settings nobody touched. The page now
// reads every control as it was rendered and sends only what differs at Save
// (public/js/lib/settingsChanges.js). This file runs that browser module itself.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/** @type {any} */
let lib;
test.before(async () => {
  // A .js file in a CommonJS package: a data: URL makes Node parse it as ESM.
  const src = fs.readFileSync(path.join(__dirname, '../public/js/lib/settingsChanges.js'), 'utf8');
  lib = await import(`data:text/javascript,${encodeURIComponent(src)}`);
});

const ENV = { VIEW_DISTANCE: '20', MOTD: 'Hi', ALLOW_FLIGHT: 'true', INIT_MEMORY: '512M' };

/** The advanced fields as the page renders them for ENV. */
function rendered(fields, env = ENV) {
  const out = {};
  for (const [key, field] of Object.entries(fields)) {
    out[key] = { type: field.type, value: lib.renderedValue(field, env, key) };
  }
  return out;
}

const FIELDS = {
  VIEW_DISTANCE: { type: 'number' },
  SIMULATION_DISTANCE: { type: 'number' },
  MAX_WORLD_SIZE: { type: 'number' },
  ALLOW_FLIGHT: { type: 'boolean', default: 'false' },
  ALLOW_NETHER: { type: 'boolean', default: 'true' },
  MODE: { type: 'enum', default: 'survival' },
  LEVEL_TYPE: { type: 'enum' },
};

test('a field shows the env value, else its default (booleans, enums) or nothing', () => {
  const r = rendered(FIELDS);
  assert.equal(r.VIEW_DISTANCE.value, '20');
  assert.equal(r.MAX_WORLD_SIZE.value, '');
  assert.equal(r.ALLOW_FLIGHT.value, 'true');
  assert.equal(r.ALLOW_NETHER.value, 'true');
  assert.equal(r.MODE.value, 'survival');
  assert.equal(r.LEVEL_TYPE.value, '');
});

test('a save with nothing touched changes no env key, not even a default the page shows', () => {
  const before = rendered(FIELDS);
  const { env, changed } = lib.mergeEnvChanges(ENV, before, structuredClone(before));
  assert.deepEqual(changed, []);
  assert.deepEqual(env, ENV);
  // The select shows MODE's default; the old save wrote it into the env.
  assert.equal('MODE' in env, false);
});

test('changing one field changes that key only', () => {
  const before = rendered(FIELDS);
  const after = structuredClone(before);
  after.SIMULATION_DISTANCE.value = '8';
  const { env, changed } = lib.mergeEnvChanges(ENV, before, after);
  assert.deepEqual(changed, ['SIMULATION_DISTANCE']);
  assert.deepEqual(env, { ...ENV, SIMULATION_DISTANCE: '8' });
});

test('an emptied field removes its key, so the setting is back to its default', () => {
  const env0 = { ...ENV, MAX_WORLD_SIZE: '20' };
  const before = rendered(FIELDS, env0);
  assert.equal(before.MAX_WORLD_SIZE.value, '20');
  const after = structuredClone(before);
  after.MAX_WORLD_SIZE.value = '';
  const { env, changed } = lib.mergeEnvChanges(env0, before, after);
  assert.deepEqual(changed, ['MAX_WORLD_SIZE']);
  assert.equal('MAX_WORLD_SIZE' in env, false);
  assert.deepEqual(env, ENV);
});

test('a boolean turned to its default is stored, not dropped', () => {
  const before = rendered(FIELDS);
  const after = structuredClone(before);
  after.ALLOW_FLIGHT.value = 'false';
  assert.deepEqual(lib.mergeEnvChanges(ENV, before, after).env, { ...ENV, ALLOW_FLIGHT: 'false' });
});

test('an untouched value keeps its stored spelling (INIT_MEMORY 512M shown as 512)', () => {
  const before = { INIT_MEMORY: { type: 'number', value: '512' } };
  const { env, changed } = lib.mergeEnvChanges(ENV, before, structuredClone(before));
  assert.deepEqual(changed, []);
  assert.equal(env.INIT_MEMORY, '512M');
});

test('changing only the CPU slider names only the CPU (the save sends nothing else)', () => {
  const before = { heapMb: '4096', containerMemoryMb: '6144', cpus: '2', diskQuotaGb: '0', name: 'Fabric' };
  assert.deepEqual(lib.changedKeys(before, { ...before, cpus: '4' }), ['cpus']);
  assert.deepEqual(lib.changedKeys(before, { ...before }), []);
});

test('a slider range grows to hold a setting outside it, and is left alone otherwise', () => {
  assert.deepEqual(lib.fitRange({ min: 1024, max: 20480 }, 24576), { min: 1024, max: 24576 });
  assert.deepEqual(lib.fitRange({ min: 1024, max: 16384 }, 512), { min: 512, max: 16384 });
  assert.deepEqual(lib.fitRange({ min: 0, max: 16 }, 2.5), { min: 0, max: 16 });
  assert.deepEqual(lib.fitRange({ min: 0, max: 16 }, Number.NaN), { min: 0, max: 16 });
});
