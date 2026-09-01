'use strict';

// Crash-report service: watches each server's crash-reports/ dir (plus JVM
// hs_err_pid*.log files in the server root), indexes new reports in SQLite
// with a parsed one-line summary + suspected mods, and links each to a
// history event. All filesystem access goes through pathGuard.

const fs = require('node:fs');
const fsp = fs.promises;
const { nanoid } = require('nanoid');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const logger = require('../logger')('crashes');
const { serializeError } = require('../utils/logSanitize');
const { makeFailureThrottle } = require('../logger');

const scanAllThrottle = makeFailureThrottle();

// Package roots that never identify a mod (JDK, Minecraft, common libraries).
const BORING_ROOTS = [
  'java.',
  'jdk.',
  'sun.',
  'javax.',
  'net.minecraft.',
  'com.mojang.',
  'io.netty.',
  'org.apache.',
  'com.google.',
  'org.spongepowered.',
  'cpw.mods.',
  'net.minecraftforge.',
  'net.neoforged.',
  'net.fabricmc.',
  'org.quiltmc.',
  'org.slf4j.',
  'org.lwjgl.',
  'it.unimi.',
  'org.joml.',
  'kotlin.',
  'scala.',
];

function absPathFor(serverId, filename) {
  // hs_err files live in the server root; crash reports in crash-reports/.
  return filename.startsWith('hs_err')
    ? dataPath('servers', serverId, filename)
    : dataPath('servers', serverId, 'crash-reports', filename);
}

/** Parse a Minecraft crash report into { description, exception, summary, suspects }. */
function parseCrashReport(text) {
  const lines = text.split(/\r?\n/);

  let description = '';
  let exception = '';
  let descIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^Description:\s*(.+)$/.exec(lines[i]);
    if (m) {
      description = m[1].trim();
      descIdx = i;
      break;
    }
  }
  // The exception is the first non-indented, non-empty line after the
  // Description block (the "// joke" line and Time:/Description: header
  // precede it; the stacktrace follows it, indented).
  if (descIdx !== -1) {
    for (let i = descIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      if (/^\s/.test(line)) break; // hit indented content without an exception line
      exception = line.trim();
      break;
    }
  } else {
    // No Description header - fall back to the first line that looks like a throwable.
    const m = lines.find((l) => /^[a-zA-Z_$][\w.$]*(Exception|Error)(:|$)/.test(l));
    if (m) exception = m.trim();
  }

  const suspects = new Set();

  // Mod-loader-provided suspect list (Forge/NeoForge "-- Suspected Mod --"
  // section, or a "Suspected Mods:" line in system details).
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const inlineList = /^\s*Suspected Mods?:\s*(.+)$/.exec(line);
    if (inlineList && inlineList[1].trim().toLowerCase() !== 'none') {
      collectSuspectNames(inlineList[1], suspects);
      continue;
    }
    if (/^--\s*Suspected Mods?\s*--$/.test(line.trim())) {
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (/^--\s.+\s--$/.test(l.trim())) break; // next section
        if (!l.trim()) continue;
        if (/^\s*(Details:\s*$|Mod File:|Stacktrace:|Failure message:|Version:)/i.test(l)) continue;
        // "Mod: NameOfMod (modid), Version: x" - drop the label before parsing.
        collectSuspectNames(l.replace(/^\s*Mods?:\s*/i, ''), suspects);
      }
    }
  }

  // Heuristic: scan the first 40 stack frames for non-vanilla package roots
  // and add the 2nd package segment (e.g. com.simibubi.create -> simibubi).
  let frames = 0;
  for (const line of lines) {
    const m = /^\s+at\s+([\w.$]+)/.exec(line);
    if (!m) continue;
    if (++frames > 40) break;
    const cls = m[1];
    if (BORING_ROOTS.some((root) => cls.startsWith(root))) continue;
    const parts = cls.split('.');
    if (parts.length >= 3) suspects.add(parts[1]);
  }

  const summary = exception ? exception + (description ? ` - ${description}` : '') : description || 'Crash report';
  return { description, exception, summary, suspects: [...suspects] };
}

function collectSuspectNames(line, suspects) {
  // "NameOfMod (modid), Version: x" - prefer the modid in parentheses.
  const paren = /\(([\w-]+)\)/.exec(line);
  if (paren) {
    suspects.add(paren[1]);
    return;
  }
  const name = line.trim().split(',')[0].trim();
  if (name && name.length <= 64) suspects.add(name);
}

/** Parse a JVM fatal error log (hs_err_pid*.log). */
function parseHsErr(text) {
  const lines = text.split(/\r?\n/).slice(0, 40);
  let problem = '';
  for (const line of lines) {
    const m = /^#\s+(\S.*)$/.exec(line);
    if (!m) continue;
    const body = m[1].trim();
    if (
      /fatal error has been detected|Java Runtime Environment|please submit|bug report|http|see problematic frame|if you would like/i.test(
        body
      )
    )
      continue;
    problem = body;
    break;
  }
  return {
    description: '',
    exception: 'JVM fatal error',
    summary: 'JVM fatal error' + (problem ? ` - ${problem}` : ''),
    suspects: [],
  };
}

async function listCandidateFiles(serverId) {
  const out = [];
  const crashDir = dataPath('servers', serverId, 'crash-reports');
  const rootDir = dataPath('servers', serverId);
  try {
    for (const name of await fsp.readdir(crashDir)) {
      if (name.endsWith('.txt')) out.push(name);
    }
  } catch {
    /* no crash-reports dir yet */
  }
  try {
    for (const name of await fsp.readdir(rootDir)) {
      if (/^hs_err_pid.*\.log$/.test(name)) out.push(name);
    }
  } catch {
    /* server dir missing */
  }
  return out;
}

/** Scan one server for crash files not yet indexed; parse + insert + record event. */
async function scanServer(serverId) {
  const inserted = [];
  for (const filename of await listCandidateFiles(serverId)) {
    if (db.get('SELECT id FROM crash_reports WHERE server_id = ? AND filename = ?', serverId, filename)) continue;

    const abs = absPathFor(serverId, filename);
    let stat, text;
    try {
      stat = await fsp.stat(abs);
      text = await fsp.readFile(abs, 'utf8');
    } catch {
      continue;
    } // deleted between readdir and read

    const parsed = filename.startsWith('hs_err') ? parseHsErr(text) : parseCrashReport(text);
    const id = `cr_${nanoid(8)}`;
    db.run(
      `INSERT INTO crash_reports (id, server_id, filename, file_mtime, size_bytes, summary, exception, suspected_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      serverId,
      filename,
      stat.mtime.toISOString(),
      stat.size,
      parsed.summary,
      parsed.exception,
      JSON.stringify(parsed.suspects)
    );
    const eventId = recordEvent({
      serverId,
      type: 'crash-report',
      actor: 'system',
      summary: `New crash report: ${filename} - ${parsed.exception || parsed.summary}`,
      details: { crashId: id },
    });
    db.run('UPDATE crash_reports SET event_id = ? WHERE id = ?', eventId, id);
    logger.warn('Indexed a new crash report.', {
      serverId,
      crashId: id,
      filename,
      exception: parsed.exception || undefined,
    });
    inserted.push(id);
  }
  return inserted;
}

/** Scan every (non-deleted) server; per-server errors are swallowed. */
let scanning = false;
async function scanAll() {
  if (scanning) return; // a slow scan must not overlap the next interval tick
  scanning = true;
  try {
    const { listServers } = require('../services/servers'); // lazy: avoid require cycles
    for (const server of listServers()) {
      try {
        await scanServer(server.id);
      } catch (err) {
        logger.warn('Scanning a server for crash reports failed.', {
          serverId: server.id,
          err: serializeError(err, { includeStack: false }),
        });
      }
    }
    scanAllThrottle.ok(logger.info, 'The crash-report scan recovered.');
  } finally {
    scanning = false;
  }
}

let watcherTimer = null;

/** Start the background watcher (immediate scan + interval). Returns stop(). */
function startCrashWatcher({ intervalMs = 30000 } = {}) {
  stopCrashWatcher();
  const onScanAllFailed = (err) =>
    scanAllThrottle.fail(logger.warn, 'A crash-report scan pass failed.', {
      err: serializeError(err, { includeStack: false }),
    });
  scanAll().catch(onScanAllFailed);
  watcherTimer = setInterval(() => {
    scanAll().catch(onScanAllFailed);
  }, intervalMs);
  watcherTimer.unref();
  return stopCrashWatcher;
}

function stopCrashWatcher() {
  if (watcherTimer) {
    clearInterval(watcherTimer);
    watcherTimer = null;
  }
}

function listCrashes(serverId) {
  return db
    .all('SELECT * FROM crash_reports WHERE server_id = ? ORDER BY file_mtime DESC', serverId)
    .map((row) => ({ ...row, suspected: JSON.parse(row.suspected_json || '[]') }));
}

function getCrash(crashId) {
  const row = db.get('SELECT * FROM crash_reports WHERE id = ?', crashId);
  return row ? { ...row, suspected: JSON.parse(row.suspected_json || '[]') } : null;
}

/** Read a report's full text. The filename MUST be one indexed for this server. */
function getCrashText(serverId, filename) {
  const row = db.get('SELECT id FROM crash_reports WHERE server_id = ? AND filename = ?', serverId, filename);
  if (!row) {
    const err = new Error('Crash report not found');
    err.status = 404;
    throw err;
  }
  return fs.readFileSync(absPathFor(serverId, filename), 'utf8');
}

function markViewed(crashId) {
  db.run('UPDATE crash_reports SET viewed = 1 WHERE id = ?', crashId);
}

/**
 * Share a crash report to mclo.gs. Publishes the report text on the public
 * internet, so this only ever runs from an explicit user action; a report
 * already shared returns its existing paste instead of re-uploading.
 */
async function shareCrash(crashId, { actor = 'system' } = {}) {
  const row = getCrash(crashId);
  if (!row) {
    const err = new Error('Crash report not found');
    err.status = 404;
    throw err;
  }
  if (row.mclogs_url) return { id: row.mclogs_id, url: row.mclogs_url, alreadyShared: true };
  const text = fs.readFileSync(absPathFor(row.server_id, row.filename), 'utf8');
  const paste = await require('../integrations/mclogs').uploadLog(text);
  db.run('UPDATE crash_reports SET mclogs_id = ?, mclogs_url = ? WHERE id = ?', paste.id, paste.url, crashId);
  recordEvent({
    serverId: row.server_id,
    actor,
    type: 'crash-shared',
    summary: `Crash report ${row.filename} shared to mclo.gs: ${paste.url}`,
    details: { crashId, pasteUrl: paste.url },
  });
  logger.info('Shared a crash report to mclo.gs.', { serverId: row.server_id, crashId, actor });
  return { id: paste.id, url: paste.url, alreadyShared: false };
}

/**
 * mclo.gs's automated analysis of a crash report (known problems + suggested
 * solutions). Shares the report first when it isn't yet - the analysis runs
 * on an mclo.gs paste, so "analyze" implies "publish"; the UI says so.
 */
async function crashInsights(crashId, { actor = 'system' } = {}) {
  const row = getCrash(crashId);
  if (!row) {
    const err = new Error('Crash report not found');
    err.status = 404;
    throw err;
  }
  const share = row.mclogs_id ? { id: row.mclogs_id, url: row.mclogs_url } : await shareCrash(crashId, { actor });
  const insights = await require('../integrations/mclogs').getInsights(share.id);
  return { ...insights, url: share.url };
}

/** Delete a report: unlink the file + remove the row + record the event. */
function deleteCrash(crashId, { actor = 'system' } = {}) {
  const row = getCrash(crashId);
  if (!row) {
    const err = new Error('Crash report not found');
    err.status = 404;
    throw err;
  }
  try {
    fs.unlinkSync(absPathFor(row.server_id, row.filename));
  } catch {
    /* file already gone - still drop the row */
  }
  db.run('DELETE FROM crash_reports WHERE id = ?', crashId);
  recordEvent({
    serverId: row.server_id,
    type: 'crash-report-deleted',
    actor,
    summary: `Deleted crash report: ${row.filename}`,
    details: { crashId, filename: row.filename, freedBytes: row.size_bytes },
  });
  return { freedBytes: row.size_bytes };
}

/** Bulk cleanup: delete this server's reports older than `days`. */
function deleteOlderThan(serverId, days, { actor = 'system' } = {}) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const rows = db.all('SELECT id FROM crash_reports WHERE server_id = ? AND file_mtime < ?', serverId, cutoff);
  let freedBytes = 0;
  for (const { id } of rows) {
    freedBytes += deleteCrash(id, { actor }).freedBytes;
  }
  return { deleted: rows.length, freedBytes };
}

module.exports = {
  scanServer,
  scanAll,
  startCrashWatcher,
  stopCrashWatcher,
  listCrashes,
  getCrash,
  getCrashText,
  markViewed,
  shareCrash,
  crashInsights,
  deleteCrash,
  deleteOlderThan,
};
