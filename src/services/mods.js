// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Per-server content management (mods/plugins/datapacks/resourcepacks).
// Two classes of content, handled differently on purpose (see discovery):
//   pack    — installed by the itzg pack installer; deleting the jar triggers
//             re-install, so disable goes through CF_EXCLUDE_MODS /
//             MODRINTH_EXCLUDE_FILES (+ *_FORCE_SYNCHRONIZE) and a recreate.
//   overlay — panel-managed via the shared library; survives pack updates;
//             toggled instantly by renaming to .jar.disabled.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const library = require('./library');
const modrinth = require('./modrinthApi');
const curseforge = require('./curseforgeApi');
const serversService = require('./servers');
const indexer = require('../storage/indexer');

const PLUGIN_TYPES = new Set(['PAPER', 'PURPUR', 'PUFFERFISH', 'LEAF', 'FOLIA', 'SPIGOT', 'BUKKIT', 'CANYON']);

function contentDir(server, kind) {
  if (kind === 'datapack') return 'world/datapacks';
  if (kind === 'resourcepack') return 'resourcepacks';
  return PLUGIN_TYPES.has(server.type) ? 'plugins' : 'mods';
}

// Modpack servers don't set CF_MOD_LOADER/MODRINTH_LOADER — the pack itself
// decides the loader. mc-image-helper writes a per-loader manifest into the data
// dir (e.g. .neoforge-manifest.json), so detect from that; otherwise mod installs
// have no loader to match and grab an arbitrary (e.g. Fabric) build.
function detectPackLoader(serverId) {
  let names = [];
  try {
    names = fs.readdirSync(dataPath('servers', serverId));
  } catch {
    return null;
  }
  for (const loader of ['neoforge', 'forge', 'fabric', 'quilt']) {
    if (names.includes(`.${loader}-manifest.json`)) return loader;
  }
  return null;
}

function loaderOf(server) {
  const map = { FABRIC: 'fabric', QUILT: 'quilt', FORGE: 'forge', NEOFORGE: 'neoforge' };
  if (map[server.type]) return map[server.type];
  if (PLUGIN_TYPES.has(server.type)) return 'paper';
  if (server.type === 'AUTO_CURSEFORGE' || server.type === 'MODRINTH' || server.type === 'FTBA') {
    const envLoader = (server.env.MODRINTH_LOADER || server.env.CF_MOD_LOADER || '').toLowerCase();
    return envLoader || detectPackLoader(server.id) || null;
  }
  return null;
}

/** List installed content: DB overlay rows + on-disk scan for pack/unknown files. */
async function listContent(serverId) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const kind = PLUGIN_TYPES.has(server.type) ? 'plugin' : 'mod';
  const dirRel = contentDir(server, kind);
  const dirAbs = dataPath('servers', serverId, dirRel);

  const rows = db.all('SELECT * FROM server_content WHERE server_id = ?', serverId);
  const byFile = new Map(rows.map((r) => [r.filename.replace(/\.disabled$/, ''), r]));
  const seen = new Set();
  const items = [];

  let entries = [];
  try {
    entries = await fsp.readdir(dirAbs, { withFileTypes: true });
  } catch {
    /* dir doesn't exist yet */
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const isDisabled = entry.name.endsWith('.disabled');
    const baseName = entry.name.replace(/\.disabled$/, '');
    if (!baseName.endsWith('.jar') && !baseName.endsWith('.zip')) continue;
    seen.add(baseName);
    const row = byFile.get(baseName);
    const stat = await fsp.stat(path.join(dirAbs, entry.name)).catch(() => null);
    const lib = row && row.library_id ? db.get('SELECT * FROM library_files WHERE id = ?', row.library_id) : null;
    items.push({
      id: row ? row.id : null,
      name: row ? row.name : prettifyJarName(baseName),
      file: baseName,
      kind,
      source: row ? row.managed_by : server.pack || isPackServer(server) ? 'pack' : 'unknown',
      version: row ? row.version : null,
      size: stat ? stat.size : 0,
      enabled: !isDisabled,
      disabledVia: row && row.managed_by === 'pack' && !isDisabled ? null : undefined,
      sharedWith: lib ? library.usageCount(lib.id) : null,
      iconUrl:
        lib && lib.icon_rel_path ? `/${lib.icon_rel_path}` : (lib && lib.icon_url) || (row && row.icon_url) || null,
      updateAvailable: updateFor(row),
    });
  }
  // Overlay rows whose files vanished (user deleted manually) — surface them.
  for (const row of rows) {
    const base = row.filename.replace(/\.disabled$/, '');
    if (!seen.has(base)) {
      items.push({
        id: row.id,
        name: row.name,
        file: base,
        kind: row.kind,
        source: row.managed_by,
        version: row.version,
        size: 0,
        enabled: false,
        missing: true,
        sharedWith: null,
        iconUrl: row.icon_url,
      });
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function isPackServer(server) {
  return ['AUTO_CURSEFORGE', 'MODRINTH', 'FTBA', 'CURSEFORGE', 'GTNH'].includes(server.type);
}

function updateFor(row) {
  if (!row) return null;
  const check = db.get(
    "SELECT latest_version, latest_name FROM update_checks WHERE subject_type = 'content' AND subject_id = ?",
    row.id
  );
  // latest_name is only set when the checker saw a genuinely newer build;
  // compare name-to-name (latest_version holds the platform id, not a name).
  return check && check.latest_name && check.latest_name !== row.version ? check.latest_name : null;
}

/**
 * Classify an install reference. Pure routing decision, no network.
 * Returns { kind: 'modrinth' | 'curseforge' | 'direct' | 'invalid', ref }.
 *  - modrinth:  modrinth.com page URLs and bare project slugs
 *  - curseforge: curseforge.com page URLs
 *  - direct:    any other URL, INCLUDING cdn.modrinth.com file links —
 *               those are downloads, not project pages
 */
function classifyModSource(input) {
  const ref = String(input || '').trim();
  if (/^https?:\/\//i.test(ref)) {
    let url;
    try {
      url = new URL(ref);
    } catch {
      return { kind: 'invalid', ref };
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'modrinth.com') return { kind: 'modrinth', ref };
    if (host === 'curseforge.com') return { kind: 'curseforge', ref };
    return { kind: 'direct', ref };
  }
  // Modrinth slug charset (their documented rule): [\w!@$()`.+,"\-'] ×3–64.
  // \w keeps underscores valid — sodium_extra style slugs used to 500.
  if (/^[\w!@$()`.+,"\-']{3,64}$/.test(ref)) return { kind: 'modrinth', ref };
  return { kind: 'invalid', ref };
}

/**
 * Install content from any source reference: direct URL, Modrinth URL/slug,
 * or CurseForge URL. Downloads into the library, links into the server dir,
 * and records an overlay row. onProgress passes through to the download.
 */
async function installFromUrl(serverId, input, { actor = 'system', kind, onProgress } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const targetKind = kind || (PLUGIN_TYPES.has(server.type) ? 'plugin' : 'mod');
  const mcVersion = server.mc_version === 'LATEST' || server.mc_version === 'SNAPSHOT' ? undefined : server.mc_version;
  const loader = loaderOf(server);

  const source = classifyModSource(input);
  if (source.kind === 'invalid') {
    throw httpError(400, 'Enter a Modrinth/CurseForge URL, a direct download URL, or a Modrinth project slug');
  }

  let downloadUrl = source.ref;
  const meta = { category: targetKind, platform: 'url' };

  if (source.kind === 'modrinth') {
    const resolved = await modrinth.resolveUrl(source.ref);
    const versions = resolved.versionId
      ? [await modrinth.getVersion(resolved.versionId)]
      : await modrinth.getVersions(resolved.projectId, { loader, mcVersion });
    if (!versions.length)
      throw httpError(404, `No ${resolved.title} build matches ${loader || 'this loader'} ${mcVersion || ''}`.trim());
    const version = versions[0];
    const file = modrinth.primaryFile(version);
    downloadUrl = file.url;
    Object.assign(meta, {
      platform: 'modrinth',
      projectId: resolved.projectId,
      fileId: version.id,
      name: resolved.title,
      filename: file.filename,
      version: version.version_number,
      iconUrl: resolved.iconUrl,
      mcVersions: version.game_versions,
      loaders: version.loaders,
    });
  } else if (source.kind === 'curseforge') {
    const resolved = await curseforge.resolveUrl(source.ref);
    const file = resolved.fileId
      ? await curseforge.getFile(resolved.modId, resolved.fileId)
      : (await curseforge.getFiles(resolved.modId, { mcVersion, loader }))[0];
    if (!file)
      throw httpError(404, `No ${resolved.name} file matches ${loader || 'this loader'} ${mcVersion || ''}`.trim());
    if (!file.downloadUrl)
      throw httpError(
        409,
        `${resolved.name} disallows automated downloads — download it in a browser and upload the jar instead`
      );
    downloadUrl = file.downloadUrl;
    Object.assign(meta, {
      platform: 'curseforge',
      projectId: String(resolved.modId),
      fileId: String(file.fileId),
      name: resolved.name,
      filename: file.fileName,
      version: file.name,
      iconUrl: resolved.iconUrl,
      mcVersions: file.gameVersions,
    });
  }
  // source.kind === 'direct' → plain download of the URL as-is.

  const lib = await library.downloadToLibrary(downloadUrl, meta, { onProgress, actor });
  indexer.assertUnderQuota(server, lib.size_bytes);
  const { filename } = await library.installToServer(lib.id, serverId, contentDir(server, targetKind));

  const id = `sc_${nanoid(8)}`;
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, icon_url)
     VALUES (?, ?, ?, ?, 'overlay', ?, ?, ?, ?)
     ON CONFLICT(server_id, filename) DO UPDATE SET library_id = excluded.library_id, version = excluded.version`,
    id,
    serverId,
    lib.id,
    targetKind,
    lib.name,
    filename,
    lib.version,
    lib.icon_url
  );
  recordEvent({
    serverId,
    actor,
    type: 'mod-installed',
    summary: `Custom ${targetKind} installed: ${lib.name}${lib.version ? ` ${lib.version}` : ''} (overlay)`,
    details: { libraryId: lib.id, filename },
  });
  indexer.scan().catch(() => {});
  return { library: lib, filename };
}

/** Toggle content. Overlay: rename instantly. Pack: exclusion env + recreate flag. */
async function setEnabled(serverId, file, enabled, { actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', serverId, file);
  const managedBy = row ? row.managed_by : isPackServer(server) ? 'pack' : 'overlay';

  if (managedBy === 'overlay' || !isPackServer(server)) {
    const dirRel = contentDir(server, row ? row.kind : 'mod');
    const base = dataPath('servers', serverId, dirRel, file);
    const disabled = `${base}.disabled`;
    if (enabled && fs.existsSync(disabled)) await fsp.rename(disabled, base);
    else if (!enabled && fs.existsSync(base)) await fsp.rename(base, disabled);
    if (row) db.run('UPDATE server_content SET enabled = ? WHERE id = ?', enabled ? 1 : 0, row.id);
    recordEvent({
      serverId,
      actor,
      type: enabled ? 'mod-enabled' : 'mod-disabled',
      summary: `${file} ${enabled ? 'enabled' : 'disabled'} (instant)`,
    });
    return { applied: 'instant' };
  }

  // Pack-managed: manipulate the exclusion env var. Prefer the real CF project
  // slug/ID from the pack manifest — a name-derived token misses renamed/unofficial
  // mods (e.g. display name "cc tweaked" vs slug "unofficial-cc-tweaked-…"), which
  // silently fails to exclude anything.
  const env = { ...server.env };
  const isCF = server.type === 'AUTO_CURSEFORGE';
  const varName = isCF ? 'CF_EXCLUDE_MODS' : 'MODRINTH_EXCLUDE_FILES';
  const fromManifest = packManifestIndex(serverId).get(file.replace(/\.disabled$/, ''));
  const token =
    (fromManifest && (fromManifest.slug || fromManifest.projectId)) ||
    (row && row.icon_url && row.name
      ? row.name.toLowerCase().replace(/\s+/g, '-')
      : file.replace(/(-[\d.]+.*)?\.jar$/, ''));
  const list = (env[varName] || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const next = enabled ? list.filter((t) => t !== token) : [...new Set([...list, token])];
  env[varName] = next.join('\n');
  env[isCF ? 'CF_FORCE_SYNCHRONIZE' : 'MODRINTH_FORCE_SYNCHRONIZE'] = 'true';
  serversService.updateServer(serverId, { env }, { actor });
  recordEvent({
    serverId,
    actor,
    type: enabled ? 'mod-enabled' : 'mod-disabled',
    summary: `${file} ${enabled ? 're-included' : 'excluded'} via ${varName} — applies on next restart`,
  });
  return { applied: 'on-restart' };
}

/** Remove overlay content (file + row); pack content is excluded, not removed. */
async function removeContent(serverId, file, { actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', serverId, file);
  if (row && row.managed_by === 'pack')
    throw httpError(409, 'Pack-managed content is excluded, not deleted — use Disable');
  const dirRel = contentDir(server, row ? row.kind : 'mod');
  let freed = 0;
  for (const candidate of [file, `${file}.disabled`]) {
    const abs = dataPath('servers', serverId, dirRel, candidate);
    if (fs.existsSync(abs)) {
      freed = (await fsp.stat(abs)).size;
      await fsp.rm(abs);
    }
  }
  if (row) db.run('DELETE FROM server_content WHERE id = ?', row.id);
  recordEvent({
    serverId,
    actor,
    type: 'mod-removed',
    summary: `Removed ${file} (${(freed / 1024 / 1024).toFixed(1)} MB freed)`,
  });
  return { freedBytes: freed };
}

/** Re-apply the overlay after a pack install/update (belt-and-braces). */
async function reapplyOverlay(serverId, { actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  const rows = db.all(
    "SELECT * FROM server_content WHERE server_id = ? AND managed_by = 'overlay' AND library_id IS NOT NULL",
    serverId
  );
  let restored = 0;
  for (const row of rows) {
    const dirRel = contentDir(server, row.kind);
    const target = dataPath('servers', serverId, dirRel, row.enabled ? row.filename : `${row.filename}.disabled`);
    if (!fs.existsSync(target) && !fs.existsSync(`${target}.disabled`)) {
      await library.installToServer(row.library_id, serverId, dirRel, { filename: row.filename });
      if (!row.enabled) await fsp.rename(dataPath('servers', serverId, dirRel, row.filename), target);
      restored += 1;
    }
  }
  if (restored > 0) {
    recordEvent({
      serverId,
      actor,
      type: 'overlay-reapplied',
      summary: `Custom overlay re-applied: ${restored} file(s) restored after pack operation`,
    });
  }
  return { restored };
}

function prettifyJarName(file) {
  return (
    file
      .replace(/\.(jar|zip)$/, '')
      .replace(/[-_](\d+\.[\d.]+.*|mc[\d.]+.*|v\d.*)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim() || file
  );
}

// ---------------------------------------------------------------------------
// Manual-download handling. A CurseForge pack can pin mods whose authors disallow
// automated download (or that were pulled from CF). mc-image-helper then writes
// MODS_NEED_DOWNLOAD.txt and the pack install FAILS until each is excluded or
// supplied by hand — this turns that dead-end into guided actions.

/** Best-effort filename -> {slug, projectId} map from the pack's CF manifest. */
function packManifestIndex(serverId) {
  const map = new Map();
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataPath('servers', serverId, '.curseforge-manifest.json'), 'utf8'));
  } catch {
    return map;
  }
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const fname = node.fileName || node.filename;
    const slug = node.slug || node.projectSlug;
    const pid = node.projectID ?? node.projectId ?? node.modId;
    if (typeof fname === 'string' && /\.jar$/i.test(fname) && (slug || pid != null)) {
      map.set(fname, { slug: slug || null, projectId: pid != null ? String(pid) : null });
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(data);
  return map;
}

/** Parse MODS_NEED_DOWNLOAD.txt text → [{ name, versionName, filename, url, slug, fileId }]. */
function parseModsNeedDownload(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /(https?:\/\/\S*curseforge\.com\/\S+)/i.exec(line); // only data rows carry a URL
    if (!m) continue;
    const cols = line
      .slice(0, m.index)
      .split(/\s{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    const filename = cols[cols.length - 1] || '';
    const versionName = cols.length > 1 ? cols[cols.length - 2] : '';
    const name = cols.length > 2 ? cols.slice(0, -2).join(' ') : cols[0] || filename;
    const slug = (/curseforge\.com\/minecraft\/mc-mods\/([^/]+)/i.exec(m[1]) || [])[1] || null;
    const fileId = (/\/download\/(\d+)/.exec(m[1]) || [])[1] || null;
    out.push({ name, versionName, filename, url: m[1], slug, fileId });
  }
  return out;
}

/** Mods a CF pack needs supplied by hand, parsed from the server's MODS_NEED_DOWNLOAD.txt. */
function pendingDownloads(serverId) {
  try {
    return parseModsNeedDownload(fs.readFileSync(dataPath('servers', serverId, 'MODS_NEED_DOWNLOAD.txt'), 'utf8'));
  } catch {
    return [];
  }
}

/** The exclusion token (slug preferred) for a pending mod identified by filename. */
function pendingExcludeToken(serverId, filename) {
  const entry = pendingDownloads(serverId).find((p) => p.filename === filename);
  return (entry && entry.slug) || String(filename).replace(/(-[\d.]+.*)?\.jar$/, '');
}

/** Drop a resolved mod's line from MODS_NEED_DOWNLOAD.txt (best-effort). */
function clearPendingLine(serverId, filename) {
  const file = dataPath('servers', serverId, 'MODS_NEED_DOWNLOAD.txt');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const kept = text.split(/\r?\n/).filter((l) => !filename || !l.includes(filename));
  try {
    if (kept.some((l) => /curseforge\.com/i.test(l))) fs.writeFileSync(file, kept.join('\n'));
    else fs.rmSync(file, { force: true });
  } catch {
    /* ownership not aligned yet — the banner clears on the next successful start */
  }
}

/** Add a project slug/ID to the pack's exclusion env var (applies on recreate). */
function excludePackMod(serverId, token, { actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  if (!token) throw httpError(400, 'Nothing to exclude');
  const isCF = server.type === 'AUTO_CURSEFORGE';
  const varName = isCF ? 'CF_EXCLUDE_MODS' : 'MODRINTH_EXCLUDE_FILES';
  const env = { ...server.env };
  const list = (env[varName] || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.includes(token)) list.push(token);
  env[varName] = list.join('\n');
  env[isCF ? 'CF_FORCE_SYNCHRONIZE' : 'MODRINTH_FORCE_SYNCHRONIZE'] = 'true';
  serversService.updateServer(serverId, { env }, { actor });
  recordEvent({
    serverId,
    actor,
    type: 'mod-excluded',
    summary: `Excluded pack mod "${token}" via ${varName} — applies on recreate`,
  });
  return { excluded: token };
}

/** Install a manually-uploaded jar as an overlay (optionally excluding the pack's copy). */
async function importUploadedMod(serverId, tmpPath, origName, { excludeToken, actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const filename = origName || 'mod.jar';
  if (!/\.(jar|zip)$/i.test(filename)) throw httpError(400, 'Only .jar or .zip files can be uploaded');
  const targetKind = PLUGIN_TYPES.has(server.type) ? 'plugin' : 'mod';
  const lib = await library.importFile(
    tmpPath,
    { name: prettifyJarName(filename), filename, category: targetKind },
    { actor }
  );
  indexer.assertUnderQuota(server, lib.size_bytes);
  const { filename: installed } = await library.installToServer(lib.id, serverId, contentDir(server, targetKind));
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, icon_url)
     VALUES (?, ?, ?, ?, 'overlay', ?, ?, ?, ?)
     ON CONFLICT(server_id, filename) DO UPDATE SET library_id = excluded.library_id`,
    `sc_${nanoid(8)}`,
    serverId,
    lib.id,
    targetKind,
    lib.name,
    installed,
    lib.version,
    lib.icon_url
  );
  if (excludeToken) excludePackMod(serverId, excludeToken, { actor });
  recordEvent({
    serverId,
    actor,
    type: 'mod-installed',
    summary: `Uploaded ${targetKind} installed: ${lib.name} (overlay)`,
    details: { filename: installed },
  });
  indexer.scan().catch(() => {});
  return { filename: installed, excluded: excludeToken || null };
}

module.exports = {
  listContent,
  installFromUrl,
  classifyModSource,
  setEnabled,
  removeContent,
  reapplyOverlay,
  contentDir,
  loaderOf,
  isPackServer,
  parseModsNeedDownload,
  pendingDownloads,
  pendingExcludeToken,
  excludePackMod,
  clearPendingLine,
  importUploadedMod,
};
