'use strict';

// The panel's pinning invariant, in one place: a pack selector env var
// (CurseForge slug/page URL, Modrinth project, FTB pack id, GTNH type) must
// always be accompanied by its version pin, or the container image resolves
// "latest" again on EVERY start and silently upgrades the server (see
// packs.js - installs have pinned since 0.9.7, but servers created before
// that, or env edited by hand, can still carry the unpinned shape).

const path = require('node:path');
const httpError = require('../utils/httpError');
const logger = require('../logger')(path.basename(__filename));

const has = (env, key) => env[key] != null && String(env[key]).trim() !== '';

/**
 * Detect unpinned pack selectors in a server's (type, env).
 * Returns [] when safe, else one entry per selector:
 * { platform, pinKey, message }.
 */
function unpinnedPackSelectors(type, env = {}) {
  const issues = [];

  // CurseForge: a slug or page URL without CF_FILE_ID. A page URL naming a
  // specific file (…/files/<id>) is itself a pin, and CF_MODPACK_ZIP is a
  // fixed local file with nothing to resolve.
  if ((has(env, 'CF_SLUG') || has(env, 'CF_PAGE_URL')) && !has(env, 'CF_MODPACK_ZIP')) {
    const pagePinned = has(env, 'CF_PAGE_URL') && /\/files\/\d+/.test(env.CF_PAGE_URL);
    if (!has(env, 'CF_FILE_ID') && !pagePinned) {
      issues.push({
        platform: 'curseforge',
        pinKey: 'CF_FILE_ID',
        message:
          'The CurseForge modpack has no pinned file (CF_FILE_ID): the container would install the newest pack version on every start.',
      });
    }
  }

  // Modrinth: a project without MODRINTH_VERSION. A /version/ URL is a pin.
  if (has(env, 'MODRINTH_MODPACK')) {
    const urlPinned = /\/version\//.test(env.MODRINTH_MODPACK);
    if (!has(env, 'MODRINTH_VERSION') && !urlPinned) {
      issues.push({
        platform: 'modrinth',
        pinKey: 'MODRINTH_VERSION',
        message:
          'The Modrinth modpack has no pinned version (MODRINTH_VERSION): the container would install the newest pack version on every start.',
      });
    }
  }

  // FTB: pack id without a version id.
  if (has(env, 'FTB_MODPACK_ID') && !has(env, 'FTB_MODPACK_VERSION_ID')) {
    issues.push({
      platform: 'ftb',
      pinKey: 'FTB_MODPACK_VERSION_ID',
      message:
        'The FTB modpack has no pinned version (FTB_MODPACK_VERSION_ID): the container would install the newest pack version on every start.',
    });
  }

  // GTNH: the type alone selects the pack; without GTNH_PACK_VERSION the
  // image installs the newest release on every start.
  if (type === 'GTNH' && !has(env, 'GTNH_PACK_VERSION')) {
    issues.push({
      platform: 'gtnh',
      pinKey: 'GTNH_PACK_VERSION',
      message:
        'The GTNH server has no pinned pack version (GTNH_PACK_VERSION): the container would install the newest release on every start.',
    });
  }

  return issues;
}

/**
 * Reject an env write that would leave a pack selector unpinned. Every path
 * that persists server env (create, config update, blueprint import) calls
 * this; applyPack is pinned by construction and never trips it.
 */
function assertPinnedPackEnv(type, env) {
  const issues = unpinnedPackSelectors(type, env);
  if (!issues.length) return;
  throw httpError(
    400,
    `${issues.map((i) => i.message).join(' ')} Pick a version in the modpack installer UI (or set ${issues
      .map((i) => i.pinKey)
      .join(', ')}) instead.`
  );
}

// ---- boot-time repair of already-unpinned servers ---------------------------

/**
 * The version pin to adopt for one unpinned selector, from best evidence:
 * 1. the server's own server_packs row (the panel's recorded intent), else
 * 2. the image's install manifest in the data dir - what is ACTUALLY installed
 *    (.curseforge-manifest.json / .modrinth-manifest.json, written by
 *    mc-image-helper; slug is cross-checked so a leftover manifest from a
 *    different pack can't mis-pin).
 * Never resolves "latest": no evidence → no pin (the settings UI shows an
 * unpinned warning with a manual picker instead).
 */
function findPinEvidence(server, issue) {
  const pack = require('./packs').getPack(server.id);
  if (pack && pack.platform === issue.platform && pack.pinned_version_id) {
    return {
      pin: String(pack.pinned_version_id),
      name: pack.pinned_version_name || String(pack.pinned_version_id),
      source: 'panel record',
    };
  }

  const fs = require('node:fs');
  const { dataPath } = require('../storage/pathGuard');
  const readManifest = (file) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dataPath('servers', server.id), file), 'utf8'));
    } catch {
      return null; // absent or unreadable - simply not evidence
    }
  };

  if (issue.platform === 'curseforge') {
    const m = readManifest('.curseforge-manifest.json');
    if (!m || !m.fileId) return null;
    const expected =
      (server.env.CF_SLUG || '').trim().toLowerCase() ||
      (String(server.env.CF_PAGE_URL || '').match(/\/modpacks\/([^/?#]+)/i) || [])[1]?.toLowerCase();
    if (expected && m.slug && m.slug.toLowerCase() !== expected) return null;
    return {
      pin: String(m.fileId),
      name: m.modpackVersion || m.fileName || String(m.fileId),
      source: 'installed manifest',
      manifest: m,
    };
  }
  if (issue.platform === 'modrinth') {
    const m = readManifest('.modrinth-manifest.json');
    if (!m || !m.versionId) return null;
    const ref = String(server.env.MODRINTH_MODPACK || '').trim();
    const expected = ref && !ref.includes('/') ? ref.toLowerCase() : null;
    if (expected && m.projectSlug && m.projectSlug.toLowerCase() !== expected) return null;
    return { pin: String(m.versionId), name: String(m.versionId), source: 'installed manifest', manifest: m };
  }
  return null; // ftb/gtnh: no on-disk manifest to trust - panel record only
}

/**
 * One-shot boot repair (idempotent: pinned servers stop matching): pin every
 * unpinned pack selector to the version that is already installed, so the
 * next recreate can't silently upgrade it. Evidence-less servers are only
 * logged - the UI warns and offers a manual pick.
 */
function pinUnpinnedServers() {
  const db = require('../db');
  const { recordEvent } = require('../events');
  const serversService = require('./servers');
  let pinned = 0;
  let unresolved = 0;

  for (const server of serversService.listServers()) {
    const issues = unpinnedPackSelectors(server.type, server.env);
    if (!issues.length) continue;
    const env = { ...server.env };
    const applied = [];
    for (const issue of issues) {
      const evidence = findPinEvidence(server, issue);
      if (!evidence) {
        unresolved += 1;
        logger.warn('A server has an unpinned modpack and no installed version could be read - pin it manually.', {
          serverId: server.id,
          platform: issue.platform,
        });
        continue;
      }
      env[issue.pinKey] = evidence.pin;
      applied.push({ issue, evidence });
    }
    if (!applied.length) continue;

    db.run('UPDATE servers SET env_json = ?, pending_recreate = 1 WHERE id = ?', JSON.stringify(env), server.id);
    for (const { issue, evidence } of applied) {
      // A CF manifest carries enough to give a legacy server the server_packs
      // row the upgrade/update-check flows key off; never clobber an existing row.
      if (evidence.manifest && issue.platform === 'curseforge') {
        db.run(
          `INSERT INTO server_packs (server_id, platform, project_ref, project_name, pinned_version_id, pinned_version_name)
           VALUES (?, 'curseforge', ?, ?, ?, ?) ON CONFLICT(server_id) DO NOTHING`,
          server.id,
          evidence.manifest.slug || server.env.CF_SLUG || '?',
          evidence.manifest.modpackName || evidence.manifest.slug || 'CurseForge modpack',
          evidence.pin,
          evidence.name
        );
      }
      recordEvent({
        serverId: server.id,
        actor: 'system',
        type: 'pack-pinned',
        summary: `Locked the ${issue.platform} modpack to the installed version (${evidence.name}) - it was set to auto-update on every start`,
        details: { pinKey: issue.pinKey, pin: evidence.pin, source: evidence.source },
      });
      pinned += 1;
    }
    logger.info('Pinned an unpinned modpack server to its installed version.', {
      serverId: server.id,
      pins: applied.map(({ issue, evidence }) => `${issue.pinKey}=${evidence.pin} (${evidence.source})`),
    });
  }
  if (pinned || unresolved) logger.info('Finished the unpinned-modpack sweep.', { pinned, unresolved });
  return { pinned, unresolved };
}

module.exports = { unpinnedPackSelectors, assertPinnedPackEnv, pinUnpinnedServers };
