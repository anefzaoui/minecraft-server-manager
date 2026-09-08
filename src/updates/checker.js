// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Update checker: compares pinned packs, overlay mods, and the itzg image
// against the latest available, caching results in update_checks. Scheduled
// daily + on-demand; API-friendly (all lookups go through cached clients).

const path = require('node:path');
const db = require('../db');
const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');
const serversService = require('../services/servers');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');
const packsService = require('../services/packs');
const modrinth = require('../services/modrinthApi');
const curseforge = require('../services/curseforgeApi');
const modsService = require('../services/mods');
const containers = require('../docker/containers');
const images = require('../docker/images');
const mojang = require('../services/mojang');
const loaderVersions = require('../services/loaderVersions');

const CONTENT_KIND_LABEL = {
  mod: 'Mod (overlay)',
  datapack: 'Datapack (overlay)',
  resourcepack: 'Resource pack (overlay)',
  plugin: 'Plugin (overlay)',
};

// itzg env var that pins a build for a server NOT tracking latest - only these
// are the panel's business (empty/unset means the image resolves latest itself
// on every recreate, same as an unpinned modpack "latest" would - see checker.js
// module comment).
const LOADER_BUILD_ENV_KEY = {
  fabric: 'FABRIC_LOADER_VERSION',
  quilt: 'QUILT_LOADER_VERSION',
  forge: 'FORGE_VERSION',
  neoforge: 'NEOFORGE_VERSION',
  paper: 'PAPER_BUILD',
};

async function checkAll({ actor = 'scheduler' } = {}) {
  const startedAt = Date.now();
  logger.info('Started an update check.', { actor });
  const findings = [];
  // Many servers often resolve to the same image ref (e.g. all java21) - pull
  // and resolve each DISTINCT ref once per run rather than once per server.
  const imageIdCache = new Map();
  for (const server of serversService.listServers()) {
    // 'manual' means "leave me alone": the check rows are still refreshed (so
    // flipping the policy later shows current state instantly), but nothing
    // lands in findings - no badge, no "updates available" event, no bridge
    // notification (#24).
    const quiet = server.update_policy === 'manual';
    // Pack updates
    try {
      const result = await packsService.latestFor(server.id);
      if (result) {
        // GTNH's latestFor already surfaces a real per-version diff link off the
        // index entry itself - prefer that over the platform-derived fallback
        // (which, for GTNH, is only the generic changelogs directory).
        const changelog = result.updateAvailable
          ? result.changelogUrl || packChangelogUrl(result.platform, result.projectRef)
          : null;
        upsertCheck('pack', server.id, result.current.name, {
          isNew: result.updateAvailable,
          latestId: result.latest.id,
          latestName: result.latest.name,
          changelogUrl: changelog,
        });
        if (result.updateAvailable && !quiet && !isUpdateIgnored('pack', server.id, result.latest.id))
          findings.push({
            server: server.display_name,
            kind: 'pack',
            subject: result.projectName,
            current: result.current.name,
            latest: result.latest.name,
          });
      }
    } catch (err) {
      logger.debug('A pack update lookup failed; keeping the cached result.', {
        serverId: server.id,
        err: serializeError(err, { includeStack: false }),
      });
    }

    // Overlay mod updates
    const rows = db.all(
      `SELECT sc.*, lf.platform, lf.project_id, lf.version AS lib_version
       FROM server_content sc JOIN library_files lf ON lf.id = sc.library_id
       WHERE sc.server_id = ? AND sc.managed_by = 'overlay' AND lf.project_id IS NOT NULL`,
      server.id
    );
    const mcVersion =
      server.mc_version === 'LATEST' || server.mc_version === 'SNAPSHOT' ? undefined : server.mc_version;
    const loader = modsService.loaderOf(server);
    for (const row of rows) {
      try {
        let latest = null;
        let changelogUrl = null;
        if (row.platform === 'modrinth') {
          const versions = await modrinth.getVersions(row.project_id, { loader, mcVersion });
          if (versions.length) latest = { id: versions[0].id, name: versions[0].version_number };
          changelogUrl = `https://modrinth.com/project/${row.project_id}/changelog`;
        } else if (row.platform === 'curseforge') {
          const files = await curseforge.getFiles(Number(row.project_id), { mcVersion, loader });
          if (files.length) latest = { id: String(files[0].fileId), name: files[0].name };
          changelogUrl = `https://www.curseforge.com/projects/${row.project_id}`;
        } else if (row.platform === 'hangar') {
          const versions = await require('../services/hangarApi').getVersions(row.project_id, { mcVersion });
          if (versions.length) latest = { id: versions[0].name, name: versions[0].name };
          changelogUrl = `https://hangar.papermc.io/${row.project_id}/versions`;
        } else if (row.platform === 'spiget') {
          const versions = await require('../services/spigetApi').getVersions(row.project_id, { limit: 1 });
          if (versions.length) latest = { id: versions[0].versionId, name: versions[0].name };
          changelogUrl = `https://www.spigotmc.org/resources/${row.project_id}/updates`;
        } else if (row.platform === 'github') {
          const releases = await require('../services/githubApi').getReleases(row.project_id);
          const withJars = releases.filter((r) => r.assets.length);
          const rel = withJars.find((r) => !r.prerelease) || withJars[0];
          if (rel) {
            latest = { id: rel.tag, name: rel.tag };
            changelogUrl = rel.htmlUrl;
          }
        }
        if (latest) {
          // Name-to-name comparison - mods.updateFor and listOutdated use the
          // same rule, so a check can never invent a phantom update.
          const isNew = latest.name !== row.lib_version;
          upsertCheck('content', row.id, row.lib_version || '?', {
            isNew,
            latestId: latest.id,
            latestName: latest.name,
            changelogUrl: isNew ? changelogUrl : null,
          });
          // Cache stays accurate above so "un-ignore" needs no re-check; only
          // keep an ignored build out of the findings notification.
          if (isNew && !quiet && latest.name !== row.ignored_update_version)
            findings.push({
              server: server.display_name,
              kind: 'mod',
              subject: row.name,
              current: row.lib_version,
              latest: latest.name,
            });
        }
      } catch (err) {
        logger.debug('An overlay mod update lookup failed; skipping this mod.', {
          serverId: server.id,
          mod: row.name,
          platform: row.platform,
          err: serializeError(err, { includeStack: false }),
        });
      }
    }

    // Docker image updates - any server with a container, pack or standalone.
    try {
      const status = await containers.inspectStatus(server.id);
      if (status.exists && status.imageId) {
        const ref = serversService.resolveImage(server);
        if (!imageIdCache.has(ref)) {
          await images.pullImage(ref).catch((err) =>
            logger.debug('Pulling an image during the update check failed.', {
              ref,
              err: serializeError(err, { includeStack: false }),
            })
          );
          imageIdCache.set(ref, await images.imageId(ref));
        }
        const latestId = imageIdCache.get(ref);
        const isNew = Boolean(latestId) && latestId !== status.imageId;
        upsertCheck('image', server.id, status.imageId, { isNew, latestId, latestName: ref, changelogUrl: null });
        if (isNew && !quiet && !isUpdateIgnored('image', server.id, latestId))
          findings.push({
            server: server.display_name,
            kind: 'image',
            subject: ref,
            current: shortId(status.imageId),
            latest: shortId(latestId),
          });
      }
    } catch (err) {
      logger.debug('An image update check failed; keeping the cached result.', {
        serverId: server.id,
        err: serializeError(err, { includeStack: false }),
      });
    }

    // Standalone (non-pack) Minecraft version / loader build updates - only
    // for an EXPLICIT pin (LATEST/SNAPSHOT and an empty loader-build env var
    // already resolve to newest on every recreate; nothing to check there).
    if (!packsService.getPack(server.id)) {
      try {
        await checkStandaloneVersion(server, quiet ? [] : findings);
      } catch (err) {
        logger.debug('A standalone version update check failed; keeping the cached result.', {
          serverId: server.id,
          err: serializeError(err, { includeStack: false }),
        });
      }
    }
  }

  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES ('last-update-check', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    JSON.stringify({ findings: findings.length })
  );
  recordEvent({
    actor,
    type: 'update-check',
    summary: findings.length
      ? `Update check: ${findings.length} update(s) available`
      : 'Update check: everything up to date',
    details: { findings },
  });
  logger.info('Finished an update check.', {
    actor,
    updatesAvailable: findings.length,
    durationMs: Date.now() - startedAt,
  });
  return findings;
}

function shortId(id) {
  return id ? id.replace(/^sha256:/, '').slice(0, 12) : '?';
}

/**
 * True when the user chose to ignore exactly the update currently on offer for
 * this subject (update_checks.ignored_version === the pending latest_version).
 * A newer build changes latest_version, so the ignore lapses on its own.
 * Content rows keep their own ignore on server_content.ignored_update_version -
 * this is only for the pack / image / mc_version / loader_build kinds.
 */
function isUpdateIgnored(subjectType, subjectId, latestId) {
  if (latestId == null) return false;
  const row = db.get(
    'SELECT ignored_version FROM update_checks WHERE subject_type = ? AND subject_id = ?',
    subjectType,
    subjectId
  );
  return Boolean(row && row.ignored_version != null && String(row.ignored_version) === String(latestId));
}

/**
 * Ignore (or un-ignore) the update currently offered for a pack / image /
 * mc_version / loader_build subject. Pins update_checks.ignored_version to the
 * pending latest_version; `ignore: false` clears it. (Overlay content uses
 * mods.setIgnoredUpdate instead - different table, same behaviour.)
 */
function setUpdateIgnored(subjectType, subjectId, { ignore = true, actor = 'system' } = {}) {
  if (subjectType === 'content') {
    // Callers should route content through mods.setIgnoredUpdate; guard anyway.
    throw httpError(400, 'Use the per-mod ignore for overlay content');
  }
  const check = db.get('SELECT * FROM update_checks WHERE subject_type = ? AND subject_id = ?', subjectType, subjectId);
  if (!check || !check.latest_version) {
    throw httpError(409, 'No pending update to ignore - run an update check first');
  }
  db.run(
    'UPDATE update_checks SET ignored_version = ? WHERE subject_type = ? AND subject_id = ?',
    ignore ? check.latest_version : null,
    subjectType,
    subjectId
  );
  // Every non-content subject here is keyed by server id.
  recordEvent({
    serverId: subjectId,
    actor,
    type: ignore ? 'update-ignored' : 'update-unignored',
    summary: `${ignore ? 'Ignoring' : 'No longer ignoring'} ${check.latest_name || check.latest_version} (${subjectType.replace('_', ' ')})`,
  });
  return { ignored: ignore ? check.latest_version : null };
}

/** MC version + loader/Paper build checks for a server with no managed modpack. */
async function checkStandaloneVersion(server, findings) {
  if (server.mc_version && server.mc_version !== 'LATEST' && server.mc_version !== 'SNAPSHOT') {
    const manifest = await mojang.getVersionManifest();
    const latestRelease = manifest.latest && manifest.latest.release;
    if (latestRelease && latestRelease !== server.mc_version) {
      const ids = manifest.versions.map((v) => v.id);
      const curIdx = ids.indexOf(server.mc_version);
      const latestIdx = ids.indexOf(latestRelease);
      // Manifest is newest-first - only offer a version strictly newer than the
      // pin. An unrecognized pin (curIdx === -1) can't be verified as older, so
      // it's treated as "offer it" rather than silently never surfacing.
      const isNew = curIdx === -1 || (latestIdx !== -1 && latestIdx < curIdx);
      upsertCheck('mc_version', server.id, server.mc_version, {
        isNew,
        latestId: latestRelease,
        latestName: latestRelease,
        changelogUrl: null,
      });
      if (isNew && !isUpdateIgnored('mc_version', server.id, latestRelease))
        findings.push({
          server: server.display_name,
          kind: 'mc_version',
          subject: 'Minecraft version',
          current: server.mc_version,
          latest: latestRelease,
        });
    }
  }

  const loader = modsService.loaderOf(server);
  const envKey = loader && LOADER_BUILD_ENV_KEY[loader];
  const pinned = envKey && server.env[envKey];
  if (pinned) {
    const channel = loader === 'paper' ? server.env.PAPER_CHANNEL || 'default' : undefined;
    const { builds } = await loaderVersions.getBuilds(loader, server.mc_version, { channel });
    const newest = builds.find((b) => b.version); // skip the "Latest (recommended)" no-pin sentinel
    const isNew = Boolean(newest) && newest.version !== pinned;
    upsertCheck('loader_build', server.id, pinned, {
      isNew,
      latestId: newest ? newest.version : null,
      latestName: newest ? newest.label : null,
      changelogUrl: null,
    });
    if (isNew && !isUpdateIgnored('loader_build', server.id, newest.version))
      findings.push({
        server: server.display_name,
        kind: 'loader_build',
        subject: `${loader} build`,
        current: pinned,
        latest: newest.version,
      });
  }
}

/**
 * Cache one check result. The latest_* columns are only populated when the
 * subject is ACTUALLY outdated (isNew) - latest_version holds the platform id,
 * latest_name the human-readable version name. Up-to-date subjects get NULLs,
 * so `latest_version IS NOT NULL` cleanly means "update available".
 */
function upsertCheck(subjectType, subjectId, current, { isNew, latestId, latestName, changelogUrl }) {
  db.run(
    `INSERT INTO update_checks (subject_type, subject_id, current_version, latest_version, latest_name, changelog_url, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(subject_type, subject_id) DO UPDATE SET
       current_version = excluded.current_version, latest_version = excluded.latest_version,
       latest_name = excluded.latest_name, changelog_url = excluded.changelog_url, checked_at = excluded.checked_at`,
    subjectType,
    subjectId,
    current,
    isNew ? latestId : null,
    isNew ? latestName : null,
    isNew ? changelogUrl : null
  );
}

function packChangelogUrl(platform, projectRef) {
  if (platform === 'modrinth') return `https://modrinth.com/project/${projectRef}/changelog`;
  if (platform === 'curseforge') return `https://www.curseforge.com/minecraft/modpacks/${projectRef}/files`;
  // Fallback only: latestFor's gtnh branch normally supplies a real per-version
  // link straight from the index entry (see checkAll above). This is the "all
  // files" equivalent for the rare case a version's changelog href didn't pass
  // safeChangelogUrl's github.com/https check.
  if (platform === 'gtnh') return 'https://github.com/GTNewHorizons/DreamAssemblerXXL/tree/master/releases/changelogs';
  return null;
}

/** Everything outdated, joined for the Updates page. */
function listOutdated() {
  const rows = [];
  // ignored rows stay in the list (greyed, with an "un-ignore" action) so the
  // Updates page is the one place to manage them; countOutdated() and the
  // digest exclude them instead.
  const ignoredByVersion = (c) => c.ignored_version != null && String(c.ignored_version) === String(c.latest_version);
  for (const c of db.all('SELECT * FROM update_checks WHERE latest_version IS NOT NULL')) {
    if (c.subject_type === 'pack') {
      const server = db.get(
        "SELECT id, display_name FROM servers WHERE id = ? AND deleted_at IS NULL AND update_policy != 'manual'",
        c.subject_id
      );
      const pack = db.get('SELECT * FROM server_packs WHERE server_id = ?', c.subject_id);
      if (server && pack && pack.pinned_version_id !== c.latest_version) {
        rows.push({
          serverId: server.id,
          server: server.display_name,
          kind: 'Modpack',
          subjectType: 'pack',
          subject: pack.project_name,
          current: pack.pinned_version_name,
          latest: c.latest_name,
          versionId: c.latest_version,
          changelogUrl: c.changelog_url || null,
          ignored: ignoredByVersion(c),
        });
      }
    } else if (c.subject_type === 'content') {
      const row = db.get(
        `SELECT sc.*, s.display_name, s.id AS sid FROM server_content sc
           JOIN servers s ON s.id = sc.server_id AND s.deleted_at IS NULL AND s.update_policy != 'manual'
         WHERE sc.id = ?`,
        c.subject_id
      );
      // Name-to-name: skip only rows the user already updated since the last
      // check. An ignored row still shows (greyed) so it can be un-ignored here.
      if (row && c.latest_name && c.latest_name !== row.version) {
        rows.push({
          serverId: row.sid,
          server: row.display_name,
          kind: CONTENT_KIND_LABEL[row.kind] || 'Mod (overlay)',
          subjectType: 'content',
          subject: row.name,
          current: c.current_version,
          latest: c.latest_name,
          contentId: row.id,
          changelogUrl: c.changelog_url || null,
          ignored: c.latest_name === row.ignored_update_version,
        });
      }
    } else if (c.subject_type === 'image') {
      const server = serversService.getServer(c.subject_id);
      if (server && server.update_policy === 'manual') continue;
      // No durable local field records "the image this container was built
      // from" - a stale row simply self-corrects on the next checkAll() run
      // (re-pull + re-compare), same eventual-consistency window as everything
      // else here. Still-existing container is the only cheap guard available.
      if (server && server.container_id) {
        rows.push({
          serverId: server.id,
          server: server.display_name,
          kind: 'Docker image',
          subjectType: 'image',
          subject: c.latest_name,
          current: shortId(c.current_version),
          latest: shortId(c.latest_version),
          imageUpgrade: true,
          changelogUrl: null,
          ignored: ignoredByVersion(c),
        });
      }
    } else if (c.subject_type === 'mc_version') {
      const server = serversService.getServer(c.subject_id);
      if (server && server.update_policy === 'manual') continue;
      if (server && server.mc_version === c.current_version) {
        rows.push({
          serverId: server.id,
          server: server.display_name,
          kind: 'Minecraft version',
          subjectType: 'mc_version',
          subject: 'Minecraft version',
          current: c.current_version,
          latest: c.latest_name,
          targetVersion: c.latest_version,
          changelogUrl: c.changelog_url || null,
          ignored: ignoredByVersion(c),
        });
      }
    } else if (c.subject_type === 'loader_build') {
      const server = serversService.getServer(c.subject_id);
      if (server && server.update_policy === 'manual') continue;
      if (server) {
        const loader = modsService.loaderOf(server);
        const envKey = loader && LOADER_BUILD_ENV_KEY[loader];
        if (envKey && server.env[envKey] === c.current_version) {
          rows.push({
            serverId: server.id,
            server: server.display_name,
            kind: 'Loader build',
            subjectType: 'loader_build',
            subject: `${loader} build`,
            current: c.current_version,
            latest: c.latest_name || c.latest_version,
            targetLoaderBuild: c.latest_version,
            envKey,
            changelogUrl: null,
            ignored: ignoredByVersion(c),
          });
        }
      }
    }
  }
  return rows;
}

/**
 * Just the count from listOutdated()'s same filter logic, as one aggregate
 * query instead of N+1 row-by-row lookups - used for the sidebar badge that's
 * computed on every single page render (see web/routes/index.js), where the
 * full per-row join-and-materialize listOutdated() does is pure waste when
 * only a number is needed.
 */
function countOutdatedByKind() {
  const row = db.get(`
    SELECT
      (SELECT COUNT(*) FROM update_checks c
         JOIN server_packs p ON p.server_id = c.subject_id
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL AND s.update_policy != 'manual'
         WHERE c.subject_type = 'pack' AND c.latest_version IS NOT NULL
           AND p.pinned_version_id != c.latest_version
           AND (c.ignored_version IS NULL OR c.ignored_version != c.latest_version))
      AS packs,
      (SELECT COUNT(*) FROM update_checks c
         JOIN server_content sc ON sc.id = c.subject_id
         JOIN servers s ON s.id = sc.server_id AND s.deleted_at IS NULL AND s.update_policy != 'manual'
         WHERE c.subject_type = 'content' AND c.latest_version IS NOT NULL
           AND c.latest_name IS NOT NULL AND c.latest_name != sc.version
           AND (sc.ignored_update_version IS NULL OR sc.ignored_update_version != c.latest_name))
      AS content,
      (SELECT COUNT(*) FROM update_checks c
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL AND s.update_policy != 'manual'
         WHERE c.subject_type = 'image' AND c.latest_version IS NOT NULL AND s.container_id IS NOT NULL
           AND (c.ignored_version IS NULL OR c.ignored_version != c.latest_version))
      AS images,
      (SELECT COUNT(*) FROM update_checks c
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL AND s.update_policy != 'manual'
         WHERE c.subject_type = 'mc_version' AND c.latest_version IS NOT NULL AND s.mc_version = c.current_version
           AND (c.ignored_version IS NULL OR c.ignored_version != c.latest_version))
      AS mc,
      (SELECT COUNT(*) FROM update_checks c
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL AND s.update_policy != 'manual'
         WHERE c.subject_type = 'loader_build' AND c.latest_version IS NOT NULL
           AND (c.ignored_version IS NULL OR c.ignored_version != c.latest_version))
      AS loader
  `);
  const packs = row?.packs || 0;
  const content = row?.content || 0;
  const images = row?.images || 0;
  const mc = row?.mc || 0;
  const loader = row?.loader || 0;
  return {
    all: packs + content + images + mc + loader,
    // Mods/plugins/datapacks/resource packs the user installed as content.
    mods: packs + content,
    // Server-level rebuilds: the container image or the Minecraft/loader version.
    server: images + mc + loader,
  };
}

function countOutdated() {
  return countOutdatedByKind().all;
}

function lastCheckedAt() {
  const row = db.get("SELECT fetched_at FROM api_cache WHERE key = 'last-update-check'");
  return row ? row.fetched_at : null;
}

module.exports = { checkAll, listOutdated, countOutdated, countOutdatedByKind, lastCheckedAt, setUpdateIgnored };
