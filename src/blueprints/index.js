// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Blueprints: portable .mcserver.zip snapshots of a server's full recipe
// (identity, env, resources, pinned pack, custom-mod overlay, config files,
// optionally embedded jars and world). Export produces the zip + a DB row;
// import validates the manifest (zod, zip-slip-guarded) and reproduces the
// server on any Minecraft Server Manager install. Secrets are never written to a blueprint.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const archiver = require('archiver');
const yauzl = require('yauzl');
const { nanoid } = require('nanoid');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { dataPath, safeJoin } = require('../storage/pathGuard');

// Starter blueprints inherit the panel's host-aware resource defaults so they
// import cleanly on a small VPS as well as a big workstation.
function starterResources() {
  const d = config.defaults;
  return {
    heapMb: d.heapMb,
    containerMemoryMb: d.containerMemoryMb,
    cpus: d.cpus,
    diskQuotaGb: d.diskQuotaGb,
    quotaStrict: false,
    updatePolicy: 'manual',
  };
}
const { recordEvent } = require('../events');
const servers = require('../services/servers');
const packs = require('../services/packs');
const library = require('../services/library');
const mods = require('../services/mods');
const modrinth = require('../services/modrinthApi');
const curseforge = require('../services/curseforgeApi');
const indexer = require('../storage/indexer');

const PANEL_VERSION = '0.1';
// Any env var whose NAME matches this is a secret and never leaves the panel.
const SECRET_ENV_RE = /PASSWORD|TOKEN|KEY|SECRET/i;

const KNOWN_TYPES = new Set([
  'VANILLA',
  'PAPER',
  'PURPUR',
  'PUFFERFISH',
  'LEAF',
  'FOLIA',
  'SPIGOT',
  'BUKKIT',
  'CANYON',
  'FABRIC',
  'QUILT',
  'FORGE',
  'NEOFORGE',
  'AUTO_CURSEFORGE',
  'MODRINTH',
  'FTBA',
  'CURSEFORGE',
]);

// ---- Manifest schema (msm: 1) ----

const overlayEntrySchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['mod', 'plugin', 'datapack', 'resourcepack']).default('mod'),
  filename: z.string().max(200).nullable().default(null),
  sourceUrl: z.string().max(1000).nullable().default(null),
  platform: z.string().max(20).nullable().default(null),
  projectId: z.string().max(60).nullable().default(null),
  fileId: z.string().max(60).nullable().default(null),
  version: z.string().max(120).nullable().default(null),
  // null = skip verification (e.g. starter blueprints resolve "latest compatible" at import time)
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .default(null),
});

const manifestSchema = z.object({
  msm: z.literal(1),
  name: z.string().trim().min(1).max(120),
  createdAt: z.string().max(40),
  panelVersion: z.string().max(20),
  notes: z.string().max(4000).default(''),
  identity: z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(4000).default(''),
    icon: z.string().max(64).default('grass'),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#3fa62b'),
    tags: z.array(z.string().max(24)).max(16).default([]),
  }),
  config: z.object({
    type: z.string().trim().min(1).max(32),
    mcVersion: z.string().trim().min(1).max(32),
    javaTag: z.string().max(16).default(''),
    env: z.record(z.string(), z.string()).default({}),
  }),
  resources: z.object({
    heapMb: z.number().int().min(512).max(262144),
    containerMemoryMb: z.number().int().min(1024).max(524288),
    cpus: z.number().min(0).max(128),
    diskQuotaGb: z.number().min(0).max(16384),
    quotaStrict: z.boolean().default(false),
    updatePolicy: z.enum(['manual', 'notify', 'auto']).default('manual'),
  }),
  pack: z
    .object({
      platform: z.enum(['curseforge', 'modrinth', 'ftb']),
      projectRef: z.string().min(1).max(400),
      projectName: z.string().max(200).default(''),
      versionId: z.string().min(1).max(60),
      versionName: z.string().max(200).default(''),
    })
    .nullable()
    .default(null),
  overlay: z.array(overlayEntrySchema).max(500).default([]),
  configFiles: z.array(z.string().min(1).max(300)).max(2000).default([]),
  embedFiles: z.boolean().default(false),
  world: z.boolean().default(false),
});

// ---- Export ----

/**
 * Export a server as a .mcserver.zip in data/blueprints.
 * options: { includeConfig (server.properties + config/), embedFiles (bundle
 * overlay jars for offline portability), includeWorld }.
 */
async function exportBlueprint(serverId, options = {}, { actor = 'system' } = {}) {
  const server = servers.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const includeConfig = options.includeConfig !== false;
  const embedFiles = Boolean(options.embedFiles);
  const includeWorld = Boolean(options.includeWorld);
  const serverDir = dataPath('servers', serverId);

  const pack = packs.getPack(serverId);
  const overlayRows = db.all(
    `SELECT sc.*, lf.source_url, lf.platform AS lib_platform, lf.project_id, lf.file_id,
            lf.sha256, lf.version AS lib_version, lf.rel_path AS lib_rel_path
     FROM server_content sc LEFT JOIN library_files lf ON lf.id = sc.library_id
     WHERE sc.server_id = ? AND sc.managed_by = 'overlay'`,
    serverId
  );

  const configFiles = includeConfig ? collectConfigFiles(serverDir) : [];
  const worldDirs = includeWorld ? worldDirsOf(server, serverDir) : [];
  if (includeWorld && worldDirs.length) {
    const needed = worldDirs.reduce((n, d) => n + servers.dirSize(d.abs), 0);
    const { free } = await indexer.diskFree();
    if (free < needed * 1.1) {
      throw httpError(507, `Not enough disk space to embed the world (~${(needed / 1024 ** 3).toFixed(1)} GB needed)`);
    }
  }

  const manifest = {
    msm: 1,
    name: server.display_name,
    createdAt: new Date().toISOString(),
    panelVersion: PANEL_VERSION,
    notes: server.notes || '',
    identity: {
      name: server.display_name,
      description: server.description || '',
      icon: server.icon || 'grass',
      accent: server.accent || '#3fa62b',
      tags: server.tags || [],
    },
    config: {
      type: server.type,
      mcVersion: server.mc_version,
      javaTag: server.java_tag || '',
      env: sanitizeEnv(server.env),
    },
    resources: {
      heapMb: server.heap_mb,
      containerMemoryMb: server.container_memory_mb,
      cpus: server.cpus,
      diskQuotaGb: Math.round(server.disk_quota_bytes / 1024 ** 3),
      quotaStrict: Boolean(server.quota_strict),
      updatePolicy: server.update_policy || 'manual',
    },
    pack: pack
      ? {
          platform: pack.platform,
          projectRef: pack.project_ref,
          projectName: pack.project_name,
          versionId: pack.pinned_version_id,
          versionName: pack.pinned_version_name,
        }
      : null,
    overlay: overlayRows.map((r) => ({
      name: r.name,
      kind: r.kind,
      filename: r.filename,
      sourceUrl: r.source_url || null,
      platform: r.lib_platform || null,
      projectId: r.project_id || null,
      fileId: r.file_id || null,
      version: r.lib_version || r.version || null,
      sha256: r.sha256 || null,
    })),
    configFiles,
    embedFiles,
    world: includeWorld && worldDirs.length > 0,
  };

  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const filename = `${slugify(server.display_name)}-${stamp}.mcserver.zip`;
  const relPath = `blueprints/${filename}`;
  const absPath = dataPath(relPath);
  await fsp.mkdir(path.dirname(absPath), { recursive: true });

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(absPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    for (const rel of configFiles) {
      archive.file(safeJoin(serverDir, rel), { name: `payload/config/${rel}` });
    }
    if (embedFiles) {
      for (const row of overlayRows) {
        if (row.lib_rel_path && fs.existsSync(dataPath(row.lib_rel_path))) {
          archive.file(dataPath(row.lib_rel_path), { name: `payload/overlay/${row.filename}` });
        }
      }
    }
    for (const dir of worldDirs) archive.directory(dir.abs, `payload/world/${dir.name}`);
    archive.finalize();
  });

  const size = (await fsp.stat(absPath)).size;
  const id = `bp_${nanoid(8)}`;
  db.run(
    'INSERT INTO blueprints (id, name, filename, rel_path, size_bytes, builtin, manifest_json) VALUES (?, ?, ?, ?, ?, 0, ?)',
    id,
    server.display_name,
    filename,
    relPath,
    size,
    JSON.stringify(manifest)
  );
  recordEvent({
    serverId,
    actor,
    type: 'blueprint-exported',
    summary: `Blueprint exported: ${server.display_name} (${filename}, ${(size / 1024 ** 2).toFixed(1)} MB)`,
    details: { id, filename, includeConfig, embedFiles, includeWorld, overlayCount: manifest.overlay.length },
  });
  indexer.scan().catch(() => {});
  return db.get('SELECT * FROM blueprints WHERE id = ?', id);
}

// ---- Import ----

/**
 * Validate a .mcserver.zip and return { manifest, warnings, entries }.
 * Rejects zip-slip entry names and schema violations before anything is created.
 */
async function importPreview(zipPath) {
  const { entries, manifestText } = await readZipIndex(zipPath);
  if (!manifestText) throw httpError(400, 'Not a Minecraft Server Manager blueprint: manifest.json is missing');

  let raw;
  try {
    raw = JSON.parse(manifestText);
  } catch {
    throw httpError(400, 'Blueprint manifest is not valid JSON');
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw httpError(400, `Blueprint manifest failed validation — ${detail}`);
  }
  const manifest = parsed.data;
  for (const rel of manifest.configFiles) {
    if (rel.split('/').includes('..') || path.isAbsolute(rel)) {
      throw httpError(400, `Blueprint config file path escapes the server directory: ${rel}`);
    }
  }

  const entryNames = new Set(entries.map((e) => e.name));
  const warnings = [];
  if (!KNOWN_TYPES.has(manifest.config.type)) {
    warnings.push(`Unknown server type "${manifest.config.type}" — this panel may not know how to run it.`);
  }
  const mcMatch = /^1\.(\d+)/.exec(manifest.config.mcVersion);
  if (mcMatch && Number(mcMatch[1]) < 13) {
    warnings.push(`Minecraft ${manifest.config.mcVersion} is very old — expect Java and mod availability quirks.`);
  }
  if (manifest.embedFiles) {
    const missing = manifest.overlay.filter((o) => o.filename && !entryNames.has(`payload/overlay/${o.filename}`));
    if (missing.length)
      warnings.push(
        `${missing.length} embedded overlay file(s) are missing from the archive — they will be downloaded instead.`
      );
  }
  for (const entry of manifest.overlay) {
    if (!entry.sourceUrl && !(entry.filename && entryNames.has(`payload/overlay/${entry.filename}`))) {
      warnings.push(`"${entry.name}" has no source URL and no embedded file — it cannot be installed.`);
    }
    if (!entry.sha256) {
      warnings.push(`"${entry.name}" carries no hash — its download will not be verified.`);
    }
  }
  if (manifest.world && !entries.some((e) => e.name.startsWith('payload/world/'))) {
    warnings.push('The manifest claims a world is included but the archive has no world payload.');
  }
  if (manifest.pack && manifest.pack.platform === 'curseforge') {
    warnings.push('CurseForge pack — a CurseForge API key must be configured in Settings for the install to work.');
  }

  return {
    manifest,
    warnings,
    entries: {
      count: entries.length,
      payloadBytes: entries.filter((e) => e.name.startsWith('payload/')).reduce((n, e) => n + e.size, 0),
    },
  };
}

/**
 * Create a NEW server from a blueprint. `zipRef` is a blueprint id (bp_…) or a
 * zip path inside the data dir. Fresh ports and RCON password are always
 * assigned; identity/resources come from the manifest unless overridden.
 * Returns { server, report } — report has one {name, status, error?} per
 * pack/overlay item ('ok' | 'hash-mismatch' | 'failed'); failures never abort
 * the rest of the import.
 */
async function importBlueprint(zipRef, overrides = {}, { actor = 'system', onProgress = () => {} } = {}) {
  let zipPath = zipRef;
  if (/^bp_/.test(zipRef)) {
    zipPath = getBlueprintPath(zipRef);
  }
  if (!fs.existsSync(zipPath)) throw httpError(404, 'Blueprint archive not found');

  const { manifest, entries } = await importPreview(zipPath);
  const o = overrides || {};

  onProgress('Creating server…');
  const server = await servers.createServer(
    {
      name: o.name || manifest.identity.name || manifest.name,
      description: o.description !== undefined ? o.description : manifest.identity.description,
      icon: o.icon || manifest.identity.icon,
      accent: o.accent || manifest.identity.accent,
      tags: o.tags || manifest.identity.tags,
      type: manifest.config.type,
      mcVersion: o.mcVersion || manifest.config.mcVersion,
      javaTag: manifest.config.javaTag,
      env: sanitizeEnv(manifest.config.env),
      heapMb: o.heapMb ?? manifest.resources.heapMb,
      containerMemoryMb: o.containerMemoryMb ?? manifest.resources.containerMemoryMb,
      cpus: o.cpus ?? manifest.resources.cpus,
      diskQuotaGb: o.diskQuotaGb ?? manifest.resources.diskQuotaGb,
      updatePolicy: manifest.resources.updatePolicy,
    },
    { actor, start: false, onProgress }
  );
  if (manifest.resources.quotaStrict) {
    servers.updateServer(server.id, { quotaStrict: true }, { actor });
  }

  const report = [];
  const hasPayload = entries.payloadBytes > 0;
  const tmpDir = dataPath('tmp', `bpimp-${nanoid(8)}`);

  try {
    if (hasPayload) {
      onProgress('Extracting blueprint payload…');
      await extractZipSafe(zipPath, tmpDir);
    }

    // Pinned modpack
    if (manifest.pack) {
      onProgress(`Installing pinned pack: ${manifest.pack.projectName || manifest.pack.projectRef}…`);
      try {
        const resolved = await packs.resolvePack(manifest.pack.platform, manifest.pack.projectRef, {
          versionId: manifest.pack.versionId,
        });
        await packs.applyPack(server.id, resolved, { actor });
        report.push({ name: `Modpack: ${resolved.projectName} @ ${resolved.versionName}`, status: 'ok' });
      } catch (err) {
        report.push({
          name: `Modpack: ${manifest.pack.projectName || manifest.pack.projectRef}`,
          status: 'failed',
          error: err.message,
        });
      }
    }

    // Custom overlay: embedded payload first, else re-download + hash verify.
    const freshServer = servers.getServer(server.id);
    for (let i = 0; i < manifest.overlay.length; i += 1) {
      const entry = manifest.overlay[i];
      onProgress(`Overlay ${i + 1}/${manifest.overlay.length}: ${entry.name}…`);
      report.push(await installOverlayItem(entry, freshServer, tmpDir, { actor }));
    }

    // Config files payload → server dir (paths re-guarded against the server dir).
    for (const rel of manifest.configFiles) {
      const src = path.join(tmpDir, 'payload', 'config', rel);
      if (!fs.existsSync(src)) continue;
      const dest = safeJoin(dataPath('servers', server.id), rel);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(src, dest);
    }

    // World payload → server dir (dir names come from the extracted tree).
    const worldPayload = path.join(tmpDir, 'payload', 'world');
    if (manifest.world && fs.existsSync(worldPayload)) {
      onProgress('Installing world…');
      await fsp.cp(worldPayload, dataPath('servers', server.id), { recursive: true, force: true });
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  const failed = report.filter((r) => r.status !== 'ok').length;
  recordEvent({
    serverId: server.id,
    actor,
    type: 'blueprint-imported',
    summary: `Server created from blueprint "${manifest.name}"${report.length ? ` — ${report.length - failed}/${report.length} items ok` : ''}`,
    details: { blueprint: manifest.name, report },
  });
  indexer.scan().catch(() => {});
  return { server: servers.getServer(server.id), report };
}

/** One overlay item → {name, status: 'ok'|'hash-mismatch'|'failed', error?}. */
async function installOverlayItem(entry, server, tmpDir, { actor }) {
  const dirRel = mods.contentDir(server, entry.kind);
  try {
    let lib = null;
    const embedded = entry.filename ? path.join(tmpDir, 'payload', 'overlay', entry.filename) : null;
    if (embedded && fs.existsSync(embedded)) {
      const sha256 = await hashFile(embedded);
      if (entry.sha256 && sha256 !== entry.sha256) {
        return {
          name: entry.name,
          status: 'hash-mismatch',
          error: `Embedded file hash ${sha256.slice(0, 12)}… does not match the manifest`,
        };
      }
      lib = await ingestLocalFile(embedded, entry, sha256);
    } else {
      const { url, meta } = await resolveOverlaySource(entry, server);
      lib = await library.downloadToLibrary(url, { ...meta, category: entry.kind, name: entry.name }, { actor });
      if (entry.sha256 && lib.sha256 !== entry.sha256) {
        return {
          name: entry.name,
          status: 'hash-mismatch',
          error: `Downloaded file hash ${lib.sha256.slice(0, 12)}… does not match the manifest`,
        };
      }
    }
    const { filename } = await library.installToServer(lib.id, server.id, dirRel);
    db.run(
      `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, icon_url)
       VALUES (?, ?, ?, ?, 'overlay', ?, ?, ?, ?)
       ON CONFLICT(server_id, filename) DO UPDATE SET library_id = excluded.library_id, version = excluded.version`,
      `sc_${nanoid(8)}`,
      server.id,
      lib.id,
      entry.kind,
      entry.name,
      filename,
      lib.version || entry.version,
      lib.icon_url || null
    );
    return { name: entry.name, status: 'ok' };
  } catch (err) {
    return { name: entry.name, status: 'failed', error: err.message };
  }
}

/** Turn an overlay manifest entry into a direct download URL + library meta. */
async function resolveOverlaySource(entry, server) {
  const loader = mods.loaderOf(server);
  const mcVersion = ['LATEST', 'SNAPSHOT'].includes(server.mc_version) ? undefined : server.mc_version;

  // Exact pinned file when the platform ids are recorded.
  if (entry.platform === 'modrinth' && entry.fileId) {
    const version = await modrinth.getVersion(entry.fileId);
    const file = modrinth.primaryFile(version);
    return {
      url: file.url,
      meta: {
        platform: 'modrinth',
        projectId: entry.projectId,
        fileId: entry.fileId,
        filename: file.filename,
        version: version.version_number,
        mcVersions: version.game_versions,
        loaders: version.loaders,
      },
    };
  }
  if (entry.platform === 'curseforge' && entry.projectId && entry.fileId) {
    const file = await curseforge.getFile(entry.projectId, Number(entry.fileId));
    if (!file || !file.downloadUrl)
      throw httpError(409, `${entry.name} disallows automated downloads — install it manually`);
    return {
      url: file.downloadUrl,
      meta: {
        platform: 'curseforge',
        projectId: entry.projectId,
        fileId: entry.fileId,
        filename: file.fileName,
        version: file.name,
        mcVersions: file.gameVersions,
      },
    };
  }
  // Platform project page (starter blueprints): resolve the best build for
  // this server's loader + MC version at import time.
  if (entry.sourceUrl && /modrinth\.com\//.test(entry.sourceUrl)) {
    const project = await modrinth.resolveUrl(entry.sourceUrl);
    const versions = await modrinth.getVersions(project.projectId, { loader, mcVersion });
    if (!versions.length)
      throw httpError(
        404,
        `No ${project.title} build matches ${loader || 'this loader'} ${mcVersion || 'this version'}`
      );
    const version = versions[0];
    const file = modrinth.primaryFile(version);
    return {
      url: file.url,
      meta: {
        platform: 'modrinth',
        projectId: project.projectId,
        fileId: version.id,
        filename: file.filename,
        version: version.version_number,
        iconUrl: project.iconUrl,
        mcVersions: version.game_versions,
        loaders: version.loaders,
      },
    };
  }
  if (entry.sourceUrl) {
    return {
      url: entry.sourceUrl,
      meta: { platform: 'url', filename: entry.filename || undefined, version: entry.version || undefined },
    };
  }
  throw httpError(400, 'No embedded file and no source URL — nothing to install from');
}

/** Register an extracted payload file in the shared library (dedupe by hash). */
async function ingestLocalFile(absFile, entry, sha256) {
  const category = entry.kind || 'mod';
  const existing = db.get('SELECT * FROM library_files WHERE sha256 = ? AND category = ?', sha256, category);
  if (existing) return existing;
  const filename = sanitizeFilename(entry.filename || path.basename(absFile));
  const relPath = `${library.CATEGORY_DIR[category]}/${sha256.slice(0, 8)}-${filename}`;
  await fsp.mkdir(path.dirname(dataPath(relPath)), { recursive: true });
  await fsp.copyFile(absFile, dataPath(relPath));
  const size = (await fsp.stat(dataPath(relPath))).size;
  const id = `lib_${nanoid(8)}`;
  // ON CONFLICT: a concurrent ingest of the same file no-ops here (shared relPath),
  // and we return whichever row exists for this (sha256, category).
  db.run(
    `INSERT INTO library_files (id, category, name, filename, rel_path, sha256, size_bytes, source_url, platform, project_id, file_id, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sha256, category) DO NOTHING`,
    id,
    category,
    entry.name,
    filename,
    relPath,
    sha256,
    size,
    entry.sourceUrl,
    entry.platform || 'blueprint',
    entry.projectId,
    entry.fileId,
    entry.version
  );
  return db.get('SELECT * FROM library_files WHERE sha256 = ? AND category = ?', sha256, category);
}

// ---- Clone ----

/** One-click duplicate: full export (embedded files) + immediate import. */
async function cloneServer(serverId, { includeWorld = false, actor = 'system', onProgress = () => {} } = {}) {
  const original = servers.getServer(serverId);
  if (!original) throw httpError(404, 'Server not found');
  onProgress('Exporting blueprint…');
  const blueprint = await exportBlueprint(serverId, { includeConfig: true, embedFiles: true, includeWorld }, { actor });
  const { server, report } = await importBlueprint(
    blueprint.id,
    { name: `${original.display_name} (copy)` },
    { actor, onProgress }
  );
  return { server, report, blueprint };
}

// ---- Library CRUD ----

function listBlueprints() {
  return db.all('SELECT * FROM blueprints ORDER BY builtin DESC, created_at DESC').map(decorate);
}

function getBlueprint(id) {
  const row = db.get('SELECT * FROM blueprints WHERE id = ?', id);
  return row ? decorate(row) : null;
}

function getBlueprintPath(id) {
  const row = db.get('SELECT * FROM blueprints WHERE id = ?', id);
  if (!row) throw httpError(404, 'Blueprint not found');
  return dataPath(row.rel_path);
}

async function deleteBlueprint(id, { actor = 'system' } = {}) {
  const row = db.get('SELECT * FROM blueprints WHERE id = ?', id);
  if (!row) throw httpError(404, 'Blueprint not found');
  await fsp.rm(dataPath(row.rel_path), { force: true });
  db.run('DELETE FROM blueprints WHERE id = ?', id);
  recordEvent({
    actor,
    type: 'blueprint-deleted',
    summary: `Blueprint deleted: ${row.name} (${(row.size_bytes / 1024 ** 2).toFixed(1)} MB freed)`,
    details: { id, filename: row.filename },
  });
  return { freedBytes: row.size_bytes };
}

/** Row + fields derived from the cached manifest for lists/cards. */
function decorate(row) {
  let manifest = {};
  try {
    manifest = JSON.parse(row.manifest_json);
  } catch {
    /* corrupt cache — show bare row */
  }
  return {
    ...row,
    builtin: Boolean(row.builtin),
    manifest,
    notes: manifest.notes || (manifest.identity && manifest.identity.description) || '',
    pack: manifest.pack
      ? `${manifest.pack.projectName || manifest.pack.projectRef} @ ${manifest.pack.versionName || manifest.pack.versionId}`
      : null,
    overlayCount: Array.isArray(manifest.overlay) ? manifest.overlay.length : 0,
    type: manifest.config ? manifest.config.type : '',
    mcVersion: manifest.config ? manifest.config.mcVersion : '',
    world: Boolean(manifest.world),
    created: row.created_at,
  };
}

// ---- Starter blueprints (first-run seed) ----

/** Ship two preset blueprints once. A settings flag prevents re-seeding after the user deletes them. */
async function seedStarters() {
  if (db.get("SELECT 1 FROM settings WHERE key = 'blueprints_seeded'")) return { seeded: 0 };
  if (db.get('SELECT 1 FROM blueprints WHERE builtin = 1')) return { seeded: 0 };

  const created = [];
  for (const manifest of [paperStarterManifest(), fabricStarterManifest()]) {
    created.push(await writeManifestOnlyBlueprint(manifest, { builtin: true }));
  }
  db.run("INSERT INTO settings (key, value_json) VALUES ('blueprints_seeded', 'true')");
  recordEvent({
    actor: 'system',
    type: 'blueprints-seeded',
    summary: `Starter blueprints installed: ${created.map((c) => c.name).join(', ')}`,
  });
  return { seeded: created.length, blueprints: created };
}

function paperStarterManifest() {
  return {
    msm: 1,
    name: 'Optimized Paper Survival',
    createdAt: new Date().toISOString(),
    panelVersion: PANEL_VERSION,
    notes: 'Paper with Aikar JVM flags and sane survival defaults — a fast vanilla-plus base.',
    identity: {
      name: 'Optimized Paper Survival',
      description: 'Paper with Aikar JVM flags and sane survival defaults — a fast vanilla-plus base.',
      icon: 'grass',
      accent: '#3fa62b',
      tags: ['paper', 'survival', 'optimized'],
    },
    config: {
      type: 'PAPER',
      mcVersion: 'LATEST',
      javaTag: '',
      env: { USE_AIKAR_FLAGS: 'true', VIEW_DISTANCE: '12' },
    },
    resources: starterResources(),
    pack: null,
    overlay: [],
    configFiles: [],
    embedFiles: false,
    world: false,
  };
}

function fabricStarterManifest() {
  // Manifest-only overlay refs: sha256 null = skip verification, the latest
  // compatible build is resolved from the project page at import time.
  const mod = (name, slug) => ({
    name,
    kind: 'mod',
    filename: null,
    sourceUrl: `https://modrinth.com/mod/${slug}`,
    platform: 'modrinth',
    projectId: null,
    fileId: null,
    version: null,
    sha256: null,
  });
  return {
    msm: 1,
    name: 'Fabric Performance Base',
    createdAt: new Date().toISOString(),
    panelVersion: PANEL_VERSION,
    notes: 'Fabric with Lithium, FerriteCore, Krypton and Spark — a lean modded starting point.',
    identity: {
      name: 'Fabric Performance Base',
      description: 'Fabric with Lithium, FerriteCore, Krypton and Spark — a lean modded starting point.',
      icon: 'diamond',
      accent: '#21a7ab',
      tags: ['fabric', 'performance'],
    },
    config: { type: 'FABRIC', mcVersion: 'LATEST', javaTag: '', env: {} },
    resources: starterResources(),
    pack: null,
    overlay: [
      mod('Lithium', 'lithium'),
      mod('FerriteCore', 'ferrite-core'),
      mod('Krypton', 'krypton'),
      mod('Spark', 'spark'),
    ],
    configFiles: [],
    embedFiles: false,
    world: false,
  };
}

async function writeManifestOnlyBlueprint(manifest, { builtin = false } = {}) {
  const filename = `${slugify(manifest.name)}.mcserver.zip`;
  const relPath = `blueprints/${filename}`;
  const absPath = dataPath(relPath);
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(absPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.finalize();
  });
  const size = (await fsp.stat(absPath)).size;
  const id = `bp_${nanoid(8)}`;
  db.run(
    'INSERT INTO blueprints (id, name, filename, rel_path, size_bytes, builtin, manifest_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id,
    manifest.name,
    filename,
    relPath,
    size,
    builtin ? 1 : 0,
    JSON.stringify(manifest)
  );
  return db.get('SELECT * FROM blueprints WHERE id = ?', id);
}

// ---- Zip helpers (all zip-slip-guarded) ----

function safeEntryName(name) {
  if (!name || name.includes('\0') || name.includes('\\')) return false;
  if (path.isAbsolute(name) || /^[a-zA-Z]:/.test(name)) return false;
  return !name.split('/').includes('..');
}

/** List entries and stream out manifest.json without extracting anything. */
function readZipIndex(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(httpError(400, 'Not a valid zip archive'));
      const entries = [];
      let manifestText = null;
      zip.on('error', reject);
      zip.on('end', () => resolve({ entries, manifestText }));
      zip.on('entry', (entry) => {
        if (!safeEntryName(entry.fileName)) {
          zip.close();
          return reject(httpError(400, `Archive entry escapes its destination: ${entry.fileName}`));
        }
        entries.push({ name: entry.fileName, size: entry.uncompressedSize });
        if (entry.fileName === 'manifest.json') {
          zip.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return reject(streamErr);
            const chunks = [];
            readStream.on('data', (c) => chunks.push(c));
            readStream.on('error', reject);
            readStream.on('end', () => {
              manifestText = Buffer.concat(chunks).toString('utf8');
              zip.readEntry();
            });
          });
        } else {
          zip.readEntry();
        }
      });
      zip.readEntry();
    });
  });
}

/** Extract a whole zip under destDir; every entry path is containment-checked. */
function extractZipSafe(zipFile, destDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFile, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry) => {
        if (!safeEntryName(entry.fileName)) {
          zip.close();
          return reject(new Error(`Archive entry escapes destination: ${entry.fileName}`));
        }
        const target = path.resolve(destDir, entry.fileName);
        if (target !== path.resolve(destDir) && !target.startsWith(path.resolve(destDir) + path.sep)) {
          zip.close();
          return reject(new Error(`Archive entry escapes destination: ${entry.fileName}`));
        }
        if (/\/$/.test(entry.fileName)) {
          fs.mkdirSync(target, { recursive: true });
          zip.readEntry();
        } else {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          zip.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr) return reject(streamErr);
            const out = fs.createWriteStream(target);
            out.on('close', () => zip.readEntry());
            out.on('error', reject);
            readStream.pipe(out);
          });
        }
      });
      zip.readEntry();
    });
  });
}

// ---- Small helpers ----

function sanitizeEnv(env) {
  return Object.fromEntries(Object.entries(env || {}).filter(([k]) => !SECRET_ENV_RE.test(k)));
}

function collectConfigFiles(serverDir) {
  const rels = [];
  if (fs.existsSync(path.join(serverDir, 'server.properties'))) rels.push('server.properties');
  const walk = (abs, rel) => {
    let entries = [];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(path.join(abs, entry.name), childRel);
      else if (entry.isFile()) rels.push(childRel);
    }
  };
  if (fs.existsSync(path.join(serverDir, 'config'))) walk(path.join(serverDir, 'config'), 'config');
  return rels;
}

/** World dirs to embed: the active level dir plus its Bukkit-style split siblings. */
function worldDirsOf(server, serverDir) {
  // activeLevelName honors LEVEL env AND server.properties level-name — a
  // renamed/activated world would otherwise be silently missing from exports.
  const level = require('../services/worlds').activeLevelName(server);
  return [level, `${level}_nether`, `${level}_the_end`]
    .map((name) => ({ name, abs: path.join(serverDir, name) }))
    .filter((d) => fs.existsSync(d.abs) && fs.statSync(d.abs).isDirectory());
}

function hashFile(absFile) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(absFile)
      .on('data', (c) => hash.update(c))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

function slugify(name) {
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'blueprint'
  );
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|\0]/g, '_').slice(0, 180);
}

module.exports = {
  exportBlueprint,
  importPreview,
  importBlueprint,
  cloneServer,
  listBlueprints,
  getBlueprint,
  getBlueprintPath,
  deleteBlueprint,
  seedStarters,
};
