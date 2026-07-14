'use strict';

// Player statistics: curates the world's vanilla stat files into flat
// snapshots (player_stat_snapshots), and derives profiles, scoreboards, and
// the advisory X-ray report from them.

const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const serversService = require('../services/servers');
const { activeLevelName } = require('../services/worlds');
const { uuidToDashed } = require('../services/mojangProfiles');

const RUNNING = new Set(['running', 'starting', 'unhealthy']);
const STONE_BLOCKS = ['minecraft:stone', 'minecraft:cobblestone', 'minecraft:deepslate', 'minecraft:cobbled_deepslate'];
const METRICS = new Set([
  'playtimeTicks',
  'deaths',
  'mobKills',
  'playerKills',
  'blocksMinedTotal',
  'stoneMined',
  'diamondsMined',
  'ironMined',
  'ancientDebrisMined',
  'distanceCm',
  'damageDealt',
  'damageTaken',
  'jumps',
  'blocksUsedTotal',
]);

let timer = null;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sumAll = (obj) => Object.values(obj || {}).reduce((n, v) => n + num(v), 0);
const pick = (obj, keys) => keys.reduce((n, k) => n + num(obj && obj[k]), 0);

/** Vanilla stats JSON -> curated flat object (stable key order for diffing). */
function curate(root) {
  const stats = (root && root.stats) || {};
  const custom = stats['minecraft:custom'] || {};
  const mined = stats['minecraft:mined'] || {};
  let distanceCm = 0;
  for (const [key, value] of Object.entries(custom)) {
    if (key.endsWith('_one_cm')) distanceCm += num(value); // walk/sprint/swim/fly/boat/horse/…
  }
  return {
    playtimeTicks: num(custom['minecraft:play_time']) || num(custom['minecraft:play_one_minute']),
    deaths: num(custom['minecraft:deaths']),
    mobKills: num(custom['minecraft:mob_kills']),
    playerKills: num(custom['minecraft:player_kills']),
    damageDealt: num(custom['minecraft:damage_dealt']),
    damageTaken: num(custom['minecraft:damage_taken']),
    jumps: num(custom['minecraft:jump']),
    distanceCm,
    blocksMinedTotal: sumAll(mined),
    stoneMined: pick(mined, STONE_BLOCKS),
    diamondsMined: pick(mined, ['minecraft:diamond_ore', 'minecraft:deepslate_diamond_ore']),
    ironMined: pick(mined, ['minecraft:iron_ore', 'minecraft:deepslate_iron_ore']),
    ancientDebrisMined: num(mined['minecraft:ancient_debris']),
    // Vanilla has no "blocks placed" stat; minecraft:used counts right-click
    // uses per item, which is dominated by block placements — good builder proxy.
    blocksUsedTotal: sumAll(stats['minecraft:used']),
  };
}

function readUsercache(serverId) {
  const names = new Map();
  try {
    const rows = JSON.parse(fs.readFileSync(dataPath('servers', serverId, 'usercache.json'), 'utf8'));
    for (const row of rows) {
      const uuid = uuidToDashed(row.uuid);
      if (uuid && row.name) names.set(uuid, row.name);
    }
  } catch {
    /* no usercache yet */
  }
  return names;
}

/**
 * Read <server>/<level>/stats/*.json and snapshot each player whose curated
 * stats changed since the last snapshot. Returns { players, snapshots }.
 */
function ingestStats(serverId) {
  const server = serversService.getServer(serverId);
  if (!server) {
    const err = new Error('Server not found');
    err.status = 404;
    throw err;
  }
  // activeLevelName honors LEVEL env AND server.properties level-name — a
  // renamed/activated world would otherwise silently stop producing stats.
  const level = activeLevelName(server);
  // MC 26.x moved stat files from <world>/stats to <world>/players/stats.
  let statsDir;
  try {
    const modern = dataPath('servers', serverId, level, 'players', 'stats');
    const legacy = dataPath('servers', serverId, level, 'stats');
    statsDir = fs.existsSync(modern) ? modern : legacy;
  } catch {
    return { players: 0, snapshots: 0 };
  }
  if (!fs.existsSync(statsDir)) return { players: 0, snapshots: 0 };

  const names = readUsercache(serverId);
  let players = 0;
  let snapshots = 0;
  for (const file of fs.readdirSync(statsDir)) {
    if (!file.endsWith('.json')) continue;
    const uuid = uuidToDashed(path.basename(file, '.json'));
    if (!uuid) continue;
    let curated;
    try {
      curated = curate(JSON.parse(fs.readFileSync(path.join(statsDir, file), 'utf8')));
    } catch {
      continue; // partial write / malformed file — retry next cycle
    }
    players++;
    const json = JSON.stringify(curated);
    const latest = db.get(
      'SELECT stats_json FROM player_stat_snapshots WHERE server_id = ? AND uuid = ? ORDER BY id DESC LIMIT 1',
      serverId,
      uuid
    );
    if (latest && latest.stats_json === json) continue;
    db.run(
      `INSERT INTO player_stat_snapshots (server_id, uuid, name, ts, stats_json)
       VALUES (?, ?, ?, ?, ?)`,
      serverId,
      uuid,
      names.get(uuid) || '',
      new Date().toISOString(),
      json
    );
    snapshots++;
  }
  return { players, snapshots };
}

/** Periodic stat ingestion for all running servers. Returns a stop function. */
function startStatsIngest({ intervalMs = 5 * 60 * 1000 } = {}) {
  const tick = () => {
    for (const server of serversService.listServers()) {
      if (!RUNNING.has(server.status)) continue;
      try {
        ingestStats(server.id);
      } catch (err) {
        console.error(`[analytics] stats ingest ${server.id} failed:`, err.message);
      }
    }
  };
  tick();
  timer = setInterval(tick, intervalMs);
  if (timer.unref) timer.unref();
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

function latestSnapshot(serverId, uuid) {
  return db.get(
    'SELECT * FROM player_stat_snapshots WHERE server_id = ? AND uuid = ? ORDER BY id DESC LIMIT 1',
    serverId,
    uuid
  );
}

/**
 * Baseline snapshot for windowed deltas: the newest snapshot at or before the
 * cutoff; when the player has none that old (snapshots only exist since
 * tracking started), the oldest snapshot stands in so deltas never exceed
 * what was actually observed.
 */
function baselineSnapshot(serverId, uuid, cutoffIso) {
  return (
    db.get(
      `SELECT * FROM player_stat_snapshots WHERE server_id = ? AND uuid = ? AND ts <= ?
       ORDER BY ts DESC LIMIT 1`,
      serverId,
      uuid,
      cutoffIso
    ) ||
    db.get(
      'SELECT * FROM player_stat_snapshots WHERE server_id = ? AND uuid = ? ORDER BY ts ASC LIMIT 1',
      serverId,
      uuid
    )
  );
}

function windowCutoff(window) {
  const hours = window === '24h' ? 24 : window === '7d' ? 24 * 7 : null;
  return hours ? new Date(Date.now() - hours * 3_600_000).toISOString() : null;
}

function deltaBetween(latest, base) {
  const out = {};
  for (const key of METRICS) out[key] = Math.max(0, num(latest[key]) - num(base ? base[key] : 0));
  return out;
}

/**
 * Playstyle heuristic (percentages of the four normalized scores):
 *   miner    = blocks broken
 *   builder  = minecraft:used total (right-click uses ≈ blocks placed; vanilla
 *              has no direct "placed" stat) — falls back to jumps when zero
 *   fighter  = 25 * (mobKills + 4 * playerKills) + damageDealt / 10
 *   explorer = distanceCm / 1600 (16 m traveled weighted like one block mined)
 * The scale factors put a typical hour of each activity in the same order of
 * magnitude so the split reflects how time is actually spent.
 */
function playstyle(stats) {
  const scores = {
    miner: stats.blocksMinedTotal,
    builder: stats.blocksUsedTotal > 0 ? stats.blocksUsedTotal : stats.jumps / 2,
    fighter: 25 * (stats.mobKills + 4 * stats.playerKills) + stats.damageDealt / 10,
    explorer: stats.distanceCm / 1600,
  };
  const total = Object.values(scores).reduce((n, v) => n + v, 0);
  const pct = {};
  for (const [key, value] of Object.entries(scores)) {
    pct[key] = total > 0 ? Math.round((value / total) * 100) : 0;
  }
  return pct;
}

/** Full profile for one player: latest stats, 24h/7d deltas, playstyle, sessions. */
function profile(serverId, uuid) {
  const dashed = uuidToDashed(uuid) || uuid;
  const row = latestSnapshot(serverId, dashed);
  if (!row) return null;
  const stats = JSON.parse(row.stats_json);
  const deltas = {};
  for (const window of ['24h', '7d']) {
    const base = baselineSnapshot(serverId, dashed, windowCutoff(window));
    deltas[window] = deltaBetween(stats, base ? JSON.parse(base.stats_json) : null);
  }

  const name = row.name || '';
  const sessionAgg = name
    ? db.get(
        `SELECT COUNT(*) AS count,
                SUM(CASE WHEN ended_at IS NOT NULL
                    THEN (julianday(ended_at) - julianday(started_at)) * 86400 ELSE 0 END) AS closed_seconds
         FROM player_sessions WHERE server_id = ? AND player = ?`,
        serverId,
        name
      )
    : { count: 0, closed_seconds: 0 };
  const recentSessions = name
    ? db
        .all(
          `SELECT started_at, ended_at FROM player_sessions WHERE server_id = ? AND player = ?
         ORDER BY started_at DESC LIMIT 10`,
          serverId,
          name
        )
        .map((s) => ({
          startedAt: s.started_at,
          endedAt: s.ended_at,
          durationSec: Math.max(
            0,
            Math.round(((s.ended_at ? Date.parse(s.ended_at) : Date.now()) - Date.parse(s.started_at)) / 1000)
          ),
          open: !s.ended_at,
        }))
    : [];

  return {
    uuid: dashed,
    name,
    updatedAt: row.ts,
    stats,
    deltas,
    playstyle: playstyle(stats),
    playtimeSeconds: Math.round(stats.playtimeTicks / 20),
    sessions: {
      count: Number(sessionAgg.count) || 0,
      closedSeconds: Math.round(Number(sessionAgg.closed_seconds) || 0),
      last: recentSessions[0] || null,
      recent: recentSessions,
    },
  };
}

/** Rank every tracked player by one metric, absolute or windowed delta. */
function scoreboard(serverId, { metric = 'playtimeTicks', window = 'all' } = {}) {
  if (!METRICS.has(metric)) {
    const err = new Error(`Unknown metric: ${metric}`);
    err.status = 400;
    throw err;
  }
  const cutoff = windowCutoff(window);
  const uuids = db.all('SELECT DISTINCT uuid FROM player_stat_snapshots WHERE server_id = ?', serverId);
  const rows = [];
  for (const { uuid } of uuids) {
    const latest = latestSnapshot(serverId, uuid);
    const stats = JSON.parse(latest.stats_json);
    let value = num(stats[metric]);
    if (cutoff) {
      const base = baselineSnapshot(serverId, uuid, cutoff);
      value = Math.max(0, value - num(base ? JSON.parse(base.stats_json)[metric] : 0));
    }
    rows.push({ uuid, name: latest.name || uuid.slice(0, 8), value });
  }
  rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return rows.map((row, i) => ({ ...row, rank: i + 1, crown: i === 0 && row.value > 0 }));
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Advisory X-ray heuristic: each player's diamond/(stone+1) and ancient-debris
 * ratios vs the server median (players with >= 64 stone mined). Flags ratios
 * over 4x median with at least 16 diamonds — evidence only, never punitive.
 */
function xrayReport(serverId) {
  const uuids = db.all('SELECT DISTINCT uuid FROM player_stat_snapshots WHERE server_id = ?', serverId);
  const players = uuids.map(({ uuid }) => {
    const latest = latestSnapshot(serverId, uuid);
    const s = JSON.parse(latest.stats_json);
    return {
      uuid,
      name: latest.name || uuid.slice(0, 8),
      stoneMined: s.stoneMined,
      diamondsMined: s.diamondsMined,
      ancientDebrisMined: s.ancientDebrisMined,
      diamondRatio: s.diamondsMined / (s.stoneMined + 1),
      debrisRatio: s.ancientDebrisMined / (s.stoneMined + 1),
    };
  });

  const eligible = players.filter((p) => p.stoneMined >= 64);
  const medDiamond = median(eligible.map((p) => p.diamondRatio));
  const medDebris = median(eligible.map((p) => p.debrisRatio));
  // Floor keeps a lone miner on a fresh server from dividing by a zero median.
  const effDiamond = Math.max(medDiamond, 0.001);
  const effDebris = Math.max(medDebris, 0.0005);

  const ratios = players.map((p) => p.diamondRatio).sort((a, b) => a - b);
  const out = players
    .map((p) => {
      const flaggedDiamond = p.stoneMined >= 64 && p.diamondsMined >= 16 && p.diamondRatio > 4 * effDiamond;
      const flaggedDebris = p.stoneMined >= 64 && p.ancientDebrisMined >= 8 && p.debrisRatio > 4 * effDebris;
      return {
        ...p,
        diamondRatio: Number(p.diamondRatio.toFixed(5)),
        debrisRatio: Number(p.debrisRatio.toFixed(5)),
        percentile:
          ratios.length > 1
            ? Math.round((ratios.filter((r) => r <= p.diamondRatio).length / ratios.length) * 100)
            : 100,
        flagged: flaggedDiamond || flaggedDebris,
        reasons: [
          ...(flaggedDiamond ? [`diamond ratio ${(p.diamondRatio / effDiamond).toFixed(1)}x server median`] : []),
          ...(flaggedDebris ? [`ancient debris ratio ${(p.debrisRatio / effDebris).toFixed(1)}x server median`] : []),
        ],
      };
    })
    .sort((a, b) => b.diamondRatio - a.diamondRatio);

  return {
    advisory: true,
    sampleSize: eligible.length,
    medianDiamondRatio: Number(medDiamond.toFixed(5)),
    medianDebrisRatio: Number(medDebris.toFixed(5)),
    players: out,
    flagged: out.filter((p) => p.flagged),
  };
}

module.exports = { ingestStats, startStatsIngest, profile, scoreboard, xrayReport, curate };
