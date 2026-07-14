// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Shared file library: downloads deduplicated by sha256 under
// ./data/library/<kind>/, installed into servers by hard link (falls back to
// copy across volumes), with locally cached icons.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { nanoid } = require('nanoid');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const { safeFetch } = require('../utils/urlGuard');

const CATEGORY_DIR = {
  mod: 'library/mods',
  plugin: 'library/mods', // same pool — kind recorded per row
  datapack: 'library/mods',
  resourcepack: 'library/mods',
  modpack: 'library/modpacks',
  world: 'library/worlds',
  icon: 'library/icons',
};

// No single library download may exceed this — a lying/hostile server can't
// fill the disk through an endless stream.
const MAX_DOWNLOAD_BYTES = 8 * 1024 ** 3;

/**
 * Download a URL into the library with hash dedupe.
 * onProgress({receivedBytes, totalBytes}) fires during download.
 * Returns the library_files row (existing row when the hash already exists).
 */
async function downloadToLibrary(url, meta, { onProgress = () => {}, actor = 'system' } = {}) {
  const category = meta.category || 'mod';
  const tmpFile = dataPath('tmp', `dl-${nanoid(6)}`);
  // SSRF-guarded: rejects private/loopback/link-local targets and re-checks every
  // redirect hop, so a user-supplied "direct" URL can't reach internal services.
  const res = await safeFetch(url, {
    headers: { 'User-Agent': 'MinecraftServerManager/0.1' },
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!res.ok) throw httpError(502, `Download failed: HTTP ${res.status} from ${new URL(url).host}`);
  const totalBytes = Number(res.headers.get('content-length')) || 0;

  // Disk preflight when the server declares a size (tmp copy + final copy).
  if (totalBytes > 0) {
    if (totalBytes > MAX_DOWNLOAD_BYTES) {
      throw httpError(
        413,
        `Download is ${humanBytes(totalBytes)} — the ${humanBytes(MAX_DOWNLOAD_BYTES)} per-file limit blocks it`
      );
    }
    const { free } = await require('../storage/indexer').diskFree();
    if (free < totalBytes * 1.2) {
      throw httpError(507, `Not enough disk space for this download (~${humanBytes(totalBytes)} needed)`);
    }
  }

  const hash = crypto.createHash('sha256');
  let receivedBytes = 0;
  const counter = new (require('node:stream').Transform)({
    transform(chunk, enc, cb) {
      hash.update(chunk);
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_DOWNLOAD_BYTES) {
        // Hard abort — content-length can lie or be absent entirely.
        return cb(
          httpError(413, `Download aborted: stream exceeded the ${humanBytes(MAX_DOWNLOAD_BYTES)} per-file limit`)
        );
      }
      onProgress({ receivedBytes, totalBytes });
      cb(null, chunk);
    },
  });
  try {
    await pipeline(res.body, counter, fs.createWriteStream(tmpFile));
  } catch (err) {
    await fsp.rm(tmpFile, { force: true }).catch(() => {});
    throw err;
  }

  const sha256 = hash.digest('hex');
  const existing = db.get('SELECT * FROM library_files WHERE sha256 = ? AND category = ?', sha256, category);
  if (existing) {
    await fsp.rm(tmpFile, { force: true });
    return existing;
  }

  const filename = sanitizeFilename(
    meta.filename || decodeURIComponent(path.basename(new URL(url).pathname)) || `file-${sha256.slice(0, 8)}`
  );
  const relPath = `${CATEGORY_DIR[category]}/${sha256.slice(0, 8)}-${filename}`;
  await fsp.mkdir(path.dirname(dataPath(relPath)), { recursive: true });
  await fsp.rename(tmpFile, dataPath(relPath));
  const size = (await fsp.stat(dataPath(relPath))).size;

  const id = `lib_${nanoid(8)}`;
  // ON CONFLICT closes the check-then-insert race: if a concurrent add for the same
  // (sha256, category) won, our INSERT no-ops (relPath is derived from the sha, so
  // both point at the identical file — nothing to clean up) and we return theirs.
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, source_url,
       platform, project_id, file_id, version, mc_versions_json, loaders_json, icon_url, world_source, world_flavor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sha256, category) DO NOTHING`,
    id,
    category,
    meta.name || filename,
    filename,
    relPath,
    sha256,
    size,
    url,
    meta.platform || 'url',
    meta.projectId || null,
    meta.fileId || null,
    meta.version || null,
    JSON.stringify(meta.mcVersions || []),
    JSON.stringify(meta.loaders || []),
    meta.iconUrl || null,
    meta.worldSource || null,
    meta.worldFlavor || null
  );
  const row = db.get('SELECT * FROM library_files WHERE sha256 = ? AND category = ?', sha256, category);
  if (row && row.id === id) {
    // We won the insert — do the one-time side effects.
    if (meta.iconUrl) cacheIcon(id, meta.iconUrl).catch(() => {});
    recordEvent({
      actor,
      type: 'library-added',
      summary: `Added to library: ${meta.name || filename} (${humanBytes(size)})`,
      details: { id, category, sha256 },
    });
  }
  return row;
}

/** Cache a mod's platform icon locally so the UI never hotlinks. */
async function cacheIcon(libraryId, iconUrl) {
  try {
    const res = await safeFetch(iconUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return;
    const ext = path.extname(new URL(iconUrl).pathname) || '.png';
    const rel = `library/icons/mods/${libraryId}${ext}`;
    await fsp.mkdir(path.dirname(dataPath(rel)), { recursive: true });
    await pipeline(res.body, fs.createWriteStream(dataPath(rel)));
    db.run('UPDATE library_files SET icon_rel_path = ? WHERE id = ?', rel, libraryId);
  } catch {
    /* icons are best-effort */
  }
}

/**
 * Install a library file into a server directory (hard link → copy fallback).
 * destRel example: 'mods' | 'plugins' | 'world/datapacks'.
 */
async function installToServer(libraryId, serverId, destRel, { filename } = {}) {
  const lib = db.get('SELECT * FROM library_files WHERE id = ?', libraryId);
  if (!lib) throw httpError(404, 'Library file not found');
  // The panel must own the server dir to write into it — a server created before
  // container-runs-as-panel-user has files owned by uid 1000. Lazy require breaks
  // the servers<->library cycle.
  await require('./servers').ensureOwnership(serverId);
  const destDir = dataPath('servers', serverId, destRel);
  await fsp.mkdir(destDir, { recursive: true });
  const target = path.join(destDir, sanitizeFilename(filename || lib.filename));
  await fsp.rm(target, { force: true });
  try {
    await fsp.link(dataPath(lib.rel_path), target);
  } catch {
    await fsp.copyFile(dataPath(lib.rel_path), target);
  }
  return { installedPath: target, filename: path.basename(target) };
}

function usageCount(libraryId) {
  return db.get('SELECT COUNT(*) AS n FROM server_content WHERE library_id = ?', libraryId)?.n || 0;
}

async function deleteLibraryFile(libraryId, { actor = 'system', force = false } = {}) {
  const lib = db.get('SELECT * FROM library_files WHERE id = ?', libraryId);
  if (!lib) return { freedBytes: 0 };
  const used = usageCount(libraryId);
  if (used > 0 && !force) throw httpError(409, `Still installed on ${used} server(s) — remove it there first`);
  await fsp.rm(dataPath(lib.rel_path), { force: true });
  if (lib.icon_rel_path) await fsp.rm(dataPath(lib.icon_rel_path), { force: true });
  db.run('DELETE FROM library_files WHERE id = ?', libraryId);
  recordEvent({
    actor,
    type: 'library-deleted',
    summary: `Removed from library: ${lib.name} (${humanBytes(lib.size_bytes)} freed)`,
  });
  return { freedBytes: lib.size_bytes };
}

/** Library rows whose files no other record references — cleanup candidates. */
function orphans() {
  return db.all(
    `SELECT lf.* FROM library_files lf
     LEFT JOIN server_content sc ON sc.library_id = lf.id
     WHERE sc.id IS NULL AND lf.category IN ('mod','plugin','datapack','resourcepack')`
  );
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|\0]/g, '_').slice(0, 180);
}

function humanBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

module.exports = {
  downloadToLibrary,
  installToServer,
  deleteLibraryFile,
  cacheIcon,
  usageCount,
  orphans,
  CATEGORY_DIR,
};
