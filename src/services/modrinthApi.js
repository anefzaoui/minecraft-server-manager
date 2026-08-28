// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Modrinth public API client (no key required). Cached + rate-limit friendly.
// Docs: https://docs.modrinth.com/api

const httpError = require('../utils/httpError');
const db = require('../db');

const BASE = 'https://api.modrinth.com/v2';
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';

async function mrFetch(pathname, { ttlMs = 10 * 60 * 1000, search, method = 'GET', body } = {}) {
  const url = new URL(BASE + pathname);
  if (search) for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);
  const cacheKey = `modrinth:${url.pathname}${url.search}`;
  const cached =
    method === 'GET' ? db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey) : null;
  if (cached && Date.now() - Date.parse(cached.fetched_at + 'Z') < ttlMs) {
    return JSON.parse(cached.value_json);
  }
  const res = await fetch(url, {
    method,
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    if (cached) return JSON.parse(cached.value_json);
    throw httpError(429, 'Modrinth rate limit hit — try again in a minute');
  }
  if (res.status === 404) throw httpError(404, 'Not found on Modrinth');
  if (!res.ok) throw httpError(502, `Modrinth answered HTTP ${res.status}`);
  const data = await res.json();
  if (method === 'GET') {
    db.run(
      `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
      cacheKey,
      JSON.stringify(data)
    );
  }
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

// Chunk bulk lookups — one oversized request shouldn't fail wholesale.
const BULK_CHUNK = 200;

/**
 * Reverse lookup versions by file hash (POST /v2/version_files).
 * Unknown hashes are simply absent from the result map.
 * @returns {Promise<Record<string, object>>} hash → version object
 */
async function getVersionsByHashes(hashes, algorithm = 'sha1') {
  const uniq = [...new Set(hashes.filter(Boolean))];
  const out = {};
  for (let i = 0; i < uniq.length; i += BULK_CHUNK) {
    const data = await mrFetch('/version_files', {
      method: 'POST',
      body: { hashes: uniq.slice(i, i + BULK_CHUNK), algorithm },
    });
    Object.assign(out, data || {});
  }
  return out;
}

/** Bulk project metadata (GET /v2/projects?ids=[…]), keyed by project id. */
async function getProjectsBulk(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const out = {};
  for (let i = 0; i < uniq.length; i += BULK_CHUNK) {
    const data = await mrFetch('/projects', {
      search: { ids: JSON.stringify(uniq.slice(i, i + BULK_CHUNK)) },
      ttlMs: 30 * 60 * 1000,
    });
    for (const p of data || []) out[p.id] = p;
  }
  return out;
}

module.exports = {
  search,
  getProject,
  getVersions,
  getVersion,
  resolveUrl,
  primaryFile,
  getVersionsByHashes,
  getProjectsBulk,
};
