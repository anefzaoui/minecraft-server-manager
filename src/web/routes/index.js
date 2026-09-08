// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Page routes. Every page renders REAL data - servers, events, crashes,
// backups, updates, schedules, storage, activity, and the global file manager.

const asyncHandler = require('../middleware/asyncHandler');
const express = require('express');
const serversService = require('../../services/servers');
const eventsService = require('../../events');
const {
  serverVM,
  buildServerContext,
  sidebarServerVMs,
  packServerVMs,
  eventsVM,
  crashVM,
  safeJsonParse,
} = require('../viewModels');
const { fetchLogs } = require('../../docker/logs');
const db = require('../../db');
const { requireRole } = require('../middleware/auth');
const { PLAYER_NAME_RE, isBedrockName } = require('../../utils/playerName');
const logger = require('../../logger')('pages');
const { serializeError } = require('../../utils/logSanitize');

// Page renders degrade gracefully when optional/remote data is unavailable
// (Docker down, no network, no API key). Record it at debug so "why is this
// list empty" is answerable without adding noise at the default level.
function pageDegraded(what, err) {
  logger.debug('Rendered a page with degraded data.', {
    what,
    err: err ? serializeError(err, { includeStack: false }) : undefined,
  });
}

const router = express.Router();

const SERVER_TABS = [
  'overview',
  'console',
  'chat',
  'commands',
  'players',
  'inventory',
  'analytics',
  'mods',
  'map',
  'files',
  'worlds',
  'backups',
  'history',
  'metrics',
  'settings',
  'discord',
  'status-page',
  'invites',
  'chatbot',
];

// Two-level information architecture: the tabs are grouped into a handful of
// domain sections (top nav), each with a sub-nav of related sections. Grouped by
// user intent: Console is everything you say to / automate on the running
// server; Players is only about people; World is world-scoped; Settings holds
// the per-integration pages. All existing routes still work (see the
// /integrations redirect below); only the navigation is reorganized.
const TAB_GROUPS = [
  { key: 'overview', label: 'Overview', icon: 'layout-dashboard', tabs: ['overview'] },
  { key: 'console', label: 'Console', icon: 'terminal', tabs: ['console', 'chat', 'commands'] },
  { key: 'players', label: 'Players', icon: 'users', tabs: ['players', 'inventory', 'analytics'] },
  { key: 'mods', label: 'Mods', icon: 'puzzle', tabs: ['mods'] },
  { key: 'world', label: 'World', icon: 'earth', tabs: ['worlds', 'map', 'files'] },
  { key: 'backups', label: 'Backups', icon: 'archive', tabs: ['backups'] },
  { key: 'monitoring', label: 'Monitoring', icon: 'activity', tabs: ['history', 'metrics'] },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'settings',
    tabs: ['settings', 'discord', 'status-page', 'invites', 'chatbot'],
  },
];
const SUB_LABELS = {
  console: 'Console',
  chat: 'Chat',
  commands: 'Commands',
  players: 'Roster',
  inventory: 'Inventory',
  analytics: 'Stats',
  worlds: 'Worlds',
  mods: 'Mods',
  map: 'Map',
  files: 'Files',
  metrics: 'Live',
  history: 'History',
  settings: 'Configuration',
  discord: 'Discord',
  'status-page': 'Status Page',
  invites: 'Invites',
  chatbot: 'Chatbot',
};
// Sub-nav entries only shown to admins (the API 403s these for other roles).
const ADMIN_ONLY_TABS = new Set(['chatbot']);

/** Build the two-level nav (top groups + contextual sub-nav) for a given active tab. */
function buildNav(id, tab, server, { isAdmin = false } = {}) {
  const crashes = server && server.crashesUnread;
  const group = TAB_GROUPS.find((g) => g.tabs.includes(tab)) || TAB_GROUPS[0];
  const groups = TAB_GROUPS.map((g) => ({
    label: g.label,
    icon: g.icon,
    href: `/servers/${id}/${g.tabs[0]}`,
    active: g.key === group.key,
    badge: g.tabs.includes('history') && crashes ? crashes : null,
  }));
  const visibleSubTabs = group.tabs.filter((t) => isAdmin || !ADMIN_ONLY_TABS.has(t));
  const sub =
    visibleSubTabs.length > 1
      ? visibleSubTabs.map((t) => ({
          label: SUB_LABELS[t] || t,
          href: `/servers/${id}/${t}`,
          active: t === tab,
          badge: t === 'history' && crashes ? crashes : null,
        }))
      : null;
  return { groups, sub };
}

// Sidebar data available to every view (lightweight - no live stats, no
// per-server pack/update/crash/loader fan-out; see viewModels.sidebarServerVMs).
router.use(
  asyncHandler(async (req, res, next) => {
    res.locals.servers = sidebarServerVMs();
    res.locals.updatesCount = require('../../updates/checker').countOutdated();
    // Timezone + locale for client-side date formatting (window.MSM).
    res.locals.panelLocalization = require('../../services/settings').clientLocalization();
    next();
  })
);

const STATUS_RANK = {
  running: 0,
  unhealthy: 1,
  starting: 2,
  stalled: 3,
  updating: 4,
  crashed: 5,
  'over-quota': 6,
  stopped: 7,
};
const DASH_SORTS = {
  status: (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  size: (a, b) => b.disk.used - a.disk.used,
  started: (a, b) => String(b.lastStarted).localeCompare(String(a.lastStarted)),
  created: (a, b) => String(b.created).localeCompare(String(a.created)),
};

// Combined live totals across every running server for the dashboard's
// "Resource overview" graphs. Fed entirely by the in-memory live cache each
// serverVM already reads (serverVM.js:118), so nothing here touches Docker.
// Only servers with actual live stats participate in the resource sums; a
// server that is "running" in status but hasn't produced a sample yet is
// listed but contributes zero rather than being falsely included.
function buildCombinedOverview(servers) {
  const running = [];
  for (const s of servers) {
    if (s.status !== 'running' && s.status !== 'starting' && s.status !== 'unhealthy' && s.status !== 'stalled') {
      continue;
    }
    running.push({
      id: s.id,
      name: s.name,
      accent: s.accent,
      status: s.status,
      cpuPct: Math.round((s.stats.cpuPct || 0) * 10) / 10,
      cpus: s.resources.cpus || 0,
      memUsedMb: s.stats.memUsedMb || 0,
      memLimitMb: s.resources.containerMemoryMb || 0,
      playersOnline: s.players.online || 0,
      playersMax: s.players.max || 0,
    });
  }
  return {
    hasLive: running.some((s) => s.cpuPct > 0 || s.memUsedMb > 0 || s.playersOnline > 0),
    running: running.length,
    playersOnline: running.reduce((n, s) => n + s.playersOnline, 0),
    playersMax: running.reduce((n, s) => n + s.playersMax, 0),
    memoryUsedMb: running.reduce((n, s) => n + s.memUsedMb, 0),
    memoryLimitMb: running.reduce((n, s) => n + s.memLimitMb, 0),
    cpuTotal: Math.round(running.reduce((n, s) => n + s.cpuPct, 0)),
    // Each server's own CPU% is relative to its own core allowance, so the
    // meaningful total is the sum of the used portions of those allowances.
    cpuCapacity: running.reduce((n, s) => n + s.cpus * 100, 0),
    breakdown: running,
  };
}

// Dashboard "At a glance" panel: everything below is aggregated from the
// server VMs already built above (memory, disk, status counts) plus cheap
// event/SQLite lookups (24h health, update breakdown). No extra Docker calls.
function buildDashboardOverview(servers) {
  const countEvents = (types, since) =>
    db.get(
      `SELECT COUNT(*) AS n FROM events WHERE type IN (${types.map(() => '?').join(',')})` +
        (since ? ` AND created_at >= datetime('now', ?)` : ''),
      ...(since ? [...types, since] : types)
    )?.n || 0;

  const byStatus = {
    running: 0,
    starting: 0,
    stopped: 0,
    unhealthy: 0,
    stalled: 0,
    updating: 0,
    crashed: 0,
    'over-quota': 0,
  };
  let memAllottedMb = 0;
  let memUsedMb = 0;
  let diskUsedBytes = 0;
  let playersOnline = 0;
  let playersMax = 0;
  for (const s of servers) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    memAllottedMb += s.resources.containerMemoryMb || 0;
    memUsedMb += s.stats.memUsedMb || 0;
    diskUsedBytes += s.disk.used || 0;
    playersOnline += s.players.online || 0;
    playersMax += s.players.max || 0;
  }

  const health = {
    oom: countEvents(['oom'], '-1 day'),
    autoRestarted: countEvents(['auto-restarted'], '-1 day'),
    crashes: countEvents(['crashed'], '-1 day'),
  };
  const healthTotal = health.oom + health.autoRestarted + health.crashes;

  let updates = { all: 0, mods: 0, server: 0 };
  try {
    updates = require('../../updates/checker').countOutdatedByKind();
  } catch {
    /* check store unavailable - show zeroes */
  }

  return {
    byStatus,
    mem: { allottedMb: Math.round(memAllottedMb), usedMb: Math.round(memUsedMb) },
    disk: { usedBytes: diskUsedBytes },
    players: { online: playersOnline, max: playersMax },
    health,
    healthTotal,
    updates,
  };
}

async function renderServerList(req, res, next, { page }) {
  try {
    const rows = serversService.listServers();
    const ctx = buildServerContext(rows); // one batched DB pass for all servers
    const results = await Promise.allSettled(rows.map((s) => serverVM(s, { ctx })));
    const servers = results
      .map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        logger.error('Failed to load server VM', { serverId: rows[i].id, err: serializeError(r.reason) });
        return {
          id: rows[i].id,
          name: rows[i].display_name,
          description: rows[i].description || '',
          icon: rows[i].icon,
          accent: rows[i].accent,
          type: rows[i].type,
          flavor: '',
          mcVersion: rows[i].mc_version || '',
          status: 'unknown',
          ports: { game: rows[i].port_game, rcon: rows[i].port_rcon, bedrock: rows[i].port_bedrock },
          resources: { heapMb: rows[i].heap_mb, containerMemoryMb: rows[i].container_memory_mb, cpus: rows[i].cpus },
          stats: { cpuPct: 0, memUsedMb: 0, uptime: null, perf: null, perfSupported: true },
          players: { online: 0, max: Number((rows[i].env && rows[i].env.MAX_PLAYERS) || 20), names: [] },
          disk: { used: 0, quota: rows[i].disk_quota_bytes || 0 },
          pack: null,
          updateAvailable: false,
          crashesUnread: 0,
          autoStart: Boolean(rows[i].auto_start),
          autoRestart: Boolean(rows[i].auto_restart),
          notes: rows[i].notes || '',
          updatePolicy: rows[i].update_policy,
          pendingRecreate: false,
          lastStarted: rows[i].last_started_at || '-',
          created: rows[i].created_at,
          consoleLabel: rows[i].console_label || '',
          loadError: r.reason ? serializeError(r.reason, { includeStack: false }) : undefined,
        };
      })
      .filter(Boolean);
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
        // "online" means answering - a server still booting isn't.
        running: servers.filter((s) => s.status === 'running' || s.status === 'unhealthy').length,
        total: servers.length,
        players: servers.reduce((n, s) => n + s.players.online, 0),
        updates: res.locals.updatesCount,
      },
      combined: buildCombinedOverview(servers),
      activity: [],
    };
    if (page === 'dashboard') {
      const events = eventsService
        .listEvents({ limit: 20 })
        .filter((e) => !e.type.endsWith('-requested'))
        .slice(0, 6);
      context.activity = eventsVM(events);
      context.overview = buildDashboardOverview(servers);
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
    // Every channel - releases, snapshots, betas and alphas - so the picker can
    // offer the full history; the template groups them by type.
    versions = await mojang.listVersions({ includeAll: true, limit: 5000 });
    latestRelease = (await mojang.getVersionManifest()).latest.release;
  } catch (err) {
    pageDegraded('wizard-mojang-versions', err); // offline - manual entry still works
  }
  // Whether the "From mods" tab can offer CurseForge search (needs the stored key).
  let curseforgeEnabled = false;
  try {
    curseforgeEnabled = Boolean(require('../../services/apiKeys').getKey('curseforge'));
  } catch (err) {
    pageDegraded('wizard-curseforge-key', err); // no key store yet
  }
  let suggestedPort = 25565;
  try {
    suggestedPort = (await require('../../services/ports').suggestPorts()).game;
  } catch (err) {
    pageDegraded('wizard-suggested-port', err); // daemon down
  }
  const catalog = require('../../config/field-catalog');
  const SIMPLE_SECTIONS = new Set(['identity', 'flavor', 'resources']); // covered by the Simple UI
  const advancedSections = catalog.SECTIONS.filter((s) => !SIMPLE_SECTIONS.has(s.id))
    .map((s) => ({ ...s, fields: catalog.forSection(s.id, 'advanced').filter((f) => f.scope === 'env') }))
    .filter((s) => s.fields.length);
  res.render('wizard', {
    title: 'Create Server',
    active: 'servers',
    blueprints: require('../../blueprints').listBlueprints(),
    versions,
    latestRelease,
    suggestedPort,
    advancedSections,
    curseforgeEnabled,
    defaults: require('../../services/settings').getDefaults(),
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
    if (!PLAYER_NAME_RE.test(name)) return next();
    const server = await serverVM(row);
    const playersService = require('../../services/players');
    const running = server.status === 'running' || server.status === 'unhealthy';
    let player = {
      name,
      bedrock: isBedrockName(name),
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
    } catch (err) {
      pageDegraded('player-page-roster', err); // offline / RCON down - render with the fallback
    }
    res.render('server-player', {
      title: `${player.name} · ${server.name}`,
      active: 'servers',
      server,
      tab: 'players',
      nav: buildNav(row.id, 'players', server, { isAdmin: req.user.role === 'admin' }),
      player,
    });
  })
);

// Back-compat: the old single Integrations tab is now four per-integration
// pages under Settings. Land on the first one.
router.get('/servers/:id/integrations', (req, res) => {
  res.redirect(302, `/servers/${req.params.id}/discord`);
});

router.get(
  '/servers/:id{/:tab}',
  asyncHandler(async (req, res, next) => {
    const row = serversService.getServer(req.params.id);
    if (!row) return next();
    const tab = req.params.tab || 'overview';
    if (!SERVER_TABS.includes(tab)) return next();

    const server = await serverVM(row);
    // Docker settings (container name, network, extra ports/binds - including
    // host filesystem paths) are added ONLY here, never in serverVM, since
    // that view model is shared with the public /status/:slug page. They are
    // admin-only: host paths and container internals must not leak to viewers.
    if (req.user.role === 'admin') {
      server.containerName = row.containerName;
      server.networkName = row.networkName;
      server.extraPorts = row.extraPorts;
      server.extraBinds = row.extraBinds;
    }
    const context = {
      title: server.name,
      active: 'servers',
      server,
      tab,
      tabs: SERVER_TABS,
      nav: buildNav(row.id, tab, server, { isAdmin: req.user.role === 'admin' }),
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
      // Recent sends (oldest first) so the history pane survives reloads and
      // is shared across admins - chat.js replays them with the live preview.
      context.chatHistory = require('../../events')
        .listEvents({ serverId: row.id, type: 'chat-sent', limit: 50 })
        .map((e) => ({ ts: e.created_at, actor: e.actor, ...e.details }))
        .reverse();
    } else if (tab === 'mods') {
      context.mods = await require('../../services/mods')
        .listContent(row.id)
        .catch(() => []);
      // Toggles the "Update all" toolbar button (ignored updates don't count).
      context.hasModUpdates = context.mods.some((m) => m.updateAvailable);
      // Same gate as the wizard: CurseForge search/import needs the stored key.
      try {
        context.curseforgeEnabled = Boolean(require('../../services/apiKeys').getKey('curseforge'));
      } catch {
        context.curseforgeEnabled = false;
      }
    } else if (tab === 'worlds') {
      const worldsService = require('../../services/worlds');
      context.worlds = await worldsService.listServerWorlds(row.id).catch(() => []);
      context.libraryWorlds = worldsService.libraryWorlds();
      // Copy-to target list, serialized in one piece by the json helper - the
      // view used to hand-assemble this JSON attribute field by field.
      context.serverOptions = (res.locals.servers || []).map((s) => ({
        id: s.id,
        name: s.name,
        flavor: s.flavor,
        status: s.status,
      }));
    } else if (tab === 'files') {
      // File browsing exposes raw server files (names/sizes/types/downloads),
      // so only accounts that can read them via the files API (admin/operator)
      // get a listing here - the API route sets this same contract explicitly.
      const filesService = require('../../services/files');
      const rel = String(req.query.path || '');
      if (!['admin', 'operator'].includes(req.user.role)) {
        context.files = [];
        context.filePath = rel;
        context.crumbs = rel
          ? rel.split('/').map((seg, i, a) => ({ name: seg, path: a.slice(0, i + 1).join('/') }))
          : [];
        context.parentPath = '';
      } else {
        try {
          const listing = await filesService.list(row.id, rel);
          context.files = listing.entries;
          context.filePath = listing.path;
          context.crumbs = listing.path
            ? listing.path.split('/').map((seg, i, a) => ({ name: seg, path: a.slice(0, i + 1).join('/') }))
            : [];
          context.parentPath = context.crumbs.length > 1 ? context.crumbs[context.crumbs.length - 2].path : '';
        } catch (err) {
          pageDegraded('server-files-tab', err);
          context.files = [];
          context.filePath = '';
          context.crumbs = [];
          context.parentPath = '';
        }
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

      // --- Health & stability: values already collected elsewhere, never shown
      // on a live view. All best-effort - a Docker hiccup must not 500 the tab.
      const isLive = ['running', 'starting', 'unhealthy', 'stalled'].includes(row.status);
      if (isLive) {
        try {
          context.health = await require('../../docker/containers').inspectStatus(row.id);
        } catch {
          /* leave undefined - the card just omits the Docker-sourced fields */
        }
      }
      // All-time totals plus a recent window, so the card shows whether trouble
      // is current or ancient history. The events table is the persistence here
      // (pruned at 90 days by the daily maintenance job), indexed on created_at.
      const countEvents = (type, since) =>
        db.get(
          `SELECT COUNT(*) AS n FROM events WHERE server_id = ? AND type = ?` +
            (since ? ` AND created_at >= datetime('now', ?)` : ''),
          ...(since ? [row.id, type, since] : [row.id, type])
        )?.n || 0;
      context.stability = {
        oomKills: countEvents('oom'),
        oomKills24h: countEvents('oom', '-1 day'),
        autoRestarts: countEvents('auto-restarted'),
        autoRestarts24h: countEvents('auto-restarted', '-1 day'),
        crashes: countEvents('crashed'),
        crashes24h: countEvents('crashed', '-1 day'),
        crashes7d: countEvents('crashed', '-7 days'),
      };
      context.lastCrash = db.get(
        'SELECT id, summary, exception, file_mtime FROM crash_reports WHERE server_id = ? ORDER BY file_mtime DESC LIMIT 1',
        row.id
      );
      context.recentEvents = eventsVM(eventsService.listEvents({ serverId: row.id, limit: 8 }));

      // --- Per-world / per-dimension sizes + host disk free.
      try {
        context.worldSizes = await require('../../services/worlds').listServerWorlds(row.id);
      } catch {
        context.worldSizes = [];
      }
      try {
        context.diskFree = (await indexer.diskFree()).free;
      } catch {
        /* statfs failed - card omits the "free on disk" line */
      }

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
      // The raw env goes only to accounts that can write it back (the client
      // merges-and-PATCHes against the API, which `requireWrite` blocks for
      // viewers, and env_json can carry secrets like RCON_PASSWORD) - same
      // privilege split as the admin-only Docker fields above.
      if (req.user.role === 'admin' || req.user.role === 'operator') {
        context.settingsEnv = JSON.stringify(row.env);
      }
      context.motd = String(row.env.MOTD || '').replace(/§([0-9a-fk-orA-FK-OR])/g, '&$1');

      // Every catalog field configurable at creation, minus what's covered
      // elsewhere on this tab: identity/flavor/resources (their own cards
      // above - flavor/version changes go through the Updates page, which
      // handles the migration safely), players (live via whitelist/ops
      // files on the Players tab, no restart needed), and gameplay's
      // DIFFICULTY/PVP (live via World Controls) + MOTD (the field above) -
      // exposing those here too would just drift out of sync with the
      // RCON-set values. Same catalog + same field-level filter the wizard
      // itself uses, so nothing new is exposed beyond what's already safe there.
      const catalog = require('../../config/field-catalog');
      const EXCLUDED_SECTIONS = new Set(['identity', 'flavor', 'resources', 'players']);
      // Scoped to 'gameplay' specifically (not a global key blocklist) - a
      // future field in another section coincidentally named e.g. MOTD must
      // never be silently swallowed by this exclusion.
      const EXCLUDED_GAMEPLAY_KEYS = new Set(['DIFFICULTY', 'PVP', 'MOTD']);
      context.advancedSections = catalog.SECTIONS.filter((s) => !EXCLUDED_SECTIONS.has(s.id))
        .map((s) => ({
          ...s,
          fields: catalog
            .forSection(s.id, 'advanced')
            .filter((f) => f.scope === 'env' && !(s.id === 'gameplay' && EXCLUDED_GAMEPLAY_KEYS.has(f.key))),
        }))
        .filter((s) => s.fields.length);
    } else if (tab === 'discord' || tab === 'status-page' || tab === 'invites' || tab === 'chatbot') {
      // Each integration is its own page now; hydrate only the slice it needs.
      // integrations.hbs switches on `sub` and renders exactly one card.
      context.integrationsSub = tab;
      context.integrations = {};
      if (tab === 'discord') {
        context.integrations.discord = require('../../integrations/discord').getConfig(row.id);
      } else if (tab === 'status-page') {
        context.integrations.statusPage = require('../../integrations/statusPage').getStatusPage(row.id);
      } else if (tab === 'invites') {
        context.integrations.invite = await require('../../integrations/invites')
          .inviteInfo(row.id)
          .catch(() => null);
      } else if (tab === 'chatbot') {
        if (req.user.role !== 'admin') return next();
        // Chatbot endpoint/model/prompt and transcript controls are admin-only.
        context.integrations.wizard = require('../../services/wizard').getConfig(row.id);
      }
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
      } catch (err) {
        pageDegraded('server-players-tab', err);
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
      context.events = eventsVM(eventsService.listEvents({ serverId: row.id, limit: 100 }));
      context.crashReports = db
        .all('SELECT * FROM crash_reports WHERE server_id = ? ORDER BY file_mtime DESC LIMIT 50', row.id)
        .map(crashVM);
    } else if (tab === 'backups') {
      context.backups = db
        .all('SELECT * FROM backups WHERE server_id = ? ORDER BY created_at DESC LIMIT 50', row.id)
        .map((b) => ({ id: b.id, file: b.filename, size: b.size_bytes, reason: b.reason, ts: b.created_at }));
      const rc = require('../../services/backupRetention').effective(row.id);
      context.retention = {
        keepScheduled: rc.keepScheduled,
        keepPreUpdate: rc.keepPreUpdate,
        keepManual: rc.keepManual,
        keepPreRestore: rc.keepPreRestore,
        maxAgeDays: rc.maxAgeDays,
        maxTotalGb: rc.maxTotalGb,
      };
    }

    res.render('server-detail', context);
  })
);

router.get('/wizard-transcripts', requireRole('admin'), (req, res) => {
  const wizard = require('../../services/wizard');
  res.render('wizard-transcripts', {
    title: 'Chatbot transcripts',
    active: 'activity',
    transcripts: wizard.listTranscripts({ limit: 1000 }),
  });
});

router.get('/modpacks', async (req, res) => {
  // Own query, not res.locals.servers: the sidebar VMs are deliberately lean and
  // carry no pack info. NB: never pass this list under the `servers` key - that
  // shadows res.locals.servers and silently filters the sidebar's server list.
  res.render('modpacks', { title: 'Modpacks', active: 'modpacks', packServers: packServerVMs() });
});

router.get('/worlds', (req, res) => {
  res.render('worlds', {
    title: 'Worlds',
    active: 'worlds',
    worlds: require('../../services/worlds').libraryWorlds(),
    // Install/extract target list - one json call, not hand-assembled JSON.
    serverOptions: (res.locals.servers || []).map((s) => ({
      id: s.id,
      name: s.name,
      flavor: s.flavor,
      status: s.status,
    })),
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
    // Changelog URLs come from remote platform APIs - allow only http(s) so a
    // hostile response can never plant a javascript: link.
    updates: checker.listOutdated().map((u) => ({
      ...u,
      changelog: /^https?:\/\//i.test(u.changelog || '') ? u.changelog : null,
    })),
    lastChecked: checker.lastCheckedAt() || null,
  });
});

router.get('/backups', (req, res) => {
  // Bounded list (newest 200) with a separate totals query. The pre-audit code
  // rendered every backup row the table held and derived the totals from that
  // in-memory array - a fleet with months of retention materialized the whole
  // table on every page load just to show the newest entries.
  const totals = db.get('SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) AS s FROM backups');
  const backups = db
    .all(
      `SELECT b.*, s.display_name FROM backups b JOIN servers s ON s.id = b.server_id ORDER BY b.created_at DESC LIMIT 200`
    )
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
    totals: { count: totals.n, bytes: totals.s },
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
  requireRole('admin'),
  asyncHandler(async (req, res, next) => {
    const indexer = require('../../storage/indexer');
    const { free, total } = await indexer.diskFree().catch(() => ({ free: 0, total: 0 }));
    const catNames = {
      servers: 'Servers',
      backups: 'Backups',
      'library/worlds': 'Library - worlds',
      'library/mods': 'Library - mods & content',
      'library/modpacks': 'Library - modpacks',
      'library/icons': 'Library - icons',
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

  const total = db.get(`SELECT COUNT(*) AS n FROM events ${whereSql}`, ...params)?.n || 0;
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PER_PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
  const events = eventsVM(
    db
      .all(
        `SELECT * FROM events ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
        ...params,
        ACTIVITY_PER_PAGE,
        (page - 1) * ACTIVITY_PER_PAGE
      )
      .map((r) => ({ ...r, details: safeJsonParse(r.details_json) }))
  );

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
    types: eventsService.knownTypes(),
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

// Global file manager over ./data (admin only - full panel data access).
router.get(
  '/files',
  require('../middleware/auth').requireRole('admin'),
  asyncHandler(async (req, res, next) => {
    const filesService = require('../../services/files');
    const rel = String(req.query.path || '');
    let listing;
    try {
      listing = await filesService.list(null, rel);
    } catch (err) {
      pageDegraded('global-files-bad-path', err);
      return res.redirect('/files'); // stale/invalid path - back to the root
    }
    const crumbs = listing.path
      ? listing.path.split('/').map((seg, i, a) => {
          const p = a.slice(0, i + 1).join('/');
          return { name: seg, path: p, enc: encodeURIComponent(p) };
        })
      : [];
    res.render('files-global', {
      title: 'File Manager',
      active: 'storage',
      files: listing.entries.map((e) => ({ ...e, enc: encodeURIComponent(e.path) })),
      filePath: listing.path,
      crumbs,
      parentEnc: crumbs.length > 1 ? crumbs[crumbs.length - 2].enc : '',
    });
  })
);

router.get('/settings', requireRole('admin'), (req, res) => {
  const apiKeys = require('../../services/apiKeys');
  const config = require('../../config');
  const settings = require('../../services/settings');
  const publicHost = settings.getPublicHost();
  res.render('settings', {
    title: 'Settings',
    active: 'settings',
    cfKeyMasked: apiKeys.maskedKey('curseforge'),
    publicHost,
    cookieSecureWarning: Boolean(publicHost) && config.cookieSecure === false,
    users: require('../../services/auth').listUsers(),
    selfUserId: req.user.id,
    panel: {
      host: config.host,
      port: config.port,
      version: req.app.locals.appVersion,
    },
    defaults: settings.getDefaults(),
    defaultsBase: config.defaults,
    publicApiEnabled: settings.isPublicApiEnabled(),
    apiTokens: require('../../services/apiTokens').listTokens(),
    serverOptions: require('../../services/servers')
      .listServers()
      .map((s) => ({ id: s.id, name: s.display_name })),
  });
});

router.get('/login', (req, res) => {
  res.render('login', { title: 'Sign In', layout: 'bare' });
});

module.exports = router;
