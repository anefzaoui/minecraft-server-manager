'use strict';

// Maps DB rows + live Docker data into the shape the views render.

const { getVersionManifest } = require('../services/mojang');
const db = require('../db');

const GB = 1024 ** 3;

/**
 * UX rule (user-mandated): LATEST/SNAPSHOT are never shown bare — always
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

async function serverVM(s, { withLive = true } = {}) {
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
    stats: { cpuPct: 0, memUsedMb: 0, uptime: null },
    players: { online: 0, max: Number(s.env.MAX_PLAYERS) || 20, names: [] },
    disk: { used: diskUsed(s.id), quota: s.disk_quota_bytes || 25 * GB },
    pack: packVM(s.id),
    updateAvailable: hasPackUpdate(s.id),
    crashesUnread: db.get('SELECT COUNT(*) AS n FROM crash_reports WHERE server_id = ? AND viewed = 0', s.id)?.n || 0,
    autoStart: Boolean(s.auto_start),
    autoRestart: Boolean(s.auto_restart),
    notes: s.notes,
    updatePolicy: s.update_policy,
    pendingRecreate: Boolean(s.pending_recreate),
    lastStarted: s.last_started_at || '—',
    created: s.created_at,
    consoleLabel: s.console_label || '',
  };

  if (withLive && (s.status === 'running' || s.status === 'starting' || s.status === 'unhealthy')) {
    // Never block a page render on Docker: everything comes from the in-memory
    // live cache (fed by streaming stats + periodic rcon list).
    const live = require('../services/liveCache').get(s.id);
    if (live.stats) {
      vm.stats.cpuPct = live.stats.cpuPct;
      vm.stats.memUsedMb = Math.round(live.stats.memUsedBytes / 1024 / 1024);
    }
    if (live.startedAt) vm.stats.uptime = formatUptime(Date.now() - Date.parse(live.startedAt));
    if (live.players) vm.players = { ...vm.players, ...live.players };
    // Boot-phase detail ("Downloading mods…", "Generating world") replaces the
    // flat starting/unhealthy label while the server hasn't answered rcon yet.
    if (live.phase && !live.players) vm.statusDetail = live.phase.label;
  }
  return vm;
}

function packVM(serverId) {
  const pack = db.get('SELECT * FROM server_packs WHERE server_id = ?', serverId);
  if (!pack) return null;
  const check = db.get(
    "SELECT latest_name FROM update_checks WHERE subject_type = 'pack' AND subject_id = ?",
    serverId
  );
  return {
    platform: { curseforge: 'CurseForge', modrinth: 'Modrinth', ftb: 'FTB' }[pack.platform] || pack.platform,
    name: pack.project_name,
    version: pack.pinned_version_name,
    versionId: pack.pinned_version_id,
    latest: check && check.latest_name ? check.latest_name : pack.pinned_version_name,
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
  return {
    id: e.id,
    // Deleted servers keep their name in history but must not be linked (404).
    serverId: server && !server.deleted_at ? e.server_id : null,
    server: server ? server.display_name + (server.deleted_at ? ' (deleted)' : '') : '— panel —',
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
    suspected: JSON.parse(c.suspected_json || '[]'),
    viewed: Boolean(c.viewed),
  };
}

module.exports = { serverVM, flavorLabel, displayVersion, eventVM, crashVM, safeJsonParse };
