'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
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
