'use strict';

// The retention settings UI's routes: preview what a change would remove (and
// remove nothing), save, then optionally apply now. Admin-only, like the
// policy routes they sit beside.

const app = require('./helpers/app');
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const settings = require('../src/services/settings');
const { guardOp } = require('../src/services/opLock');

let cookie;
let opCookie;
let viewerCookie;

async function login(username, password, role) {
  await require('../src/services/auth').createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return (r.setCookie || []).map((c) => c.split(';')[0]).join('; ');
}

function seedServer(id, port) {
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, ?, 'PAPER', ?, ?, 'x', 1024, 1536)`,
    id,
    id,
    port,
    port + 1000
  );
}

// created_at grows with i, so higher i == newer == kept.
function seedBackups(serverId, reason, count) {
  for (let i = 0; i < count; i++) {
    const n = String(i).padStart(3, '0');
    db.run(
      `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, created_at)
       VALUES (?, ?, ?, ?, 1024, ?, datetime('2026-01-01 00:00:00', '+' || ? || ' minutes'))`,
      `bk_${serverId}_${reason}_${n}`,
      serverId,
      `${serverId}-${reason}-${n}.zip`,
      `backups/${serverId}/${serverId}-${reason}-${n}.zip`,
      reason,
      i
    );
  }
}

const count = (serverId) => db.get('SELECT COUNT(*) AS n FROM backups WHERE server_id = ?', serverId).n;
const post = (path, body, who = cookie) => app.req('POST', path, { cookie: who, body });

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  opCookie = await login('retop', 'operatorpass123', 'operator');
  viewerCookie = await login('retviewer', 'viewerpass123', 'viewer');
});
test.after(app.stop);
test.beforeEach(() => {
  settings.remove('backup_retention');
  db.run('DELETE FROM backups');
  db.run('DELETE FROM servers');
  seedServer('srv_a', 47300);
  seedServer('srv_b', 47310);
  seedBackups('srv_a', 'scheduled', 8);
  seedBackups('srv_b', 'scheduled', 8);
});

test('a global preview counts every affected server and deletes nothing', async () => {
  const r = await post('/api/backups/retention/preview', { keepScheduled: 5 });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.backups, r.json.bytes, r.json.servers], [6, 6 * 1024, 2]);
  assert.equal(count('srv_a') + count('srv_b'), 16);
});

test('a global change reaches a server whose override does not set that key', async () => {
  await post('/api/servers/srv_b/backups/retention', { keepManual: 3 }); // partial override
  const r = await post('/api/backups/retention/preview', { keepScheduled: 5 });
  assert.equal(r.json.servers, 2);
  await post('/api/servers/srv_b/backups/retention', { keepScheduled: 8 }); // now it pins scheduled too
  const pinned = await post('/api/backups/retention/preview', { keepScheduled: 5 });
  assert.deepEqual([pinned.json.backups, pinned.json.servers], [3, 1]);
});

test('From Next Backup: saving alone removes nothing', async () => {
  const r = await post('/api/backups/retention', { keepScheduled: 5 });
  assert.equal(r.status, 200, r.text);
  assert.equal(count('srv_a'), 8);
});

test('Remove Now: save then apply trims every server to the saved policy and records it', async () => {
  await post('/api/backups/retention', { keepScheduled: 5 });
  const r = await post('/api/backups/retention/apply', {});
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.deleted, r.json.skipped], [6, 0]);
  assert.deepEqual([count('srv_a'), count('srv_b')], [5, 5]);
  assert.ok(db.get("SELECT 1 AS x FROM backups WHERE id = 'bk_srv_a_scheduled_007'"), 'the newest stay');
  const events = db.get("SELECT COUNT(*) AS n FROM events WHERE type = 'backup-deleted' AND actor = 'admin'").n;
  assert.equal(events, 6);
});

test('a server busy with another action is skipped by the global apply, never interrupted', async () => {
  await post('/api/backups/retention', { keepScheduled: 5 });
  let release;
  const held = guardOp('restore', () => new Promise((r) => (release = r)))('srv_a');
  const r = await post('/api/backups/retention/apply', {});
  assert.deepEqual([r.json.deleted, r.json.skipped], [3, 1]);
  assert.equal(count('srv_a'), 8);
  const one = await post('/api/servers/srv_a/backups/retention/apply', {});
  assert.equal(one.status, 409);
  release();
  await held;
});

test('a per-server preview, save and apply touch only that server', async () => {
  const preview = await post('/api/servers/srv_a/backups/retention/preview', {
    keepScheduled: 2,
    keepPreUpdate: 10,
    keepManual: 20,
    keepPreRestore: 5,
    maxAgeDays: 0,
    maxTotalGb: 0,
  });
  assert.deepEqual([preview.json.backups, preview.json.servers], [6, 1]);
  await post('/api/servers/srv_a/backups/retention', { keepScheduled: 2 });
  const r = await post('/api/servers/srv_a/backups/retention/apply', {});
  assert.equal(r.json.deleted, 6);
  assert.deepEqual([count('srv_a'), count('srv_b')], [2, 8]);
  const get = await app.req('GET', '/api/servers/srv_a/backups/retention', { cookie });
  assert.deepEqual(get.json.override, { keepScheduled: 2 });
});

test('previewing a reset shows what following the panel default would remove', async () => {
  await post('/api/backups/retention', { keepScheduled: 4 });
  await post('/api/servers/srv_a/backups/retention', { keepScheduled: 8 });
  const r = await post('/api/servers/srv_a/backups/retention/preview', { reset: true });
  assert.deepEqual([r.json.backups, r.json.servers], [4, 1]);
  await post('/api/servers/srv_a/backups/retention', { reset: true });
  const get = await app.req('GET', '/api/servers/srv_a/backups/retention', { cookie });
  assert.equal(get.json.override, null);
});

test('out-of-range values are refused before anything is previewed or saved', async () => {
  assert.equal((await post('/api/backups/retention/preview', { keepScheduled: 0 })).status, 400);
  assert.equal((await post('/api/backups/retention/preview', { bogus: 1 })).status, 400);
});

test('only admins can preview or apply retention', async () => {
  for (const who of [opCookie, viewerCookie]) {
    for (const path of [
      '/api/backups/retention/preview',
      '/api/backups/retention/apply',
      '/api/servers/srv_a/backups/retention/preview',
      '/api/servers/srv_a/backups/retention/apply',
    ]) {
      const r = await post(path, { keepScheduled: 1 }, who);
      assert.equal(r.status, 403, `${path} answered ${r.status}`);
    }
  }
  assert.equal(count('srv_a'), 8);
});

test("a server's limits are per field: null removes one key, the rest stay", async () => {
  await post('/api/servers/srv_a/backups/retention', { keepScheduled: 3, maxTotalGb: 50 });
  const r = await post('/api/servers/srv_a/backups/retention', { keepScheduled: null });
  assert.equal(r.status, 200, r.text);
  const get = await app.req('GET', '/api/servers/srv_a/backups/retention', { cookie });
  assert.deepEqual(get.json.override, { maxTotalGb: 50 });
  assert.equal(get.json.effective.keepScheduled, 10); // back on the panel value
  await post('/api/servers/srv_a/backups/retention', { maxTotalGb: null });
  const cleared = await app.req('GET', '/api/servers/srv_a/backups/retention', { cookie });
  assert.equal(cleared.json.override, null); // no keys left: no override at all
});

test('a per-server preview mixes set fields with blank (null) ones', async () => {
  await post('/api/backups/retention', { keepScheduled: 6 });
  const r = await post('/api/servers/srv_a/backups/retention/preview', { keepScheduled: null, keepManual: 4 });
  assert.deepEqual([r.json.backups, r.json.servers], [2, 1]); // scheduled follows the panel's 6
});

test('a panel-wide apply never locks a server that has nothing to delete', async () => {
  await post('/api/backups/retention', { keepScheduled: 5 });
  await post('/api/servers/srv_b/backups/retention', { keepScheduled: 8 }); // srv_b: nothing over
  let release;
  const held = guardOp('restore', () => new Promise((r) => (release = r)))('srv_b');
  const r = await post('/api/backups/retention/apply', {});
  assert.deepEqual([r.json.deleted, r.json.skipped], [3, 0]);
  release();
  await held;
});

test('deleted servers are left out of previews and applies', async () => {
  seedServer('srv_gone', 47320);
  seedBackups('srv_gone', 'scheduled', 8);
  db.run("UPDATE servers SET deleted_at = datetime('now') WHERE id = 'srv_gone'");
  const preview = await post('/api/backups/retention/preview', { keepScheduled: 5 });
  assert.equal(preview.json.servers, 2);
  await post('/api/backups/retention', { keepScheduled: 5 });
  await post('/api/backups/retention/apply', {});
  assert.equal(count('srv_gone'), 8);
});

test('the Backups tab shows the retention form to admins only', async () => {
  const admin = await app.req('GET', '/servers/srv_a/backups', { cookie, headers: { Accept: 'text/html' } });
  assert.equal(admin.status, 200);
  assert.match(admin.text, /id="bk-retention"/);
  assert.match(admin.text, /placeholder="Panel: 10"/);
  const op = await app.req('GET', '/servers/srv_a/backups', { cookie: opCookie, headers: { Accept: 'text/html' } });
  assert.equal(op.status, 200);
  assert.doesNotMatch(op.text, /id="bk-retention"/);
  assert.match(op.text, /This server uses the panel-wide limits\./);
});

test('Remove Now deletes only what its preview listed, even if more is over the limit by then', async () => {
  const preview = await post('/api/backups/retention/preview', { keepScheduled: 5 });
  assert.equal(preview.json.ids.length, 6);
  await post('/api/backups/retention', { keepScheduled: 5 });
  // A scheduled backup lands between the preview and the click: srv_a is now 4 over, not 3.
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason, created_at)
     VALUES ('bk_srv_a_late', 'srv_a', 'late.zip', 'backups/srv_a/late.zip', 1024, 'scheduled', datetime('2026-02-01'))`
  );
  const r = await post('/api/backups/retention/apply', { ids: preview.json.ids });
  assert.equal(r.json.deleted, 6);
  assert.equal(count('srv_a'), 6); // 9 - 3: the 4th oldest waits for the next trim
  assert.ok(db.get("SELECT 1 AS x FROM backups WHERE id = 'bk_srv_a_scheduled_003'"));
});

test('panel-wide values cannot be blank, and reset:false on a server is just a patch', async () => {
  for (const path of ['/api/backups/retention', '/api/backups/retention/preview']) {
    const r = await post(path, { maxAgeDays: null });
    assert.equal(r.status, 400, path);
    assert.match(r.json.error, /cannot be blank/);
  }
  const r = await post('/api/servers/srv_a/backups/retention', { reset: false, keepManual: 4 });
  assert.equal(r.status, 200, r.text);
  const get = await app.req('GET', '/api/servers/srv_a/backups/retention', { cookie });
  assert.deepEqual(get.json.override, { keepManual: 4 });
});

test('the preview breaks it down per server and flags excess that was there before this change', async () => {
  // srv_a was left over its own limit by an earlier "from the next backup".
  await post('/api/servers/srv_a/backups/retention', { keepScheduled: 2 });
  // An unrelated panel-wide edit still lists srv_a's old excess - and says so.
  const r = await post('/api/backups/retention/preview', { keepManual: 19 });
  assert.equal(r.json.byServer.length, 1);
  const [a] = r.json.byServer;
  assert.deepEqual([a.id, a.name, a.backups, a.alreadyOver], ['srv_a', 'srv_a', 6, true]);
  assert.deepEqual(a.byReason, { scheduled: 6 });
  assert.equal(a.oldest, '2026-01-01 00:00:00');
  // A change that alone causes the excess is not flagged.
  await post('/api/servers/srv_a/backups/retention', { reset: true });
  const fresh = await post('/api/backups/retention/preview', { keepScheduled: 5 });
  assert.ok(fresh.json.byServer.every((s) => s.alreadyOver === false));
});

test('reset accepts the forms scripts and form posts send, and refuses nonsense', async () => {
  for (const reset of [true, 'true', 1, '1']) {
    await post('/api/servers/srv_a/backups/retention', { keepManual: 3 });
    const r = await post('/api/servers/srv_a/backups/retention', { reset });
    assert.equal(r.status, 200, `reset ${JSON.stringify(reset)}`);
    const get = await app.req('GET', '/api/servers/srv_a/backups/retention', { cookie });
    assert.equal(get.json.override, null, `reset ${JSON.stringify(reset)} cleared it`);
  }
  const form = await app.req('POST', '/api/servers/srv_a/backups/retention', {
    cookie,
    form: 'reset=true', // raw body: the helper JSON-encodes `body`
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(form.status, 200, form.text);
  assert.equal((await post('/api/servers/srv_a/backups/retention', { reset: 'yes' })).status, 400);
});
