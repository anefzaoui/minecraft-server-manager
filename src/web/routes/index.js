// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Page routes. Every page renders REAL data — servers, events, crashes,
// backups, updates, schedules, storage, activity, and the global file manager.

const asyncHandler = require('../middleware/asyncHandler');
const express = require('express');
const serversService = require('../../services/servers');
const eventsService = require('../../events');
const { serverVM, eventVM, crashVM, safeJsonParse } = require('../viewModels');
const { fetchLogs } = require('../../docker/logs');
const db = require('../../db');

const router = express.Router();

const SERVER_TABS = [
  'overview',
  'console',
  'chat',
  'players',
  'commands',
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

// Two-level information architecture: the 15 tabs are grouped into a handful of
// domain sections (top nav), each with a sub-nav of related sections. Inventory is
// not a top tab any more — it lives per-player on the player page. All existing
// routes still work; only the navigation is reorganized.
const TAB_GROUPS = [
  { key: 'overview', label: 'Overview', icon: 'layout-dashboard', tabs: ['overview'] },
  { key: 'console', label: 'Console', icon: 'terminal', tabs: ['console', 'chat'] },
  { key: 'players', label: 'Players', icon: 'users', tabs: ['players', 'inventory', 'analytics', 'commands'] },
  { key: 'world', label: 'World', icon: 'earth', tabs: ['worlds', 'mods', 'map', 'files'] },
  { key: 'backups', label: 'Backups', icon: 'archive', tabs: ['backups'] },
  { key: 'insights', label: 'Insights', icon: 'activity', tabs: ['metrics', 'history'] },
  { key: 'settings', label: 'Settings', icon: 'settings', tabs: ['settings', 'integrations'] },
];
const SUB_LABELS = {
  console: 'Console',
  chat: 'Chat',
  players: 'Roster',
  inventory: 'Inventory',
  analytics: 'Stats',
  commands: 'Chat commands',
  worlds: 'Worlds',
  mods: 'Mods',
  map: 'Map',
  files: 'Files',
  metrics: 'Metrics',
  history: 'History',
  settings: 'Configuration',
  integrations: 'Integrations',
};

/** Build the two-level nav (top groups + contextual sub-nav) for a given active tab. */
function buildNav(id, tab, server) {
  const crashes = server && server.crashesUnread;
  const group = TAB_GROUPS.find((g) => g.tabs.includes(tab)) || TAB_GROUPS[0];
  const groups = TAB_GROUPS.map((g) => ({
    label: g.label,
    icon: g.icon,
    href: `/servers/${id}/${g.tabs[0]}`,
    active: g.key === group.key,
    badge: g.tabs.includes('history') && crashes ? crashes : null,
  }));
  const sub =
    group.tabs.length > 1
      ? group.tabs.map((t) => ({
          label: SUB_LABELS[t] || t,
          href: `/servers/${id}/${t}`,
          active: t === tab,
          badge: t === 'history' && crashes ? crashes : null,
        }))
      : null;
  return { groups, sub };
}

// Sidebar data available to every view (lightweight — no live stats).
router.use(
  asyncHandler(async (req, res, next) => {
    const rows = serversService.listServers();
    res.locals.servers = await Promise.all(rows.map((s) => serverVM(s, { withLive: false })));
    res.locals.updatesCount = require('../../updates/checker').listOutdated().length;
    // Timezone + locale for client-side date formatting (window.MSM).
    res.locals.panelLocalization = require('../../services/settings').clientLocalization();
    next();
  })
);

const STATUS_RANK = { running: 0, unhealthy: 1, starting: 2, updating: 3, crashed: 4, 'over-quota': 5, stopped: 6 };
const DASH_SORTS = {
  status: (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  size: (a, b) => b.disk.used - a.disk.used,
  started: (a, b) => String(b.lastStarted).localeCompare(String(a.lastStarted)),
  created: (a, b) => String(b.created).localeCompare(String(a.created)),
};

async function renderServerList(req, res, next, { page }) {
  try {
    const rows = serversService.listServers();
    const servers = await Promise.all(rows.map((s) => serverVM(s)));
    const sort = DASH_SORTS[req.query.sort] ? String(req.query.sort) : 'status';
    servers.sort(DASH_SORTS[sort]);
    const context = {
      title: page === 'servers' ? 'Servers' : 'Dashboard',
      active: page,
      serversOnly: page === 'servers', // hides the stat row + activity feed
      servers,
      sort,
      noServers: servers.length === 0,
      totals: {
        running: servers.filter((s) => s.status === 'running' || s.status === 'starting').length,
        total: servers.length,
        players: servers.reduce((n, s) => n + s.players.online, 0),
        updates: res.locals.updatesCount,
      },
      activity: [],
    };
    if (page === 'dashboard') {
      const events = eventsService.listEvents({ limit: 6 }).filter((e) => !e.type.endsWith('-requested'));
      context.activity = events.map(eventVM);
    }
    res.render('dashboard', context);
  } catch (err) {
    next(err);
  }
}

router.get('/', (req, res, next) => renderServerList(req, res, next, { page: 'dashboard' }));
router.get('/servers', (req, res, next) => renderServerList(req, res, next, { page: 'servers' }));

router.get('/servers/new', async (req, res) => {
  let versions = [];
  let latestRelease = '';
  try {
    const mojang = require('../../services/mojang');
    versions = await mojang.listVersions({ limit: 60 });
    latestRelease = (await mojang.getVersionManifest()).latest.release;
  } catch {
    /* offline — manual entry still works */
  }
  let suggestedPort = 25565;
  try {
    suggestedPort = (await require('../../services/ports').suggestPorts()).game;
  } catch {
    /* daemon down */
  }
  const catalog = require('../../config/field-catalog');
  const SIMPLE_SECTIONS = new Set(['identity', 'flavor', 'resources']); // covered by the Simple UI
  const advancedSections = catalog.SECTIONS.filter((s) => !SIMPLE_SECTIONS.has(s.id))
    .map((s) => ({ ...s, fields: catalog.forSection(s.id, 'advanced').filter((f) => f.scope === 'env') }))
    .filter((s) => s.fields.length);
  res.render('wizard', {
    title: 'Create server',
    active: 'servers',
    blueprints: require('../../blueprints').listBlueprints(),
    versions,
    latestRelease,
    suggestedPort,
    advancedSections,
  });
});

// Per-player page: opened by clicking a player in the roster. Shows that player's
// roles/ban/teleport controls and their full inventory (the Players+Inventory merge).
router.get(
  '/servers/:id/players/:name',
  asyncHandler(async (req, res, next) => {
    const row = serversService.getServer(req.params.id);
    if (!row) return next();
    const name = String(req.params.name || '');
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) return next();
    const server = await serverVM(row);
    const playersService = require('../../services/players');
    const running = server.status === 'running' || server.status === 'unhealthy';
    let player = {
      name,
      uuid: null,
      online: false,
      whitelisted: false,
      op: false,
      opLevel: null,
      banned: false,
      banReason: null,
      banDate: null,
      lastSeen: null,
    };
    try {
      const onlineNames = running ? await playersService.listOnlineNames(row.id).catch(() => []) : [];
      const found = playersService
        .listPlayers(row.id, onlineNames)
        .find((p) => (p.name || '').toLowerCase() === name.toLowerCase());
      if (found) player = found;
    } catch {
      /* offline / rcon down — render with the fallback */
    }
    res.render('server-player', {
      title: `${player.name} · ${server.name}`,
      active: 'servers',
      server,
      tab: 'players',
      nav: buildNav(row.id, 'players', server),
      player,
    });
  })
);

router.get(
  '/servers/:id/:tab?',
  asyncHandler(async (req, res, next) => {
    const row = serversService.getServer(req.params.id);
    if (!row) return next();
    const tab = req.params.tab || 'overview';
    if (!SERVER_TABS.includes(tab)) return next();

    const server = await serverVM(row);
    const context = {
      title: server.name,
      active: 'servers',
      server,
      tab,
      tabs: SERVER_TABS,
      nav: buildNav(row.id, tab, server),
      mods: [],
      backups: [],
      worlds: [],
      consoleLines: [],
      events: [],
      crashReports: [],
      quotaGb: Math.round((row.disk_quota_bytes || 0) / 1024 ** 3),
    };

    if (tab === 'overview') {
      // Connect addresses: the configured public domain first (if any), then LAN
      // IPv4s + game port, ready to copy.
      const os = require('node:os');
      const addrs = [];
      const publicAddr = require('../../services/settings').publicAddress(row.port_game);
      if (publicAddr) addrs.push(publicAddr);
      for (const nics of Object.values(os.networkInterfaces())) {
        for (const nic of nics || []) {
          if (nic.family === 'IPv4' && !nic.internal) addrs.push(`${nic.address}:${row.port_game}`);
        }
      }
      addrs.push(`localhost:${row.port_game}`);
      context.addresses = [...new Set(addrs)];
    } else if (tab === 'chat') {
      const live = require('../../services/liveCache').get(row.id);
      context.onlinePlayers = (live && live.players && live.players.names) || [];
    } else if (tab === 'mods') {
      context.mods = await require('../../services/mods')
        .listContent(row.id)
        .catch(() => []);
    } else if (tab === 'worlds') {
      const worldsService = require('../../services/worlds');
      context.worlds = await worldsService.listServerWorlds(row.id).catch(() => []);
      context.libraryWorlds = worldsService.libraryWorlds();
    } else if (tab === 'files') {
      const filesService = require('../../services/files');
      const rel = String(req.query.path || '');
      try {
        const listing = await filesService.list(row.id, rel);
        context.files = listing.entries;
        context.filePath = listing.path;
        context.crumbs = listing.path
          ? listing.path.split('/').map((seg, i, a) => ({ name: seg, path: a.slice(0, i + 1).join('/') }))
          : [];
        context.parentPath = context.crumbs.length > 1 ? context.crumbs[context.crumbs.length - 2].path : '';
      } catch {
        context.files = [];
        context.filePath = '';
        context.crumbs = [];
        context.parentPath = '';
      }
    } else if (tab === 'map') {
      const mapService = require('../../services/map');
      const cfg = mapService.getMapConfig(row.id);
      context.mapEnabled = cfg.enabled;
      context.mapSupported = mapService.supportsMap(row);
    } else if (tab === 'metrics') {
      // Real per-category sizes from the storage index (view contract:
      // [{label, size, pct, color}]; empty → "run a scan" state).
      const indexer = require('../../storage/indexer');
      const total = indexer.sizeOf(`servers/${row.id}`);
      if (total > 0) {
        const cats = [
          { label: 'World(s)', rel: 'world', color: 'bg-grass-500' },
          { label: 'Mods', rel: 'mods', color: 'bg-diamond-400' },
          { label: 'Plugins', rel: 'plugins', color: 'bg-diamond-400' },
          { label: 'Logs', rel: 'logs', color: 'bg-gold-400' },
          { label: 'Config', rel: 'config', color: 'bg-stone-500' },
        ];
        const rows = [];
        let accounted = 0;
        for (const c of cats) {
          const size = indexer.sizeOf(`servers/${row.id}/${c.rel}`);
          if (size > 0) {
            rows.push({ label: c.label, size, pct: Math.round((size / total) * 100), color: c.color });
            accounted += size;
          }
        }
        const other = total - accounted;
        if (other > 0)
          rows.push({
            label: 'Config & other',
            size: other,
            pct: Math.max(1, Math.round((other / total) * 100)),
            color: 'bg-stone-500',
          });
        context.breakdown = rows;
      }
    } else if (tab === 'settings') {
      // MOTD editing: expose the env for a client-side merge-and-PATCH; the
      // stored §-codes become &-codes for friendly editing.
      context.settingsEnv = JSON.stringify(row.env);
      context.motd = String(row.env.MOTD || '').replace(/§([0-9a-fk-orA-FK-OR])/g, '&$1');
    } else if (tab === 'integrations') {
      context.integrations = {
        discord: require('../../integrations/discord').getConfig(row.id),
        statusPage: require('../../integrations/statusPage').getStatusPage(row.id),
        invite: await require('../../integrations/invites')
          .inviteInfo(row.id)
          .catch(() => null),
      };
    } else if (tab === 'players') {
      const playersService = require('../../services/players');
      let online = [];
      if (server.status === 'running') {
        online = await Promise.resolve(playersService.listOnlineNames(row.id)).catch(() => []);
      }
      try {
        context.players = playersService.listPlayers(row.id, online);
        context.bannedIps = playersService.listBannedIps(row.id);
        context.whitelistEnforced = playersService.getWhitelistEnforced(row.id);
      } catch {
        context.players = [];
        context.bannedIps = [];
        context.whitelistEnforced = false;
      }
    } else if (tab === 'commands') {
      const chatCommands = require('../../services/chatCommands');
      context.chatPrefix = chatCommands.getPrefix(row.id);
      context.chatCommands = chatCommands.listCommands(row.id).map((c) => ({
        ...c,
        actionSummary: chatCommands.actionSummary(c),
        cooldownLabel: c.cooldown_sec > 0 ? `${c.cooldown_sec}s` : 'none',
        lastUsed: c.last_used_at || null,
      }));
      context.chatCommandEvents = eventsService
        .listEvents({ serverId: row.id, type: 'chat-command', limit: 10 })
        .map((e) => ({ ts: e.created_at, summary: e.summary, failed: e.details && e.details.success === false }));
    } else if (tab === 'console') {
      const { stripAnsi } = require('../../utils/ansi');
      const raw = await fetchLogs(row.id, { tail: 300 }).catch(() => '');
      context.consoleLines = raw
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const text = stripAnsi(line); // SSR lines are plain; live WS lines get real ANSI rendering
          return { text, level: /\/(ERROR|FATAL)\]/.test(text) ? 'ERROR' : /\/WARN\]/.test(text) ? 'WARN' : 'INFO' };
        });
      context.wsConsole = true;
    } else if (tab === 'history') {
      context.events = eventsService.listEvents({ serverId: row.id, limit: 100 }).map(eventVM);
      context.crashReports = db
        .all('SELECT * FROM crash_reports WHERE server_id = ? ORDER BY file_mtime DESC', row.id)
        .map(crashVM);
    } else if (tab === 'backups') {
      context.backups = db
        .all('SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC', row.id)
        .map((b) => ({ id: b.id, file: b.filename, size: b.size_bytes, reason: b.reason, ts: b.created_at }));
    }

    res.render('server-detail', context);
  })
);

router.get('/modpacks', async (req, res) => {
  const withPacks = (res.locals.servers || []).filter((s) => s.pack);
  // NB: never pass this under the `servers` key — that shadows res.locals.servers
  // and silently filters the sidebar's server list.
  res.render('modpacks', { title: 'Modpacks', active: 'modpacks', packServers: withPacks });
});

router.get('/worlds', (req, res) => {
  res.render('worlds', {
    title: 'Worlds',
    active: 'worlds',
    worlds: require('../../services/worlds').libraryWorlds(),
  });
});

router.get('/blueprints', (req, res) => {
  res.render('blueprints', {
    title: 'Blueprints',
    active: 'blueprints',
    blueprints: require('../../blueprints').listBlueprints(),
  });
});

router.get('/updates', (req, res) => {
  const checker = require('../../updates/checker');
  res.render('updates', {
    title: 'Updates',
    active: 'updates',
    updates: checker.listOutdated(),
    lastChecked: checker.lastCheckedAt() || 'never',
  });
});

router.get('/backups', (req, res) => {
  const backups = db
    .all(`SELECT b.*, s.display_name FROM backups b JOIN servers s ON s.id = b.server_id ORDER BY b.created_at DESC`)
    .map((b) => ({
      id: b.id,
      serverId: b.server_id,
      server: b.display_name,
      file: b.filename,
      size: b.size_bytes,
      reason: b.reason,
      ts: b.created_at,
    }));
  res.render('backups', {
    title: 'Backups',
    active: 'backups',
    backups,
    totals: { count: backups.length, bytes: backups.reduce((n, b) => n + (b.size || 0), 0) },
  });
});

router.get('/schedules', (req, res) => {
  const scheduler = require('../../services/scheduler');
  res.render('schedules', {
    title: 'Schedules',
    active: 'schedules',
    schedules: scheduler.listSchedules(),
    taskTypes: Object.entries(scheduler.TASK_TYPES).map(([value, t]) => ({
      value,
      label: t.label,
      serverScoped: t.serverScoped,
    })),
    serverOptions: (res.locals.servers || []).map((s) => ({ id: s.id, name: s.name })),
  });
});

router.get(
  '/storage',
  asyncHandler(async (req, res, next) => {
    const indexer = require('../../storage/indexer');
    const { free, total } = await indexer.diskFree().catch(() => ({ free: 0, total: 0 }));
    const catNames = {
      servers: 'Servers',
      backups: 'Backups',
      'library/worlds': 'Library — worlds',
      'library/mods': 'Library — mods & content',
      'library/modpacks': 'Library — modpacks',
      'library/icons': 'Library — icons',
      logs: 'Logs & event captures',
      blueprints: 'Blueprints',
      tmp: 'tmp',
    };
    const categories = Object.entries(catNames)
      .map(([rel, name]) => ({
        name,
        path: `${rel}/`,
        link: `/files?path=${encodeURIComponent(rel)}`,
        size: indexer.sizeOf(rel),
      }))
      .filter((c) => c.size > 0 || ['servers', 'backups', 'tmp'].includes(c.path.replace(/\/$/, '')));
    const snapshots = db.all('SELECT total_bytes FROM storage_snapshots ORDER BY id DESC LIMIT 14').reverse();
    const maxSnap = Math.max(1, ...snapshots.map((s) => s.total_bytes));

    const totalUsed = indexer.sizeOf('');
    // Real category bar: servers / backups / library / other, from the index.
    const segs = [
      { label: 'Servers', cls: 'bg-grass-600', size: indexer.sizeOf('servers') },
      { label: 'Backups', cls: 'bg-diamond-500', size: indexer.sizeOf('backups') },
      { label: 'Library', cls: 'bg-gold-400', size: indexer.sizeOf('library') },
    ];
    segs.push({
      label: 'Logs, blueprints, tmp',
      cls: 'bg-stone-500',
      size: Math.max(0, totalUsed - segs.reduce((n, s) => n + s.size, 0)),
    });
    const breakdown = segs.map((s) => ({
      ...s,
      width: totalUsed ? Math.max(0.5, (s.size / totalUsed) * 100).toFixed(1) : 0,
    }));

    const { runCleanup, largestFiles, DEFAULT_DAYS } = require('./storageCleanup');
    const preview = async (action, label, olderThanDays) => {
      const p = await runCleanup(action, { olderThanDays, dryRun: true }).catch(() => ({ freedBytes: 0, removed: 0 }));
      return { key: action, action: label, frees: p.freedBytes, count: p.removed, days: olderThanDays || null };
    };
    const cleanup = await Promise.all([
      preview('tmp', 'Purge tmp/ (files older than 1 h)'),
      preview('orphans', 'Remove orphaned library files'),
      preview('old-logs', `Delete archived logs older than ${DEFAULT_DAYS} days`, DEFAULT_DAYS),
      preview('old-crashes', `Delete crash reports older than ${DEFAULT_DAYS} days`, DEFAULT_DAYS),
    ]);

    const largest = (await largestFiles({ top: 15, maxScan: 3000 }).catch(() => [])).map((f) => ({
      ...f,
      link: `/files?path=${encodeURIComponent(f.path.split('/').slice(0, -1).join('/'))}`,
    }));

    res.render('storage', {
      title: 'Storage',
      active: 'storage',
      storage: {
        totalUsed,
        diskFree: free,
        diskTotal: total,
        lastScan: indexer.lastScan() || 'not yet',
        categories,
        breakdown,
        largestFiles: largest,
        cleanup,
        trend: snapshots.map((s) => Math.max(4, Math.round((s.total_bytes / maxSnap) * 100))),
      },
    });
  })
);

const ACTIVITY_PER_PAGE = 50;

router.get('/activity', (req, res) => {
  const q = String(req.query.q || '')
    .trim()
    .slice(0, 200);
  const server = String(req.query.server || '')
    .trim()
    .slice(0, 40);
  const type = String(req.query.type || '')
    .trim()
    .slice(0, 60);
  const where = [];
  const params = [];
  if (server) {
    where.push('server_id = ?');
    params.push(server);
  }
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  if (q) {
    where.push('(summary LIKE ? OR actor LIKE ? OR type LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.get(`SELECT COUNT(*) AS n FROM events ${whereSql}`, ...params).n;
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PER_PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  const events = db
    .all(
      `SELECT * FROM events ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      ...params,
      ACTIVITY_PER_PAGE,
      (page - 1) * ACTIVITY_PER_PAGE
    )
    .map((r) => eventVM({ ...r, details: safeJsonParse(r.details_json) }));

  const filterParams = new URLSearchParams();
  if (q) filterParams.set('q', q);
  if (server) filterParams.set('server', server);
  if (type) filterParams.set('type', type);
  const filterQs = filterParams.toString(); // without page
  const pageHref = (p) => `/activity?${filterQs ? filterQs + '&' : ''}page=${p}`;

  res.render('activity', {
    title: 'Activity',
    active: 'activity',
    events,
    types: db.all('SELECT DISTINCT type FROM events ORDER BY type').map((r) => r.type),
    filters: { q, server, type },
    exportQs: filterQs ? `&${filterQs}` : '',
    total,
    page,
    pages,
    from: total ? (page - 1) * ACTIVITY_PER_PAGE + 1 : 0,
    to: Math.min(page * ACTIVITY_PER_PAGE, total),
    prevHref: page > 1 ? pageHref(page - 1) : null,
    nextHref: page < pages ? pageHref(page + 1) : null,
  });
});

// Global file manager over ./data (admin only — full panel data access).
router.get(
  '/files',
  require('../middleware/auth').requireRole('admin'),
  asyncHandler(async (req, res, next) => {
    const filesService = require('../../services/files');
    const rel = String(req.query.path || '');
    let listing;
    try {
      listing = await filesService.list(null, rel);
    } catch {
      return res.redirect('/files'); // stale/invalid path — back to the root
    }
    const crumbs = listing.path
      ? listing.path.split('/').map((seg, i, a) => {
          const p = a.slice(0, i + 1).join('/');
          return { name: seg, path: p, enc: encodeURIComponent(p) };
        })
      : [];
    res.render('files-global', {
      title: 'File manager',
      active: 'storage',
      files: listing.entries.map((e) => ({ ...e, enc: encodeURIComponent(e.path) })),
      filePath: listing.path,
      crumbs,
      parentEnc: crumbs.length > 1 ? crumbs[crumbs.length - 2].enc : '',
    });
  })
);

router.get('/settings', (req, res) => {
  const apiKeys = require('../../services/apiKeys');
  const config = require('../../config');
  res.render('settings', {
    title: 'Settings',
    active: 'settings',
    cfKeyMasked: apiKeys.maskedKey('curseforge'),
    publicHost: require('../../services/settings').getPublicHost(),
    users: require('../../services/auth').listUsers(),
    panel: { host: config.host, port: config.port },
    defaults: config.defaults,
  });
});

router.get('/login', (req, res) => {
  res.render('login', { title: 'Sign in', layout: 'bare' });
});

module.exports = router;
