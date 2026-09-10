'use strict';

// Player-event ingestion: live log taps on every running server plus a
// one-shot backfill from the container's recent log buffer. Every classified
// line becomes a player_events row; join/leave events also maintain
// player_sessions.

const path = require('node:path');
const db = require('../db');
const serversService = require('../services/servers');
const { followLogs, fetchLogs } = require('../docker/logs');
const { classify } = require('./logClassifier');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');
const { makeFailureThrottle } = require('../logger');

const syncThrottle = makeFailureThrottle();

// 'stalled' (starting far longer than expected, no 'Done (' yet) is still a
// live container - keep its log tap attached so join/leave events don't go
// unrecorded for the duration of the stall (see liveCache.js's sync()).
const RUNNING = new Set(['running', 'starting', 'unhealthy', 'stalled']);
const DEDUPE_WINDOW_MS = 5000; // paired lines (logged-in/joined, lost-connection/left)

const taps = new Map(); // serverId -> { stop }
let pollTimer = null;

// Docker prepends this RFC3339(Nano) receive time to each line when
// `timestamps: true` - the authoritative event time, independent of the
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
  // A dangling open session means we missed the leave - close it at the new join.
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
  const eventTs = dockerTs || buildTs(evt.time);
  let inserted = false;
  try {
    inserted = insertEvent(serverId, evt, eventTs, raw);
  } catch (err) {
    logger.error('Inserting a player event failed.', { serverId, err: serializeError(err, { includeStack: false }) });
  }
  if (inserted && (evt.type === 'join' || evt.type === 'leave')) {
    const onPresenceError = (err) =>
      logger.warn('Forwarding a presence event to the chatbot failed.', {
        serverId,
        err: serializeError(err, { includeStack: false }),
      });
    try {
      const wizard = require('../services/wizard');
      if (evt.type === 'join') {
        wizard.handleJoin(serverId, evt.player, eventTs).catch(onPresenceError);
      } else {
        wizard.handleLeave(serverId, evt.player);
      }
    } catch (err) {
      onPresenceError(err);
    }
  }
  // Custom chat commands (!rtp2 …): fire-and-forget - a broken command handler
  // must never break log ingestion. Lazy require avoids any module cycle.
  if (evt.type === 'chat' && evt.player !== '[Server]') {
    const onChatCmdError = (err) =>
      logger.warn('A custom chat command handler failed.', {
        serverId,
        err: serializeError(err, { includeStack: false }),
      });
    try {
      require('../services/chatCommands').handleChat(serverId, evt.player, evt.message).catch(onChatCmdError);
    } catch (err) {
      onChatCmdError(err);
    }
    const onWizardError = (err) =>
      logger.warn('The chatbot chat handler failed.', {
        serverId,
        err: serializeError(err, { includeStack: false }),
      });
    try {
      require('../services/wizard').handleChat(serverId, evt.player, evt.message).catch(onWizardError);
    } catch (err) {
      onWizardError(err);
    }
  }
}

async function attach(serverId) {
  // timestamps:true so each line carries Docker's authoritative UTC receive
  // time - TZ-independent, unlike the container's bare HH:MM:SS console prefix.
  const { stream, stop } = await followLogs(serverId, { tail: 0, timestamps: true });
  let buf = Buffer.alloc(0);
  const tap = { stop };
  taps.set(serverId, tap);
  stream.on('data', (chunk) => {
    // Accumulate raw bytes and only split on newlines. Decoding each chunk with
    // toString('utf8') alone would corrupt a multi-byte UTF-8 sequence split
    // across chunks (a player name with non-ASCII letters), so keep the bytes
    // whole and decode line-by-line once a boundary is found.
    buf = Buffer.concat([buf, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    let nl;
    while ((nl = buf.indexOf(0x0a)) !== -1) {
      const line = buf.subarray(0, nl).toString('utf8');
      buf = buf.subarray(nl + 1);
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
        await attach(id).catch((err) =>
          logger.warn('Attaching a log tap failed.', {
            serverId: id,
            err: serializeError(err, { includeStack: false }),
          })
        );
      }
    }
    syncThrottle.ok(logger.info, 'The analytics tap sync recovered.');
  } finally {
    syncing = false;
  }
}

/** Start live ingestion; re-syncs taps every 60 s as servers start/stop. */
async function startIngest() {
  const onSyncFailed = (err) =>
    syncThrottle.fail(logger.warn, 'An analytics tap sync failed.', {
      err: serializeError(err, { includeStack: false }),
    });
  await syncTaps().catch(onSyncFailed);
  pollTimer = setInterval(() => syncTaps().catch(onSyncFailed), 60_000);
  if (pollTimer.unref) pollTimer.unref();
}

function stopIngest() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  // Don't rely solely on each stream's end/close firing cleanup: stop the raw
  // handles AND close any sessions still open (ingest is stopping, so a
  // dangling open session would never see its leave event). `stop()` destroys
  // the underlying stream, whose end/close handler deletes each tap; iterate a
  // snapshot of the ids so late cleanup can't invalidate the loop.
  const ids = [...taps.keys()];
  for (const tap of taps.values()) tap.stop();
  for (const id of ids) closeAllSessions(id);
}

/**
 * One-shot backfill from the container's recent log buffer. Skips lines older
 * than the newest recorded event and exact raw duplicates at the same second.
 * Sessions are not touched - replayed historical joins would reopen them.
 */
async function backfillFromLogs(serverId, { tail = 5000 } = {}) {
  const raw = await fetchLogs(serverId, { tail, timestamps: true });
  const newest = db.get('SELECT ts FROM player_events WHERE server_id = ? ORDER BY ts DESC LIMIT 1', serverId);
  // Load the server's existing event keys once so the per-line dedupe check is a
  // Set membership, not a SELECT-per-line across a multi-thousand-line backfill.
  // Lines older than the newest recorded event are skipped below, so only rows
  // at or after that timestamp can ever collide - no need to load the whole
  // retention window (hundreds of thousands of rows on a busy server).
  const seen = new Set(
    (newest
      ? db.all('SELECT ts, raw FROM player_events WHERE server_id = ? AND ts >= ?', serverId, newest.ts)
      : []
    ).map((r) => `${r.ts}\u0000${r.raw}`)
  );
  const now = new Date();
  let inserted = 0;
  for (const rawLine of raw.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const { ts: dockerTs, rest: line } = splitDockerTimestamp(rawLine);
    const evt = classify(line);
    if (!evt) continue;
    const ts = dockerTs || buildTs(evt.time, now);
    if (newest && ts < newest.ts) continue;
    const key = `${ts}\u0000${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
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
