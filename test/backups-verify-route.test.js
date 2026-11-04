'use strict';

// POST /api/backups/:id/verify: auth, 404, healthy and damaged archives.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = require('./helpers/app');
const db = require('../src/db');
const { dataPath } = require('../src/storage/pathGuard');
const { zipDirectory } = require('../src/services/backups');

let cookie;
let viewerCookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  const auth = require('../src/services/auth');
  await auth.createUser({ username: 'bkverifyviewer', password: 'viewerpass123', role: 'viewer' }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username: 'bkverifyviewer', password: 'viewerpass123' } });
  viewerCookie = (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
});
test.after(() => app.stop());

async function seedBackup() {
  const serverId = await app.seedServer();
  const id = typeof serverId === 'string' ? serverId : serverId.id;
  fs.mkdirSync(dataPath('servers', id), { recursive: true });
  fs.writeFileSync(dataPath('servers', id, 'a.txt'), 'hello');
  const rel = `backups/${id}/t.zip`;
  fs.mkdirSync(dataPath('backups', id), { recursive: true });
  await zipDirectory(dataPath('servers', id), dataPath(rel));
  db.run(
    "INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason) VALUES ('bk_v1', ?, 't.zip', ?, 1, 'manual')",
    id,
    rel
  );
  return rel;
}

test('verify: healthy archive is ok, damaged is 422, unknown is 404, viewer is refused', async () => {
  const rel = await seedBackup();
  const url = '/api/backups/bk_v1/verify';
  const ok = await app.req('POST', url, { cookie });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.ok, true);
  assert.equal(ok.json.bytes, 5);

  assert.equal((await app.req('POST', url, { cookie: viewerCookie })).status, 403);
  assert.equal((await app.req('POST', '/api/backups/bk_nope/verify', { cookie })).status, 404);

  fs.writeFileSync(dataPath(rel), 'garbage');
  assert.equal((await app.req('POST', url, { cookie })).status, 422);
});
