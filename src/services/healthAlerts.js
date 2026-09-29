'use strict';

// The dashboard's "Health · 24h" alerts: crashes, out-of-memory stops and
// auto-restarts from the last day of history. Each user dismisses alerts for
// themselves (alert_dismissals); the underlying events are never touched.

const db = require('../db');
const httpError = require('../utils/httpError');

const HEALTH_TYPES = ['crashed', 'oom', 'auto-restarted'];
const WINDOW = '-1 day';
const LIST_LIMIT = 50;
// A crash report file is written seconds after the container dies; anything
// further from the event than this is a different crash.
const REPORT_MATCH_MS = 5 * 60 * 1000;

const TYPE_PH = HEALTH_TYPES.map(() => '?').join(',');

/** Undismissed health events for `user` on servers they may see, newest first. */
function activeRows(user, visibleIds) {
  return db
    .all(
      `SELECT e.id, e.type, e.summary, e.server_id, e.created_at, e.details_json, e.log_excerpt_path,
              s.display_name AS server
         FROM events e
         LEFT JOIN servers s ON s.id = e.server_id
        WHERE e.type IN (${TYPE_PH})
          AND e.created_at >= datetime('now', ?)
          AND NOT EXISTS (SELECT 1 FROM alert_dismissals d WHERE d.event_id = e.id AND d.user_id = ?)
        ORDER BY e.id DESC`,
      ...HEALTH_TYPES,
      WINDOW,
      user.id
    )
    .filter((r) => !r.server_id || visibleIds.has(r.server_id));
}

function tally(rows) {
  const out = { crashes: 0, oom: 0, autoRestarted: 0 };
  for (const r of rows) {
    if (r.type === 'crashed') out.crashes += 1;
    else if (r.type === 'oom') out.oom += 1;
    else out.autoRestarted += 1;
  }
  return { ...out, total: rows.length };
}

/** Counts per type, for the dashboard card. */
function counts(user, visibleIds) {
  return tally(activeRows(user, visibleIds));
}

function safeParse(json) {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

/** The indexed crash report written closest to a crash event, if any. */
function reportNear(serverId, createdAt) {
  const eventMs = Date.parse(`${createdAt.replace(' ', 'T')}Z`);
  if (Number.isNaN(eventMs)) return null;
  let best = null;
  let bestGap = REPORT_MATCH_MS;
  for (const r of db.all(
    'SELECT id, filename, file_mtime, exception, summary, suspected_json FROM crash_reports WHERE server_id = ?',
    serverId
  )) {
    const gap = Math.abs(Date.parse(r.file_mtime) - eventMs);
    if (gap <= bestGap) {
      best = r;
      bestGap = gap;
    }
  }
  if (!best) return null;
  return {
    id: best.id,
    filename: best.filename,
    exception: best.exception || best.summary || '',
    suspects: parseList(best.suspected_json),
  };
}

function parseList(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** The newest alerts with the detail the modal shows. */
function list(user, visibleIds) {
  const rows = activeRows(user, visibleIds);
  return {
    counts: tally(rows),
    alerts: rows.slice(0, LIST_LIMIT).map((r) => {
      const details = safeParse(r.details_json);
      const crash = r.type === 'crashed';
      return {
        id: r.id,
        type: r.type,
        summary: r.summary,
        serverId: r.server_id,
        server: r.server,
        at: r.created_at,
        ...(crash
          ? {
              exitCode: Number.isFinite(details.exitCode) ? details.exitCode : null,
              willRestart: Boolean(details.armedRestart),
              hasLog: Boolean(r.log_excerpt_path),
              report: r.server_id ? reportNear(r.server_id, r.created_at) : null,
            }
          : {}),
      };
    }),
  };
}

/** Hide one alert for this user. */
function dismiss(user, visibleIds, eventId) {
  const row = db.get(
    `SELECT id, server_id FROM events WHERE id = ? AND type IN (${TYPE_PH})`,
    eventId,
    ...HEALTH_TYPES
  );
  if (!row || (row.server_id && !visibleIds.has(row.server_id))) throw httpError(404, 'That alert no longer exists.');
  db.run('INSERT OR IGNORE INTO alert_dismissals (user_id, event_id) VALUES (?, ?)', user.id, eventId);
}

/** Hide every alert this user can currently see. Returns how many were cleared. */
function clearAll(user, visibleIds) {
  const rows = activeRows(user, visibleIds);
  db.transaction(() => {
    for (const r of rows) {
      db.run('INSERT OR IGNORE INTO alert_dismissals (user_id, event_id) VALUES (?, ?)', user.id, r.id);
    }
  });
  return rows.length;
}

module.exports = { HEALTH_TYPES, counts, list, dismiss, clearAll };
