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
const pages = require('../src/web/routes/index');

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'];

// Admin-only endpoints keep their requireRole('admin') gate instead of a
// capability. Anything added here must be admin-only by design.
const ADMIN_ONLY_ROUTES = new Set(['/servers/:id/backups/retention']);
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
    else if (gate.handle.writesOnly) {
      // A writes-only mount gate covers every write route of the sub-router.
      // An inner requireCap on a route is allowed only when it is at least as
      // specific (a different capability than the mount's), never a downgrade
      // to `view`, which would be a no-op behind the mount's own view check.
      for (const rl of sub.handle.stack) {
        if (!rl.route) continue;
        const inner = rl.route.stack.find((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_'));
        if (inner && inner.handle.capability === 'view')
          missing.push(`${mountPath}${rl.route.path}: inner requireCap('view')`);
      }
    }
  }
  assert.deepEqual(missing, [], 'server-scoped mounts without a capability gate');
});

test('page router: serverScope is mounted ahead of every /servers/:id page', () => {
  const scopeIndex = pages.stack.findIndex((l) => l.name === 'serverScope');
  assert.ok(scopeIndex >= 0, 'serverScope layer present on the pages router');
  const late = pages.stack
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.route && /^\/servers\/:id(\/|\{|$)/.test(l.route.path))
    .map(({ l, i }) => ({ path: l.route.path, i }));
  assert.ok(late.length >= 3, `found ${late.length} server page routes`);
  const before = late.filter((r) => r.i < scopeIndex).map((r) => r.path);
  assert.deepEqual(before, [], 'server pages registered before serverScope');
  const scope = pages.stack[scopeIndex];
  assert.equal(scope.match('/servers/srv_probe/players/Steve'), true);
  assert.equal(scope.match('/servers/new'), true, 'static ids also match; serverScope passes them through');
});

test('sensitive per-server GETs name a capability: files tree, logs archive and bundle, events export', () => {
  const need = {
    '/servers/:id/logs/archived': 'files',
    '/servers/:id/logs/archived/:file': 'files',
    '/servers/:id/logs/game': 'files',
    '/servers/:id/logs/game/:file': 'files',
    '/servers/:id/logs/bundle.zip': 'files',
    '/servers/:id/events/export': 'files',
  };
  for (const [p, cap] of Object.entries(need)) {
    const layer = api.stack.find((l) => l.route && l.route.path === p && l.route.methods.get);
    assert.ok(layer, `${p} exists`);
    const gate = layer.route.stack.find((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_'));
    assert.equal(gate && gate.handle.capability, cap, `${p} needs ${cap}`);
  }
  const files = api.stack.filter((l) => !l.route && l.match('/servers/srv_probe/files/list'));
  const filesGate = files.find((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_'));
  assert.ok(
    filesGate && filesGate.handle.capability === 'files' && !filesGate.handle.writesOnly,
    'files tree gated on reads too'
  );
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

test('the capability catalog names every gated route (the Permissions page cannot drift from enforcement)', () => {
  const { CAPABILITY_INFO } = require('../src/services/permissions');
  const gated = [];
  for (const layer of api.stack) {
    if (!layer.route) continue;
    const gate = layer.route.stack.find((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_'));
    if (!gate) continue;
    for (const m of Object.keys(layer.route.methods)) {
      gated.push({ cap: gate.handle.capability, entry: `${m.toUpperCase()} /api${layer.route.path}` });
    }
  }
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'web', 'routes', 'api.js'), 'utf8');
  for (const m of src.matchAll(/router\.use\('(\/servers\/:id\/[^']+)', (requireCap\w*)\('(\w+)'\)/g)) {
    gated.push({ cap: m[3], entry: `${m[2] === 'requireCapForWrites' ? 'WRITES' : 'ALL'} /api${m[1]}/*` });
  }
  assert.ok(gated.length >= 50, `found ${gated.length} gated routes`);
  const missing = [];
  for (const { cap, entry } of gated) {
    const reach = CAPABILITY_INFO[cap].reach.map((r) => r.replace(/ \(.*\)$/, ''));
    if (!reach.includes(entry)) missing.push(`${cap}: ${entry}`);
  }
  assert.deepEqual(missing, [], 'gated routes absent from the catalog reach');
  // And the other way round: every catalogued API route is really gated by that capability.
  const known = new Set(gated.map((g) => `${g.cap} ${g.entry}`));
  const stale = [];
  for (const cap of Object.keys(CAPABILITY_INFO)) {
    for (const r of CAPABILITY_INFO[cap].reach) {
      const entry = r.replace(/ \(.*\)$/, '');
      if (!/^(GET|POST|PUT|PATCH|DELETE|WRITES|ALL) \/api\/servers\/:id/.test(entry)) continue; // ws, map, pages, body-scoped
      if (entry === 'GET /api/servers/:id/*') continue; // view: everything under serverScope
      if (
        /^(GET|POST) \/api\/servers\/:id\/(worlds\/:world\/download|integrations\/invite\/modpack\.mrpack)$/.test(entry)
      )
        continue; // gated inside sub-routers
      if (!known.has(`${cap} ${entry}`)) stale.push(`${cap}: ${entry}`);
    }
  }
  assert.deepEqual(stale, [], 'catalog entries that no route enforces');
});
