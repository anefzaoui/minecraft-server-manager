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
// Express 5 records router.all() as `_all`; treat it as a write.
const isWrite = (methods) => Object.keys(methods).some((m) => WRITE_METHODS.includes(m) || m === '_all');
// Any parameter name counts: `/servers/:serverId/x` is as server-scoped as `/servers/:id/x`.
const SERVER_ROUTE = /^\/servers\/:\w+(\/|\{|$)/;
const ROUTES_DIR = path.join(__dirname, '..', 'src', 'web', 'routes');
const routeSources = () =>
  fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ file: f, src: fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8') }));

// Admin-only endpoints keep their requireRole('admin') gate instead of a
// capability. Anything added here must be admin-only by design.
const ADMIN_ONLY_ROUTES = new Set(['/servers/:id/backups/retention']);
const ADMIN_ONLY_MOUNTS = new Set(['/servers/:id/wizard']);

const hasCap = (stack) => stack.some((l) => typeof l.name === 'string' && l.name.startsWith('requireCap_'));

test('serverScope is mounted on /servers/:id ahead of every per-server route', () => {
  const scopeIndex = api.stack.findIndex((l) => l.name === 'serverScope');
  assert.ok(scopeIndex >= 0, 'serverScope layer present');
  const firstServerRoute = api.stack.findIndex((l) => l.route && SERVER_ROUTE.test(l.route.path));
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
    if (!SERVER_ROUTE.test(p)) continue;
    if (!isWrite(layer.route.methods)) continue;
    if (ADMIN_ONLY_ROUTES.has(p)) continue;
    if (!hasCap(layer.route.stack)) missing.push(`${Object.keys(layer.route.methods).join(',').toUpperCase()} ${p}`);
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
  // Mount paths come from the source because Express 5 layers keep no path
  // string. Every routes file is scanned, any quote style, wrapped or not, and
  // a mount whose path is not a literal fails loudly below.
  const mounts = [];
  for (const { file, src } of routeSources()) {
    for (const m of src.matchAll(/router\.use\(\s*(['"`])(\/servers\/:\w+\/[^'"`]+)\1/g)) mounts.push(m[2]);
    for (const m of src.matchAll(/router\.use\(\s*([^'"`\s][^,\n]*),/g)) {
      const arg = m[1].trim();
      // A non-literal first argument that is not itself a middleware (name
      // starts with a lower-case identifier followed by "(") is a mount path
      // we cannot audit.
      if (/^[A-Za-z_$][\w$]*$/.test(arg) && /servers/i.test(arg)) assert.fail(`${file}: non-literal mount path ${arg}`);
    }
  }
  assert.ok(mounts.length >= 9, `found ${mounts.length} server-scoped mounts`);
  const missing = [];
  for (const mountPath of mounts) {
    if (ADMIN_ONLY_MOUNTS.has(mountPath)) continue;
    const probe = mountPath.replace(/:\w+/, 'srv_probe') + '/probe';
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
    .filter(({ l }) => l.route && SERVER_ROUTE.test(l.route.path))
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
  for (const { src } of routeSources()) {
    for (const m of src.matchAll(
      /router\.use\(\s*(['"`])(\/servers\/:\w+\/[^'"`]+)\1\s*,\s*(requireCap\w*)\(\s*(['"`])(\w+)\4\s*\)/g
    )) {
      gated.push({ cap: m[5], entry: `${m[3] === 'requireCapForWrites' ? 'WRITES' : 'ALL'} /api${m[2]}/*` });
    }
  }
  // Server-scoped schedule task types: the parenthetical on each
  // `POST /api/schedules (…)` reach line must list exactly the task types whose
  // `capability` in services/scheduler.js is that capability.
  const { TASK_TYPES } = require('../src/services/scheduler');
  for (const cap of Object.keys(CAPABILITY_INFO)) {
    const line = CAPABILITY_INFO[cap].reach.find((r) => r.startsWith('POST /api/schedules'));
    const listed = line
      ? line
          .replace(/^.*\((.*)\)$/, '$1')
          .split(',')
          .map((s) => s.trim())
          .sort()
      : [];
    const actual = Object.entries(TASK_TYPES)
      .filter(([, t]) => t.serverScoped && t.capability === cap)
      .map(([k]) => k)
      .sort();
    assert.deepEqual(listed, actual, `schedule task types listed for ${cap}`);
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

// Sub-router modules whose `router` is mounted under /api/servers/:id (their
// mount gate covers every write). Kept in step with the mounts in api.js.
const SERVER_MOUNTED_FILES = new Set([
  'analytics.js',
  'chatCommands.js',
  'crashes.js',
  'files.js',
  'integrations.js',
  'inventory.js',
  'items.js',
  'players.js',
  'wizard.js',
]);

test('every route that names its server in the body is either under /servers/:id or listed in BODY_SCOPED', () => {
  const { BODY_SCOPED } = require('../src/web/middleware/auth');
  const offenders = [];
  for (const { file, src } of routeSources()) {
    // Split the source into route blocks: from one `router.<verb>(` to the next.
    const blocks = src.split(
      /(?=^(?:router|serverWorlds|globalSearch|serverFiles|globalFiles)\.(?:get|post|put|patch|delete|all|use)\()/m
    );
    for (const block of blocks) {
      const head = block.match(/^(\w+)\.(get|post|put|patch|delete|all|use)\(\s*(['"`])([^'"`]+)\3/);
      if (!head) continue;
      const [, routerName, method, , routePath] = head;
      if (!/\b(?:targetServerId|serverId)\b/.test(block)) continue;
      if (method === 'get' || method === 'use') continue; // reads and mounts are covered elsewhere
      const mountedUnderServer =
        SERVER_ROUTE.test(routePath) ||
        routerName === 'serverWorlds' ||
        routerName === 'serverFiles' ||
        SERVER_MOUNTED_FILES.has(file);
      if (mountedUnderServer) continue;
      // A write outside /servers/:id that reads a server id from the body.
      const full = {
        'api.js': '/api',
        'worlds.js': '/api/worlds',
        'blueprints.js': '/api/blueprints',
        'inventory.js': '/api/inventory',
      }[file];
      if (!full) {
        offenders.push(`${file}: ${method.toUpperCase()} ${routePath} (unknown mount prefix, add it to this test)`);
        continue;
      }
      const url = (full + routePath).replace(/\/$/, '') || '/';
      const probe = url.replace(/:\w+/g, 'x');
      if (!BODY_SCOPED.some((e) => e.re.test(probe))) offenders.push(`${file}: ${method.toUpperCase()} ${url}`);
    }
  }
  // Creating a server (plain, from a pack, zip, mods, blueprint, or clone)
  // names no existing server and stays on the global role; the permissions
  // endpoint is admin-only.
  const allowed = new Set([
    'api.js: POST /api/servers',
    'api.js: POST /api/servers/from-pack',
    'api.js: POST /api/servers/from-zip',
    'api.js: POST /api/servers/from-mods',
    'api.js: PUT /api/permissions/:userId/:serverId',
    'blueprints.js: POST /api/blueprints/clone',
    'blueprints.js: POST /api/blueprints/import',
  ]);
  assert.deepEqual(
    offenders.filter((o) => !allowed.has(o)),
    [],
    'body-addressed writes the viewer gate does not know about'
  );
});
