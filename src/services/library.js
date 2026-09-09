// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
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
const contentHashes = require('../utils/contentHashes');
const logger = require('../logger')(path.basename(__filename));

const CATEGORY_DIR = {
  mod: 'library/mods',
  plugin: 'library/mods', // same pool - kind recorded per row
  datapack: 'library/mods',
  resourcepack: 'library/mods',
  modpack: 'library/modpacks',
  world: 'library/worlds',
  icon: 'library/icons',
};

// No single library download may exceed this - a lying/hostile server can't
// fill the disk through an endless stream.
const MAX_DOWNLOAD_BYTES = 8 * 1024 ** 3;

/**
 * Download a URL into the library with hash dedupe.
 * onProgress({receivedBytes, totalBytes}) fires during download.
 * When meta.expectedHashes ({sha512?/sha256?/sha1?/md5?} from the registry
 * that published the file) is set, the streamed bytes are verified against the
 * strongest digest and a mismatch aborts the install.
 * Returns the library_files row (existing row when the hash already exists).
 */
async function downloadToLibrary(url, meta, { onProgress = () => {}, actor = 'system' } = {}) {
  const category = meta.category || 'mod';
  const expected = contentHashes.strongest(meta.expectedHashes);
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
        `Download is ${humanBytes(totalBytes)}, which is over the ${humanBytes(MAX_DOWNLOAD_BYTES)} per-file limit.`
      );
    }
    const { free } = await require('../storage/indexer').diskFree();
    if (free < totalBytes * 1.2) {
      throw httpError(507, `Not enough disk space for this download (~${humanBytes(totalBytes)} needed)`);
    }
  }

  const hash = crypto.createHash('sha256');
  // sha256 is always computed for dedupe; when the registry published a
  // different-algo digest, run a second hasher over the same stream.
  const verifyHash = expected && expected.algo !== 'sha256' ? crypto.createHash(expected.algo) : null;
  let receivedBytes = 0;
  const counter = new (require('node:stream').Transform)({
    transform(chunk, enc, cb) {
      hash.update(chunk);
      if (verifyHash) verifyHash.update(chunk);
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_DOWNLOAD_BYTES) {
        // Hard abort - content-length can lie or be absent entirely.
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
  if (expected) {
    const actual = expected.algo === 'sha256' ? sha256 : verifyHash.digest('hex');
    if (actual !== expected.hex) {
      await fsp.rm(tmpFile, { force: true }).catch(() => {});
      throw httpError(
        502,
        `Download failed integrity check: ${expected.algo} of the received file does not match what ` +
          `${new URL(url).host} published (expected ${expected.hex.slice(0, 12)}…, got ${actual.slice(0, 12)}…). ` +
          'Nothing was installed - try again.'
      );
    }
  }
  const existing = db.get('SELECT * FROM library_files WHERE sha256 = ? AND category = ?', sha256, category);
  if (existing) {
    await fsp.rm(tmpFile, { force: true });
    // The file was already in the library, but its icon may never have cached
    // (transient fetch failure at the original add) - retry now that we have a
    // fresh iconUrl to work from.
    if (!existing.icon_rel_path && (meta.iconUrl || existing.icon_url)) {
      cacheIcon(existing.id, meta.iconUrl || existing.icon_url).catch(() => {});
    }
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
  // both point at the identical file - nothing to clean up) and we return theirs.
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
    // We won the insert - do the one-time side effects.
    if (meta.iconUrl) cacheIcon(id, meta.iconUrl).catch(() => {});
    recordEvent({
      actor,
      type: 'library-added',
      summary: `Added to library: ${meta.name || filename} (${humanBytes(size)}).`,
      details: { id, category, sha256 },
    });
  } else if (row && !row.icon_rel_path && (meta.iconUrl || row.icon_url)) {
    // Lost the insert race - still make sure the winner's row has its icon.
    cacheIcon(row.id, meta.iconUrl || row.icon_url).catch(() => {});
  }
  return row;
}

/** Cache a mod's platform icon locally so the UI never hotlinks. */
async function cacheIcon(libraryId, iconUrl) {
  try {
    const res = await safeFetch(iconUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      logger.debug('An icon fetch returned a non-OK status.', { libraryId, status: res.status });
      return;
    }
    const ext = path.extname(new URL(iconUrl).pathname) || '.png';
    const rel = `library/icons/mods/${libraryId}${ext}`;
    await fsp.mkdir(path.dirname(dataPath(rel)), { recursive: true });
    await pipeline(res.body, fs.createWriteStream(dataPath(rel)));
    db.run('UPDATE library_files SET icon_rel_path = ? WHERE id = ?', rel, libraryId);
  } catch {
    /* icons are best-effort */
  }
}

function looksLikeFilename(name, filename) {
  if (!name) return true;
  if (!filename) return false;
  const n = String(name).trim().toLowerCase();
  const f = String(filename).toLowerCase();
  return n === f || n === f.replace(/\.(jar|zip)$/, '');
}

/**
 * Repair the metadata gaps that leave the Mods tab showing a bare placeholder -
 * a missing/broken local icon, and (when the row came from a registry) a
 * filename-derived name, an empty version, or empty MC-version / loader lists.
 * Does at most one platform round-trip. Best-effort: every failure is swallowed
 * with a debug line, so it is safe to call fire-and-forget from a render path.
 */
async function ensureContentMeta(libRow) {
  if (!libRow || !libRow.id) return;
  try {
    const haveIcon = libRow.icon_rel_path && fs.existsSync(dataPath(libRow.icon_rel_path));
    const haveName = !looksLikeFilename(libRow.name, libRow.filename);
    const haveVersion = Boolean(libRow.version);
    const haveMcVersions = libRow.mc_versions_json && libRow.mc_versions_json !== '[]';
    const haveLoaders = libRow.loaders_json && libRow.loaders_json !== '[]';
    if (haveIcon && haveName && haveVersion && haveMcVersions) return;

    const patch = {};
    let iconUrl = libRow.icon_url || null;

    if (libRow.platform && libRow.project_id) {
      if (libRow.platform === 'modrinth') {
        const project = await require('./modrinthApi').getProject(libRow.project_id);
        if (project) {
          if (!iconUrl && project.icon_url) iconUrl = project.icon_url;
          if (!haveName && project.title) patch.name = project.title;
          if (!haveMcVersions && Array.isArray(project.game_versions) && project.game_versions.length) {
            patch.mc_versions_json = JSON.stringify(project.game_versions);
          }
          if (!haveLoaders && Array.isArray(project.loaders) && project.loaders.length) {
            patch.loaders_json = JSON.stringify(project.loaders);
          }
        }
        if (!haveVersion && libRow.file_id) {
          const version = await require('./modrinthApi')
            .getVersion(libRow.file_id)
            .catch(() => null);
          if (version && version.version_number) patch.version = version.version_number;
        }
      } else if (libRow.platform === 'curseforge') {
        const mod = await require('./curseforgeApi').getMod(Number(libRow.project_id));
        if (mod) {
          if (!iconUrl && mod.iconUrl) iconUrl = mod.iconUrl;
          if (!haveName && mod.name) patch.name = mod.name;
        }
        if (!haveVersion && libRow.file_id) {
          const file = await require('./curseforgeApi')
            .getFile(Number(libRow.project_id), Number(libRow.file_id))
            .catch(() => null);
          if (file && (file.name || file.fileName)) patch.version = file.name || file.fileName;
        }
      }
    }

    if (iconUrl && iconUrl !== libRow.icon_url) patch.icon_url = iconUrl;

    const cols = Object.keys(patch);
    if (cols.length) {
      db.run(
        `UPDATE library_files SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        ...cols.map((c) => patch[c]),
        libRow.id
      );
    }
    if (iconUrl && !haveIcon) await cacheIcon(libRow.id, iconUrl);
  } catch (err) {
    logger.debug('ensureContentMeta could not repair a library row.', {
      libraryId: libRow.id,
      err: String(err && err.message),
    });
  }
}

/**
 * Install a library file into a server directory (hard link → copy fallback).
 * destRel example: 'mods' | 'plugins' | 'world/datapacks'.
 */
async function installToServer(libraryId, serverId, destRel, { filename } = {}) {
  const lib = db.get('SELECT * FROM library_files WHERE id = ?', libraryId);
  if (!lib) throw httpError(404, 'Library file not found');
  // The panel must own the server dir to write into it - a server created before
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

/**
 * Import a locally-uploaded file (e.g. a manually-downloaded mod jar) into the
 * library with sha256 dedupe. Mirrors downloadToLibrary but from a local path.
 */
async function importFile(localPath, meta, { actor = 'system' } = {}) {
  const category = meta.category || 'mod';
  const buf = await fsp.readFile(localPath);
  if (buf.length > MAX_DOWNLOAD_BYTES) throw httpError(413, 'File is too large');
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const existing = db.get('SELECT * FROM library_files WHERE sha256 = ? AND category = ?', sha256, category);
  if (existing) {
    if (!existing.icon_rel_path && (meta.iconUrl || existing.icon_url)) {
      cacheIcon(existing.id, meta.iconUrl || existing.icon_url).catch(() => {});
    }
    return existing;
  }
  const filename = sanitizeFilename(meta.filename || path.basename(localPath));
  const relPath = `${CATEGORY_DIR[category]}/${sha256.slice(0, 8)}-${filename}`;
  await fsp.mkdir(path.dirname(dataPath(relPath)), { recursive: true });
  await fsp.writeFile(dataPath(relPath), buf);
  const id = `lib_${nanoid(8)}`;
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
    buf.length,
    null,
    meta.platform || 'upload',
    meta.projectId || null,
    meta.fileId || null,
    meta.version || null,
    JSON.stringify(meta.mcVersions || []),
    JSON.stringify(meta.loaders || []),
    meta.iconUrl || null,
    null,
    null
  );
  const row = db.get('SELECT * FROM library_files WHERE sha256 = ? AND category = ?', sha256, category);
  if (row && row.id === id) {
    if (meta.iconUrl) cacheIcon(id, meta.iconUrl).catch(() => {});
    recordEvent({
      actor,
      type: 'library-added',
      summary: `Uploaded to library: ${meta.name || filename} (${humanBytes(buf.length)}).`,
      details: { id, category, sha256 },
    });
  }
  return row;
}

function usageCount(libraryId) {
  return db.get('SELECT COUNT(*) AS n FROM server_content WHERE library_id = ?', libraryId)?.n || 0;
}

async function deleteLibraryFile(libraryId, { actor = 'system', force = false } = {}) {
  const lib = db.get('SELECT * FROM library_files WHERE id = ?', libraryId);
  if (!lib) return { freedBytes: 0 };
  const used = usageCount(libraryId);
  if (used > 0 && !force) throw httpError(409, `Still installed on ${used} server(s) - remove it there first`);
  await fsp.rm(dataPath(lib.rel_path), { force: true });
  if (lib.icon_rel_path) await fsp.rm(dataPath(lib.icon_rel_path), { force: true });
  db.run('DELETE FROM library_files WHERE id = ?', libraryId);
  recordEvent({
    actor,
    type: 'library-deleted',
    summary: `Removed from library: ${lib.name} (${humanBytes(lib.size_bytes)} freed).`,
  });
  return { freedBytes: lib.size_bytes };
}

/** Library rows whose files no other record references - cleanup candidates. */
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
  importFile,
  installToServer,
  deleteLibraryFile,
  cacheIcon,
  ensureContentMeta,
  usageCount,
  orphans,
  CATEGORY_DIR,
};
