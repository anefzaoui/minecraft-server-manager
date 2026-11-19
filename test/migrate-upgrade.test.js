'use strict';

// Upgrading a panel that already has data: start from the schema as it was after
// migration 003 (real rows in it), run every later migration, and check nothing
// was lost or left inconsistent. Also pins that each migration file is recorded
// exactly once, in order.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/db');
const { migrate } = require('../src/db/migrate');

const DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');
const files = fs
  .readdirSync(DIR)
  .filter((f) => /^\d{3}_.+\.js$/.test(f))
  .sort();

function applyThrough(maxNumber) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  for (const f of files.filter((x) => Number(x.slice(0, 3)) <= maxNumber)) {
    db.transaction(() => {
      require(path.join(DIR, f)).up(db);
      db.run('INSERT INTO schema_migrations (version) VALUES (?)', f.replace(/\.js$/, ''));
    });
  }
}

const cols = (table) => db.all(`PRAGMA table_info(${table})`).map((c) => c.name);

test('an old database keeps its data through every later migration', () => {
  applyThrough(3);
  assert.ok(!cols('servers').includes('console_label'), 'starts from the old schema');

  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES ('srv_old', 'Old Server', 'PAPER', 25565, 25575, 'cipher', 2048, 3072)`
  );
  db.run(
    `INSERT INTO events (server_id, actor, type, summary) VALUES ('srv_old', 'admin', 'created', 'Server created.')`
  );
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES ('srv_old', 'curseforge', 'atm10', 'ATM 10', '100', 'v1')`
  );
  db.run("INSERT INTO settings (key, value_json) VALUES ('panel.timezone', '\"Europe/Paris\"')");

  const applied = migrate();
  assert.equal(applied, files.length - 3, 'exactly the later migrations ran');

  const srv = db.get("SELECT * FROM servers WHERE id = 'srv_old'");
  assert.equal(srv.display_name, 'Old Server');
  assert.equal(srv.heap_mb, 2048);
  assert.equal(srv.rcon_password_cipher, 'cipher', 'secrets are untouched');
  assert.ok('console_label' in srv, 'new columns exist with defaults');
  assert.equal(db.get("SELECT COUNT(*) AS n FROM events WHERE server_id = 'srv_old'").n, 1);
  const pack = db.get("SELECT * FROM server_packs WHERE server_id = 'srv_old'");
  assert.equal(pack.pinned_version_id, '100');
  assert.ok('max_java_version' in pack && 'channel' in pack, 'GTNH columns added, existing pin intact');
  assert.equal(
    JSON.parse(db.get("SELECT value_json FROM settings WHERE key = 'panel.timezone'").value_json),
    'Europe/Paris'
  );
});

test('every migration file is recorded exactly once, and a re-run applies nothing', () => {
  const recorded = db.all('SELECT version FROM schema_migrations ORDER BY version').map((r) => r.version);
  assert.deepEqual(
    recorded,
    files.map((f) => f.replace(/\.js$/, ''))
  );
  assert.equal(migrate(), 0);
});

test('migration 004 collapses duplicate library files and re-points the content that used them', () => {
  // The unique index exists now; rebuild the pre-004 state to exercise the collapse.
  db.exec('DROP INDEX IF EXISTS uniq_library_sha_cat');
  const lib = (id) =>
    db.run(
      `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes)
       VALUES (?, 'mod', 'Sodium', ?, ?, 'samehash', 10)`,
      id,
      `${id}.jar`,
      `library/${id}.jar`
    );
  lib('lib_a');
  lib('lib_b');
  lib('lib_c');
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename)
     VALUES ('sc_1', 'srv_old', 'lib_c', 'mod', 'overlay', 'Sodium', 'sodium.jar')`
  );
  require(path.join(DIR, '004_library_dedup.js')).up(db);
  const left = db.all("SELECT id FROM library_files WHERE sha256 = 'samehash'").map((r) => r.id);
  assert.deepEqual(left, ['lib_a'], 'the lowest id survives');
  assert.equal(db.get("SELECT library_id FROM server_content WHERE id = 'sc_1'").library_id, 'lib_a');
  assert.throws(() => lib('lib_d'), /UNIQUE/, 'the unique index is back in force');
});

test('migration 004 is safe on a library with no duplicates and different categories may share a hash', () => {
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes)
     VALUES ('lib_dp', 'datapack', 'Same File', 'x.zip', 'library/x.zip', 'samehash', 10)`
  );
  require(path.join(DIR, '004_library_dedup.js')).up(db);
  assert.equal(db.all("SELECT 1 FROM library_files WHERE sha256 = 'samehash'").length, 2);
});

test('a migration that throws leaves no half-applied state and is not recorded', () => {
  const bad = path.join(DIR, '998_broken_probe.js');
  fs.writeFileSync(
    bad,
    "exports.up = (db) => { db.exec('CREATE TABLE _probe_broken (id INTEGER)'); throw new Error('nope'); };\n"
  );
  try {
    assert.throws(() => migrate(), /nope/);
  } finally {
    fs.rmSync(bad, { force: true });
  }
  assert.equal(db.get("SELECT 1 AS x FROM sqlite_master WHERE name = '_probe_broken'"), undefined, 'rolled back');
  assert.equal(db.get("SELECT 1 AS x FROM schema_migrations WHERE version = '998_broken_probe'"), undefined);
  assert.equal(migrate(), 0, 'the panel still boots normally afterwards');
});
