'use strict';

// Action-history service. Every panel feature routes its notable actions
// through recordEvent() so history can never drift out of sync with behavior.

const fs = require('node:fs');
const path = require('node:path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');

/**
 * Record an event.
 * @param {object} e
 * @param {string|null} [e.serverId]  null for panel-global events
 * @param {string} [e.actor]          username | 'system' | 'scheduler'
 * @param {string} e.type             kebab-case event type ('started', 'config-changed', …)
 * @param {string} e.summary          human-readable one-liner
 * @param {object} [e.details]        structured payload (diffs, versions, sizes…)
 * @param {string} [e.logExcerpt]     raw text to persist alongside the event
 * @returns {number} event id
 */
function recordEvent({ serverId = null, actor = 'system', type, summary, details = {}, logExcerpt = null }) {
  let excerptRel = null;
  if (logExcerpt) {
    // nanoid suffix: two events of the same type in the same millisecond must
    // not overwrite each other's captured logs.
    excerptRel = path.posix.join('logs', serverId || '_panel', 'events', `${Date.now()}-${type}-${nanoid(4)}.log`);
    const abs = dataPath(excerptRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    // Cap captures at 256 KB so a runaway log can't flood the data dir.
    fs.writeFileSync(abs, logExcerpt.slice(-256 * 1024));
  }
  const result = db.run(
    `INSERT INTO events (server_id, actor, type, summary, details_json, log_excerpt_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    serverId,
    actor,
    type,
    summary,
    JSON.stringify(details),
    excerptRel
  );
  return Number(result.lastInsertRowid);
}

function listEvents({ serverId = null, type = null, limit = 50, offset = 0 } = {}) {
  const where = [];
  const params = [];
  if (serverId) {
    where.push('server_id = ?');
    params.push(serverId);
  }
  if (type) {
    where.push('type = ?');
    params.push(type);
  }
  const sql = `SELECT * FROM events ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY id DESC LIMIT ? OFFSET ?`;
  return db.all(sql, ...params, limit, offset).map(hydrate);
}

function getEvent(id) {
  const row = db.get('SELECT * FROM events WHERE id = ?', id);
  return row ? hydrate(row) : null;
}

function readExcerpt(event) {
  if (!event.log_excerpt_path) return null;
  try {
    return fs.readFileSync(dataPath(event.log_excerpt_path), 'utf8');
  } catch {
    return null;
  }
}

function hydrate(row) {
  return { ...row, details: JSON.parse(row.details_json || '{}') };
}

function safeParse(json) {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

const EXPORT_LIMIT = 10000;

/**
 * Export events as a downloadable JSON or CSV string.
 * @returns {{ filename: string, contentType: string, body: string }}
 */
function exportEvents(serverId, { format = 'json', q = '', type = '' } = {}) {
  const fmt = format === 'csv' ? 'csv' : 'json';
  const where = [];
  const params = [];
  if (serverId) {
    where.push('server_id = ?');
    params.push(serverId);
  }
  if (type) {
    where.push('type = ?');
    params.push(String(type));
  }
  if (q) {
    where.push('(summary LIKE ? OR actor LIKE ? OR type LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const rows = db.all(
    `SELECT id, created_at, server_id, actor, type, summary, details_json FROM events
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`,
    ...params,
    EXPORT_LIMIT
  );
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `events-${serverId || 'all'}-${stamp}.${fmt}`;
  if (fmt === 'json') {
    const body = JSON.stringify(
      rows.map((r) => ({ ...r, details: safeParse(r.details_json), details_json: undefined })),
      null,
      2
    );
    return { filename, contentType: 'application/json', body };
  }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = ['id,created_at,server_id,actor,type,summary']
    .concat(rows.map((r) => [r.id, r.created_at, r.server_id || '', r.actor, r.type, r.summary].map(esc).join(',')))
    .join('\r\n');
  return { filename, contentType: 'text/csv', body };
}

/** Delete events (and their captured log excerpts) older than `days`. */
function pruneEvents(days, { actor = 'system' } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const rows = db.all('SELECT id, log_excerpt_path FROM events WHERE created_at < ?', cutoff);
  for (const row of rows) {
    if (row.log_excerpt_path) {
      try {
        fs.rmSync(dataPath(row.log_excerpt_path), { force: true });
      } catch {
        /* best-effort */
      }
    }
  }
  db.run('DELETE FROM events WHERE created_at < ?', cutoff);
  recordEvent({
    actor,
    type: 'events-pruned',
    summary: `Event history pruned: ${rows.length} event(s) older than ${days} days removed`,
  });
  return { removed: rows.length };
}

module.exports = { recordEvent, listEvents, getEvent, readExcerpt, exportEvents, pruneEvents };
