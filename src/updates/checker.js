// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
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

async function checkAll({ actor = 'scheduler' } = {}) {
  const findings = [];
  for (const server of serversService.listServers()) {
    // Pack updates
    try {
      const result = await packsService.latestFor(server.id);
      if (result) {
        const changelog = result.updateAvailable ? packChangelogUrl(result.platform, result.projectRef) : null;
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
      /* pack platform unreachable — keep old cache */
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
          // Name-to-name comparison — mods.updateFor and listOutdated use the
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

/**
 * Cache one check result. The latest_* columns are only populated when the
 * subject is ACTUALLY outdated (isNew) — latest_version holds the platform id,
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
          kind: 'Mod (overlay)',
          subject: row.name,
          current: c.current_version,
          latest: c.latest_name,
          contentId: row.id,
          changelogUrl: c.changelog_url || null,
        });
      }
    }
  }
  return rows;
}

function lastCheckedAt() {
  const row = db.get("SELECT fetched_at FROM api_cache WHERE key = 'last-update-check'");
  return row ? row.fetched_at : null;
}

module.exports = { checkAll, listOutdated, lastCheckedAt };
