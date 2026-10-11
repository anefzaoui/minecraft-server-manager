'use strict';

// The mod loader version of an existing server: what the Versions tab shows
// and changes. A plain loader server pins it with the loader's own itzg
// variable (FORGE_VERSION, NEOFORGE_VERSION, FABRIC_LOADER_VERSION,
// QUILT_LOADER_VERSION). A CurseForge pack installs the version its manifest
// declares; CF_MOD_LOADER_VERSION overrides that, for the pack that lists the
// wrong one - but only for Forge and Fabric packs: the image's CurseForge
// installer hands NeoForge the pack's own loader id and ignores the override.
// Modrinth and FTB packs have no override at all, so their loader follows the
// pack version and is changed by updating the pack. A pack update rewrites the
// pack's CF_ variables, which drops an override along with them.

const fs = require('node:fs');
const path = require('node:path');
const httpError = require('../utils/httpError');
const { serializeError } = require('../utils/logSanitize');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const loaderVersions = require('./loaderVersions');
const packPins = require('./packPins');
const mods = require('./mods');
const servers = require('./servers');
const backups = require('./backups');
const logger = require('../logger')(path.basename(__filename));

const PLAIN_TYPES = { FORGE: 'forge', NEOFORGE: 'neoforge', FABRIC: 'fabric', QUILT: 'quilt' };
const LOADER_NAMES = { forge: 'Forge', neoforge: 'NeoForge', fabric: 'Fabric', quilt: 'Quilt' };
const PACK_OVERRIDE_KEY = 'CF_MOD_LOADER_VERSION';
// Pack types whose loader the image takes from the pack, with no override.
const FIXED_PACK_TYPES = new Set(['MODRINTH', 'FTBA']);
// Loaders the CurseForge installer applies CF_MOD_LOADER_VERSION to.
const CF_OVERRIDABLE = new Set(['forge', 'fabric']);
// The Minecraft-specific loaders: their builds can't be listed without a version.
const MC_SPECIFIC = new Set(['forge', 'neoforge']);

/**
 * @typedef {object} LoaderVersionInfo
 * @property {string} loader            forge | neoforge | fabric | quilt
 * @property {string} loaderName        display name ("NeoForge")
 * @property {'server'|'curseforge'|'modpack'} source  who decides the version
 * @property {string|null} envKey       the variable that pins it; null when nothing can
 * @property {string} pinned            the pinned build, '' when none
 * @property {string|null} installed    the build the image last installed, when known
 * @property {boolean} pendingInstall   a pinned build the image has yet to install
 * @property {string|null} mcVersion    the Minecraft version builds are listed for
 * @property {string|null} fixesMcVersion  a server that follows the newest Minecraft is
 *   fixed to this installed version when a Forge/NeoForge build is pinned (see below)
 * @property {boolean} editable
 */

/**
 * The installed build, read from the manifest the image writes next to the
 * server files (`.forge-manifest.json` and friends). Null before the first
 * install, or when the manifest is unreadable.
 * @param {string} serverId
 * @param {string} loader
 * @returns {{ version: string|null, mcVersion: string|null }}
 */
function readInstalled(serverId, loader) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(dataPath('servers', serverId, `.${loader}-manifest.json`), 'utf8'));
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'ENOENT') {
      logger.debug('Could not read the installed loader manifest.', {
        serverId,
        loader,
        err: serializeError(err, { includeStack: false }),
      });
    }
    return { version: null, mcVersion: null };
  }
  // Field names per the image's installers: Forge/NeoForge share one manifest
  // shape, Quilt has its own, Fabric nests the versions under `origin`.
  const version =
    loader === 'fabric'
      ? manifest.origin && manifest.origin.loader
      : loader === 'quilt'
        ? manifest.loaderVersion
        : manifest.forgeVersion;
  return {
    version: typeof version === 'string' && version ? version : null,
    mcVersion: typeof manifest.minecraftVersion === 'string' ? manifest.minecraftVersion : null,
  };
}

/**
 * What the Versions tab shows for this server's loader, or null when the
 * server has no mod loader (vanilla, plugin servers) or its pack's loader
 * isn't known yet (a pack that has never been installed).
 * @param {{ id: string, type: string, mc_version?: string|null, env: Record<string, string> }} server
 * @returns {LoaderVersionInfo|null}
 */
function loaderVersionInfo(server) {
  /** @type {string|null} */
  let loader = PLAIN_TYPES[/** @type {keyof typeof PLAIN_TYPES} */ (server.type)] || null;
  /** @type {LoaderVersionInfo['source']} */
  let source = 'server';
  if (!loader) {
    if (server.type !== 'AUTO_CURSEFORGE' && !FIXED_PACK_TYPES.has(server.type)) return null;
    loader = mods.loaderOf(server);
    if (!loader || !Object.hasOwn(LOADER_NAMES, loader)) return null;
    // A NeoForge CurseForge pack has no working override (see the top of this
    // file), so it is shown like any other pack whose loader can't be changed.
    source = server.type === 'AUTO_CURSEFORGE' && CF_OVERRIDABLE.has(loader) ? 'curseforge' : 'modpack';
  }
  const envKey =
    source === 'server' ? loaderVersions.envKeyFor(loader) : source === 'curseforge' ? PACK_OVERRIDE_KEY : null;
  const installed = readInstalled(server.id, loader);
  const mc = server.mc_version && !/^(LATEST|SNAPSHOT)$/i.test(server.mc_version) ? server.mc_version : null;
  const pinned = (envKey && server.env[envKey]) || '';
  return {
    loader,
    loaderName: LOADER_NAMES[/** @type {keyof typeof LOADER_NAMES} */ (loader)],
    source,
    envKey,
    pinned,
    installed: installed.version,
    // Only a build number can be compared with what is installed: an image
    // keyword pin ("latest", "recommended") never equals one.
    pendingInstall: Boolean(pinned && installed.version && /^\d/.test(pinned) && pinned !== installed.version),
    // The server's own setting first: right after a Minecraft version change,
    // the manifest still describes the install from before it.
    mcVersion: mc || installed.mcVersion,
    // A Forge or NeoForge build exists for one Minecraft version, but a server
    // on LATEST is re-resolved by the image to the newest version every start:
    // the pin would break the day a newer one ships. Pinning one therefore
    // also fixes the server to the version it has installed.
    fixesMcVersion: source === 'server' && MC_SPECIFIC.has(loader) && !mc ? installed.mcVersion : null,
    editable: Boolean(envKey),
  };
}

/**
 * Refuse a change the server can't take, before any task starts: a server
 * without a changeable loader, or a build that isn't published for its
 * Minecraft version. '' (go back to the default) is always allowed.
 * @param {Parameters<typeof loaderVersionInfo>[0]} server
 * @param {string} version
 * @returns {Promise<LoaderVersionInfo>}
 */
async function assertChangeable(server, version) {
  const info = loaderVersionInfo(server);
  if (!info) throw httpError(409, 'This server has no mod loader to change.');
  if (!info.editable) {
    throw httpError(409, 'This modpack sets its own loader version. Update the modpack to change it.');
  }
  if (version === info.pinned) throw httpError(409, `This server is already set to that ${info.loaderName} version.`);
  // The env this change would write must pass the same pack-pin guard the
  // save does, or a legacy unpinned pack would only fail after its backup.
  const nextEnv = { ...server.env };
  if (version) nextEnv[/** @type {string} */ (info.envKey)] = version;
  else delete nextEnv[/** @type {string} */ (info.envKey)];
  packPins.assertPinnedPackEnv(server.type, nextEnv);
  if (!version) return info;
  if (MC_SPECIFIC.has(info.loader) && !info.mcVersion) {
    throw httpError(
      409,
      `Start this server once, so the panel knows its Minecraft version, then choose a ${info.loaderName} build.`
    );
  }
  let check;
  try {
    check = await loaderVersions.checkBuild(info.loader, info.mcVersion, version);
  } catch (err) {
    // The user gets the 424 below; the cause is kept here, because the error
    // handler only logs a client error's message.
    logger.debug('Could not check a loader build against its registry.', {
      serverId: server.id,
      loader: info.loader,
      err: serializeError(err, { includeStack: false }),
    });
    // 424, not 5xx: the API error handler replaces every 5xx message with a
    // generic one, and this one tells the user what to do.
    throw httpError(
      424,
      `Couldn't reach the ${info.loaderName} build list to check that version. Try again in a minute.`
    );
  }
  if (!check.known) {
    const notPublished =
      info.mcVersion && info.loader !== 'fabric' && info.loader !== 'quilt'
        ? `${info.loaderName} ${version} isn't a published build for Minecraft ${info.mcVersion}.`
        : `${info.loaderName} ${version} isn't a published build.`;
    throw httpError(
      400,
      check.closestNewer ? `${notPublished} The closest newer build is ${check.closestNewer}.` : notPublished
    );
  }
  return info;
}

/**
 * Back up, set (or clear, for '') the loader pin, and rebuild the server so
 * the image installs that build. Runs inside a task; validate with
 * assertChangeable first.
 * @param {string} serverId
 * @param {string} version
 * @param {{ actor: string, task: { step: (label: string) => void } }} opts
 * @returns {Promise<{ from: string, to: string, mcVersion: string|null, backupId: string }>}
 */
async function applyLoaderVersion(serverId, version, { actor, task }) {
  const server = servers.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const info = await assertChangeable(server, version);
  const envKey = /** @type {string} */ (info.envKey);
  const from = info.pinned || info.installed || '';
  // What '' means depends on who decides: the pack's declared build, or the
  // image's own default for a plain server.
  const fallback = info.source === 'curseforge' ? "the modpack's version" : 'the default version';
  const target = version ? `${info.loaderName} ${version}` : `${fallback} of ${info.loaderName}`;

  task.step('Creating pre-update backup…');
  const backup = await backups.createBackup(serverId, {
    reason: 'pre-update',
    actor,
    note: `Before ${info.loaderName} ${from || 'default'} → ${version || 'default'}`,
    task,
  });

  task.step(`Switching to ${target}…`);
  // Re-read: a settings save made while the backup ran must survive the pin.
  const current = servers.getServer(serverId);
  if (!current) throw httpError(404, 'Server not found');
  const env = { ...current.env };
  if (version) env[envKey] = version;
  else delete env[envKey];
  const fixedMc = version && info.fixesMcVersion ? info.fixesMcVersion : null;
  servers.updateServer(serverId, fixedMc ? { env, mcVersion: fixedMc } : { env }, { actor });

  task.step('Rebuilding the server…');
  await servers.recreateServer(serverId, { actor });
  recordEvent({
    serverId,
    actor,
    type: 'loader-version-changed',
    summary: version
      ? `${info.loaderName} version changed to ${version}${fixedMc ? `, with the server fixed to Minecraft ${fixedMc}` : ''}.`
      : `${info.loaderName} version reset to ${fallback}.`,
    details: { loader: info.loader, envKey, from, to: version, mcVersion: fixedMc, backupId: backup.id },
  });
  logger.info('Changed a server loader version.', { serverId, loader: info.loader, from, to: version, actor });
  return { from, to: version, mcVersion: fixedMc, backupId: backup.id };
}

module.exports = { loaderVersionInfo, assertChangeable, applyLoaderVersion, readInstalled, PACK_OVERRIDE_KEY };
