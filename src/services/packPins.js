'use strict';

// The panel's pinning invariant, in one place: a pack selector env var
// (CurseForge slug/page URL, Modrinth project, FTB pack id, GTNH type) must
// always be accompanied by its version pin, or the container image resolves
// "latest" again on EVERY start and silently upgrades the server (see
// packs.js - installs have pinned since 0.9.7, but servers created before
// that, or env edited by hand, can still carry the unpinned shape).

const httpError = require('../utils/httpError');

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

module.exports = { unpinnedPackSelectors, assertPinnedPackEnv };
