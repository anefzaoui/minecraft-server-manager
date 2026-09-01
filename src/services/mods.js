// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Per-server content management (mods/plugins/datapacks/resourcepacks).
// Two classes of content, handled differently on purpose (see discovery):
//   pack    - installed by the itzg pack installer; deleting the jar triggers
//             re-install, so disable goes through CF_EXCLUDE_MODS /
//             MODRINTH_EXCLUDE_FILES (+ *_FORCE_SYNCHRONIZE) and a recreate.
//   overlay - panel-managed via the shared library; survives pack updates;
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
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

const onRescanFailed = (err) =>
  logger.debug('A background library rescan failed to start.', { err: serializeError(err, { includeStack: false }) });

const PLUGIN_TYPES = new Set(['PAPER', 'PURPUR', 'PUFFERFISH', 'LEAF', 'FOLIA', 'SPIGOT', 'BUKKIT', 'CANYON']);

// Content filenames must be bare names inside the server's content dir. dataPath()
// only guarantees containment within DATA_DIR, so a `file` like "../../../panel.db"
// would still resolve (escaping the server dir to a panel-internal file). Reject any
// separator, NUL, or dot-segment before it reaches a path join.
function assertBareContentName(file) {
  const name = String(file || '');
  if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) {
    throw httpError(400, 'Invalid content filename');
  }
  return name;
}

function contentDir(server, kind) {
  if (kind === 'datapack') return 'world/datapacks';
  if (kind === 'resourcepack') return 'resourcepacks';
  return PLUGIN_TYPES.has(server.type) ? 'plugins' : 'mods';
}

// server_content rows carry `kind`, so toggling/removing normally knows exactly
// which directory a file lives in. But files with no row (dropped in manually,
// or pack-installed content on a non-pack server) have no kind to go on - guessing
// 'mod' silently missed datapacks/resourcepacks (looked in mods/plugins, found
// nothing, reported success without touching the file). Probe every content dir
// instead of guessing, so toggle/remove actually reach the file wherever it is.
function locateContentDir(server, row, file) {
  if (row) return contentDir(server, row.kind);
  for (const kind of ['mod', 'datapack', 'resourcepack']) {
    const dirRel = contentDir(server, kind);
    const base = dataPath('servers', server.id, dirRel, file);
    if (fs.existsSync(base) || fs.existsSync(`${base}.disabled`)) return dirRel;
  }
  return contentDir(server, 'mod'); // not found anywhere - fall back to the old default
}

/** The primary content kind a server runs - the single source for plugin-vs-mod. */
function contentKindOf(server) {
  return PLUGIN_TYPES.has(server.type) ? 'plugin' : 'mod';
}

// Modpack servers don't set CF_MOD_LOADER/MODRINTH_LOADER - the pack itself
// decides the loader. mc-image-helper writes a per-loader manifest into the data
// dir (e.g. .neoforge-manifest.json), so detect from that; otherwise mod installs
// have no loader to match and grab an arbitrary (e.g. Fabric) build.
// loaderOf() is called from serverVM() for every server on essentially every
// page render (sidebar + dashboard/servers list) - cache the directory-listing
// result briefly instead of re-running a sync readdirSync per server per
// request. The manifest file this detects only changes across a pack
// recreate/upgrade (an occasional, deliberate action), so a short TTL bounds
// the sync-call frequency with a practically unnoticeable staleness window.
const loaderCache = new Map(); // serverId -> { loader, expiresAt }
const LOADER_CACHE_TTL_MS = 60 * 1000;

function detectPackLoader(serverId) {
  const cached = loaderCache.get(serverId);
  if (cached && cached.expiresAt > Date.now()) return cached.loader;
  let names;
  try {
    names = fs.readdirSync(dataPath('servers', serverId));
  } catch {
    return null;
  }
  let loader = null;
  for (const candidate of ['neoforge', 'forge', 'fabric', 'quilt']) {
    if (names.includes(`.${candidate}-manifest.json`)) {
      loader = candidate;
      break;
    }
  }
  loaderCache.set(serverId, { loader, expiresAt: Date.now() + LOADER_CACHE_TTL_MS });
  return loader;
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
  const primaryKind = contentKindOf(server);

  const rows = db.all('SELECT * FROM server_content WHERE server_id = ?', serverId);
  const byFile = new Map(rows.map((r) => [r.filename.replace(/\.disabled$/, ''), r]));
  const seen = new Set();
  const items = [];

  // Batch the per-row lookups that used to run once per item (library file,
  // usage count, update check) - a modpack with a few hundred mods turned
  // into a few hundred extra round trips each for something a single
  // IN (...) query covers.
  const libraryIds = [...new Set(rows.map((r) => r.library_id).filter(Boolean))];
  const libById = new Map();
  const usageCounts = new Map();
  if (libraryIds.length) {
    const placeholders = libraryIds.map(() => '?').join(',');
    for (const lib of db.all(`SELECT * FROM library_files WHERE id IN (${placeholders})`, ...libraryIds)) {
      libById.set(lib.id, lib);
    }
    for (const u of db.all(
      `SELECT library_id, COUNT(*) AS n FROM server_content WHERE library_id IN (${placeholders}) GROUP BY library_id`,
      ...libraryIds
    )) {
      usageCounts.set(u.library_id, u.n);
    }
  }
  const rowIds = rows.map((r) => r.id);
  const updateChecks = new Map();
  if (rowIds.length) {
    const placeholders = rowIds.map(() => '?').join(',');
    for (const c of db.all(
      `SELECT * FROM update_checks WHERE subject_type = 'content' AND subject_id IN (${placeholders})`,
      ...rowIds
    )) {
      updateChecks.set(c.subject_id, c);
    }
  }
  // latest_name is only set when the checker saw a genuinely newer build;
  // compare name-to-name (latest_version holds the platform id, not a name).
  const updateAvailableFor = (row) => {
    if (!row) return null;
    const check = updateChecks.get(row.id);
    return check && check.latest_name && check.latest_name !== row.version ? check.latest_name : null;
  };

  // Datapacks and resource packs work on every server type (vanilla included),
  // unlike mods/plugins which are loader/platform-specific - always scan all
  // three dirs, not just the one matching this server's type.
  for (const kind of [primaryKind, 'datapack', 'resourcepack']) {
    const dirAbs = dataPath('servers', serverId, contentDir(server, kind));
    let entries;
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      continue; // dir doesn't exist yet
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const isDisabled = entry.name.endsWith('.disabled');
      const baseName = entry.name.replace(/\.disabled$/, '');
      if (!baseName.endsWith('.jar') && !baseName.endsWith('.zip')) continue;
      seen.add(baseName);
      const row = byFile.get(baseName);
      const stat = await fsp.stat(path.join(dirAbs, entry.name)).catch(() => null);
      const lib = row && row.library_id ? libById.get(row.library_id) : null;
      items.push({
        id: row ? row.id : null,
        name: row ? row.name : prettifyJarName(baseName),
        file: baseName,
        kind: row ? row.kind : kind,
        source: row ? row.managed_by : server.pack || isPackServer(server) ? 'pack' : 'unknown',
        version: row ? row.version : null,
        size: stat ? stat.size : 0,
        enabled: !isDisabled,
        disabledVia: row && row.managed_by === 'pack' && !isDisabled ? null : undefined,
        sharedWith: lib ? usageCounts.get(lib.id) || 0 : null,
        iconUrl:
          lib && lib.icon_rel_path ? `/${lib.icon_rel_path}` : (lib && lib.icon_url) || (row && row.icon_url) || null,
        updateAvailable: updateAvailableFor(row),
        // Provenance, when known - lets search UIs badge already-installed hits.
        platform: (lib && lib.platform) || null,
        projectId: (lib && lib.project_id) || null,
      });
    }
  }
  // Overlay rows whose files vanished (user deleted manually) - surface them.
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

/**
 * Classify an install reference. Pure routing decision, no network.
 * Returns { kind: 'modrinth' | 'curseforge' | 'hangar' | 'spiget' | 'github'
 *           | 'direct' | 'invalid', ref }.
 *  - modrinth:  modrinth.com page URLs and bare project slugs
 *  - curseforge: curseforge.com page URLs
 *  - hangar:    hangar.papermc.io project/version page URLs
 *  - spiget:    spigotmc.org resource page URLs
 *  - github:    github.com repo/release URLs and bare "owner/repo" refs
 *  - direct:    any other URL, INCLUDING cdn.modrinth.com file links -
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
    if (host === 'hangar.papermc.io') return { kind: 'hangar', ref };
    if (host === 'spigotmc.org') return { kind: 'spiget', ref };
    if (host === 'github.com' && require('./githubApi').parseRepoRef(ref)) return { kind: 'github', ref };
    return { kind: 'direct', ref };
  }
  // A slash can never appear in a Modrinth slug, so "owner/repo" is
  // unambiguously a GitHub ref.
  if (/^[\w.-]+\/[\w.-]+$/.test(ref) && !ref.includes('..')) return { kind: 'github', ref };
  // Modrinth slug charset (their documented rule): [\w!@$()`.+,"\-'] ×3–64.
  // \w keeps underscores valid - sodium_extra style slugs used to 500.
  if (/^[\w!@$()`.+,"\-']{3,64}$/.test(ref)) return { kind: 'modrinth', ref };
  return { kind: 'invalid', ref };
}

/**
 * Install content from any source reference: direct URL, Modrinth URL/slug,
 * or CurseForge URL. Downloads into the library, links into the server dir,
 * and records an overlay row. onProgress passes through to the download.
 */
async function installFromUrl(serverId, input, { actor = 'system', kind, onProgress, ignoreVersion = false } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  let targetKind = kind || contentKindOf(server);
  // ignoreVersion: the user explicitly asked to install a build that isn't
  // listed as compatible with this server - accepting the risk waives BOTH
  // the exact MC version match (e.g. the newest Fabric build only lists
  // 1.21.1 and the server runs 1.21.2) and the loader/platform match, since
  // either can be the thing a build simply isn't tagged for.
  const mcVersion =
    ignoreVersion || server.mc_version === 'LATEST' || server.mc_version === 'SNAPSHOT' ? undefined : server.mc_version;
  // loader is the server's actual loader (used by the override note below to
  // report "not built for <loader>"). effectiveLoader is the one used to filter
  // builds: only a meaningful version filter for mods, since Modrinth tags
  // plugin builds paper/spigot/bukkit (a strict facet would hide spigot-only
  // plugins) and datapack/resourcepack builds by content type, so filtering
  // those by the server's loader over-filters to zero. The override waives it.
  const loader = loaderOf(server);
  const effectiveLoader = ignoreVersion || targetKind !== 'mod' ? undefined : loader;

  const source = classifyModSource(input);
  if (source.kind === 'invalid') {
    throw httpError(
      400,
      'Enter a Modrinth/CurseForge/Hangar/SpigotMC/GitHub URL, a direct download URL, a Modrinth slug, or a GitHub owner/repo'
    );
  }

  let downloadUrl = source.ref;
  const meta = { category: targetKind, platform: 'url' };

  if (source.kind === 'modrinth') {
    const resolved = await modrinth.resolveUrl(source.ref);
    // Datapacks/resourcepacks aren't loader-specific, and search already sends
    // kind explicitly - this only fires for "Add by URL"/slug installs where
    // the caller couldn't have known the project type in advance.
    if (!kind && (resolved.projectType === 'datapack' || resolved.projectType === 'resourcepack')) {
      targetKind = resolved.projectType;
    }
    const versionLoader = targetKind === 'datapack' || targetKind === 'resourcepack' ? undefined : effectiveLoader;
    let versions = resolved.versionId
      ? [await modrinth.getVersion(resolved.versionId)]
      : await modrinth.getVersions(resolved.projectId, { loader: versionLoader, mcVersion });
    // The unfiltered plugin query returns every build of hybrid projects
    // (WorldEdit-style plugin+mod releases) - newest-first could hand a Paper
    // server a Fabric jar. Keep only builds tagged with a plugin loader,
    // unless the user pinned an exact version themselves.
    if (targetKind === 'plugin' && !resolved.versionId) {
      const { PLUGIN_LOADERS } = require('./modIdentify');
      // Drop builds tagged for a non-plugin loader only (a hybrid project's
      // Fabric/Forge jar), but keep untagged builds - many pure plugins carry no
      // loader tag at all, and filtering those out would leave zero results.
      versions = versions.filter((v) => {
        const loaders = (v.loaders || []).map((l) => String(l).toLowerCase());
        return loaders.length === 0 || loaders.some((l) => PLUGIN_LOADERS.has(l));
      });
    }
    if (!versions.length)
      throw httpError(
        404,
        targetKind === 'plugin'
          ? `No ${resolved.title} plugin build matches this server${mcVersion ? ` (Minecraft ${mcVersion})` : ''}`
          : `No ${resolved.title} build matches ${versionLoader || 'this loader'} ${mcVersion || ''}`.trim()
      );
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
      expectedHashes: file.hashes || {},
    });
  } else if (source.kind === 'curseforge') {
    const resolved = await curseforge.resolveUrl(source.ref);
    const file = resolved.fileId
      ? await curseforge.getFile(resolved.modId, resolved.fileId)
      : (await curseforge.getFiles(resolved.modId, { mcVersion, loader: effectiveLoader }))[0];
    if (!file)
      throw httpError(
        404,
        `No ${resolved.name} file matches ${effectiveLoader || 'this loader'} ${mcVersion || ''}`.trim()
      );
    if (!file.downloadUrl)
      throw httpError(
        409,
        `${resolved.name} disallows automated downloads - download it in a browser and upload the jar instead`
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
      expectedHashes: require('../utils/contentHashes').fromCurseforge(file.hashes),
    });
  } else if (source.kind === 'hangar') {
    const hangar = require('./hangarApi');
    const resolved = await hangar.resolveUrl(source.ref);
    const versions = await hangar.getVersions(resolved.slug, { mcVersion });
    let version = resolved.versionName
      ? versions.find((v) => v.name === resolved.versionName) ||
        (await hangar.getVersions(resolved.slug, {})).find((v) => v.name === resolved.versionName)
      : versions[0];
    if (!version) {
      throw httpError(404, `No ${resolved.name} build matches this server${mcVersion ? ` (Minecraft ${mcVersion})` : ''}`);
    }
    if (!version.downloadUrl) throw httpError(409, `${resolved.name} publishes no downloadable Paper file for this version`);
    downloadUrl = version.downloadUrl;
    Object.assign(meta, {
      platform: 'hangar',
      projectId: resolved.slug,
      fileId: version.name,
      name: resolved.name,
      filename: version.filename,
      version: version.name,
      iconUrl: resolved.iconUrl,
      mcVersions: version.gameVersions,
      expectedHashes: version.sha256 ? { sha256: version.sha256 } : {},
    });
  } else if (source.kind === 'spiget') {
    const spiget = require('./spigetApi');
    const ref = spiget.parseResourceRef(source.ref);
    if (!ref) throw httpError(400, 'Could not read a SpigotMC resource id from that URL');
    const resource = await spiget.getResource(ref.resourceId);
    if (resource.external) {
      throw httpError(
        409,
        `${resource.name} is hosted outside SpigotMC and can't be auto-downloaded - download it in a browser (${resource.pageUrl}) and upload the jar instead`
      );
    }
    const versions = await spiget.getVersions(ref.resourceId);
    const version = ref.versionId ? versions.find((v) => v.versionId === ref.versionId) : versions[0];
    if (!version) throw httpError(404, `No downloadable version of ${resource.name} was found`);
    downloadUrl = spiget.downloadUrl(ref.resourceId, version.versionId);
    Object.assign(meta, {
      platform: 'spiget',
      projectId: String(ref.resourceId),
      fileId: version.versionId,
      name: resource.name,
      filename: `${resource.name.replace(/[^\w.-]+/g, '-')}-${version.name}.jar`,
      version: version.name,
      iconUrl: resource.iconUrl,
      mcVersions: resource.testedVersions, // resource-level "tested" majors; Spiget has no per-version tags
    });
  } else if (source.kind === 'github') {
    const github = require('./githubApi');
    const ref = github.parseRepoRef(source.ref);
    const repoInfo = await github.getRepo(ref.repo);
    const releases = await github.getReleases(ref.repo);
    const withJars = releases.filter((r) => r.assets.length);
    const release = ref.tag
      ? releases.find((r) => r.tag === ref.tag)
      : withJars.find((r) => !r.prerelease) || withJars[0];
    if (!release) {
      throw httpError(404, ref.tag ? `No release tagged ${ref.tag} in ${ref.repo}` : `No release with jar assets in ${ref.repo}`);
    }
    const asset = github.pickAsset(release.assets, ref.asset);
    if (!asset) throw httpError(404, `Release ${release.tag} of ${ref.repo} has no jar assets`);
    downloadUrl = asset.downloadUrl;
    Object.assign(meta, {
      platform: 'github',
      projectId: ref.repo,
      fileId: release.tag,
      name: repoInfo.name || ref.repo,
      filename: asset.name,
      version: release.tag,
      iconUrl: repoInfo.iconUrl,
    });
  }
  // source.kind === 'direct' → plain download of the URL as-is.
  meta.category = targetKind; // may have changed above (Modrinth datapack/resourcepack auto-detect)

  return installResolved(serverId, { downloadUrl, meta, kind: targetKind }, { actor, onProgress, ignoreVersion });
}

/**
 * Install an already-resolved download (URL + metadata) as an overlay.
 * The shared tail of every install path: library download → quota check →
 * link into the server dir → server_content row → event. Used directly by
 * bulk installers (modpack zip import) that resolved files via bulk API calls
 * and must not re-resolve one mod at a time.
 */
async function installResolved(
  serverId,
  { downloadUrl, meta, kind = 'mod' },
  { actor = 'system', onProgress, ignoreVersion = false } = {}
) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const lib = await library.downloadToLibrary(downloadUrl, meta, { onProgress, actor });
  indexer.assertUnderQuota(server, lib.size_bytes);
  const { filename } = await library.installToServer(lib.id, serverId, contentDir(server, kind));

  const id = `sc_${nanoid(8)}`;
  db.run(
    `INSERT INTO server_content (id, server_id, library_id, kind, managed_by, name, filename, version, icon_url)
     VALUES (?, ?, ?, ?, 'overlay', ?, ?, ?, ?)
     ON CONFLICT(server_id, filename) DO UPDATE SET library_id = excluded.library_id, version = excluded.version`,
    id,
    serverId,
    lib.id,
    kind,
    lib.name,
    filename,
    lib.version,
    lib.icon_url
  );
  // ignoreVersion is only ever set by the single-URL install path; bulk zip
  // imports call this without it, so their override flags stay false.
  // meta.mcVersions/meta.loaders are only set for modrinth sources (curseforge
  // has no meta.loaders at all) - a direct-URL install has nothing to compare
  // against either way, so neither flag ever fires for one.
  const overrideLoader = kind === 'mod' ? loaderOf(server) : null;
  const versionOverridden =
    ignoreVersion &&
    server.mc_version &&
    Array.isArray(meta.mcVersions) &&
    !meta.mcVersions.includes(server.mc_version);
  // Only meaningful for plain mods: plugin loader categories are already
  // known-unreliable, and datapacks/resourcepacks have no loader concept.
  const loaderOverridden =
    ignoreVersion &&
    kind === 'mod' &&
    overrideLoader &&
    Array.isArray(meta.loaders) &&
    !require('../utils/loaderCompat').loaderAccepts(overrideLoader, meta.loaders);
  const overrideBits = [
    versionOverridden ? `not listed for ${server.mc_version}` : null,
    loaderOverridden ? `not built for ${overrideLoader}` : null,
  ].filter(Boolean);
  recordEvent({
    serverId,
    actor,
    type: 'mod-installed',
    summary:
      `Custom ${kind} installed: ${lib.name}${lib.version ? ` ${lib.version}` : ''}` +
      (overrideBits.length
        ? ` - ${overrideBits.join(', ')}, installed anyway (compatibility check overridden)`
        : ' (overlay)'),
    details: { libraryId: lib.id, filename, versionOverridden, loaderOverridden },
  });
  logger.info('Installed custom content on a server.', { serverId, actor, kind, filename });
  indexer.scan().catch(onRescanFailed);
  return { library: lib, filename, versionOverridden, loaderOverridden };
}

/** Toggle content. Overlay: rename instantly. Pack: exclusion env + recreate flag. */
async function setEnabled(serverId, file, enabled, { actor = 'system' } = {}) {
  assertBareContentName(file);
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', serverId, file);
  const managedBy = row ? row.managed_by : isPackServer(server) ? 'pack' : 'overlay';

  if (managedBy === 'overlay' || !isPackServer(server)) {
    const dirRel = locateContentDir(server, row, file);
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
  // slug/ID from the pack manifest - a name-derived token misses renamed/unofficial
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
    summary: `${file} ${enabled ? 're-included' : 'excluded'} via ${varName} - applies on next restart`,
  });
  return { applied: 'on-restart' };
}

/** Remove overlay content (file + row); pack content is excluded, not removed. */
async function removeContent(serverId, file, { actor = 'system' } = {}) {
  assertBareContentName(file);
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const row = db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', serverId, file);
  // Pack-installed files have no server_content row at all (only overlay
  // installs get one), so `row && row.managed_by === 'pack'` never caught
  // them - a row-less file on a pack server slipped past this guard, got
  // deleted from disk with nothing recorded to keep it excluded, and came
  // back the moment the pack next recreated. Mirror listContent()'s own
  // "pack" classification (row-less + pack server ⇒ pack-managed) instead.
  const managedByPack = row ? row.managed_by === 'pack' : isPackServer(server);
  if (managedByPack) throw httpError(409, 'Pack-managed content is excluded, not deleted - use Disable');
  const dirRel = locateContentDir(server, row, file);
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
  logger.info('Removed content from a server.', { serverId, actor, file, freedBytes: freed });
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
      summary: `Custom mods re-applied: ${restored} file(s) restored after pack operation`,
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
// supplied by hand - this turns that dead-end into guided actions.

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
    /* ownership not aligned yet - the banner clears on the next successful start */
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
    summary: `Excluded pack mod "${token}" via ${varName} - applies on recreate`,
  });
  return { excluded: token };
}

/**
 * Install a manually-uploaded jar as an overlay (optionally excluding the
 * pack's copy). The jar is identified first (Modrinth hash → CF fingerprint →
 * embedded metadata) so uploads keep real provenance — name, version, icon,
 * and the platform/project ids that make them update-checkable later.
 */
async function importUploadedMod(serverId, tmpPath, origName, { excludeToken, actor = 'system' } = {}) {
  const filename = origName || 'mod.jar';
  let identity = null;
  try {
    const buffer = await fsp.readFile(tmpPath);
    const [identified] = await require('./modIdentify').identifyJars([{ name: filename, buffer }]);
    identity = identified.identity;
  } catch {
    /* identification is best-effort — an unreadable jar still imports as-is */
  }
  return installLocalContent(serverId, tmpPath, filename, { identity, excludeToken, actor });
}

/**
 * Shared tail of every local-file install: library import (with whatever
 * identity is known) → quota → link into the server dir → overlay row.
 * Bulk importers (mod-zip digester) identify in one batch and call this per
 * jar; the single-upload path identifies one jar then lands here.
 */
async function installLocalContent(
  serverId,
  tmpPath,
  filename,
  { identity = null, excludeToken, actor = 'system' } = {}
) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  if (!/\.(jar|zip)$/i.test(filename)) throw httpError(400, 'Only .jar or .zip files can be uploaded');
  const targetKind = contentKindOf(server);

  const fromRegistry = identity && (identity.platform === 'modrinth' || identity.platform === 'curseforge');
  const lib = await library.importFile(
    tmpPath,
    {
      name: (identity && identity.name) || prettifyJarName(filename),
      filename,
      category: targetKind,
      version: (identity && identity.version) || null,
      platform: fromRegistry ? identity.platform : 'upload',
      projectId: fromRegistry ? identity.projectId : null,
      fileId: fromRegistry ? identity.versionId : null,
      iconUrl: (identity && identity.iconUrl) || null,
      mcVersions: (identity && identity.mcVersions) || [],
      loaders: (identity && identity.loaders) || [],
    },
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
    summary: `Uploaded ${targetKind} installed: ${lib.name}`,
    details: { filename: installed },
  });
  indexer.scan().catch(onRescanFailed);
  return { filename: installed, name: lib.name, version: lib.version, excluded: excludeToken || null };
}

module.exports = {
  listContent,
  installFromUrl,
  installResolved,
  classifyModSource,
  setEnabled,
  removeContent,
  reapplyOverlay,
  contentDir,
  contentKindOf,
  loaderOf,
  isPackServer,
  parseModsNeedDownload,
  pendingDownloads,
  pendingExcludeToken,
  excludePackMod,
  clearPendingLine,
  importUploadedMod,
  installLocalContent,
};
