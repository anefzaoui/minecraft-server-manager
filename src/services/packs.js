// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Modpack installation & pinning. Minecraft Server Manager NEVER installs an unpinned pack:
// "latest" is resolved to a concrete version id at install time, so container
// restarts can never silently upgrade a server (discovery: unpinned
// AUTO_CURSEFORGE/MODRINTH auto-upgrade on every start).

const httpError = require('../utils/httpError');
const db = require('../db');
const { recordEvent } = require('../events');
const serversService = require('./servers');
const modrinth = require('./modrinthApi');
const curseforge = require('./curseforgeApi');
const modsService = require('./mods');

/**
 * Resolve a pack reference to install candidates.
 * platform: 'curseforge' | 'modrinth' | 'ftb'
 * ref: slug/URL/id — versionId optional (null → resolve latest now, then pin).
 */
/**
 * CF bare slugs default to the MODS class in curseforge.resolveUrl, but this
 * service only ever deals in MODPACKS — spell it out as a modpacks URL so
 * slugs like "all-the-mods-10" resolve. Numeric IDs and full URLs pass through.
 */
function normalizeCurseforgeRef(ref) {
  const s = String(ref).trim();
  if (/^https?:\/\//i.test(s) || /^\d+$/.test(s)) return s;
  return `https://www.curseforge.com/minecraft/modpacks/${s}`;
}

async function resolvePack(platform, ref, { versionId = null, mcVersion } = {}) {
  if (platform === 'curseforge') {
    const project = await curseforge.resolveUrl(normalizeCurseforgeRef(ref));
    const files = await curseforge.getFiles(project.modId, { mcVersion });
    const file = versionId
      ? await curseforge.getFile(project.modId, Number(versionId))
      : files.find((f) => f.releaseType === 'release') || files[0];
    if (!file) throw httpError(404, `No installable file found for ${project.name}`);
    return {
      platform,
      projectRef: project.slug,
      projectId: String(project.modId),
      projectName: project.name,
      iconUrl: project.iconUrl,
      versionId: String(file.fileId),
      versionName: file.name,
      mcVersion: pickMcVersion(file.gameVersions),
      allVersions: files
        .slice(0, 25)
        .map((f) => ({ id: String(f.fileId), name: f.name, type: f.releaseType, date: f.fileDate })),
    };
  }
  if (platform === 'modrinth') {
    const project = await modrinth.resolveUrl(ref);
    const versions = await modrinth.getVersions(project.projectId, { mcVersion });
    const version = versionId
      ? await modrinth.getVersion(versionId)
      : versions.find((v) => v.version_type === 'release') || versions[0];
    if (!version) throw httpError(404, `No installable version found for ${project.title}`);
    return {
      platform,
      projectRef: project.slug,
      projectId: project.projectId,
      projectName: project.title,
      iconUrl: project.iconUrl,
      versionId: version.id,
      versionName: version.version_number,
      mcVersion: version.game_versions[version.game_versions.length - 1] || null,
      loaders: version.loaders,
      allVersions: versions
        .slice(0, 25)
        .map((v) => ({ id: v.id, name: v.version_number, type: v.version_type, date: v.date_published })),
    };
  }
  if (platform === 'ftb') {
    const id = String(ref).match(/\d+/)?.[0];
    if (!id) throw httpError(400, 'FTB packs are referenced by numeric modpack ID');
    if (!versionId) throw httpError(400, 'FTB installs need an explicit version ID (the panel never uses latest)');
    return {
      platform,
      projectRef: id,
      projectId: id,
      projectName: `FTB pack ${id}`,
      versionId: String(versionId),
      versionName: String(versionId),
      mcVersion: null,
    };
  }
  throw httpError(400, `Unknown modpack platform: ${platform}`);
}

/** Env vars implementing the PINNED install for each platform. */
function packEnv(resolved) {
  if (resolved.platform === 'curseforge') {
    return {
      TYPE: 'AUTO_CURSEFORGE',
      CF_SLUG: resolved.projectRef,
      CF_FILE_ID: resolved.versionId,
    };
  }
  if (resolved.platform === 'modrinth') {
    const env = {
      TYPE: 'MODRINTH',
      MODRINTH_MODPACK: resolved.projectRef,
      MODRINTH_VERSION: resolved.versionId,
    };
    // Record the loader so the panel (mods manager, BlueMap, update checks)
    // knows the ecosystem without re-querying the API.
    const loader = (resolved.loaders || []).find((l) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(l));
    if (loader) env.MODRINTH_LOADER = loader;
    return env;
  }
  return {
    TYPE: 'FTBA',
    FTB_MODPACK_ID: resolved.projectRef,
    FTB_MODPACK_VERSION_ID: resolved.versionId,
  };
}

/**
 * Apply a pack (install or version change) to an existing server:
 * updates env with the pinned reference, records server_packs, flags recreate.
 * The caller decides when to restart (upgrade orchestrator stops first).
 */
async function applyPack(serverId, resolved, { actor = 'system', force = false } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');

  // World-safety guard (learned the hard way): applying a pack that targets a
  // different MC version than the existing world either crashes on boot
  // (downgrade) or irreversibly upgrades the world. Require explicit consent.
  if (!force) {
    const warnings = worldVersionWarnings(server, resolved);
    if (warnings.length) {
      const err = httpError(409, warnings.join(' '));
      err.warnings = warnings;
      err.requiresForce = true;
      throw err;
    }
  }

  const previous = db.get('SELECT * FROM server_packs WHERE server_id = ?', serverId);
  // Strip EVERY previous pack-selection/exclusion env var (CF_/MODRINTH_/FTB_)
  // before merging the new pack env: switching platform (or even version)
  // must not leave stale slugs, file pins or exclusion lists behind. Unrelated
  // user env is preserved.
  const cleanedEnv = Object.fromEntries(
    Object.entries(server.env).filter(([key]) => !/^(CF_|MODRINTH_|FTB_)/.test(key))
  );
  const env = { ...cleanedEnv, ...packEnv(resolved) };
  // The TYPE lives in its own column; keep env's TYPE out of the extras.
  const type = env.TYPE;
  delete env.TYPE;

  db.run(
    `UPDATE servers SET type = ?, env_json = ?, pending_recreate = 1${resolved.mcVersion ? ', mc_version = ?' : ''} WHERE id = ?`,
    ...(resolved.mcVersion
      ? [type, JSON.stringify(env), resolved.mcVersion, serverId]
      : [type, JSON.stringify(env), serverId])
  );
  db.run(
    `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name, previous_version_id, previous_version_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(server_id) DO UPDATE SET
       platform = excluded.platform, project_ref = excluded.project_ref, project_name = excluded.project_name,
       pinned_version_id = excluded.pinned_version_id, pinned_version_name = excluded.pinned_version_name,
       previous_version_id = excluded.previous_version_id, previous_version_name = excluded.previous_version_name,
       installed_at = datetime('now')`,
    serverId,
    resolved.platform,
    resolved.projectRef,
    resolved.projectName,
    resolved.versionId,
    resolved.versionName,
    previous ? previous.pinned_version_id : null,
    previous ? previous.pinned_version_name : null
  );
  recordEvent({
    serverId,
    actor,
    type: previous ? 'modpack-updated' : 'modpack-applied',
    summary: previous
      ? `Pack ${resolved.projectName}: ${previous.pinned_version_name} → ${resolved.versionName} (pinned)`
      : `Pack applied: ${resolved.projectName} @ ${resolved.versionName} (pinned)`,
    details: {
      platform: resolved.platform,
      versionId: resolved.versionId,
      previous: previous ? previous.pinned_version_id : null,
    },
  });
  return { previous: previous || null };
}

function getPack(serverId) {
  return db.get('SELECT * FROM server_packs WHERE server_id = ?', serverId) || null;
}

/** Latest available version for a server's pinned pack (for the update checker). */
async function latestFor(serverId) {
  const pack = getPack(serverId);
  if (!pack) return null;
  if (pack.platform === 'ftb') return null; // FTB API not wired for checks yet
  // Scope "latest" to the server's own MC version — otherwise the checker
  // offers upgrades that silently cross MC versions.
  const server = serversService.getServer(serverId);
  const mcVersion = server && !['LATEST', 'SNAPSHOT'].includes(server.mc_version) ? server.mc_version : undefined;
  const resolved = await resolvePack(pack.platform, pack.project_ref, { mcVersion });
  return {
    current: { id: pack.pinned_version_id, name: pack.pinned_version_name },
    latest: { id: resolved.versionId, name: resolved.versionName },
    updateAvailable: resolved.versionId !== pack.pinned_version_id,
    projectName: pack.project_name,
    projectRef: pack.project_ref,
    platform: pack.platform,
  };
}

/** After any pack install/update completes on disk, restore the overlay. */
async function afterPackOperation(serverId, { actor = 'system' } = {}) {
  return modsService.reapplyOverlay(serverId, { actor });
}

/** Warnings when a pack's MC version conflicts with the server's existing world. */
function worldVersionWarnings(server, resolved) {
  if (!resolved.mcVersion) return [];
  const warnings = [];
  try {
    const worlds = require('./worlds');
    const { dataPath } = require('../storage/pathGuard');
    const path = require('node:path');
    const level = worlds.activeLevelName(server);
    const worldVersion = worlds.readLevelVersion(path.join(dataPath('servers', server.id), level, 'level.dat'));
    if (worldVersion && worldVersion !== resolved.mcVersion) {
      const { parseVersion } = require('./javaMatrix');
      const wv = parseVersion(worldVersion);
      const pv = parseVersion(resolved.mcVersion);
      const downgrade =
        wv &&
        pv &&
        (pv.major < wv.major ||
          (pv.major === wv.major && (pv.minor < wv.minor || (pv.minor === wv.minor && pv.patch < wv.patch))));
      warnings.push(
        downgrade
          ? `This pack runs Minecraft ${resolved.mcVersion} but the existing world was generated on ${worldVersion} — Minecraft cannot load newer worlds on older versions and the server will crash. Reset or swap the world first, or confirm to proceed anyway.`
          : `This pack runs Minecraft ${resolved.mcVersion} but the existing world is from ${worldVersion} — starting will permanently upgrade the world (make a backup first).`
      );
    }
  } catch {
    /* unreadable level.dat → no warning */
  }
  return warnings;
}

function pickMcVersion(gameVersions = []) {
  return gameVersions.find((v) => /^\d+\.\d+(\.\d+)?$/.test(v)) || null;
}

module.exports = { resolvePack, applyPack, getPack, latestFor, afterPackOperation, packEnv };
