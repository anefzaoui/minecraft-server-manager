'use strict';

// services/permissions.js: the capability model itself. No HTTP here - the
// route-level behaviour lives in permissions-authz.test.js and the structural
// route audit in permissions-routes.test.js.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { migrate } = require('../src/db/migrate');
migrate();
const db = require('../src/db');
const permissions = require('../src/services/permissions');
const { seedServer } = require('./helpers/app');

const ALL = [...permissions.CAPABILITIES];

function seedUser(id, username, role) {
  db.run('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)', id, username, 'x', role);
  return { id, username, role };
}

const admin = seedUser('usr_admin', 'admin', 'admin');
const operator = seedUser('usr_op', 'op', 'operator');
const viewer = seedUser('usr_view', 'view', 'viewer');
const srvA = seedServer('srv_a');
const srvB = seedServer('srv_b');

test('the catalog has nine capabilities with labels and help, view first', () => {
  assert.equal(ALL.length, 9);
  assert.equal(ALL[0], 'view');
  for (const c of ALL) {
    assert.ok(permissions.CAPABILITY_INFO[c].label, `${c} has a label`);
    assert.match(permissions.CAPABILITY_INFO[c].help, /\.$/, `${c} help ends in a period`);
  }
});

test('normalize: dedupes, orders by catalog, implies view, rejects unknown names', () => {
  assert.deepEqual(permissions.normalize(['delete', 'power', 'power']), ['view', 'power', 'delete']);
  assert.deepEqual(permissions.normalize([]), []);
  assert.deepEqual(permissions.normalize(['view']), ['view']);
  assert.throws(() => permissions.normalize(['root']), /Unknown permission "root"/);
  assert.throws(() => permissions.normalize('power'), /list of capability names/);
  const err = (() => {
    try {
      permissions.normalize(['nope']);
    } catch (e) {
      return e;
    }
  })();
  assert.equal(err.status, 400);
});

test('role defaults: admin and operator hold everything, viewer holds view only', () => {
  assert.deepEqual(permissions.effective(admin, srvA), ALL);
  assert.deepEqual(permissions.effective(operator, srvA), ALL);
  assert.deepEqual(permissions.effective(viewer, srvA), ['view']);
  assert.deepEqual(permissions.effective(null, srvA), []);
  assert.equal(permissions.can(viewer, srvA, 'power'), false);
  assert.equal(permissions.can(operator, srvA, 'delete'), true);
  assert.throws(() => permissions.can(admin, srvA, 'sudo'), /Unknown capability/);
});

test('a grant elevates a viewer on one server only', () => {
  const res = permissions.setGrant(viewer.id, srvB, ['power', 'console'], { actor: 'test' });
  assert.deepEqual(res.grant, ['view', 'power', 'console']);
  assert.deepEqual(res.effective, ['view', 'power', 'console']);
  assert.equal(permissions.can(viewer, srvB, 'power'), true);
  assert.equal(permissions.can(viewer, srvB, 'backups'), false);
  assert.equal(permissions.can(viewer, srvA, 'power'), false, 'other server untouched');
  assert.deepEqual(permissions.getGrant(viewer.id, srvA), null);
});

test('a grant demotes an operator on one server, and an admin is never overridden', () => {
  permissions.setGrant(operator.id, srvA, ['view'], { actor: 'test' });
  assert.deepEqual(permissions.effective(operator, srvA), ['view']);
  assert.deepEqual(permissions.effective(operator, srvB), ALL);
  assert.throws(() => permissions.setGrant(admin.id, srvA, ['view']), /Admins always have every permission/);
  assert.deepEqual(permissions.effective(admin, srvA), ALL);
});

test('an empty grant hides the server: visibleServerIds and filterVisible drop it', () => {
  permissions.setGrant(viewer.id, srvA, [], { actor: 'test' });
  assert.deepEqual(permissions.effective(viewer, srvA), []);
  assert.equal(permissions.can(viewer, srvA, 'view'), false);
  const ids = permissions.visibleServerIds(viewer);
  assert.equal(ids.has(srvA), false);
  assert.equal(ids.has(srvB), true);
  const rows = permissions.filterVisible(viewer, [{ id: srvA }, { id: srvB }]);
  assert.deepEqual(
    rows.map((r) => r.id),
    [srvB]
  );
  // Admins and grant-free users see everything without a per-server lookup.
  assert.deepEqual([...permissions.visibleServerIds(admin)].sort(), [srvA, srvB]);
  assert.deepEqual([...permissions.visibleServerIds(operator)].sort(), [srvA, srvB]);
  assert.equal(permissions.visibleServerIds(null).size, 0);
});

test('resetting a grant to null restores the role default', () => {
  const res = permissions.setGrant(viewer.id, srvA, null, { actor: 'test' });
  assert.equal(res.grant, null);
  assert.deepEqual(res.effective, ['view']);
  assert.equal(permissions.getGrant(viewer.id, srvA), null);
  assert.equal(permissions.visibleServerIds(viewer).has(srvA), true);
});

test('setGrant validates the user and the server', () => {
  assert.throws(() => permissions.setGrant('usr_ghost', srvA, ['view']), /user no longer exists/);
  assert.throws(() => permissions.setGrant(viewer.id, 'srv_ghost', ['view']), /server no longer exists/);
  assert.throws(() => permissions.setGrant(viewer.id, srvA, ['view', 'bogus']), /Unknown permission/);
});

test('a soft-deleted server drops out of visibility and its grant rows are forgotten', () => {
  const srvC = seedServer('srv_c');
  permissions.setGrant(viewer.id, srvC, ['power'], { actor: 'test' });
  assert.equal(permissions.visibleServerIds(viewer).has(srvC), true);
  db.run("UPDATE servers SET deleted_at = datetime('now') WHERE id = ?", srvC);
  assert.equal(permissions.visibleServerIds(viewer).has(srvC), false);
  permissions.forgetServer(srvC);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE server_id = ?', srvC).n, 0);
  assert.throws(() => permissions.setGrant(viewer.id, srvC, ['view']), /server no longer exists/);
});

test('deleting a user cascades its grant rows (schema contract from migration 001)', () => {
  const tmp = seedUser('usr_tmp', 'tmp', 'viewer');
  permissions.setGrant(tmp.id, srvB, ['power'], { actor: 'test' });
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE user_id = ?', tmp.id).n, 1);
  db.run('DELETE FROM users WHERE id = ?', tmp.id);
  assert.equal(db.get('SELECT COUNT(*) AS n FROM user_server_permissions WHERE user_id = ?', tmp.id).n, 0);
});

test('legacy cell contents in the pre-existing column are read defensively', () => {
  // The table predates this module; a row written by hand in the old
  // comma/plain form must not crash the panel or grant anything unknown.
  db.run(
    "INSERT INTO user_server_permissions (user_id, server_id, perms) VALUES (?, ?, 'view, power, bogus')",
    operator.id,
    srvB
  );
  assert.deepEqual(permissions.effective(operator, srvB), ['view', 'power']);
  db.run(
    "UPDATE user_server_permissions SET perms = 'not json at all' WHERE user_id = ? AND server_id = ?",
    operator.id,
    srvB
  );
  assert.deepEqual(permissions.effective(operator, srvB), [], 'unparseable = nothing granted, never a crash');
  db.run("UPDATE user_server_permissions SET perms = '' WHERE user_id = ? AND server_id = ?", operator.id, srvB);
  assert.deepEqual(permissions.effective(operator, srvB), []);
  db.run('DELETE FROM user_server_permissions WHERE user_id = ? AND server_id = ?', operator.id, srvB);
});

test('listMatrix lists non-admin users × live servers with grant and effective resolved', () => {
  permissions.setGrant(viewer.id, srvB, ['power'], { actor: 'test' });
  const m = permissions.listMatrix();
  assert.equal(m.capabilities.length, 9);
  assert.deepEqual(
    m.users.map((u) => u.username),
    ['op', 'view']
  );
  assert.deepEqual(
    m.servers.map((s) => s.id),
    [srvA, srvB]
  );
  const viewRow = m.rows.find((r) => r.user.id === viewer.id);
  assert.deepEqual(viewRow.roleDefault, ['view']);
  const cellA = viewRow.servers.find((c) => c.serverId === srvA);
  const cellB = viewRow.servers.find((c) => c.serverId === srvB);
  assert.equal(cellA.grant, null);
  assert.deepEqual(cellA.effective, ['view']);
  assert.deepEqual(cellB.grant, ['view', 'power']);
  assert.deepEqual(cellB.effective, ['view', 'power']);
});

test('every grant change is written to the history log with a period-terminated summary', () => {
  permissions.setGrant(viewer.id, srvA, ['backups'], { actor: 'admin' });
  permissions.setGrant(viewer.id, srvA, [], { actor: 'admin' });
  permissions.setGrant(viewer.id, srvA, null, { actor: 'admin' });
  const rows = db.all("SELECT summary, actor FROM events WHERE type = 'permissions-changed' ORDER BY id DESC LIMIT 3");
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.equal(r.actor, 'admin');
    assert.match(r.summary, /\.$/);
  }
  assert.match(rows[2].summary, /set to view, backups\./);
  assert.match(rows[1].summary, /hidden from view\./);
  assert.match(rows[0].summary, /reset to the viewer default\./);
});
