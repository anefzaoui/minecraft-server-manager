'use strict';

// Player-event ingestion: live log taps on every running server plus a
// one-shot backfill from the container's recent log buffer. Every classified
// line becomes a player_events row; join/leave events also maintain
// player_sessions.

const db = require('../db');
const serversService = require('../services/servers');
const { followLogs, fetchLogs } = require('../docker/logs');
const { classify } = require('./logClassifier');

const RUNNING = new Set(['running', 'starting', 'unhealthy']);
const DEDUPE_WINDOW_MS = 5000; // paired lines (logged-in/joined, lost-connection/left)

const taps = new Map(); // serverId -> { stop, buf }
let pollTimer = null;

// Docker prepends this RFC3339(Nano) receive time to each line when
// `timestamps: true` — the authoritative event time, independent of the
// container's TZ. (nanoseconds trimmed to ms for JS Date.)
const DOCKER_TS_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s([\s\S]*)$/;

/** Split a Docker-timestamped line into { ts: ISO|null, rest: line }. */
function splitDockerTimestamp(line) {
  const m = DOCKER_TS_RE.exec(line);
  if (!m) return { ts: null, rest: line };
  const iso = m[1].replace(/(\.\d{3})\d*Z$/, '$1Z'); // trim ns → ms
  const d = new Date(iso);
  return { ts: Number.isNaN(d.getTime()) ? null : d.toISOString(), rest: m[2] };
}

/**
 * Fallback timestamp from the log line's HH:MM:SS when Docker's timestamp is
 * absent: today's date + time; a result more than a minute in the future means
 * the line is from yesterday. Used only for lines with no Docker prefix.
 */
function buildTs(hms, now = new Date()) {
  if (!hms) return now.toISOString();
  const [h, m, s] = hms.split(':').map(Number);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, s));
  if (d.getTime() - now.getTime() > 60_000) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

function openSession(serverId, player, ts) {
  // A dangling open session means we missed the leave — close it at the new join.
  db.run(
    'UPDATE player_sessions SET ended_at = ? WHERE server_id = ? AND player = ? AND ended_at IS NULL',
    ts,
    serverId,
    player
  );
  db.run(
    'INSERT OR IGNORE INTO player_sessions (server_id, player, started_at) VALUES (?, ?, ?)',
    serverId,
    player,
    ts
  );
}

function closeSession(serverId, player, ts) {
  db.run(
    'UPDATE player_sessions SET ended_at = ? WHERE server_id = ? AND player = ? AND ended_at IS NULL',
    ts,
    serverId,
    player
  );
}

/** Close every open session for a server (server stopped / log tap ended). */
function closeAllSessions(serverId, ts = new Date().toISOString()) {
  db.run('UPDATE player_sessions SET ended_at = ? WHERE server_id = ? AND ended_at IS NULL', ts, serverId);
}

/**
 * Insert one classified event. Collapses paired join/leave variants that land
 * within DEDUPE_WINDOW_MS of an identical-type event for the same player.
 * @returns {boolean} true when a row was inserted
 */
function insertEvent(serverId, evt, ts, raw, { sessions = true } = {}) {
  if (evt.type === 'join' || evt.type === 'leave') {
    const prev = db.get(
      'SELECT ts, type, target FROM player_events WHERE server_id = ? AND player = ? ORDER BY id DESC LIMIT 1',
      serverId,
      evt.player
    );
    if (prev && prev.type === evt.type && Math.abs(Date.parse(prev.ts) - Date.parse(ts)) <= DEDUPE_WINDOW_MS) {
      return false;
    }
  }
  db.run(
    'INSERT INTO player_events (server_id, ts, type, player, target, message, raw) VALUES (?, ?, ?, ?, ?, ?, ?)',
    serverId,
    ts,
    evt.type,
    evt.player,
    evt.target,
    evt.message,
    raw
  );
  if (sessions) {
    if (evt.type === 'join') openSession(serverId, evt.player, ts);
    else if (evt.type === 'leave') closeSession(serverId, evt.player, ts);
  }
  return true;
}

function handleLine(serverId, line) {
  const { ts: dockerTs, rest } = splitDockerTimestamp(line.replace(/\r$/, ''));
  const raw = rest;
  const evt = classify(raw);
  if (!evt) return;
  try {
    insertEvent(serverId, evt, dockerTs || buildTs(evt.time), raw);
  } catch (err) {
    console.error(`[analytics] insert failed for ${serverId}:`, err.message);
  }
  // Custom chat commands (!rtp2 …): fire-and-forget — a broken command handler
  // must never break log ingestion. Lazy require avoids any module cycle.
  if (evt.type === 'chat' && evt.player !== '[Server]') {
    try {
      require('../services/chatCommands')
        .handleChat(serverId, evt.player, evt.message)
        .catch((err) => console.error(`[chat-commands] ${serverId}:`, err.message));
    } catch (err) {
      console.error(`[chat-commands] ${serverId}:`, err.message);
    }
  }
}

async function attach(serverId) {
  // timestamps:true so each line carries Docker's authoritative UTC receive
  // time — TZ-independent, unlike the container's bare HH:MM:SS console prefix.
  const { stream, stop } = await followLogs(serverId, { tail: 0, timestamps: true });
  const tap = { stop, buf: '' };
  taps.set(serverId, tap);
  stream.on('data', (chunk) => {
    tap.buf += chunk.toString('utf8');
    let nl;
    while ((nl = tap.buf.indexOf('\n')) !== -1) {
      const line = tap.buf.slice(0, nl);
      tap.buf = tap.buf.slice(nl + 1);
      if (line.trim()) handleLine(serverId, line);
    }
  });
  const cleanup = () => {
    if (taps.get(serverId) !== tap) return;
    taps.delete(serverId);
    closeAllSessions(serverId);
  };
  stream.on('end', cleanup);
  stream.on('close', cleanup);
  stream.on('error', cleanup);
}

let syncing = false;

/** Attach taps to running servers, drop taps for stopped ones. */
async function syncTaps() {
  // Re-entrancy guard: a slow attach() can outlive the 60s poll interval and
  // a second concurrent sync would double-attach taps (duplicate events,
  // leaked streams).
  if (syncing) return;
  syncing = true;
  try {
    const running = new Set(
      serversService
        .listServers()
        .filter((s) => RUNNING.has(s.status))
        .map((s) => s.id)
    );
    for (const [id, tap] of taps) {
      if (!running.has(id)) tap.stop(); // stream end handler does the cleanup
    }
    for (const id of running) {
      if (!taps.has(id)) {
        await attach(id).catch((err) => console.error(`[analytics] tap ${id} failed:`, err.message));
      }
    }
  } finally {
    syncing = false;
  }
}

/** Start live ingestion; re-syncs taps every 60 s as servers start/stop. */
async function startIngest() {
  await syncTaps().catch((err) => console.error('[analytics] initial tap sync failed:', err.message));
  pollTimer = setInterval(() => syncTaps().catch(() => {}), 60_000);
  if (pollTimer.unref) pollTimer.unref();
}

function stopIngest() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  for (const tap of taps.values()) tap.stop();
}

/**
 * One-shot backfill from the container's recent log buffer. Skips lines older
 * than the newest recorded event and exact raw duplicates at the same second.
 * Sessions are not touched — replayed historical joins would reopen them.
 */
async function backfillFromLogs(serverId, { tail = 5000 } = {}) {
  const raw = await fetchLogs(serverId, { tail, timestamps: true });
  const newest = db.get('SELECT ts FROM player_events WHERE server_id = ? ORDER BY ts DESC LIMIT 1', serverId);
  const now = new Date();
  let inserted = 0;
  for (const rawLine of raw.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const { ts: dockerTs, rest: line } = splitDockerTimestamp(rawLine);
    const evt = classify(line);
    if (!evt) continue;
    const ts = dockerTs || buildTs(evt.time, now);
    if (newest && ts < newest.ts) continue;
    if (db.get('SELECT 1 FROM player_events WHERE server_id = ? AND ts = ? AND raw = ?', serverId, ts, line)) continue;
    if (insertEvent(serverId, evt, ts, line, { sessions: false })) inserted++;
  }
  return { inserted };
}

/** Prune old timeline rows and closed sessions. Returns deleted counts. */
function pruneOlderThan(days) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const events = Number(db.run('DELETE FROM player_events WHERE ts < ?', cutoff).changes);
  const sessions = Number(
    db.run('DELETE FROM player_sessions WHERE ended_at IS NOT NULL AND ended_at < ?', cutoff).changes
  );
  return { events, sessions };
}

module.exports = {
  startIngest,
  stopIngest,
  backfillFromLogs,
  pruneOlderThan,
  buildTs,
  splitDockerTimestamp,
  closeAllSessions,
};
