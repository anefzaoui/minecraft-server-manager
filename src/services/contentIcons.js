'use strict';

// Backfill display metadata (local icon, name, version, MC-version/loader lists)
// for mod/plugin/datapack/resourcepack library rows that never got it - a
// transient fetch failure at install, or a row predating icon caching. Pairs
// with library.ensureContentMeta(), which does the per-row work and is also
// called lazily from the Mods tab render.

const fsp = require('node:fs/promises');
const path = require('node:path');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const library = require('./library');
const logger = require('../logger')(path.basename(__filename));

const CONCURRENCY = 3;

function looksLikeFilename(name, filename) {
  if (!name) return true;
  if (!filename) return false;
  const n = String(name).trim().toLowerCase();
  const f = String(filename).toLowerCase();
  return n === f || n === f.replace(/\.(jar|zip)$/, '');
}

/**
 * @returns {Promise<{scanned:number, repaired:number}>}
 */
async function backfillContentMeta({ limit = 500 } = {}) {
  // Push the cheap, DB-only part of needsRepair() into SQL so we never materialize
  // every library row just to discard it: a row is only a repair candidate if it
  // has a remote icon URL or a registry project to look metadata up against. The
  // rest (existence of the local icon file) needs an fs check, applied below.
  const candidates = db.all(
    `SELECT * FROM library_files
     WHERE category IN ('mod','plugin','datapack','resourcepack')
       AND (icon_url IS NOT NULL AND icon_url != ''
            OR (platform IN ('modrinth', 'curseforge') AND project_id IS NOT NULL AND project_id != ''))
     ORDER BY id
     LIMIT ?`,
    Math.round(limit * 8)
  );
  // Run the fs-dependent half of needsRepair() asynchronously (no sync existsSync
  // on the event loop) and collect at most `limit` repair-worthy rows.
  const needsRepairAsync = async (r) => {
    const registry = (r.platform === 'modrinth' || r.platform === 'curseforge') && r.project_id;
    if (!r.icon_url && !registry) return false;
    let iconMissing = !r.icon_rel_path;
    if (!iconMissing) {
      try {
        await fsp.access(dataPath(r.icon_rel_path));
      } catch {
        iconMissing = true;
      }
    }
    const metaMissing =
      registry && (!r.version || looksLikeFilename(r.name, r.filename) || (r.mc_versions_json || '[]') === '[]');
    return iconMissing || metaMissing;
  };

  const rows = [];
  for (const row of candidates) {
    if (rows.length >= limit) break;
    if (await needsRepairAsync(row)) rows.push(row);
  }

  if (!rows.length) return { scanned: 0, repaired: 0 };

  let repaired = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      const before = `${row.icon_rel_path || ''}|${row.name || ''}|${row.version || ''}`;
      try {
        await library.ensureContentMeta(row);
        const after = db.get('SELECT icon_rel_path, name, version FROM library_files WHERE id = ?', row.id);
        if (after && `${after.icon_rel_path || ''}|${after.name || ''}|${after.version || ''}` !== before) {
          repaired += 1;
        }
      } catch (err) {
        logger.debug('A content-metadata backfill row failed.', { id: row.id, err: String(err && err.message) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  const result = { scanned: rows.length, repaired };
  if (repaired) {
    recordEvent({
      actor: 'system',
      type: 'content-meta-backfilled',
      summary: `Repaired metadata for ${repaired} content file${repaired === 1 ? '' : 's'} (of ${rows.length} checked)`,
    });
  }
  logger.info('Content-metadata backfill finished.', result);
  return result;
}

module.exports = { backfillContentMeta };
