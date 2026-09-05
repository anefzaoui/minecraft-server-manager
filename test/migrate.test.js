'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
  const dir = path.join(__dirname, '..', 'src', 'db', 'migrations');
  const a = path.join(dir, '999_dup_guard_a.js');
  const b = path.join(dir, '999_dup_guard_b.js');
  fs.writeFileSync(a, 'exports.up = () => {};\n');
  fs.writeFileSync(b, 'exports.up = () => {};\n');
  try {
    assert.throws(() => migrate(), /Duplicate migration number 999/);
  } finally {
    fs.rmSync(a, { force: true });
    fs.rmSync(b, { force: true });
  }
  // The directory is clean again, so a normal run is still idempotent.
  assert.equal(migrate(), 0);
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
