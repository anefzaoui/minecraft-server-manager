'use strict';

// End-to-end authorization for per-server permissions, through the real
// Express app (no Docker). Covers, in order:
//   - backward compatibility: with no grants, admin/operator/viewer behave
//     exactly as before (viewer read-only, operator full, admin full)
//   - a viewer elevated on ONE server: allowed there, still refused elsewhere,
//     still refused for every panel-wide write
//   - an operator demoted on one server
//   - a hidden server: 404 on pages, API, WebSocket, and absent from every
//     fleet-wide page and endpoint
//   - the Permissions page + API (admin-only, validation, reset)
//   - schedules, backups-by-id, world targets, events

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const authService = require('../src/services/auth');
const db = require('../src/db');
const { recordEvent } = require('../src/events');

let adminCookie;
let viewerCookie;
let operatorCookie;
let viewerId;
let operatorId;
const A = 'srv_perm_a';
const B = 'srv_perm_b';

async function login(username, password, role) {
  const user = await authService.createUser({ username, password, role }, { actor: 'test' });
  const r = await app.req('POST', '/login', { body: { username, password } });
  return { id: user.id, cookie: (r.setCookie || []).map((c) => c.split(';')[0]).join('; ') };
}

const NOT_GATED = (status) => ![401, 403, 404].includes(status);

test.before(async () => {
  await app.start();
  require('../src/ws').attachWebSockets(app.httpServer());
  adminCookie = await app.adminCookie();
  const v = await login('viewer_p', 'viewerpass123', 'viewer');
  viewerCookie = v.cookie;
  viewerId = v.id;
  const o = await login('operator_p', 'operatorpass123', 'operator');
  operatorCookie = o.cookie;
  operatorId = o.id;
  app.seedServer(A);
  app.seedServer(B);
  db.run("UPDATE servers SET display_name = 'Alpha Server' WHERE id = ?", A);
  db.run("UPDATE servers SET display_name = 'Bravo Server' WHERE id = ?", B);
});

test.after(async () => {
  // Schedules created below arm Cron timers that would keep the process alive.
  const scheduler = require('../src/services/scheduler');
  for (const row of db.all('SELECT id FROM schedules')) scheduler.deleteSchedule(row.id, { actor: 'test' });
  await app.stop();
});

// ---------------------------------------------------------------------------
// Backward compatibility: no grants = the three roles behave exactly as before.

test('no grants: viewer is read-only everywhere, operator and admin pass the gates', async () => {
  for (const id of [A, B]) {
    assert.equal((await app.req('POST', `/api/servers/${id}/stop`, { cookie: viewerCookie })).status, 403);
    assert.equal(
      (await app.req('PUT', `/api/servers/${id}/console-label`, { cookie: viewerCookie, body: { label: 'x' } })).status,
      403
    );
    assert.equal((await app.req('GET', `/api/servers/${id}/logs`, { cookie: viewerCookie })).status, 200);
    assert.equal((await app.req('GET', `/servers/${id}`, { cookie: viewerCookie })).status, 200);
    const op = await app.req('PUT', `/api/servers/${id}/console-label`, {
      cookie: operatorCookie,
      body: { label: 'Ops' },
    });
    assert.equal(op.status, 200);
    const ad = await app.req('PUT', `/api/servers/${id}/console-label`, {
      cookie: adminCookie,
      body: { label: 'Admin' },
    });
    assert.equal(ad.status, 200);
  }
  // The pre-existing files contract: viewer 403, operator through.
  assert.equal((await app.req('GET', `/api/servers/${A}/files/list`, { cookie: viewerCookie })).status, 403);
  assert.notEqual((await app.req('GET', `/api/servers/${A}/files/list`, { cookie: operatorCookie })).status, 403);
});

test('no grants: every server is visible to every role on the sidebar and the live endpoint', async () => {
  for (const cookie of [viewerCookie, operatorCookie, adminCookie]) {
    const page = await app.req('GET', '/', { cookie });
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(`/servers/${A}`) && page.text.includes(`/servers/${B}`));
    const live = await app.req('GET', '/api/servers/live', { cookie });
    assert.ok(live.json.servers[A] && live.json.servers[B]);
  }
});

// ---------------------------------------------------------------------------
// The issue's scenario: viewer everywhere, operator-ish on one server.

test('viewer with power+console on B: allowed on B, still refused on A and panel-wide', async () => {
  const set = await app.req('PUT', `/api/permissions/${viewerId}/${B}`, {
    cookie: adminCookie,
    body: { perms: ['power', 'console'] },
  });
  assert.equal(set.status, 200);
  assert.deepEqual(set.json.grant, ['view', 'power', 'console']);

  // Power on B passes the gate (no Docker here, so anything but a gate status).
  const stopB = await app.req('POST', `/api/servers/${B}/stop`, { cookie: viewerCookie });
  assert.ok(NOT_GATED(stopB.status), `stop on B not gated, got ${stopB.status}`);
  assert.notEqual(stopB.json && stopB.json.error, 'Server not found');
  // Console on B: chat endpoint passes the gate.
  const chatB = await app.req('POST', `/api/servers/${B}/chat`, { cookie: viewerCookie, body: { message: 'hi' } });
  assert.ok(NOT_GATED(chatB.status), `chat on B not gated, got ${chatB.status}`);

  // Capabilities NOT granted on B are refused with the capability named.
  const label = await app.req('PUT', `/api/servers/${B}/console-label`, { cookie: viewerCookie, body: { label: 'x' } });
  assert.equal(label.status, 403);
  assert.match(label.json.error, /settings permission/);
  assert.equal((await app.req('POST', `/api/servers/${B}/backups`, { cookie: viewerCookie, body: {} })).status, 403);
  assert.equal((await app.req('DELETE', `/api/servers/${B}`, { cookie: viewerCookie })).status, 403);
  assert.equal((await app.req('GET', `/api/servers/${B}/files/list`, { cookie: viewerCookie })).status, 403);
  assert.equal(
    (await app.req('POST', `/api/servers/${B}/players/kick`, { cookie: viewerCookie, body: { name: 'x' } })).status,
    403
  );

  // Server A is untouched: still a plain read-only viewer there.
  assert.equal((await app.req('POST', `/api/servers/${A}/stop`, { cookie: viewerCookie })).status, 403);
  assert.equal(
    (await app.req('POST', `/api/servers/${A}/chat`, { cookie: viewerCookie, body: { message: 'hi' } })).status,
    403
  );

  // Panel-wide writes stay closed to a viewer no matter what they hold per server.
  assert.equal((await app.req('POST', '/api/servers', { cookie: viewerCookie, body: { name: 'x' } })).status, 403);
  assert.equal((await app.req('POST', '/api/storage/scan', { cookie: viewerCookie })).status, 403);
  assert.equal((await app.req('POST', '/api/users', { cookie: viewerCookie, body: {} })).status, 403);
  // Server-scoped schedules follow the capability on that server, even for a viewer.
  const restartB = await app.req('POST', '/api/schedules', {
    cookie: viewerCookie,
    body: { serverId: B, taskType: 'restart', cron: '0 4 * * *' },
  });
  assert.equal(restartB.status, 201, 'power on B allows a restart schedule on B');
  const backupB = await app.req('POST', '/api/schedules', {
    cookie: viewerCookie,
    body: { serverId: B, taskType: 'backup', cron: '0 4 * * *' },
  });
  assert.equal(backupB.status, 403, 'no backups on B');
  assert.match(backupB.json.error, /backups permission/);
  const restartA = await app.req('POST', '/api/schedules', {
    cookie: viewerCookie,
    body: { serverId: A, taskType: 'restart', cron: '0 4 * * *' },
  });
  assert.equal(restartA.status, 403, 'read-only on A');
  const globalJob = await app.req('POST', '/api/schedules', {
    cookie: viewerCookie,
    body: { taskType: 'tmp-clean', cron: '0 5 * * *' },
  });
  assert.equal(globalJob.status, 403, 'panel-global schedules stay on the global role');
  const toggleB = await app.req('POST', `/api/schedules/${restartB.json.schedule.id}/toggle`, {
    cookie: viewerCookie,
    body: { enabled: false },
  });
  assert.equal(toggleB.status, 200);
  assert.equal(
    (await app.req('DELETE', `/api/schedules/${restartB.json.schedule.id}`, { cookie: viewerCookie })).status,
    200
  );
});

test('server page reflects the grant: power buttons shown on B, hidden on A; files tab absent', async () => {
  const pageB = await app.req('GET', `/servers/${B}`, { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.equal(pageB.status, 200);
  assert.ok(
    !/class="flex flex-wrap gap-2 hidden">\s*<button class="btn btn-primary" data-server-action="start"/.test(
      pageB.text
    )
  );
  const pageA = await app.req('GET', `/servers/${A}`, { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.ok(/class="flex flex-wrap gap-2 hidden">/.test(pageA.text), 'power row hidden on A');
  assert.ok(!pageA.text.includes(`/servers/${A}/files"`), 'files tab absent without the files capability');
  const filesPage = await app.req('GET', `/servers/${A}/files`, {
    cookie: viewerCookie,
    headers: { Accept: 'text/html' },
  });
  // Same as before this feature: the page renders with an empty listing, the API 403s.
  assert.equal(filesPage.status, 200);
  assert.equal((await app.req('GET', `/api/servers/${A}/files/list`, { cookie: viewerCookie })).status, 403);
  const opFiles = await app.req('GET', `/servers/${A}/files`, {
    cookie: operatorCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(opFiles.status, 200);
});

// ---------------------------------------------------------------------------
// Demotion.

test('operator demoted to view on A: refused on A, untouched on B, schedules follow', async () => {
  const set = await app.req('PUT', `/api/permissions/${operatorId}/${A}`, {
    cookie: adminCookie,
    body: { perms: ['view'] },
  });
  assert.equal(set.status, 200);
  assert.equal(
    (await app.req('PUT', `/api/servers/${A}/console-label`, { cookie: operatorCookie, body: { label: 'x' } })).status,
    403
  );
  assert.equal((await app.req('POST', `/api/servers/${A}/stop`, { cookie: operatorCookie })).status, 403);
  assert.equal((await app.req('GET', `/api/servers/${A}/files/list`, { cookie: operatorCookie })).status, 403);
  assert.equal((await app.req('GET', `/api/servers/${A}/logs`, { cookie: operatorCookie })).status, 200);
  assert.equal(
    (await app.req('PUT', `/api/servers/${B}/console-label`, { cookie: operatorCookie, body: { label: 'ok' } })).status,
    200
  );

  // A restart schedule on A needs power there; on B it is fine.
  const schedA = await app.req('POST', '/api/schedules', {
    cookie: operatorCookie,
    body: { serverId: A, taskType: 'restart', cron: '0 4 * * *' },
  });
  assert.equal(schedA.status, 403);
  assert.match(schedA.json.error, /power permission/);
  const schedB = await app.req('POST', '/api/schedules', {
    cookie: operatorCookie,
    body: { serverId: B, taskType: 'restart', cron: '0 4 * * *' },
  });
  assert.equal(schedB.status, 201);
  const global = await app.req('POST', '/api/schedules', {
    cookie: operatorCookie,
    body: { taskType: 'tmp-clean', cron: '0 5 * * *' },
  });
  assert.equal(global.status, 201, 'panel-global schedules follow the global role');
  // Toggling an A-scoped schedule created by the admin is refused too.
  const adminSched = await app.req('POST', '/api/schedules', {
    cookie: adminCookie,
    body: { serverId: A, taskType: 'backup', cron: '0 3 * * *' },
  });
  assert.equal(adminSched.status, 201);
  const toggle = await app.req('POST', `/api/schedules/${adminSched.json.schedule.id}/toggle`, {
    cookie: operatorCookie,
    body: { enabled: false },
  });
  assert.equal(toggle.status, 403);
  assert.equal(
    (await app.req('DELETE', `/api/schedules/${adminSched.json.schedule.id}`, { cookie: operatorCookie })).status,
    403
  );
  assert.equal(
    (await app.req('DELETE', `/api/schedules/${adminSched.json.schedule.id}`, { cookie: adminCookie })).status,
    200
  );
});

// ---------------------------------------------------------------------------
// Hidden server.

test('hidden server: 404 on pages and API, refused actions read as not found', async () => {
  const set = await app.req('PUT', `/api/permissions/${viewerId}/${A}`, { cookie: adminCookie, body: { perms: [] } });
  assert.equal(set.status, 200);
  assert.deepEqual(set.json.grant, []);

  assert.equal(
    (await app.req('GET', `/servers/${A}`, { cookie: viewerCookie, headers: { Accept: 'text/html' } })).status,
    404
  );
  assert.equal(
    (await app.req('GET', `/servers/${A}/console`, { cookie: viewerCookie, headers: { Accept: 'text/html' } })).status,
    404
  );
  assert.equal((await app.req('GET', `/servers/${A}/integrations`, { cookie: viewerCookie })).status, 404);
  const logs = await app.req('GET', `/api/servers/${A}/logs`, { cookie: viewerCookie });
  assert.equal(logs.status, 404);
  assert.equal(logs.json.error, 'Server not found');
  assert.equal((await app.req('GET', `/api/servers/${A}/mods`, { cookie: viewerCookie })).status, 404);
  assert.equal((await app.req('GET', `/api/servers/${A}/players`, { cookie: viewerCookie })).status, 404);
  // An action on a hidden server is 404, never 403 (no existence leak).
  assert.equal((await app.req('POST', `/api/servers/${A}/stop`, { cookie: viewerCookie })).status, 404);
  assert.equal((await app.req('GET', `/map/${A}/`, { cookie: viewerCookie })).status, 404);
  // B is still there.
  assert.equal((await app.req('GET', `/api/servers/${B}/logs`, { cookie: viewerCookie })).status, 200);
});

test('hidden server: absent from sidebar, dashboard, live, summary, backups, schedules, activity, updates', async () => {
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason) VALUES ('bk_hidden_a', ?, 'a.zip', 'backups/a.zip', 10, 'manual')`,
    A
  );
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason) VALUES ('bk_visible_b', ?, 'b.zip', 'backups/b.zip', 10, 'manual')`,
    B
  );
  recordEvent({ serverId: A, actor: 'test', type: 'crash-report', summary: 'Alpha secret event.' });
  recordEvent({ serverId: B, actor: 'test', type: 'crash-report', summary: 'Bravo public event.' });
  recordEvent({ actor: 'test', type: 'login', summary: 'Global event line.' });

  for (const path of ['/', '/servers', '/backups', '/schedules', '/activity', '/updates', '/modpacks', '/worlds']) {
    const page = await app.req('GET', path, { cookie: viewerCookie, headers: { Accept: 'text/html' } });
    assert.equal(page.status, 200, path);
    assert.ok(!page.text.includes(`/servers/${A}`), `${path} must not link the hidden server`);
    assert.ok(!page.text.includes('Alpha Server'), `${path} must not name the hidden server`);
    assert.ok(!page.text.includes('Alpha secret event'), `${path} must not show the hidden server's events`);
    assert.ok(page.text.includes(`/servers/${B}`), `${path} still shows the visible server in the sidebar`);
  }
  const activity = await app.req('GET', '/activity', { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.ok(activity.text.includes('Bravo public event'));
  assert.ok(activity.text.includes('Global event line'));

  const live = await app.req('GET', '/api/servers/live', { cookie: viewerCookie });
  assert.equal(live.json.servers[A], undefined);
  assert.ok(live.json.servers[B]);
  const summary = await app.req('GET', '/api/status/summary', { cookie: viewerCookie });
  assert.equal(summary.status, 200);
  assert.ok(!JSON.stringify(summary.json).includes(A));
  assert.ok(!JSON.stringify(summary.json).includes('Alpha'));

  // The admin still sees everything.
  const adminBackups = await app.req('GET', '/backups', { cookie: adminCookie, headers: { Accept: 'text/html' } });
  assert.ok(adminBackups.text.includes('Alpha Server') && adminBackups.text.includes('Bravo Server'));
  const adminLive = await app.req('GET', '/api/servers/live', { cookie: adminCookie });
  assert.ok(adminLive.json.servers[A] && adminLive.json.servers[B]);
});

test('hidden server: events export and excerpt, backups by id, world targets, inventory search', async () => {
  // Global export for a non-admin drops hidden-server rows; admin keeps them.
  const opExport = await app.req('GET', '/api/events/export?format=json', { cookie: operatorCookie });
  assert.equal(opExport.status, 200);
  const adminExport = await app.req('GET', '/api/events/export?format=json', { cookie: adminCookie });
  assert.ok(adminExport.text.includes('Alpha secret event'));
  // Hide A from the operator too, then re-export.
  await app.req('PUT', `/api/permissions/${operatorId}/${A}`, { cookie: adminCookie, body: { perms: [] } });
  const opExport2 = await app.req('GET', '/api/events/export?format=json', { cookie: operatorCookie });
  assert.ok(!opExport2.text.includes('Alpha secret event'));
  assert.ok(opExport2.text.includes('Bravo public event'));

  const hiddenEvent = db.get("SELECT id FROM events WHERE summary = 'Alpha secret event.'");
  assert.equal((await app.req('GET', `/api/events/${hiddenEvent.id}/excerpt`, { cookie: operatorCookie })).status, 404);

  // Backups addressed by id resolve to their server's permissions.
  assert.equal((await app.req('DELETE', '/api/backups/bk_hidden_a', { cookie: operatorCookie })).status, 404);
  assert.equal((await app.req('GET', '/api/backups/bk_hidden_a/download', { cookie: operatorCookie })).status, 404);
  assert.equal(
    (await app.req('GET', '/api/backups/bk_visible_b/download', { cookie: viewerCookie })).status,
    403,
    'viewer lacks backups on B'
  );
  const opB = await app.req('GET', '/api/backups/bk_visible_b/download', { cookie: operatorCookie });
  assert.equal(opB.status, 404, 'operator passes the gate; archive missing on disk');
  assert.match(opB.json.error, /missing on disk/);
  // The pre-existing contract for a backup id that does not exist at all.
  assert.equal((await app.req('DELETE', '/api/backups/bk_nope', { cookie: viewerCookie })).status, 403);
  assert.equal((await app.req('DELETE', '/api/backups/bk_nope', { cookie: operatorCookie })).status, 404);
  assert.equal((await app.req('DELETE', '/api/backups/bk_nope', { cookie: adminCookie })).status, 200);

  // A world copy INTO a hidden server is not found; into a server without content is refused.
  const copyHidden = await app.req('POST', `/api/servers/${B}/worlds/copy-to`, {
    cookie: operatorCookie,
    body: { targetServerId: A, mode: 'replace' },
  });
  assert.equal(copyHidden.status, 404);
  const copyNoCap = await app.req('POST', `/api/servers/${B}/worlds/copy-to`, {
    cookie: viewerCookie,
    body: { targetServerId: B, mode: 'replace' },
  });
  assert.equal(copyNoCap.status, 403);

  // Global inventory search never lists a hidden server.
  const search = await app.req('GET', '/api/inventory/search?q=diamond', { cookie: operatorCookie });
  assert.equal(search.status, 200);
  assert.ok(!JSON.stringify(search.json).includes(A));
});

test('hidden server: the WebSocket upgrade closes as unknown; console commands need the capability', async () => {
  const WebSocket = require('ws');
  const base = (await app.start()).replace('http://', 'ws://');
  // The server accepts the upgrade and then closes with 4404, so a refusal is
  // observed on 'close' (after 'open'), while an accepted socket stays open.
  const connect = (id, cookie) =>
    new Promise((resolve) => {
      const ws = new WebSocket(`${base}/ws/console/${id}`, { headers: { Cookie: cookie } });
      let settled = false;
      ws.on('close', (code) => {
        if (!settled) resolve({ code, ws: null });
        settled = true;
      });
      ws.on('open', () =>
        setTimeout(() => {
          if (!settled && ws.readyState === WebSocket.OPEN) {
            settled = true;
            resolve({ code: null, ws });
          }
        }, 150)
      );
      ws.on('error', () => {
        if (!settled) resolve({ code: 'error', ws: null });
        settled = true;
      });
    });

  const hidden = await connect(A, viewerCookie);
  assert.equal(hidden.code, 4404, 'hidden server closes like a missing one');
  const missing = await connect('srv_nope', viewerCookie);
  assert.equal(missing.code, 4404);

  const ok = await connect(B, viewerCookie);
  assert.ok(ok.ws, 'viewer with a grant on B attaches');
  const reply = await new Promise((resolve) => {
    ok.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.kind === 'cmd-result') resolve(msg);
    });
    ok.ws.send(JSON.stringify({ kind: 'cmd', command: 'list' }));
  });
  // The viewer holds console on B, so the refusal is "not running", not a permission error.
  assert.ok(!/permission/.test(reply.error || ''), `console allowed on B: ${reply.error}`);
  ok.ws.close();

  // Take console away from the viewer on B and the same command is refused by capability.
  await app.req('PUT', `/api/permissions/${viewerId}/${B}`, { cookie: adminCookie, body: { perms: ['power'] } });
  const noConsole = await connect(B, viewerCookie);
  assert.ok(noConsole.ws, 'view still attaches');
  const refused = await new Promise((resolve) => {
    noConsole.ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.kind === 'cmd-result') resolve(msg);
    });
    noConsole.ws.send(JSON.stringify({ kind: 'cmd', command: 'list' }));
  });
  assert.match(refused.error, /console permission/);
  noConsole.ws.close();
});

// ---------------------------------------------------------------------------
// The Permissions page and API.

test('the Permissions page and API are admin-only', async () => {
  for (const cookie of [viewerCookie, operatorCookie]) {
    assert.equal(
      (await app.req('GET', '/settings/permissions', { cookie, headers: { Accept: 'text/html' } })).status,
      403
    );
    assert.equal((await app.req('GET', '/api/permissions', { cookie })).status, 403);
    assert.equal(
      (await app.req('PUT', `/api/permissions/${viewerId}/${B}`, { cookie, body: { perms: ['delete'] } })).status,
      403
    );
  }
  const page = await app.req('GET', '/settings/permissions', { cookie: adminCookie, headers: { Accept: 'text/html' } });
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('Alpha Server') && page.text.includes('Bravo Server'));
  assert.ok(page.text.includes('viewer_p') && page.text.includes('operator_p'));
  assert.ok(!page.text.includes('data-username="admin"'), 'admins are not listed in the matrix');
  const matrix = await app.req('GET', '/api/permissions', { cookie: adminCookie });
  assert.equal(matrix.status, 200);
  assert.equal(matrix.json.capabilities.length, 9);
  assert.ok(matrix.json.users.every((u) => u.role !== 'admin'));
});

test('PUT /api/permissions validates and resets', async () => {
  const bad = await app.req('PUT', `/api/permissions/${viewerId}/${B}`, {
    cookie: adminCookie,
    body: { perms: ['sudo'] },
  });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Unknown permission "sudo"/);
  const notList = await app.req('PUT', `/api/permissions/${viewerId}/${B}`, {
    cookie: adminCookie,
    body: { perms: 'power' },
  });
  assert.equal(notList.status, 400);
  const ghostUser = await app.req('PUT', `/api/permissions/usr_ghost/${B}`, {
    cookie: adminCookie,
    body: { perms: ['view'] },
  });
  assert.equal(ghostUser.status, 404);
  const ghostServer = await app.req('PUT', `/api/permissions/${viewerId}/srv_ghost`, {
    cookie: adminCookie,
    body: { perms: ['view'] },
  });
  assert.equal(ghostServer.status, 404);
  const adminUser = db.get("SELECT id FROM users WHERE username = 'admin'");
  const onAdmin = await app.req('PUT', `/api/permissions/${adminUser.id}/${B}`, {
    cookie: adminCookie,
    body: { perms: ['view'] },
  });
  assert.equal(onAdmin.status, 409);

  const reset = await app.req('PUT', `/api/permissions/${viewerId}/${A}`, {
    cookie: adminCookie,
    body: { perms: null },
  });
  assert.equal(reset.status, 200);
  assert.equal(reset.json.grant, null);
  assert.deepEqual(reset.json.effective, ['view']);
  assert.equal(
    (await app.req('GET', `/api/servers/${A}/logs`, { cookie: viewerCookie })).status,
    200,
    'A visible again'
  );
});

test('a deleted server keeps its history for admins and operators; an explicit hide survives the delete', async () => {
  const C = app.seedServer('srv_perm_c');
  db.run("UPDATE servers SET display_name = 'Charlie Gone' WHERE id = ?", C);
  await app.req('PUT', `/api/permissions/${viewerId}/${C}`, { cookie: adminCookie, body: { perms: [] } });
  db.run(
    `INSERT INTO backups (id, server_id, filename, rel_path, size_bytes, reason) VALUES ('bk_charlie', ?, 'charlie.zip', 'backups/charlie.zip', 10, 'manual')`,
    C
  );
  // Soft-delete via the service path used by DELETE /api/servers/:id (no container exists; that is tolerated).
  await require('../src/services/servers').deleteServer(C, { actor: 'test', keepWorld: true, keepBackups: true });
  assert.equal(
    db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE server_id = ?', C).n,
    1,
    'grant row kept'
  );
  for (const [who, cookie] of [
    ['admin', adminCookie],
    ['operator', operatorCookie],
  ]) {
    const activity = await app.req('GET', '/activity', { cookie, headers: { Accept: 'text/html' } });
    assert.ok(activity.text.includes('Charlie Gone'), `${who} still sees the deleted server's history`);
    const backupsPage = await app.req('GET', '/backups', { cookie, headers: { Accept: 'text/html' } });
    assert.ok(backupsPage.text.includes('charlie.zip'), `${who} still sees the kept backup`);
  }
  const viewerActivity = await app.req('GET', '/activity', { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.ok(!viewerActivity.text.includes('Charlie Gone'), 'hidden stays hidden after the delete');
  assert.equal((await app.req('GET', '/api/backups/bk_charlie/download', { cookie: viewerCookie })).status, 404);

  const tmp = await login('tmp_p', 'tmppass12345', 'viewer');
  await app.req('PUT', `/api/permissions/${tmp.id}/${B}`, { cookie: adminCookie, body: { perms: ['power'] } });
  assert.equal((await app.req('DELETE', `/api/users/${tmp.id}`, { cookie: adminCookie })).status, 200);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE user_id = ?', tmp.id).n, 0);
});

// ---------------------------------------------------------------------------
// Review round: every place a hidden server used to leak, and grant-event privacy.

test('player detail page: hidden server is 404; admin keeps the power row there', async () => {
  await app.req('PUT', `/api/permissions/${viewerId}/${A}`, { cookie: adminCookie, body: { perms: [] } });
  const hidden = await app.req('GET', `/servers/${A}/players/Steve`, {
    cookie: viewerCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(hidden.status, 404);
  assert.ok(!hidden.text.includes('Alpha Server'));
  const visible = await app.req('GET', `/servers/${B}/players/Steve`, {
    cookie: viewerCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(visible.status, 200);
  const adminPage = await app.req('GET', `/servers/${A}/players/Steve`, {
    cookie: adminCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(adminPage.status, 200);
  assert.ok(!/class="flex flex-wrap gap-2 hidden">/.test(adminPage.text), 'power row visible for the admin');
  await app.req('PUT', `/api/permissions/${viewerId}/${A}`, { cookie: adminCookie, body: { perms: null } });
});

test('blueprints: export and clone need files on the source; hidden reads as missing; its blueprints are hidden', async () => {
  // Operator: hidden on A (set earlier).
  const exportHidden = await app.req('POST', '/api/blueprints/export', {
    cookie: operatorCookie,
    body: { serverId: A },
  });
  assert.equal(exportHidden.status, 404);
  const cloneHidden = await app.req('POST', '/api/blueprints/clone', { cookie: operatorCookie, body: { serverId: A } });
  assert.equal(cloneHidden.status, 404);
  await app.req('PUT', `/api/permissions/${operatorId}/${B}`, { cookie: adminCookie, body: { perms: ['content'] } });
  const exportNoFiles = await app.req('POST', '/api/blueprints/export', {
    cookie: operatorCookie,
    body: { serverId: B },
  });
  assert.equal(exportNoFiles.status, 403);
  assert.match(exportNoFiles.json.error, /files permission/);
  await app.req('PUT', `/api/permissions/${operatorId}/${B}`, { cookie: adminCookie, body: { perms: null } });

  // Viewer with files on B may export B; still read-only on A; clone stays global.
  await app.req('PUT', `/api/permissions/${viewerId}/${B}`, { cookie: adminCookie, body: { perms: ['files'] } });
  const viewerExportB = await app.req('POST', '/api/blueprints/export', {
    cookie: viewerCookie,
    body: { serverId: B },
  });
  assert.ok(
    ![401, 403, 404].includes(viewerExportB.status),
    `viewer with files exports B, got ${viewerExportB.status}`
  );
  assert.equal(
    (await app.req('POST', '/api/blueprints/export', { cookie: viewerCookie, body: { serverId: A } })).status,
    403
  );
  assert.equal(
    (await app.req('POST', '/api/blueprints/clone', { cookie: viewerCookie, body: { serverId: B } })).status,
    403,
    'clone creates a server: global role'
  );

  // A blueprint exported from a hidden server is invisible to that user.
  const adminExportA = await app.req('POST', '/api/blueprints/export', { cookie: adminCookie, body: { serverId: A } });
  assert.equal(adminExportA.status, 201);
  const bpId = adminExportA.json.blueprint.id;
  const opList = await app.req('GET', '/api/blueprints', { cookie: operatorCookie });
  assert.ok(!opList.json.blueprints.some((b) => b.id === bpId), 'hidden source: absent from the API list');
  assert.equal((await app.req('GET', `/api/blueprints/${bpId}/download`, { cookie: operatorCookie })).status, 404);
  const opPage = await app.req('GET', '/blueprints', { cookie: operatorCookie, headers: { Accept: 'text/html' } });
  assert.ok(!opPage.text.includes(bpId), 'hidden source: absent from the page');
  const adminList = await app.req('GET', '/api/blueprints', { cookie: adminCookie });
  assert.ok(adminList.json.blueprints.some((b) => b.id === bpId));
  const viewerList = await app.req('GET', '/api/blueprints', { cookie: viewerCookie });
  assert.ok(
    viewerList.json.blueprints.some((b) => b.id === bpId),
    'viewer can view A, so sees it'
  );
});

test('tasks, worlds library labels, modpacks, updates badge never name a hidden server', async () => {
  await app.req('PUT', `/api/permissions/${viewerId}/${A}`, { cookie: adminCookie, body: { perms: [] } });
  const tasks = require('../src/services/tasks');
  const t = tasks.createTask('Backing up Alpha Server…', { serverId: A, actor: 'test' });
  const viewerTasks = await app.req('GET', '/api/tasks', { cookie: viewerCookie });
  assert.ok(!viewerTasks.json.tasks.some((x) => x.id === t.id), 'hidden server task absent from the list');
  assert.equal((await app.req('GET', `/api/tasks/${t.id}`, { cookie: viewerCookie })).status, 404);
  const adminTasks = await app.req('GET', '/api/tasks', { cookie: adminCookie });
  assert.ok(adminTasks.json.tasks.some((x) => x.id === t.id));
  t.done({});

  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, world_source)
     VALUES ('lib_world_a', 'world', 'Alpha World', 'alpha-world.zip', 'library/worlds/alpha-world.zip', 'x', 10, ?)`,
    `extract:${A}`
  );
  const viewerWorlds = await app.req('GET', '/api/worlds', { cookie: viewerCookie });
  const row = viewerWorlds.json.worlds.find((w) => w.id === 'lib_world_a');
  assert.equal(row.source, 'Extracted from a server');
  const adminWorlds = await app.req('GET', '/api/worlds', { cookie: adminCookie });
  assert.equal(adminWorlds.json.worlds.find((w) => w.id === 'lib_world_a').source, 'Extracted from Alpha Server');
  const worldsPage = await app.req('GET', '/worlds', { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.ok(!worldsPage.text.includes('Alpha Server'));

  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
     VALUES (?, 'modrinth', 'alpha-pack', 'Alpha Pack', 'v1', '1.0')`,
    A
  );
  db.run("UPDATE servers SET update_policy = 'notify' WHERE id = ?", A);
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name) VALUES ('pack', ?, 'v1', 'v2', '2.0')`,
    A
  );
  const modpacks = await app.req('GET', '/modpacks', { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.ok(!modpacks.text.includes('Alpha Server') && !modpacks.text.includes('Alpha Pack'));
  const adminModpacks = await app.req('GET', '/modpacks', { cookie: adminCookie, headers: { Accept: 'text/html' } });
  assert.ok(adminModpacks.text.includes('Alpha Pack'));
  const updates = await app.req('GET', '/updates', { cookie: viewerCookie, headers: { Accept: 'text/html' } });
  assert.ok(!updates.text.includes('Alpha Pack'));
  assert.ok(!/badge badge-warn ml-auto">/.test(updates.text), 'sidebar badge counts only visible servers');
  const adminUpdates = await app.req('GET', '/updates', { cookie: adminCookie, headers: { Accept: 'text/html' } });
  assert.ok(adminUpdates.text.includes('Alpha Pack'));
  assert.ok(/badge badge-warn ml-auto">1</.test(adminUpdates.text), 'admin badge shows the one outdated pack');
  assert.equal((await app.req('GET', `/api/packs/details?serverId=${A}`, { cookie: viewerCookie })).status, 404);
  await app.req('PUT', `/api/permissions/${viewerId}/${A}`, { cookie: adminCookie, body: { perms: null } });
});

test('grant-change history entries are admin-only in every listing and export', async () => {
  await app.req('PUT', `/api/permissions/${viewerId}/${B}`, { cookie: adminCookie, body: { perms: ['power'] } });
  const history = await app.req('GET', `/servers/${B}/history`, {
    cookie: viewerCookie,
    headers: { Accept: 'text/html' },
  });
  assert.equal(history.status, 200);
  assert.ok(!history.text.includes('Permissions for'), 'server history hides grant events from non-admins');
  const overview = await app.req('GET', `/servers/${B}`, { cookie: operatorCookie, headers: { Accept: 'text/html' } });
  assert.ok(!overview.text.includes('Permissions for'));
  const activity = await app.req('GET', '/activity', { cookie: operatorCookie, headers: { Accept: 'text/html' } });
  assert.ok(!activity.text.includes('Permissions for'));
  const dash = await app.req('GET', '/', { cookie: operatorCookie, headers: { Accept: 'text/html' } });
  assert.ok(!dash.text.includes('Permissions for'));
  const opExport = await app.req('GET', '/api/events/export?format=json', { cookie: operatorCookie });
  assert.ok(!opExport.text.includes('permissions-changed'));
  const adminHistory = await app.req('GET', `/servers/${B}/history`, {
    cookie: adminCookie,
    headers: { Accept: 'text/html' },
  });
  assert.ok(adminHistory.text.includes('Permissions for'));
  const adminExport = await app.req('GET', '/api/events/export?format=json', { cookie: adminCookie });
  assert.ok(adminExport.text.includes('permissions-changed'));
});

test('capability mapping: log bundles need files, world quick actions need console, global world routes follow content', async () => {
  await app.req('PUT', `/api/permissions/${viewerId}/${B}`, { cookie: adminCookie, body: { perms: ['power'] } });
  assert.equal((await app.req('GET', `/api/servers/${B}/logs/bundle.zip`, { cookie: viewerCookie })).status, 403);
  assert.equal((await app.req('GET', `/api/servers/${B}/logs/game`, { cookie: viewerCookie })).status, 403);
  assert.equal(
    (await app.req('GET', `/api/servers/${B}/logs`, { cookie: viewerCookie })).status,
    200,
    'live console output is view'
  );
  const quickNoConsole = await app.req('POST', `/api/servers/${B}/world/quick`, {
    cookie: viewerCookie,
    body: { action: 'day' },
  });
  assert.equal(quickNoConsole.status, 403);
  assert.match(quickNoConsole.json.error, /console permission/);
  await app.req('PUT', `/api/permissions/${viewerId}/${B}`, {
    cookie: adminCookie,
    body: { perms: ['console', 'files', 'content'] },
  });
  assert.notEqual((await app.req('GET', `/api/servers/${B}/logs/game`, { cookie: viewerCookie })).status, 403);
  const quick = await app.req('POST', `/api/servers/${B}/world/quick`, {
    cookie: viewerCookie,
    body: { action: 'day' },
  });
  assert.ok(![401, 403, 404].includes(quick.status), `console allows quick actions, got ${quick.status}`);
  // Global worlds routes name the server in the body: content on B opens them for a viewer.
  const extractB = await app.req('POST', '/api/worlds/extract', {
    cookie: viewerCookie,
    body: { serverId: B, name: 'w' },
  });
  // The seeded server has no level.dat, so the world service answers its own
  // 404; the gate is passed when the error is not the "Server not found" one.
  assert.ok(![401, 403].includes(extractB.status), `extract from B passes the gate, got ${extractB.status}`);
  assert.notEqual(extractB.json && extractB.json.error, 'Server not found');
  assert.match(extractB.json.error, /level\.dat/);
  assert.equal(
    (await app.req('POST', '/api/worlds/extract', { cookie: viewerCookie, body: { serverId: A, name: 'w' } })).status,
    403
  );
  const installA = await app.req('POST', '/api/worlds/lib_world_a/install', {
    cookie: viewerCookie,
    body: { serverId: A },
  });
  assert.equal(installA.status, 403);
  await app.req('PUT', `/api/permissions/${viewerId}/${B}`, { cookie: adminCookie, body: { perms: null } });
});
