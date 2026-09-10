'use strict';

// Regression coverage for Bug 5's backup-rename half: PATCH /api/backups/:id
// renames the DB row AND the archive on disk together, is admin/operator only,
// and rejects hostile, oversize, ghost-archive and duplicate names.

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { dataPath } = require('../src/storage/pathGuard');
const { renameBackup } = require('../src/services/backups');

let cookie;
let opCookie;
let viewerCookie;

async function login(username, password, role) {
  const auth = require('../src/services/auth');
  await auth.createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  opCookie = await login('bkrenameop', 'operatorpass123', 'operator');
  viewerCookie = await login('bkrenameviewer', 'viewerpass123', 'viewer');
});

test.after(async () => {
  await app.stop();
});

test.beforeEach(() => {
  db.run('DELETE FROM backups');
  db.run('DELETE FROM servers');
  db.run('DELETE FROM events');
});

const SERVER = 'srv_ren01';

function seedServer() {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
     VALUES (?, ?, 'PAPER', 25701, 26701, 'x', 1024, 1536, 'stopped')`,
    SERVER,
    'Rename Test'
  );
}

function seedBackup(id, filename) {
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, created_at)
     VALUES (?, ?, ?, ?, 2048, 'manual', datetime('2026-01-01 12:00:00'))`,
    id,
    SERVER,
    filename,
    `backups/${SERVER}/${filename}`
  );
  return path.join(dataPath('backups'), SERVER, filename);
}

async function touch(p) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, 'archive bytes');
}

const row = (id) => db.get('SELECT * FROM backups WHERE id = ?', id);
const exists = async (p) =>
  fsp.access(p).then(
    () => true,
    () => false
  );

test('renameBackup renames the DB row and the file on disk together', async () => {
  seedServer();
  const id = 'bk_ren_ok';
  const oldName = 'srv_ren01-manual-20260101-000001-abcd1234.zip';
  const oldPath = seedBackup(id, oldName);
  await touch(oldPath);

  const res = await renameBackup(id, 'My First Backup.zip', { actor: 'test-op' });

  assert.equal(res.id, id);
  assert.equal(res.filename, 'My First Backup.zip');
  const r = row(id);
  assert.equal(r.filename, 'My First Backup.zip');
  assert.equal(r.rel_path, `backups/${SERVER}/My First Backup.zip`);
  assert.equal(await exists(oldPath), false, 'old archive should be gone');
  assert.equal(
    await exists(path.join(dataPath('backups'), SERVER, 'My First Backup.zip')),
    true,
    'renamed archive should exist'
  );
  const ev = db.get(`SELECT * FROM events WHERE type = 'backup-renamed' ORDER BY id DESC LIMIT 1`);
  assert.ok(ev, 'a backup-renamed event should be recorded');
  assert.equal(ev.actor, 'test-op');
  assert.equal(ev.server_id, SERVER);
  assert.match(ev.details_json, /My First Backup\.zip/);
});

test('renaming to the current name is a 200 no-op (row and file untouched)', async () => {
  seedServer();
  const id = 'bk_ren_same';
  const p = seedBackup(id, 'same.zip');
  await touch(p);

  const r = await app.req('PATCH', `/api/backups/${id}`, { cookie, body: { filename: 'same.zip' } });

  assert.equal(r.status, 200);
  assert.equal(r.json.backup.filename, 'same.zip');
  assert.equal(await exists(p), true);
  assert.equal(
    db.get(`SELECT COUNT(*) AS n FROM events WHERE type = 'backup-renamed'`).n,
    0,
    'no-op must not log an event'
  );
});

test('role gate: operator 200, viewer 403', async () => {
  seedServer();
  const id = 'bk_ren_role';
  seedBackup(id, 'role.zip');
  await touch(path.join(dataPath('backups'), SERVER, 'role.zip'));

  const asViewer = await app.req('PATCH', `/api/backups/${id}`, {
    cookie: viewerCookie,
    body: { filename: 'role-renamed.zip' },
  });
  assert.equal(asViewer.status, 403);

  const asOp = await app.req('PATCH', `/api/backups/${id}`, {
    cookie: opCookie,
    body: { filename: 'role-renamed.zip' },
  });
  assert.equal(asOp.status, 200);
  assert.equal(asOp.json.backup.filename, 'role-renamed.zip');
  assert.equal(row(id).filename, 'role-renamed.zip');
  assert.equal(await exists(path.join(dataPath('backups'), SERVER, 'role-renamed.zip')), true);
});

test('API rejects empty, hostile, oversize and control-char names without touching row or file', async () => {
  seedServer();
  const id = 'bk_ren_bad';
  const p = seedBackup(id, 'ok-before.zip');
  await touch(p);

  const names = ['', ' ', '.', '..', '../escape.zip', 'a\\b.zip', 'a/b.zip', 'x'.repeat(121), 'bad\u0007name.zip'];
  for (const name of names) {
    const r = await app.req('PATCH', `/api/backups/${id}`, { cookie, body: { filename: name } });
    assert.equal(r.status, 400, `expected 400 for ${JSON.stringify(name)}, got ${r.status}`);
  }

  assert.equal(row(id).filename, 'ok-before.zip', 'row must be untouched after rejected renames');
  assert.equal(await exists(p), true, 'archive must be untouched after rejected renames');
});

test('unknown backup id is a 404 and a missing archive on disk is a 404', async () => {
  seedServer();
  const missing = await app.req('PATCH', '/api/backups/bk_ren_nope', { cookie, body: { filename: 'x.zip' } });
  assert.equal(missing.status, 404);

  const id = 'bk_ren_ghost';
  seedBackup(id, 'ghost.zip'); // no file on disk
  await assert.rejects(renameBackup(id, 'new.zip', { actor: 'test' }), (err) => err.status === 404);
  assert.equal(row(id).filename, 'ghost.zip', 'row must survive a failed rename');
});

test('collision with an existing archive name is a 409 and leaves both files alone', async () => {
  seedServer();
  const a = 'first.zip';
  const b = 'second.zip';
  const pa = seedBackup('bk_ren_col1', a);
  const pb = seedBackup('bk_ren_col2', b);
  await touch(pa);
  await touch(pb);

  await assert.rejects(renameBackup('bk_ren_col1', b, { actor: 'test' }), (err) => err.status === 409);
  const r = await app.req('PATCH', '/api/backups/bk_ren_col1', { cookie, body: { filename: b } });
  assert.equal(r.status, 409, 'API collision should surface as 409');
  assert.match(r.json.error, /already exists/);

  assert.equal(row('bk_ren_col1').filename, a);
  assert.equal(row('bk_ren_col2').filename, b);
  assert.equal(await exists(pa), true);
  assert.equal(await exists(pb), true);
});

test('both backup pages render the rename affordance', async () => {
  seedServer();
  seedBackup('bk_ren_page', 'page.zip');

  const global = await app.req('GET', '/backups', { cookie: opCookie });
  assert.equal(global.status, 200);
  assert.match(global.text, /data-backup-action="rename"/);

  const server = await app.req('GET', `/servers/${SERVER}/backups`, { cookie: opCookie });
  assert.equal(server.status, 200);
  assert.match(server.text, /data-backup-rename/);
});
