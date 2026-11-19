'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrate } = require('../src/db/migrate');
const db = require('../src/db');

test('migrate() applies the full schema from an empty DB, then is idempotent', () => {
  const first = migrate();
  assert.ok(first > 0, 'first run applies at least one migration');

  const second = migrate();
  assert.equal(second, 0, 'a second run applies nothing (idempotent)');
});

test('core tables exist after migration', () => {
  migrate();
  const tables = new Set(db.all("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name));
  for (const t of ['servers', 'settings', 'schema_migrations', 'player_events']) {
    assert.ok(tables.has(t), `expected table ${t}`);
  }
});

test('a renumbered migration recorded under its legacy filename is aliased, not re-run', () => {
  // Simulate an install that shipped before the 010-015 renumber: the work for
  // 011_wizard_chat exists but is recorded as 010_wizard_chat.
  db.run('DELETE FROM schema_migrations WHERE version = ?', '011_wizard_chat');
  db.run("INSERT INTO schema_migrations (version) VALUES ('010_wizard_chat')");
  try {
    const applied = migrate();
    assert.equal(applied, 0, 'the aliased migration is not re-run');
    const rows = db.all('SELECT version FROM schema_migrations').map((r) => r.version);
    assert.ok(rows.includes('011_wizard_chat'), 'the current filename is recorded');
    assert.ok(rows.includes('010_wizard_chat'), 'the legacy filename stays recorded');
  } finally {
    // Restore the clean post-migration state for the tests that follow.
    db.run('DELETE FROM schema_migrations WHERE version = ?', '010_wizard_chat');
    db.run('DELETE FROM schema_migrations WHERE version = ?', '011_wizard_chat');
    db.run("INSERT INTO schema_migrations (version) VALUES ('011_wizard_chat')");
  }
});

test('a duplicate migration number prefix is a loud boot failure, not a silent reorder', () => {
  // A throwaway folder, NOT src/db/migrations: test files run in parallel, and a
  // stray 999_* file in the real folder breaks every other test that migrates or
  // lists it while this one is running.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-migrations-'));
  try {
    fs.writeFileSync(path.join(dir, '999_dup_guard_a.js'), 'exports.up = () => {};\n');
    fs.writeFileSync(path.join(dir, '999_dup_guard_b.js'), 'exports.up = () => {};\n');
    assert.throws(() => migrate({ dir }), /Duplicate migration number 999/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // The real folder was never touched, so a normal run is still idempotent.
  assert.equal(migrate(), 0);
});

test('a throwaway migrations folder is applied and recorded like the real one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-migrations-'));
  try {
    fs.writeFileSync(
      path.join(dir, '900_probe.js'),
      "exports.up = (db) => db.exec('CREATE TABLE IF NOT EXISTS migrate_probe (id INTEGER)');\n"
    );
    assert.equal(migrate({ dir }), 1, 'the probe migration is applied');
    assert.equal(migrate({ dir }), 0, 'and not applied twice');
    assert.ok(db.get("SELECT 1 AS x FROM schema_migrations WHERE version = '900_probe'"));
  } finally {
    db.run("DELETE FROM schema_migrations WHERE version = '900_probe'");
    db.exec('DROP TABLE IF EXISTS migrate_probe');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('transaction() rolls back on throw', () => {
  migrate();
  db.run('CREATE TABLE IF NOT EXISTS _tx_probe (id INTEGER PRIMARY KEY, v TEXT)');
  db.run('DELETE FROM _tx_probe');
  assert.throws(() =>
    db.transaction(() => {
      db.run('INSERT INTO _tx_probe (v) VALUES (?)', 'x');
      throw new Error('boom');
    })
  );
  assert.equal(db.get('SELECT COUNT(*) AS n FROM _tx_probe').n, 0, 'insert was rolled back');
});
