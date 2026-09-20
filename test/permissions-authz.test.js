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
  assert.equal(
    (
      await app.req('POST', '/api/schedules', {
        cookie: viewerCookie,
        body: { serverId: B, taskType: 'restart', cron: '0 4 * * *' },
      })
    ).status,
    403
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
  assert.equal(filesPage.status, 404);
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

test('deleting a server removes its grant rows; deleting a user cascades theirs', async () => {
  const C = app.seedServer('srv_perm_c');
  await app.req('PUT', `/api/permissions/${viewerId}/${C}`, { cookie: adminCookie, body: { perms: ['power'] } });
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE server_id = ?', C).n, 1);
  // Soft-delete via the service path used by DELETE /api/servers/:id (no container exists; that is tolerated).
  await require('../src/services/servers').deleteServer(C, { actor: 'test', keepWorld: true, keepBackups: true });
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE server_id = ?', C).n, 0);

  const tmp = await login('tmp_p', 'tmppass12345', 'viewer');
  await app.req('PUT', `/api/permissions/${tmp.id}/${B}`, { cookie: adminCookie, body: { perms: ['power'] } });
  assert.equal((await app.req('DELETE', `/api/users/${tmp.id}`, { cookie: adminCookie })).status, 200);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE user_id = ?', tmp.id).n, 0);
});
