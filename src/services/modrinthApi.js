// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Modrinth public API client (no key required). Cached + rate-limit friendly.
// Docs: https://docs.modrinth.com/api

const httpError = require('../utils/httpError');
const db = require('../db');

const BASE = 'https://api.modrinth.com/v2';
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';

async function mrFetch(pathname, { ttlMs = 10 * 60 * 1000, search } = {}) {
  const url = new URL(BASE + pathname);
  if (search) for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);
  const cacheKey = `modrinth:${url.pathname}${url.search}`;
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  if (cached && Date.now() - Date.parse(cached.fetched_at + 'Z') < ttlMs) {
    return JSON.parse(cached.value_json);
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    if (cached) return JSON.parse(cached.value_json);
    throw httpError(429, 'Modrinth rate limit hit — try again in a minute');
  }
  if (res.status === 404) throw httpError(404, 'Not found on Modrinth');
  if (!res.ok) throw httpError(502, `Modrinth answered HTTP ${res.status}`);
  const data = await res.json();
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    cacheKey,
    JSON.stringify(data)
  );
  return data;
}

/**
 * Search projects. kind: 'mod' | 'plugin' | 'datapack' | 'resourcepack' | 'modpack'
 * loader/mcVersion narrow via facets.
 */
async function search({ query = '', kind = 'mod', loader, mcVersion, limit = 20, offset = 0 }) {
  const facets = [];
  if (kind === 'plugin')
    facets.push(['categories:paper', 'categories:spigot', 'categories:bukkit', 'categories:purpur']);
  else if (kind) facets.push([`project_type:${kind === 'plugin' ? 'mod' : kind}`]);
  if (loader && kind !== 'plugin') facets.push([`categories:${loader.toLowerCase()}`]);
  if (mcVersion) facets.push([`versions:${mcVersion}`]);
  const data = await mrFetch('/search', {
    search: { query, limit: String(limit), offset: String(offset), index: 'relevance', facets: JSON.stringify(facets) },
    ttlMs: 5 * 60 * 1000,
  });
  return data.hits.map((h) => ({
    projectId: h.project_id,
    slug: h.slug,
    title: h.title,
    description: h.description,
    iconUrl: h.icon_url || null,
    downloads: h.downloads,
    categories: h.categories,
    latestVersion: h.latest_version,
  }));
}

function getProject(idOrSlug) {
  return mrFetch(`/project/${encodeURIComponent(idOrSlug)}`, { ttlMs: 30 * 60 * 1000 });
}

/** Version list filtered to the server's loader + MC version. */
async function getVersions(idOrSlug, { loader, mcVersion } = {}) {
  const search = {};
  if (loader) search.loaders = JSON.stringify([loader.toLowerCase()]);
  if (mcVersion) search.game_versions = JSON.stringify([mcVersion]);
  return mrFetch(`/project/${encodeURIComponent(idOrSlug)}/version`, { search, ttlMs: 10 * 60 * 1000 });
}

function getVersion(versionId) {
  return mrFetch(`/version/${encodeURIComponent(versionId)}`, { ttlMs: 60 * 60 * 1000 });
}

/**
 * Resolve any Modrinth URL (or slug) to {projectId, slug, versionId?}.
 * Handles /mod|plugin|datapack|resourcepack|modpack/<slug>[/version/<ver>].
 */
async function resolveUrl(input) {
  let slug = input.trim();
  let versionRef = null;
  const m = /modrinth\.com\/(?:mod|plugin|datapack|resourcepack|modpack)\/([^/]+)(?:\/version\/([^/?#]+))?/.exec(input);
  if (m) {
    slug = m[1];
    versionRef = m[2] || null;
  }
  const project = await getProject(slug);
  let versionId = null;
  if (versionRef) {
    const versions = await mrFetch(`/project/${project.id}/version`, { ttlMs: 10 * 60 * 1000 });
    const v = versions.find((x) => x.id === versionRef || x.version_number === decodeURIComponent(versionRef));
    versionId = v ? v.id : null;
  }
  return {
    projectId: project.id,
    slug: project.slug,
    title: project.title,
    iconUrl: project.icon_url || null,
    projectType: project.project_type,
    versionId,
  };
}

/** Pick the file to download from a version object (primary first). */
function primaryFile(version) {
  return version.files.find((f) => f.primary) || version.files[0];
}

module.exports = { search, getProject, getVersions, getVersion, resolveUrl, primaryFile };
