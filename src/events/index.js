'use strict';

// Action-history service. Every panel feature routes its notable actions
// through recordEvent() so history can never drift out of sync with behavior.

const fsp = require('node:fs/promises');
const path = require('node:path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const logger = require('../logger')('events');

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
// The Activity page renders a type filter built from `SELECT DISTINCT type` on
// every load. The set of distinct types is tiny and only grows, so cache it and
// only invalidate when recordEvent() writes a genuinely new one.
let distinctTypes = null;
function knownTypes() {
  if (!distinctTypes) {
    distinctTypes = db.all('SELECT DISTINCT type FROM events ORDER BY type').map((r) => r.type);
  }
  return distinctTypes;
}

function recordEvent({ serverId = null, actor = 'system', type, summary, details = {}, logExcerpt = null }) {
  if (distinctTypes && type && !distinctTypes.includes(type)) distinctTypes = null; // a new type - rebuild on next read
  let excerptRel = null;
  if (logExcerpt) {
    // nanoid suffix: two events of the same type in the same millisecond must
    // not overwrite each other's captured logs.
    excerptRel = path.posix.join('logs', serverId || '_panel', 'events', `${Date.now()}-${type}-${nanoid(4)}.log`);
    const abs = dataPath(excerptRel);
    // Cap captures at 256 KB so a runaway log can't flood the data dir.
    const content = logExcerpt.slice(-256 * 1024);
    // Write the excerpt off the event loop - these can be sizable (256 KB) and
    // recordEvent runs on hot paths (docker watcher, backups). Fire-and-forget:
    // the DB row already records the path, and excerpt reads happen later from
    // the Activity page, so a transient in-flight gap is not user-visible.
    fsp
      .mkdir(path.dirname(abs), { recursive: true })
      .then(() => fsp.writeFile(abs, content))
      .catch((err) =>
        logger.warn('Failed to persist a captured event log excerpt.', { path: excerptRel, err: err.message })
      );
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

async function readExcerpt(event) {
  if (!event.log_excerpt_path) return null;
  try {
    return await fsp.readFile(dataPath(event.log_excerpt_path), 'utf8');
  } catch {
    return null;
  }
}

function hydrate(row) {
  return { ...row, details: safeParse(row.details_json) };
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
  // Quote for CSV, and defuse spreadsheet formula injection: a cell an
  // authenticated actor can influence (actor names may start with '-' or '.',
  // server names flow into `summary`) must not be interpreted as a formula when
  // the export is opened in Excel/Sheets. Prefix a leading = + - @ tab or CR
  // with a single quote.
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const body = ['id,created_at,server_id,actor,type,summary']
    .concat(rows.map((r) => [r.id, r.created_at, r.server_id || '', r.actor, r.type, r.summary].map(esc).join(',')))
    .join('\r\n');
  return { filename, contentType: 'text/csv', body };
}

// Prune advancement window. One pass against months of history must not
// materialize every row id + excerpt path in memory at once, nor fire thousands
// of fs.rm promises in a single Promise.allSettled, nor hold one giant
// transaction open while those file deletes churn - that was the original
// admin-prune behavior, and it's also how the daily maintenance call would
// behave. Each window deletes its excerpts, deletes its rows, then advances.
const PRUNE_BATCH = 1000;

/** Delete events (and their captured log excerpts) older than `days`. */
async function pruneEvents(days, { actor = 'system' } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  let removedEvents = 0;
  let removedExcerpts = 0;
  // Advance by MAX(id) rather than re-querying created_at each batch so a
  // window can't re-read rows the previous DELETE just removed.
  let floor = 0;
  for (;;) {
    const rows = db.all(
      'SELECT id, log_excerpt_path FROM events WHERE created_at < ? AND id > ? ORDER BY id LIMIT ?',
      cutoff,
      floor,
      PRUNE_BATCH
    );
    if (!rows.length) break;
    for (const row of rows) {
      if (row.log_excerpt_path) {
        removedExcerpts += 1;
        // Excerpts are removed off the event loop - a prune can delete
        // thousands of files under data/logs/<id>/events, and awaiting each
        // rm keeps the memory / in-flight-promise count bounded.
        await fsp.rm(dataPath(row.log_excerpt_path), { force: true }).catch(() => {});
      }
    }
    const qmarks = rows.map(() => '?').join(',');
    db.run(`DELETE FROM events WHERE id IN (${qmarks})`, ...rows.map((r) => r.id));
    removedEvents += rows.length;
    floor = rows[rows.length - 1].id;
  }
  // A prune can remove the last event of a type, so the cached filter list may
  // now offer a type that matches nothing. Drop it; knownTypes() rebuilds lazily.
  distinctTypes = null;
  if (removedEvents) {
    recordEvent({
      actor,
      type: 'events-pruned',
      summary: `Event history pruned: ${removedEvents} event(s) older than ${days} days removed`,
    });
  }
  return { removed: removedEvents, excerpts: removedExcerpts };
}

module.exports = { recordEvent, listEvents, getEvent, readExcerpt, exportEvents, pruneEvents, knownTypes };
