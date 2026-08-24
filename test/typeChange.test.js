'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const typeChange = require('../src/services/typeChange');

test('allowedTargetTypes excludes modpack platforms and CUSTOM, includes plain flavors', () => {
  const values = typeChange.allowedTargetTypes().map((o) => o.value);
  for (const excluded of ['AUTO_CURSEFORGE', 'CURSEFORGE', 'MODRINTH', 'FTBA', 'GTNH', 'CUSTOM']) {
    assert.ok(!values.includes(excluded), `${excluded} should not be offered`);
  }
  for (const included of ['PAPER', 'FABRIC', 'FORGE', 'NEOFORGE', 'VANILLA', 'PURPUR']) {
    assert.ok(values.includes(included), `${included} should be offered`);
  }
});

test('typeLabel looks up the catalog label and falls back to the raw value', () => {
  assert.equal(typeChange.typeLabel('FABRIC'), 'Fabric');
  assert.equal(typeChange.typeLabel('NOT_A_REAL_TYPE'), 'NOT_A_REAL_TYPE');
});

test('previewTypeChange rejects an unknown server', () => {
  assert.throws(() => typeChange.previewTypeChange('srv_missing', 'FABRIC'), /Server not found/);
});

test('previewTypeChange rejects switching to the current type', () => {
  const id = app.seedServer('srv_tc_same');
  assert.throws(() => typeChange.previewTypeChange(id, 'PAPER'), /already/i);
});

test('previewTypeChange rejects a modpack-platform target (goes through the pack installer instead)', () => {
  const id = app.seedServer('srv_tc_pack');
  assert.throws(() => typeChange.previewTypeChange(id, 'MODRINTH'), /modpack installer/);
});

test('previewTypeChange has no warnings for a same-family, same-content-type switch', () => {
  const id = app.seedServer('srv_tc_clean'); // PAPER, no mc_version override, no env
  db.run(`UPDATE servers SET mc_version = '1.21.1' WHERE id = ?`, id);
  const { warnings, fromType, toType } = typeChange.previewTypeChange(id, 'PURPUR');
  assert.deepEqual(warnings, []);
  assert.equal(fromType, 'PAPER');
  assert.equal(toType, 'PURPUR');
});

test('previewTypeChange warns about world-family mismatch switching plugin family to modded', () => {
  const id = app.seedServer('srv_tc_family');
  db.run(`UPDATE servers SET mc_version = '1.21.1' WHERE id = ?`, id);
  const { warnings } = typeChange.previewTypeChange(id, 'FABRIC');
  assert.ok(
    warnings.some((w) => /Paper server but the target runs Fabric/.test(w)),
    `expected a family-mismatch warning, got: ${JSON.stringify(warnings)}`
  );
});

test('previewTypeChange warns about mods/plugins not carrying over across the plugin/mod boundary', () => {
  const id = app.seedServer('srv_tc_content');
  const { warnings } = typeChange.previewTypeChange(id, 'FABRIC'); // PAPER (plugin) -> FABRIC (mod)
  assert.ok(
    warnings.some((w) => /Plugins installed through this panel won't run on Fabric/.test(w)),
    `expected a content-directory warning, got: ${JSON.stringify(warnings)}`
  );
});

test('previewTypeChange warns about loader-specific env vars that will be cleared', () => {
  const id = app.seedServer('srv_tc_env');
  db.run(
    `UPDATE servers SET env_json = ? WHERE id = ?`,
    JSON.stringify({ PAPER_BUILD: '123', VIEW_DISTANCE: '10' }),
    id
  );
  const { warnings } = typeChange.previewTypeChange(id, 'PURPUR');
  const cleared = warnings.find((w) => w.includes('will be cleared'));
  assert.ok(cleared, `expected an env-clearing warning, got: ${JSON.stringify(warnings)}`);
  assert.match(cleared, /PAPER_BUILD/);
  assert.doesNotMatch(cleared, /VIEW_DISTANCE/); // unrelated user env isn't flagged
});

test('previewTypeChange warns when BlueMap is enabled', () => {
  const id = app.seedServer('srv_tc_map');
  db.run(
    `INSERT INTO integrations (server_id, kind, enabled, config_json) VALUES (?, 'bluemap', 1, '{"hostPort":25995}')`,
    id
  );
  const { warnings } = typeChange.previewTypeChange(id, 'PURPUR');
  assert.ok(warnings.some((w) => /live map \(BlueMap\) will be disabled/.test(w)));
});

test('previewTypeChange warns when a Java tag override will be cleared', () => {
  const id = app.seedServer('srv_tc_java');
  db.run(`UPDATE servers SET java_tag = 'java21' WHERE id = ?`, id);
  const { warnings } = typeChange.previewTypeChange(id, 'PURPUR');
  assert.ok(warnings.some((w) => /pinned Java version \(java21\) will be cleared/.test(w)));
});
