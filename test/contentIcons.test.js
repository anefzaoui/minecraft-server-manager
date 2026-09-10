'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/app'); // migrates the DB
const db = require('../src/db');
const library = require('../src/services/library');
const modrinth = require('../src/services/modrinthApi');
const { backfillContentMeta } = require('../src/services/contentIcons');

function seedLib(id, cols) {
  const full = {
    category: 'datapack',
    name: id,
    filename: `${id}.zip`,
    rel_path: `library/${id}`,
    sha256: `sha-${id}`,
    size_bytes: 100,
    version: null,
    icon_url: null,
    icon_rel_path: null,
    platform: null,
    project_id: null,
    file_id: null,
    mc_versions_json: '[]',
    loaders_json: '[]',
    ...cols,
  };
  const keys = Object.keys(full);
  db.run(
    `INSERT INTO library_files (id, ${keys.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`,
    id,
    ...keys.map((k) => full[k])
  );
  return db.get('SELECT * FROM library_files WHERE id = ?', id);
}

test('ensureContentMeta backfills name/version/mc-versions/icon_url from the platform API', async () => {
  const realGetProject = modrinth.getProject;
  const realGetVersion = modrinth.getVersion;
  modrinth.getProject = async () => ({
    title: 'Sky Void Additions',
    icon_url: 'https://example.invalid/svA.png',
    game_versions: ['1.21', '1.21.1'],
    loaders: ['datapack'],
  });
  modrinth.getVersion = async () => ({ version_number: '1.5.2' });

  const row = seedLib('lib_meta1', {
    name: 'sky-void-additions-1.5.2.zip', // filename-derived, no display value
    filename: 'sky-void-additions-1.5.2.zip',
    platform: 'modrinth',
    project_id: 'sky-void-additions',
    file_id: 'v-abc',
  });

  try {
    await library.ensureContentMeta(row);
    const after = db.get('SELECT * FROM library_files WHERE id = ?', 'lib_meta1');
    assert.equal(after.name, 'Sky Void Additions');
    assert.equal(after.version, '1.5.2');
    assert.equal(after.icon_url, 'https://example.invalid/svA.png');
    assert.deepEqual(JSON.parse(after.mc_versions_json), ['1.21', '1.21.1']);
    assert.deepEqual(JSON.parse(after.loaders_json), ['datapack']);
  } finally {
    modrinth.getProject = realGetProject;
    modrinth.getVersion = realGetVersion;
  }
});

test('ensureContentMeta makes no platform call when the row is already complete', async () => {
  const fs = require('node:fs');
  const { dataPath } = require('../src/storage/pathGuard');
  const rel = 'library/icons/mods/lib_meta2.png';
  fs.mkdirSync(dataPath('library/icons/mods'), { recursive: true });
  fs.writeFileSync(dataPath(rel), 'png');

  const row = seedLib('lib_meta2', {
    name: 'Terralith',
    version: '2.5.0',
    mc_versions_json: '["1.21"]',
    icon_rel_path: rel,
    platform: 'modrinth',
    project_id: 'terralith',
  });

  const realGetProject = modrinth.getProject;
  let called = false;
  modrinth.getProject = async () => {
    called = true;
    return {};
  };
  try {
    await library.ensureContentMeta(row);
    assert.equal(called, false, 'no API round-trip for an already-complete row');
  } finally {
    modrinth.getProject = realGetProject;
  }
});

test('backfillContentMeta only touches rows that need repair and reports counts', async () => {
  const fs = require('node:fs');
  const { dataPath } = require('../src/storage/pathGuard');
  const okRel = 'library/icons/mods/lib_bf_ok.png';
  fs.mkdirSync(dataPath('library/icons/mods'), { recursive: true });
  fs.writeFileSync(dataPath(okRel), 'png');

  seedLib('lib_bf_ok', {
    name: 'Complete Pack',
    version: '1.0',
    mc_versions_json: '["1.21"]',
    icon_rel_path: okRel,
    platform: 'modrinth',
    project_id: 'complete',
  });
  seedLib('lib_bf_needs1', { name: 'needs1.zip', platform: 'modrinth', project_id: 'needs1', file_id: 'v1' });
  seedLib('lib_bf_needs2', { name: 'needs2.zip', platform: 'curseforge', project_id: '42', file_id: '99' });
  // Non-registry row: nothing to repair from, must be skipped.
  seedLib('lib_bf_upload', { name: 'manual.zip', platform: 'upload' });

  const real = library.ensureContentMeta;
  const seen = [];
  library.ensureContentMeta = async (r) => {
    seen.push(r.id);
    db.run('UPDATE library_files SET version = ? WHERE id = ?', '9.9', r.id);
  };
  try {
    const result = await backfillContentMeta();
    assert.ok(seen.includes('lib_bf_needs1') && seen.includes('lib_bf_needs2'), 'both needy rows processed');
    assert.ok(!seen.includes('lib_bf_ok'), 'a complete row is skipped');
    assert.ok(!seen.includes('lib_bf_upload'), 'a non-registry row with no icon URL is skipped');
    assert.equal(result.scanned, seen.length);
    assert.equal(result.repaired, seen.length); // the stub bumps version on every row
  } finally {
    library.ensureContentMeta = real;
  }
});

test('a row the registry could not complete is stamped and left alone until the recheck window passes', async (t) => {
  let calls = 0;
  t.mock.method(modrinth, 'getProject', async (id) => {
    if (id === 'gone-project') calls += 1; // rows from earlier tests may be repaired too
    return null; // project gone / no icon published: nothing to repair with
  });
  const row = seedLib('lib_stamped', {
    platform: 'modrinth',
    project_id: 'gone-project',
    version: '1.0',
    name: 'Gone',
  });
  await library.ensureContentMeta(row);
  assert.equal(calls, 1);
  const after = db.get('SELECT meta_checked_at FROM library_files WHERE id = ?', row.id);
  assert.ok(after.meta_checked_at, 'the attempt was stamped');
  assert.equal(library.metaCheckedRecently(after), true);

  // The nightly backfill skips it now...
  const r = await backfillContentMeta();
  assert.equal(calls, 1, 'backfill did not re-fetch a freshly checked row');
  assert.ok(r.scanned >= 0);

  // ...and picks it up again once the stamp is old enough.
  db.run("UPDATE library_files SET meta_checked_at = datetime('now', '-8 days') WHERE id = ?", row.id);
  await backfillContentMeta();
  assert.equal(calls, 2, 'backfill retried after the recheck window');
});
