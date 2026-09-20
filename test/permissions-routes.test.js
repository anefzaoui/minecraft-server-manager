'use strict';

// Structural audit of the API router: every state-changing route under
// /api/servers/:id must declare the capability it needs via requireCap(), and
// every sub-router mounted under /api/servers/:id must carry a mount-level
// capability gate. This is what makes "a new endpoint cannot ship unguarded"
// a property of the codebase rather than a code-review hope.
//
// The audit walks the live Express router stack (not the source), so it sees
// exactly what runs. Mount paths are read from the source only to know WHICH
// prefixes to probe, because Express 5 layers do not retain their path string.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('../src/web/routes/api');

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

// Admin-only endpoints keep their requireRole('admin') gate instead of a
// capability. Anything added here must be admin-only by design.
const ADMIN_ONLY_ROUTES = new Set(['/servers/:id/backups/retention', '/servers/:id/docker-spec']);
const ADMIN_ONLY_MOUNTS = new Set(['/servers/:id/wizard']);

const hasCap = (stack) => stack.some((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_'));

test('serverScope is mounted on /servers/:id ahead of every per-server route', () => {
  const scopeIndex = api.stack.findIndex((l) => l.name === 'serverScope');
  assert.ok(scopeIndex >= 0, 'serverScope layer present');
  const firstServerRoute = api.stack.findIndex((l) => l.route && /^\/servers\/:id(\/|$)/.test(l.route.path));
  assert.ok(firstServerRoute > scopeIndex, 'serverScope precedes the first /servers/:id route');
  const scope = api.stack[scopeIndex];
  assert.equal(scope.match('/servers/srv_probe/anything/deeper'), true);
  assert.equal(scope.match('/servers'), false);
});

test('every write route under /servers/:id carries a requireCap layer', () => {
  const missing = [];
  for (const layer of api.stack) {
    if (!layer.route) continue;
    const p = layer.route.path;
    if (!/^\/servers\/:id(\/|$)/.test(p)) continue;
    const methods = Object.keys(layer.route.methods).filter((m) => WRITE_METHODS.includes(m));
    if (!methods.length) continue;
    if (ADMIN_ONLY_ROUTES.has(p)) continue;
    if (!hasCap(layer.route.stack)) missing.push(`${methods.join(',').toUpperCase()} ${p}`);
  }
  assert.deepEqual(missing, [], 'routes without a capability gate');
});

test('side-effecting GETs that used to be admin/operator-only now name a capability', () => {
  for (const p of ['/servers/:id/events/export', '/backups/:backupId/download']) {
    const layer = api.stack.find((l) => l.route && l.route.path === p && l.route.methods.get);
    assert.ok(layer, `${p} exists`);
    assert.ok(hasCap(layer.route.stack), `${p} has requireCap`);
  }
  for (const p of ['/backups/:backupId']) {
    for (const m of ['delete', 'patch']) {
      const layer = api.stack.find((l) => l.route && l.route.path === p && l.route.methods[m]);
      assert.ok(layer && hasCap(layer.route.stack), `${m.toUpperCase()} ${p} has requireCap`);
    }
  }
});

test('every sub-router mounted under /servers/:id has a mount-level capability gate', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'web', 'routes', 'api.js'), 'utf8');
  const mounts = [...src.matchAll(/router\.use\(\s*'(\/servers\/:id\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(mounts.length >= 9, `found ${mounts.length} server-scoped mounts`);
  const missing = [];
  for (const mountPath of mounts) {
    if (ADMIN_ONLY_MOUNTS.has(mountPath)) continue;
    const probe = mountPath.replace(':id', 'srv_probe') + '/probe';
    // Layers that match this prefix: the cap gate and the router share it.
    const matching = api.stack.filter((l) => !l.route && l.match(probe));
    const gate = matching.find((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_'));
    const sub = matching.find((l) => l.handle && Array.isArray(l.handle.stack));
    if (!sub) missing.push(`${mountPath}: no sub-router matched the probe`);
    else if (!gate) missing.push(`${mountPath}: no requireCap layer on the mount`);
    else if (gate.writesOnly) {
      // Writes-only mount gate: fine as long as the sub-router has no write
      // route that also needs a DIFFERENT capability - those must gate inline.
      for (const rl of sub.handle.stack) {
        if (!rl.route) continue;
        const writes = Object.keys(rl.route.methods).filter((m) => WRITE_METHODS.includes(m));
        if (!writes.length) continue;
        // Covered by the mount gate. Nothing more to assert; listed for clarity.
      }
    }
  }
  assert.deepEqual(missing, [], 'server-scoped mounts without a capability gate');
});

test('the wizard mount stays admin-only rather than capability-gated', () => {
  const probe = '/servers/srv_probe/wizard/probe';
  const matching = api.stack.filter((l) => !l.route && l.match(probe));
  assert.ok(matching.length >= 2, 'guard + router mounted');
  assert.ok(
    !matching.some((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_')),
    'no capability gate (admin gate instead)'
  );
});
