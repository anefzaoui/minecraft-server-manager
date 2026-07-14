'use strict';

// QA sweep: logs into the running panel and verifies
//   1. every page + server tab renders 200 within a timing budget,
//   2. no actionable control still carries a data-toast placeholder,
//   3. key API endpoints respond,
//   4. every page script referenced by a view exists on disk.
// Usage: node scripts/qa-sweep.js [baseUrl] (default http://localhost:25564)

const fs = require('node:fs');
const path = require('node:path');

const BASE = process.argv[2] || 'http://localhost:25564';
const USER = process.env.QA_USER;
const PASS = process.env.QA_PASS;
const RENDER_BUDGET_MS = 400;

if (!USER || !PASS) {
  console.error('Set QA_USER and QA_PASS (an admin login on the running panel) before running the sweep.');
  console.error('  e.g.  QA_USER=admin QA_PASS=... node scripts/qa-sweep.js');
  process.exit(1);
}

const results = { pass: 0, fail: 0, warn: 0 };
const failures = [];

function report(kind, label, detail = '') {
  results[kind] += 1;
  if (kind === 'fail') failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  const mark = { pass: 'PASS', fail: 'FAIL', warn: 'WARN' }[kind];
  console.log(`${mark}  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  // ---- login ----
  const loginRes = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(USER)}&password=${encodeURIComponent(PASS)}`,
    redirect: 'manual',
  });
  const cookie = (loginRes.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie.includes('msm.sid')) {
    console.error('LOGIN FAILED — aborting');
    process.exit(1);
  }
  const get = (url) => fetch(`${BASE}${url}`, { headers: { cookie } });

  // ---- find a server id for tab checks ----
  const db = require('../src/db');
  const server = db.get('SELECT id FROM servers WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1');
  const sid = server ? server.id : null;

  // ---- 1. pages + tabs with timing ----
  const pages = [
    '/',
    '/servers/new',
    '/modpacks',
    '/worlds',
    '/blueprints',
    '/updates',
    '/backups',
    '/schedules',
    '/storage',
    '/activity',
    '/settings',
    '/files',
  ];
  const tabs = [
    'overview',
    'console',
    'players',
    'inventory',
    'mods',
    'map',
    'files',
    'worlds',
    'backups',
    'history',
    'analytics',
    'metrics',
    'integrations',
    'settings',
  ];
  const targets = [...pages, ...(sid ? tabs.map((t) => `/servers/${sid}/${t}`) : [])];
  for (const url of targets) {
    const t0 = Date.now();
    try {
      const res = await get(url);
      const ms = Date.now() - t0;
      if (res.status !== 200) report('fail', `GET ${url}`, `HTTP ${res.status}`);
      else if (ms > RENDER_BUDGET_MS) report('warn', `GET ${url}`, `${ms}ms > ${RENDER_BUDGET_MS}ms budget`);
      else report('pass', `GET ${url}`, `${ms}ms`);
    } catch (err) {
      report('fail', `GET ${url}`, err.message);
    }
  }

  // ---- 1b. sidebar server list identical on every page (context-shadowing guard) ----
  const sidebarCounts = new Map();
  for (const url of pages) {
    try {
      const html = await (await get(url)).text();
      // Scope to the sidebar only — page bodies legitimately link to servers
      // (activity rows, cards) and event rows may reference deleted ones.
      const aside = (html.match(/<aside id="sidebar"[\s\S]*?<\/aside>/) || [''])[0];
      const count = (aside.match(/href="\/servers\/srv_[A-Za-z0-9_-]+"/g) || []).filter(
        (v, i, a) => a.indexOf(v) === i
      ).length;
      sidebarCounts.set(url, count);
    } catch {
      /* covered by the page check above */
    }
  }
  const counts = [...new Set(sidebarCounts.values())];
  if (counts.length > 1) {
    const detail = [...sidebarCounts].map(([u, c]) => `${u}=${c}`).join(', ');
    report('fail', 'sidebar server list differs between pages (context shadowing)', detail);
  } else {
    report('pass', `sidebar server list consistent across pages (${counts[0] ?? 0} servers)`);
  }

  // ---- 2. no actionable data-toast placeholders in views ----
  const viewsDir = path.join(__dirname, '..', 'views');
  const offenders = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.hbs')) {
        const src = fs.readFileSync(p, 'utf8');
        const matches = src.match(/<(button|a)[^>]*data-toast=/g) || [];
        if (matches.length) offenders.push(`${path.relative(viewsDir, p)} (${matches.length})`);
      }
    }
  })(viewsDir);
  if (offenders.length) report('fail', 'placeholder data-toast buttons remain', offenders.join(', '));
  else report('pass', 'zero placeholder data-toast controls in views');

  // ---- 3. key API endpoints ----
  const apiChecks = [
    ['/api/servers/live', 200],
    ['/api/docker/status', 200],
    ['/api/versions', 200],
    ['/api/ports/suggest', 200],
    ['/api/ports/check?port=1', 200],
    ['/api/blueprints', 200],
    ['/api/worlds', 200],
    ['/api/keys', 200],
    ['/api/users', 200],
    [`/api/schedules/preview?cron=${encodeURIComponent('0 4 * * *')}`, 200],
    ['/api/events/export?format=json', 200],
    ['/api/packs/search?q=optimized&platform=modrinth', 200],
    ...(sid
      ? [
          [`/api/servers/${sid}/mods`, 200],
          [`/api/servers/${sid}/worlds`, 200],
          [`/api/servers/${sid}/files/list?path=`, 200],
          [`/api/servers/${sid}/players`, 200],
          [`/api/servers/${sid}/crashes`, 200],
          [`/api/servers/${sid}/analytics/timeline?limit=5`, 200],
          [`/api/servers/${sid}/inventory/players`, 200],
          [`/api/servers/${sid}/integrations`, 200],
          [`/api/servers/${sid}/events/export?format=csv`, 200],
          [`/api/servers/${sid}/logs/archived`, 200],
        ]
      : []),
  ];
  for (const [url, expected] of apiChecks) {
    try {
      const res = await get(url);
      if (res.status === expected) report('pass', `API ${url}`);
      else report('fail', `API ${url}`, `HTTP ${res.status}, expected ${expected}`);
    } catch (err) {
      report('fail', `API ${url}`, err.message);
    }
  }

  // ---- 4. every referenced page script exists ----
  const missing = [];
  (function walk2(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk2(p);
      else if (entry.name.endsWith('.hbs')) {
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/src="(\/js\/[^"]+)"/g)) {
          const file = path.join(__dirname, '..', 'public', m[1]);
          if (!fs.existsSync(file)) missing.push(`${path.relative(viewsDir, p)} → ${m[1]}`);
        }
      }
    }
  })(viewsDir);
  if (missing.length) report('fail', 'views reference missing scripts', missing.join(', '));
  else report('pass', 'all referenced page scripts exist');

  // ---- summary ----
  console.log(`\n=== QA SWEEP: ${results.pass} pass, ${results.warn} warn, ${results.fail} fail ===`);
  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('sweep crashed:', err);
  process.exit(1);
});
