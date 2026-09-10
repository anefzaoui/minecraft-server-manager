'use strict';

// The Console tab can download the server's full game logs, not just the capped
// in-memory docker tail: latest.log, any one rotated file, and a .zip of the lot.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const config = require('../src/config');

let cookie;
let id;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  id = app.seedServer('srv_logs01');
  const logsDir = path.join(config.dataDir, 'servers', id, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(logsDir, 'latest.log'), '[12:00:00] [Server thread/INFO]: Done!\n');
  fs.writeFileSync(path.join(logsDir, '2026-01-01-1.log.gz'), Buffer.from([0x1f, 0x8b, 0x08, 0x00]));
  fs.writeFileSync(path.join(logsDir, 'notalog.txt'), 'ignore me');
});

test.after(async () => app.stop());

test('GET /logs/game lists latest.log first, then rotated files, and nothing else', async () => {
  const r = await app.req('GET', `/api/servers/${id}/logs/game`, { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.json.files.map((f) => f.file),
    ['latest.log', '2026-01-01-1.log.gz']
  );
});

test('GET /logs/game/:file downloads one log file', async () => {
  const r = await app.req('GET', `/api/servers/${id}/logs/game/latest.log`, { cookie });
  assert.equal(r.status, 200);
  assert.match(r.text, /Done!/);
});

test('GET /logs/game/:file rejects a traversal / non-log name', async () => {
  const r = await app.req('GET', `/api/servers/${id}/logs/game/..%2F..%2Fserver.properties`, { cookie });
  assert.notEqual(r.status, 200);
});

test('GET /logs/bundle.zip streams a zip of the log folder', async () => {
  const r = await app.req('GET', `/api/servers/${id}/logs/bundle.zip`, { cookie });
  assert.equal(r.status, 200);
  assert.match(String(r.headers.get('content-disposition') || ''), /\.zip/);
  assert.equal(r.text.slice(0, 2), 'PK'); // zip local file header magic
});
