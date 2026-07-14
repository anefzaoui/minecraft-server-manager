'use strict';

// Live-data cache: one stats stream + periodic player-list per RUNNING server,
// held in memory so page renders and the public status page never block on
// Docker (a one-shot `docker stats` costs ~2s; `docker exec rcon-cli list`
// ~0.5s). Everything reads from here; nothing user-facing calls Docker inline.

const db = require('../db');
const { statsStream, statsOnce } = require('../docker/stats');
const { execCapture, inspectStatus } = require('../docker/containers');
const { fetchLogs } = require('../docker/logs');

// Boot-phase detection: a modded first boot passes through many meaningful
// states — surface them instead of a flat "starting/unhealthy". Ordered by
// precedence (later pipeline stages win when several match the tail).
const PHASES = [
  {
    key: 'pack-download',
    re: /Downloading modpack|Downloading.*server pack|install-(curseforge|modrinth)/i,
    label: 'Downloading modpack',
  },
  { key: 'mods-download', re: /Downloaded mod file|Downloading mods|Downloaded \d+ files/i, label: 'Downloading mods' },
  {
    key: 'loader-install',
    re: /Running (the )?.*(NeoForge|Forge|Fabric|Quilt).*installer|installer for Minecraft/i,
    label: 'Installing mod loader',
  },
  {
    key: 'server-download',
    re: /Downloading (Paper|Purpur|server jar)|Downloading.*minecraft_server/i,
    label: 'Downloading server',
  },
  {
    key: 'mod-loading',
    re: /Loading \d+ mods|mixin|ModLauncher|Bootstrap|Fabric Loader|FML.*load/i,
    label: 'Loading mods',
  },
  {
    key: 'world-gen',
    re: /Preparing level|Preparing start region|Preparing spawn|Generating keypair/i,
    label: 'Generating world',
  },
  { key: 'done', re: /Done \([\d.]+s\)/, label: 'Finishing startup' },
];

function classifyPhase(logTail) {
  let found = null;
  for (const phase of PHASES) {
    if (phase.re.test(logTail)) found = phase; // last (deepest) match wins
  }
  if (!found) return null;
  if (found.key === 'mods-download') {
    const count = (logTail.match(/Downloaded mod file/g) || []).length;
    return { key: found.key, label: count > 1 ? `Downloading mods (${count} in the last minute)` : found.label };
  }
  return { key: found.key, label: found.label };
}

const entries = new Map(); // serverId -> {stats, players, uptimeStartedAt, stopStats, timers}
let syncTimer = null;
let syncing = false;

const EMPTY = { stats: null, players: null, startedAt: null };

function get(serverId) {
  const e = entries.get(serverId);
  if (!e) return EMPTY;
  return { stats: e.stats || null, players: e.players || null, startedAt: e.startedAt || null, phase: e.phase || null };
}

function getAll() {
  const out = {};
  for (const [id, e] of entries) {
    out[id] = {
      stats: e.stats || null,
      players: e.players || null,
      startedAt: e.startedAt || null,
      phase: e.phase || null,
    };
  }
  return out;
}

async function attach(serverId) {
  if (entries.has(serverId)) return;
  const entry = { stats: null, players: null, startedAt: null, stopStats: null, playerTimer: null };
  entries.set(serverId, entry);

  try {
    const info = await inspectStatus(serverId);
    entry.startedAt = info.startedAt || null;
  } catch {
    /* leave null */
  }

  try {
    entry.stopStats = await statsStream(serverId, (sample) => {
      entry.stats = { ...sample, at: Date.now() };
    });
  } catch {
    /* stats unavailable — cache stays null */
  }

  let playersInFlight = false;
  const refreshPlayers = async () => {
    if (playersInFlight) return; // don't stack calls if one is slow/hung
    playersInFlight = true;
    try {
      const raw = await execCapture(serverId, ['rcon-cli', 'list']);
      const out = require('../utils/ansi').cleanText(raw); // rcon-cli colorizes
      const m = /There are (\d+) of a max of (\d+) players online:?\s*(.*)/i.exec(out);
      if (m) {
        entry.players = {
          online: Number(m[1]),
          max: Number(m[2]),
          names: m[3]
            ? m[3]
                .split(',')
                .map((n) => n.trim())
                .filter((n) => /^[A-Za-z0-9_]{2,16}$/.test(n))
            : [],
          at: Date.now(),
        };
        entry.phase = null; // rcon answering = fully up, no boot phase
      }
    } catch {
      /* rcon not up yet — keep last value */
    } finally {
      playersInFlight = false;
    }
  };

  // Boot-phase probe: while the server hasn't answered rcon yet, read a short
  // log tail and classify what the startup pipeline is doing right now.
  let phaseInFlight = false;
  const refreshPhase = async () => {
    if (entry.players || phaseInFlight) return; // already up, or a probe is running
    phaseInFlight = true;
    try {
      const tail = await fetchLogs(serverId, { tail: 40 });
      entry.phase = classifyPhase(tail) || entry.phase || { key: 'boot', label: 'Starting up' };
    } catch {
      /* container gone — sync() will detach */
    } finally {
      phaseInFlight = false;
    }
  };

  refreshPlayers();
  refreshPhase();
  entry.playerTimer = setInterval(refreshPlayers, 20000);
  entry.playerTimer.unref();
  entry.phaseTimer = setInterval(refreshPhase, 8000);
  entry.phaseTimer.unref();
}

function detach(serverId) {
  const entry = entries.get(serverId);
  if (!entry) return;
  if (entry.stopStats) {
    try {
      entry.stopStats();
    } catch {
      /* closed */
    }
  }
  if (entry.playerTimer) clearInterval(entry.playerTimer);
  if (entry.phaseTimer) clearInterval(entry.phaseTimer);
  entries.delete(serverId);
}

/** Reconcile taps with the set of running servers. */
async function sync() {
  if (syncing) return;
  syncing = true;
  try {
    const rows = db.all('SELECT id, status FROM servers WHERE deleted_at IS NULL');
    const running = new Set(
      rows.filter((r) => ['running', 'starting', 'unhealthy'].includes(r.status)).map((r) => r.id)
    );
    for (const id of running) if (!entries.has(id)) await attach(id);
    for (const id of [...entries.keys()]) if (!running.has(id)) detach(id);
  } catch (err) {
    console.error('[liveCache]', err.message);
  } finally {
    syncing = false;
  }
}

function startLiveCache({ intervalMs = 10000 } = {}) {
  sync();
  syncTimer = setInterval(sync, intervalMs);
  syncTimer.unref();
}

/** One-shot fallback for servers not yet in the cache (e.g. just started). */
async function sampleOnce(serverId) {
  try {
    return await statsOnce(serverId);
  } catch {
    return null;
  }
}

module.exports = { get, getAll, startLiveCache, sync, detach, sampleOnce };
