// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Update checker: compares pinned packs, overlay mods, and the itzg image
// against the latest available, caching results in update_checks. Scheduled
// daily + on-demand; API-friendly (all lookups go through cached clients).

const db = require('../db');
const { recordEvent } = require('../events');
const serversService = require('../services/servers');
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
  resourcepack: 'Resourcepack (overlay)',
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
  const findings = [];
  // Many servers often resolve to the same image ref (e.g. all java21) - pull
  // and resolve each DISTINCT ref once per run rather than once per server.
  const imageIdCache = new Map();
  for (const server of serversService.listServers()) {
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
        if (result.updateAvailable)
          findings.push({
            server: server.display_name,
            kind: 'pack',
            subject: result.projectName,
            current: result.current.name,
            latest: result.latest.name,
          });
      }
    } catch {
      /* pack platform unreachable - keep old cache */
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
          if (isNew)
            findings.push({
              server: server.display_name,
              kind: 'mod',
              subject: row.name,
              current: row.lib_version,
              latest: latest.name,
            });
        }
      } catch {
        /* skip this mod */
      }
    }

    // Docker image updates - any server with a container, pack or standalone.
    try {
      const status = await containers.inspectStatus(server.id);
      if (status.exists && status.imageId) {
        const ref = serversService.resolveImage(server);
        if (!imageIdCache.has(ref)) {
          await images.pullImage(ref).catch(() => {});
          imageIdCache.set(ref, await images.imageId(ref));
        }
        const latestId = imageIdCache.get(ref);
        const isNew = Boolean(latestId) && latestId !== status.imageId;
        upsertCheck('image', server.id, status.imageId, { isNew, latestId, latestName: ref, changelogUrl: null });
        if (isNew)
          findings.push({
            server: server.display_name,
            kind: 'image',
            subject: ref,
            current: shortId(status.imageId),
            latest: shortId(latestId),
          });
      }
    } catch {
      /* docker unreachable - keep old cache */
    }

    // Standalone (non-pack) Minecraft version / loader build updates - only
    // for an EXPLICIT pin (LATEST/SNAPSHOT and an empty loader-build env var
    // already resolve to newest on every recreate; nothing to check there).
    if (!packsService.getPack(server.id)) {
      try {
        await checkStandaloneVersion(server, findings);
      } catch {
        /* registry unreachable - keep old cache */
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
  return findings;
}

function shortId(id) {
  return id ? id.replace(/^sha256:/, '').slice(0, 12) : '?';
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
      if (isNew)
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
    if (isNew)
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
  for (const c of db.all('SELECT * FROM update_checks WHERE latest_version IS NOT NULL')) {
    if (c.subject_type === 'pack') {
      const server = db.get('SELECT id, display_name FROM servers WHERE id = ? AND deleted_at IS NULL', c.subject_id);
      const pack = db.get('SELECT * FROM server_packs WHERE server_id = ?', c.subject_id);
      if (server && pack && pack.pinned_version_id !== c.latest_version) {
        rows.push({
          serverId: server.id,
          server: server.display_name,
          kind: 'Modpack',
          subject: pack.project_name,
          current: pack.pinned_version_name,
          latest: c.latest_name,
          versionId: c.latest_version,
          changelogUrl: c.changelog_url || null,
        });
      }
    } else if (c.subject_type === 'content') {
      const row = db.get(
        `SELECT sc.*, s.display_name, s.id AS sid FROM server_content sc JOIN servers s ON s.id = sc.server_id AND s.deleted_at IS NULL WHERE sc.id = ?`,
        c.subject_id
      );
      // Name-to-name: skip rows the user already updated since the last check.
      if (row && c.latest_name && c.latest_name !== row.version) {
        rows.push({
          serverId: row.sid,
          server: row.display_name,
          kind: CONTENT_KIND_LABEL[row.kind] || 'Mod (overlay)',
          subject: row.name,
          current: c.current_version,
          latest: c.latest_name,
          contentId: row.id,
          changelogUrl: c.changelog_url || null,
        });
      }
    } else if (c.subject_type === 'image') {
      const server = serversService.getServer(c.subject_id);
      // No durable local field records "the image this container was built
      // from" - a stale row simply self-corrects on the next checkAll() run
      // (re-pull + re-compare), same eventual-consistency window as everything
      // else here. Still-existing container is the only cheap guard available.
      if (server && server.container_id) {
        rows.push({
          serverId: server.id,
          server: server.display_name,
          kind: 'Docker image',
          subject: c.latest_name,
          current: shortId(c.current_version),
          latest: shortId(c.latest_version),
          imageUpgrade: true,
          changelogUrl: null,
        });
      }
    } else if (c.subject_type === 'mc_version') {
      const server = serversService.getServer(c.subject_id);
      if (server && server.mc_version === c.current_version) {
        rows.push({
          serverId: server.id,
          server: server.display_name,
          kind: 'Minecraft version',
          subject: 'Minecraft version',
          current: c.current_version,
          latest: c.latest_name,
          targetVersion: c.latest_version,
          changelogUrl: c.changelog_url || null,
        });
      }
    } else if (c.subject_type === 'loader_build') {
      const server = serversService.getServer(c.subject_id);
      if (server) {
        const loader = modsService.loaderOf(server);
        const envKey = loader && LOADER_BUILD_ENV_KEY[loader];
        if (envKey && server.env[envKey] === c.current_version) {
          rows.push({
            serverId: server.id,
            server: server.display_name,
            kind: 'Loader build',
            subject: `${loader} build`,
            current: c.current_version,
            latest: c.latest_name || c.latest_version,
            targetLoaderBuild: c.latest_version,
            envKey,
            changelogUrl: null,
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
function countOutdated() {
  const row = db.get(`
    SELECT
      (SELECT COUNT(*) FROM update_checks c
         JOIN server_packs p ON p.server_id = c.subject_id
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL
         WHERE c.subject_type = 'pack' AND c.latest_version IS NOT NULL
           AND p.pinned_version_id != c.latest_version)
      +
      (SELECT COUNT(*) FROM update_checks c
         JOIN server_content sc ON sc.id = c.subject_id
         JOIN servers s ON s.id = sc.server_id AND s.deleted_at IS NULL
         WHERE c.subject_type = 'content' AND c.latest_version IS NOT NULL
           AND c.latest_name IS NOT NULL AND c.latest_name != sc.version)
      +
      (SELECT COUNT(*) FROM update_checks c
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL
         WHERE c.subject_type = 'image' AND c.latest_version IS NOT NULL AND s.container_id IS NOT NULL)
      +
      (SELECT COUNT(*) FROM update_checks c
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL
         WHERE c.subject_type = 'mc_version' AND c.latest_version IS NOT NULL AND s.mc_version = c.current_version)
      +
      (SELECT COUNT(*) FROM update_checks c
         JOIN servers s ON s.id = c.subject_id AND s.deleted_at IS NULL
         WHERE c.subject_type = 'loader_build' AND c.latest_version IS NOT NULL)
      AS total
  `);
  return row ? row.total : 0;
}

function lastCheckedAt() {
  const row = db.get("SELECT fetched_at FROM api_cache WHERE key = 'last-update-check'");
  return row ? row.fetched_at : null;
}

module.exports = { checkAll, listOutdated, countOutdated, lastCheckedAt };
