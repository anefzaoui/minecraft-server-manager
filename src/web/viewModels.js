'use strict';

// Maps DB rows + live Docker data into the shape the views render.

const { getVersionManifest } = require('../services/mojang');
const db = require('../db');

/**
 * UX rule (user-mandated): LATEST/SNAPSHOT are never shown bare - always
 * resolve to "LATEST (26.2)" style using the cached Mojang manifest.
 */
async function displayVersion(mcVersion) {
  if (mcVersion !== 'LATEST' && mcVersion !== 'SNAPSHOT') return mcVersion;
  try {
    const manifest = await getVersionManifest();
    const resolved = mcVersion === 'LATEST' ? manifest.latest.release : manifest.latest.snapshot;
    return `${mcVersion} (${resolved})`;
  } catch {
    return mcVersion;
  }
}

/**
 * Lean per-server view models for the layout chrome that renders on EVERY
 * authenticated page: the sidebar server list, the server-picker <select>s on
 * Backups / Activity / Worlds, and the Storage quota table. Those templates read
 * id / name / icon / accent / status / disk / flavor, so this deliberately skips
 * the full serverVM() fan-out (per-server pack lookup, update-check lookup,
 * crash-count, loader detection, version-manifest resolve) that used to run once
 * per server on every page load. `flavor` is a pure map off `type` - free - so
 * it stays; the pack/update lookups do not (see packServerVMs() for the
 * Modpacks page, which does need them).
 */
function sidebarServerVMs() {
  const rows = db.all(
    'SELECT id, display_name, icon, accent, status, type, disk_quota_bytes FROM servers WHERE deleted_at IS NULL ORDER BY created_at'
  );
  // Fetch only the exact per-server size rows (servers/<id>). A bare
  // `LIKE 'servers/%'` sweep would also return every depth-≤3 nested path the
  // indexer caches (servers/<id>/worlds, /backups, …), which the sidebar never
  // reads - unnecessary rows across the whole fleet on every page load.
  const ids = rows.map((s) => s.id);
  const sizes = new Map();
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    for (const r of db.all(
      `SELECT rel_path, size_bytes FROM storage_index WHERE rel_path IN (${ph})`,
      ...ids.map((id) => `servers/${id}`)
    ))
      sizes.set(r.rel_path, r.size_bytes);
  }
  return rows.map((s) => ({
    id: s.id,
    name: s.display_name,
    icon: s.icon,
    accent: s.accent,
    status: s.status,
    flavor: flavorLabel(s.type),
    disk: { used: sizes.get(`servers/${s.id}`) || 0, quota: s.disk_quota_bytes },
  }));
}

/**
 * Pack-backed servers for the Modpacks page. Unlike sidebarServerVMs() this is
 * NOT on the every-page hot path (one route), so it can afford the per-server
 * pack + update-check lookups. Shape matches what views/modpacks.hbs reads:
 * id / name / icon / accent / pack / updateAvailable.
 */
function packServerVMs() {
  const rows = db.all(
    `SELECT s.id, s.display_name, s.icon, s.accent
       FROM servers s
       JOIN server_packs p ON p.server_id = s.id
      WHERE s.deleted_at IS NULL
      ORDER BY s.created_at`
  );
  return rows.map((s) => ({
    id: s.id,
    name: s.display_name,
    icon: s.icon,
    accent: s.accent,
    pack: packVM(s.id),
    updateAvailable: hasPackUpdate(s.id),
  }));
}

async function serverVM(s, { withLive = true, ctx = null } = {}) {
  // ctx (optional) carries pre-fetched per-server DB reads batched across the
  // whole list (see serverVMs) so a dashboard with N servers issues ~O(N)
  // queries instead of ~6N. When absent, fall back to per-call lookups.
  const diskUsedFor = ctx ? ctx.disk : diskUsed;
  const packFor = ctx ? ctx.packVM : packVM;
  const updateFor = ctx ? ctx.update : hasPackUpdate;
  const crashesFor = ctx
    ? ctx.crashes
    : (id) => db.get('SELECT COUNT(*) AS n FROM crash_reports WHERE server_id = ? AND viewed = 0', id)?.n || 0;
  const vm = {
    id: s.id,
    name: s.display_name,
    description: s.description,
    icon: s.icon,
    accent: s.accent,
    tags: s.tags,
    type: s.type,
    flavor: flavorLabel(s.type),
    loader: require('../services/mods').loaderOf(s), // resolved loader (detects the pack's for modpacks)
    mcVersion: await displayVersion(s.mc_version),
    javaTag: s.java_tag || 'auto',
    status: s.status,
    ports: { game: s.port_game, rcon: s.port_rcon, bedrock: s.port_bedrock },
    resources: { heapMb: s.heap_mb, containerMemoryMb: s.container_memory_mb, cpus: s.cpus },
    // What the memory meter is going to show and why (#25): a heap given to
    // Java up front reads as fully used from the first minute, so the meters
    // say so and where the heap sits relative to the container limit.
    memory: memoryVM(s),
    stats: { cpuPct: 0, memUsedMb: 0, uptime: null, perf: null, perfSupported: true },
    players: { online: 0, max: Number(s.env.MAX_PLAYERS) || 20, names: [] },
    disk: { used: diskUsedFor(s.id), quota: s.disk_quota_bytes },
    pack: packFor(s.id),
    updateAvailable: updateFor(s.id),
    crashesUnread: crashesFor(s.id),
    autoStart: Boolean(s.auto_start),
    autoRestart: Boolean(s.auto_restart),
    notes: s.notes,
    updatePolicy: s.update_policy,
    // True only for a server the boot sweep could not repair (no recorded or
    // installed version to pin to) - the settings page warns and asks for a
    // manual version pick (#22).
    packUnpinned: require('../services/packPins').unpinnedPackSelectors(s.type, s.env).length > 0,
    pendingRecreate: Boolean(s.pending_recreate),
    lastStarted: s.last_started_at || '-',
    created: s.created_at,
    consoleLabel: s.console_label || '',
  };

  if (
    withLive &&
    (s.status === 'running' || s.status === 'starting' || s.status === 'unhealthy' || s.status === 'stalled')
  ) {
    // Never block a page render on Docker: everything comes from the in-memory
    // live cache (fed by streaming stats + periodic rcon list).
    const liveCache = require('../services/liveCache');
    const live = liveCache.get(s.id);
    if (live.stats) {
      vm.stats.cpuPct = live.stats.cpuPct;
      vm.stats.memUsedMb = Math.round((live.stats.memUsedBytes || 0) / 1024 / 1024);
    }
    if (live.startedAt) {
      vm.stats.uptime = formatUptime(Date.now() - Date.parse(live.startedAt));
      vm.stats.startedAt = live.startedAt;
    }
    vm.stats.perf = live.perf || null;
    vm.stats.perfSupported = live.perfSupported !== false;
    if (live.players) vm.players = { ...vm.players, ...live.players };
    // Boot-phase detail ("Downloading mods…", "Generating world") or the
    // latched "Player count unavailable" state - one shared derivation with
    // the live-poll route, so the SSR chip and the hydrated one can't drift.
    const detail = liveCache.statusDetail(live);
    if (detail) vm.statusDetail = detail;
  }
  return vm;
}

// Pre-fetch every server's disk size, pack, update-check and crash-unread count
// in a handful of batched queries and return them as lookup maps (keyed by
// server id) for serverVM()'s ctx. Collapses the ~6N per-call SELECTs behind a
// dashboard render into ~N/900 + 3 queries (the N+1 round-trip collapse).
function buildServerContext(rows) {
  const ids = rows.map((s) => s.id);
  const chunked = (list) => {
    const CH = 900;
    const out = [];
    for (let i = 0; i < list.length; i += CH) out.push(list.slice(i, i + CH));
    return out.length ? out : [[]];
  };

  // packs (server_id -> pack row) + their update checks.
  const packs = new Map();
  const checks = new Map();
  for (const chunk of chunked(ids)) {
    const ph = chunk.map(() => '?').join(',');
    for (const p of db.all(`SELECT * FROM server_packs WHERE server_id IN (${ph})`, ...chunk))
      packs.set(p.server_id, p);
  }
  if (packs.size) {
    const packIds = [...packs.values()].map((p) => p.server_id);
    for (const chunk of chunked(packIds)) {
      const ph = chunk.map(() => '?').join(',');
      for (const c of db.all(
        `SELECT * FROM update_checks WHERE subject_type = 'pack' AND subject_id IN (${ph})`,
        ...chunk
      ))
        checks.set(c.subject_id, c);
    }
  }

  // storage sizes.
  const disk = new Map();
  for (const chunk of chunked(ids)) {
    const ph = chunk.map(() => '?').join(',');
    for (const r of db.all(
      `SELECT rel_path, size_bytes FROM storage_index WHERE rel_path IN (${ph})`,
      ...chunk.map((id) => `servers/${id}`)
    ))
      disk.set(r.rel_path.slice('servers/'.length), r.size_bytes);
  }

  // crash-unread counts.
  const crashes = new Map();
  for (const chunk of chunked(ids)) {
    const ph = chunk.map(() => '?').join(',');
    for (const r of db.all(
      `SELECT server_id, COUNT(*) AS n FROM crash_reports WHERE server_id IN (${ph}) AND viewed = 0 GROUP BY server_id`,
      ...chunk
    ))
      crashes.set(r.server_id, r.n);
  }

  return {
    disk: (id) => disk.get(id) || 0,
    packVM: (id) => packFromRow(packs.get(id) || null, checks.get(id) || null),
    update: (id) => {
      const p = packs.get(id);
      if (!p) return false;
      const c = checks.get(id);
      return Boolean(c && c.latest_version && c.latest_version !== p.pinned_version_id);
    },
    crashes: (id) => crashes.get(id) || 0,
  };
}

// Build every server VM on a shared batched ctx (see buildServerContext). Kept
// as a convenience for callers that don't need per-VM rejection isolation.
async function serverVMs(rows, opts = {}) {
  const ctx = buildServerContext(rows);
  return Promise.all(rows.map((s) => serverVM(s, { ...opts, ctx })));
}

// Build the pack summary from already-loaded rows (batch path).
function packFromRow(pack, check) {
  if (!pack) return null;
  return {
    platform: { curseforge: 'CurseForge', modrinth: 'Modrinth', ftb: 'FTB' }[pack.platform] || pack.platform,
    name: pack.project_name,
    version: pack.pinned_version_name,
    versionId: pack.pinned_version_id,
    latest: check && check.latest_name ? check.latest_name : pack.pinned_version_name,
    latestVersionId: check && check.latest_version ? check.latest_version : null,
  };
}

/** Heap-vs-limit facts for the memory meters. */
function memoryVM(s) {
  const plan = require('../services/jvm').heapPlan(s.env, s.heap_mb);
  const limit = Number(s.container_memory_mb) || 0;
  return {
    heapMb: plan.heapMb,
    initMb: plan.initMb,
    growsOnDemand: plan.growsOnDemand,
    note: plan.note,
    // Where the heap sits on a meter whose full width is the container limit.
    heapPct: limit && plan.heapMb ? Math.min(100, Math.round((plan.heapMb / limit) * 100)) : 0,
  };
}

function packVM(serverId) {
  const pack = db.get('SELECT * FROM server_packs WHERE server_id = ?', serverId);
  if (!pack) return null;
  const check = db.get(
    "SELECT latest_version, latest_name FROM update_checks WHERE subject_type = 'pack' AND subject_id = ?",
    serverId
  );
  return {
    platform: { curseforge: 'CurseForge', modrinth: 'Modrinth', ftb: 'FTB' }[pack.platform] || pack.platform,
    name: pack.project_name,
    version: pack.pinned_version_name,
    versionId: pack.pinned_version_id,
    latest: check && check.latest_name ? check.latest_name : pack.pinned_version_name,
    // The real platform id behind `latest` (a display NAME - differs from the id
    // for CurseForge/Modrinth). Modpacks-page "Upgrade" posts this so the request
    // names the exact version the card showed, rather than trusting the server to
    // re-derive "latest" itself. Same pattern as updates.hbs's data-version-id.
    latestVersionId: check && check.latest_version ? check.latest_version : null,
  };
}

function hasPackUpdate(serverId) {
  const pack = db.get('SELECT pinned_version_id FROM server_packs WHERE server_id = ?', serverId);
  if (!pack) return false;
  const check = db.get(
    "SELECT latest_version FROM update_checks WHERE subject_type = 'pack' AND subject_id = ?",
    serverId
  );
  return Boolean(check && check.latest_version && check.latest_version !== pack.pinned_version_id);
}

function diskUsed(serverId) {
  const row = db.get('SELECT size_bytes FROM storage_index WHERE rel_path = ?', `servers/${serverId}`);
  return row ? row.size_bytes : 0;
}

function flavorLabel(type) {
  const map = {
    VANILLA: 'Vanilla',
    PAPER: 'Paper',
    PURPUR: 'Purpur',
    PUFFERFISH: 'Pufferfish',
    FOLIA: 'Folia',
    LEAF: 'Leaf',
    SPIGOT: 'Spigot',
    BUKKIT: 'Bukkit',
    FABRIC: 'Fabric',
    FORGE: 'Forge',
    NEOFORGE: 'NeoForge',
    QUILT: 'Quilt',
    AUTO_CURSEFORGE: 'CurseForge pack',
    MODRINTH: 'Modrinth pack',
    FTBA: 'FTB pack',
    CUSTOM: 'Custom jar',
  };
  return map[type] || type;
}

function formatUptime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function safeJsonParse(json) {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

function eventVM(e) {
  const server = e.server_id ? db.get('SELECT display_name, deleted_at FROM servers WHERE id = ?', e.server_id) : null;
  return eventVMWithServer(e, server);
}

// Batched eventVM: fetch the server display_name/deleted_at for every event's
// server_id in one query instead of N per-event SELECTs (the N+1 in the
// dashboard activity feed).
function eventsVM(events) {
  const ids = [...new Set(events.map((e) => e.server_id).filter((id) => id != null))];
  const byId = new Map();
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    for (const r of db.all(`SELECT id, display_name, deleted_at FROM servers WHERE id IN (${ph})`, ...ids))
      byId.set(r.id, r);
  }
  return events.map((e) => eventVMWithServer(e, e.server_id != null ? byId.get(e.server_id) : null));
}

function eventVMWithServer(e, server) {
  return {
    id: e.id,
    // Deleted servers keep their name in history but must not be linked (404).
    serverId: server && !server.deleted_at ? e.server_id : null,
    server: server ? server.display_name + (server.deleted_at ? ' (deleted)' : '') : '- panel -',
    type: e.type,
    actor: e.actor,
    ts: e.created_at,
    summary: e.summary,
    hasLog: Boolean(e.log_excerpt_path),
    diff: e.details && e.details.diff ? e.details.diff : null,
  };
}

function crashVM(c) {
  return {
    id: c.id,
    file: c.filename,
    ts: c.file_mtime,
    size: c.size_bytes,
    summary: c.summary || c.exception,
    suspected: (() => {
      try {
        return JSON.parse(c.suspected_json || '[]');
      } catch {
        return [];
      }
    })(),
    viewed: Boolean(c.viewed),
    mclogsUrl: c.mclogs_url || null,
  };
}

module.exports = {
  serverVM,
  serverVMs,
  buildServerContext,
  sidebarServerVMs,
  packServerVMs,
  flavorLabel,
  displayVersion,
  eventVM,
  eventsVM,
  crashVM,
  safeJsonParse,
};
