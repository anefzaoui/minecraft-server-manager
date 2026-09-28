'use strict';

// Offsite backup destinations: validation, encrypted secrets, provider wire
// shapes (fetch stubbed per host), the upload engine, and the backups page.
// Local backups stay the default throughout - nothing here changes that.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const db = require('../src/db');
const remotes = require('../src/services/remotes');
const { dataPath } = require('../src/storage/pathGuard');

const realFetch = globalThis.fetch;
const upstreamCalls = [];
let upstreamRoutes = {};

function stubUpstream(routes) {
  upstreamRoutes = routes;
  upstreamCalls.length = 0;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url ? input.url : String(input);
    for (const [host, handler] of Object.entries(upstreamRoutes)) {
      if (url.includes(host)) {
        upstreamCalls.push(`${init?.method || 'GET'} ${url}`);
        return Promise.resolve(handler(new URL(url), init));
      }
    }
    return realFetch(input, init);
  };
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

const okJson = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
  headers: new Map(),
  arrayBuffer: async () => new ArrayBuffer(0),
});
const okStatus = (status, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] || null },
  json: async () => ({}),
  arrayBuffer: async () => new ArrayBuffer(0),
});

let cookie;
let viewerCookie;
let port = 27200;

function seedServer(id) {
  port += 2;
  db.run(
    `INSERT INTO servers (id, display_name, type, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status, env_json)
     VALUES (?, ?, 'PAPER', '1.21.4', ?, ?, 'x', 1024, 1536, 'stopped', '{}')`,
    id,
    id,
    port,
    port + 1
  );
  return id;
}

function seedBackup(serverId, id) {
  const rel = `backups/${serverId}/${id}.zip`;
  const abs = dataPath(rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, 'fake-zip-bytes');
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, note)
     VALUES (?, ?, ?, ?, 14, 'manual', '')`,
    id,
    serverId,
    `${id}.zip`,
    rel
  );
  return db.get('SELECT * FROM backups WHERE id = ?', id);
}

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  const authService = require('../src/services/auth');
  await authService.createUser(
    { username: 'remote_viewer', password: 'passw0rd-12345', role: 'viewer' },
    { actor: 'test' }
  );
  const r = await app.req('POST', '/login', { body: { username: 'remote_viewer', password: 'passw0rd-12345' } });
  viewerCookie = (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
});

test.after(async () => {
  restoreFetch();
  await app.stop();
});

test('destination validation rejects bad input without touching providers', async () => {
  upstreamCalls.length = 0;
  for (const body of [
    { name: 'x', provider: 'nope', config: {} },
    { name: '', provider: 'nextcloud', config: {} },
    { name: 'nc', provider: 'nextcloud', config: { url: 'ftp://x', username: 'u' } },
    { name: 'nc', provider: 'nextcloud', config: { url: 'https://x', username: 'u' }, secret: {} },
    { name: 'dbx', provider: 'dropbox', config: {}, secret: {} },
  ]) {
    const r = await app.req('POST', '/api/remotes', { cookie, body });
    assert.equal(r.status, 400, JSON.stringify(body));
  }
  assert.equal(upstreamCalls.length, 0);
});

test('secrets are stored encrypted, never plaintext', async () => {
  const r = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'NC Test',
      provider: 'nextcloud',
      config: { url: 'https://cloud.example.com', username: 'u', folder: 'Backups' },
      secret: { password: 'super-secret-pw' },
    },
  });
  assert.equal(r.status, 201);
  const row = db.get('SELECT * FROM remote_destinations WHERE id = ?', r.json.destination.id);
  assert.ok(row.secret_cipher);
  assert.ok(!row.secret_cipher.includes('super-secret-pw'));
  assert.ok(!JSON.stringify(r.json).includes('super-secret-pw'));
  assert.equal(r.json.destination.hasSecret, true);
  assert.equal(r.json.destination.authorized, true);
  assert.equal(r.json.destination.autoUpload, false);
});

test('viewer cannot manage destinations', async () => {
  const r = await app.req('POST', '/api/remotes', {
    cookie: viewerCookie,
    body: { name: 'x', provider: 'nextcloud', config: {} },
  });
  assert.equal(r.status, 403);
});

test('nextcloud test uses WebDAV propfind with basic auth', async () => {
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'NC Wire',
      provider: 'nextcloud',
      config: { url: 'https://cloud.example.com/', username: 'bob', folder: 'A/B' },
      secret: { password: 'pw' },
    },
  });
  const id = created.json.destination.id;
  let seenAuth = '';
  stubUpstream({
    'cloud.example.com': (url, init) => {
      seenAuth = init.headers.Authorization || '';
      assert.ok(url.pathname.includes('/remote.php/dav/files/bob/A/B'), `unexpected path ${url.pathname}`);
      return okStatus(207);
    },
  });
  try {
    const r = await app.req('POST', `/api/remotes/${id}/test`, { cookie });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.ok(seenAuth.startsWith('Basic '));
    assert.equal(Buffer.from(seenAuth.slice(6), 'base64').toString(), 'bob:pw');
  } finally {
    restoreFetch();
  }
});

test('nextcloud upload PUTs the archive stream', async () => {
  const sid = seedServer('srv_rem_nc');
  const backup = seedBackup(sid, 'bk_rem_nc');
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'NC Up',
      provider: 'nextcloud',
      config: { url: 'https://cloud.example.com', username: 'bob' },
      secret: { password: 'pw' },
    },
  });
  const id = created.json.destination.id;
  let putUrl = '';
  let putLength = '';
  stubUpstream({
    'cloud.example.com': (url, init) => {
      if (init.method === 'MKCOL') return okStatus(405);
      if (init.method === 'PUT') {
        putUrl = url.pathname;
        putLength = init.headers['Content-Length'];
        return okStatus(201);
      }
      return okStatus(200);
    },
  });
  try {
    await remotes.doUpload(backup.id, id, { actor: 'test' });
    assert.ok(putUrl.endsWith('/Minecraft-Backups/bk_rem_nc.zip'), putUrl);
    assert.equal(putLength, '14');
    const row = db.get('SELECT * FROM remote_backup_files WHERE backup_id = ? AND destination_id = ?', backup.id, id);
    assert.equal(row.status, 'done');
  } finally {
    restoreFetch();
  }
});

test('dropbox refreshes OAuth tokens and uploads small files directly', async () => {
  const sid = seedServer('srv_rem_dbx');
  const backup = seedBackup(sid, 'bk_rem_dbx');
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'DBX',
      provider: 'dropbox',
      config: { clientId: 'cid', folder: 'MC' },
      secret: { clientSecret: 'cs', refreshToken: 'rt' },
    },
  });
  const id = created.json.destination.id;
  let sawArg = '';
  stubUpstream({
    'api.dropboxapi.com': (url) => {
      if (url.pathname.endsWith('/oauth2/token')) return okJson({ access_token: 'tok', expires_in: 3600 });
      if (url.pathname.endsWith('/users/get_current_account')) return okJson({ name: { display_name: 'Bo' } });
      return okJson({});
    },
    'content.dropboxapi.com': (url, init) => {
      sawArg = init.headers['Dropbox-API-Arg'] || '';
      return okStatus(200);
    },
  });
  try {
    const t = await app.req('POST', `/api/remotes/${id}/test`, { cookie });
    assert.equal(t.status, 200);
    await remotes.doUpload(backup.id, id, { actor: 'test' });
    const arg = JSON.parse(sawArg);
    assert.equal(arg.path, '/MC/bk_rem_dbx.zip');
    assert.equal(arg.mode, 'add');
    const row = db.get('SELECT * FROM remote_backup_files WHERE backup_id = ? AND destination_id = ?', backup.id, id);
    assert.equal(row.status, 'done');
  } finally {
    restoreFetch();
  }
});

test('google drive uses resumable sessions', async () => {
  const sid = seedServer('srv_rem_gd');
  const backup = seedBackup(sid, 'bk_rem_gd');
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'GD',
      provider: 'gdrive',
      config: { clientId: 'cid' },
      secret: { clientSecret: 'cs', refreshToken: 'rt' },
    },
  });
  const id = created.json.destination.id;
  const calls = [];
  stubUpstream({
    'oauth2.googleapis.com': () => okJson({ access_token: 'tok', expires_in: 3600 }),
    'www.googleapis.com': (url, init) => {
      calls.push(`${init.method} ${url.pathname}${url.search}`);
      if (url.pathname === '/upload/drive/v3/files') {
        return {
          ok: true,
          status: 200,
          headers: { get: (k) => (k.toLowerCase() === 'location' ? 'https://upload.example/session' : null) },
          json: async () => ({}),
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      return okJson({});
    },
    'upload.example': () => okJson({ id: 'file-123' }),
  });
  try {
    await remotes.doUpload(backup.id, id, { actor: 'test' });
    assert.ok(
      calls.some((c) => c.startsWith('POST /upload/drive/v3/files')),
      calls.join(' | ')
    );
    const row = db.get('SELECT * FROM remote_backup_files WHERE backup_id = ? AND destination_id = ?', backup.id, id);
    assert.equal(row.status, 'done');
    assert.equal(row.remote_path, 'file-123');
  } finally {
    restoreFetch();
  }
});

test('failed uploads record the error without failing the backup', async () => {
  const sid = seedServer('srv_rem_fail');
  const backup = seedBackup(sid, 'bk_rem_fail');
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'NC Down',
      provider: 'nextcloud',
      config: { url: 'https://cloud.example.com', username: 'u' },
      secret: { password: 'pw' },
    },
  });
  const id = created.json.destination.id;
  stubUpstream({
    'cloud.example.com': () => okStatus(500),
  });
  try {
    await assert.rejects(remotes.doUpload(backup.id, id, { actor: 'test' }));
    const row = db.get('SELECT * FROM remote_backup_files WHERE backup_id = ? AND destination_id = ?', backup.id, id);
    assert.equal(row.status, 'failed');
    assert.ok(row.error);
    assert.ok(db.get('SELECT * FROM backups WHERE id = ?', backup.id), 'local backup untouched');
  } finally {
    restoreFetch();
  }
});

test('oauth authorize URL carries the registered parameters', async () => {
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'DBX OAuth',
      provider: 'dropbox',
      config: { clientId: 'cid123' },
      secret: { clientSecret: 'cs' },
    },
  });
  const id = created.json.destination.id;
  const r = await app.req('POST', `/api/remotes/${id}/oauth/start`, { cookie });
  assert.equal(r.status, 200);
  const url = new URL(r.json.url);
  assert.ok(url.host.includes('dropbox.com'));
  assert.equal(url.searchParams.get('client_id'), 'cid123');
  assert.equal(url.searchParams.get('token_access_type'), 'offline');
  assert.ok(url.searchParams.get('state'));
  assert.ok(r.json.redirectUri.endsWith('/remotes/oauth/callback'));
  const stored = db.get('SELECT oauth_state FROM remote_destinations WHERE id = ?', id);
  assert.equal(stored.oauth_state, url.searchParams.get('state'));
});

test('oauth finish rejects unknown states and stores refresh tokens', async () => {
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'GD OAuth',
      provider: 'gdrive',
      config: { clientId: 'cid' },
      secret: { clientSecret: 'cs' },
    },
  });
  const id = created.json.destination.id;
  await assert.rejects(remotes.finishOAuth(id, 'bogus', 'code', 'http://x/cb'), /expired or already used/);
  const started = await app.req('POST', `/api/remotes/${id}/oauth/start`, { cookie });
  const state = new URL(started.json.url).searchParams.get('state');
  stubUpstream({
    'oauth2.googleapis.com': () => okJson({ refresh_token: 'new-rt', access_token: 'x', expires_in: 3600 }),
  });
  try {
    const updated = await remotes.finishOAuth(id, state, 'authcode', started.json.redirectUri);
    assert.equal(updated.authorized, true);
    const row = db.get('SELECT oauth_state FROM remote_destinations WHERE id = ?', id);
    assert.equal(row.oauth_state, null);
  } finally {
    restoreFetch();
  }
});

test('explicit upload returns a task and the page shows destinations', async () => {
  const sid = seedServer('srv_rem_page');
  const backup = seedBackup(sid, 'bk_rem_page');
  const created = await app.req('POST', '/api/remotes', {
    cookie,
    body: {
      name: 'NC Page',
      provider: 'nextcloud',
      config: { url: 'https://cloud.example.com', username: 'u' },
      secret: { password: 'pw' },
    },
  });
  const destId = created.json.destination.id;
  const up = await app.req('POST', `/api/remotes/${destId}/upload/${backup.id}`, { cookie });
  assert.equal(up.status, 202);
  assert.ok(up.json.taskId);
  const page = await app.req('GET', '/backups', { cookie });
  assert.equal(page.status, 200);
  assert.match(page.text, /Offsite Destinations/);
  assert.match(page.text, /data-dest-id/);
  assert.match(page.text, new RegExp(`data-backup-id="${backup.id}"`));
  assert.match(page.text, /data-local="1"/);
});
