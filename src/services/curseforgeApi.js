// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// CurseForge API client (requires the user's API key from the encrypted
// store). Docs: https://docs.curseforge.com — Minecraft gameId = 432.

const httpError = require('../utils/httpError');
const db = require('../db');
const apiKeys = require('./apiKeys');

const BASE = 'https://api.curseforge.com/v1';
const GAME_MINECRAFT = 432;
const CLASS_MODS = 6;
const CLASS_MODPACKS = 4471;
const CLASS_PLUGINS = 5;

async function cfFetch(pathname, { search, ttlMs = 10 * 60 * 1000, method = 'GET', body } = {}) {
  const key = apiKeys.getKey('curseforge');
  if (!key) throw httpError(412, 'CurseForge API key not set — add it in Settings');

  const url = new URL(BASE + pathname);
  if (search) for (const [k, v] of Object.entries(search)) url.searchParams.set(k, String(v));
  const cacheKey = `curseforge:${method}:${url.pathname}${url.search}:${body ? JSON.stringify(body) : ''}`;
  const cached =
    method === 'GET' ? db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey) : null;
  if (cached && Date.now() - Date.parse(cached.fetched_at + 'Z') < ttlMs) return JSON.parse(cached.value_json);
  const res = await fetch(url, {
    method,
    headers: { 'x-api-key': key, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    // Rate-limited: a stale cached answer beats a hard failure (same policy
    // as the Modrinth client).
    if (cached) return JSON.parse(cached.value_json);
    throw httpError(429, 'CurseForge rate limit hit — try again in a minute');
  }
  if (res.status === 403) throw httpError(403, 'CurseForge rejected the API key — re-check it in Settings');
  if (res.status === 404) throw httpError(404, 'Not found on CurseForge');
  if (!res.ok) throw httpError(502, `CurseForge answered HTTP ${res.status}`);
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

/** Search mods or modpacks. */
async function search({ query = '', kind = 'mod', mcVersion, loader, limit = 20, index = 0 }) {
  const classId = kind === 'modpack' ? CLASS_MODPACKS : kind === 'plugin' ? CLASS_PLUGINS : CLASS_MODS;
  const params = {
    gameId: GAME_MINECRAFT,
    classId,
    searchFilter: query,
    pageSize: limit,
    index,
    sortField: 2,
    sortOrder: 'desc',
  };
  if (mcVersion) params.gameVersion = mcVersion;
  if (loader) params.modLoaderType = loaderTypeId(loader);
  const data = await cfFetch('/mods/search', { search: params, ttlMs: 5 * 60 * 1000 });
  return data.data.map(normalizeMod);
}

async function getMod(modId) {
  const data = await cfFetch(`/mods/${modId}`);
  return normalizeMod(data.data);
}

/** Look a project up by slug (search with exact slug filter). */
async function getModBySlug(slug, { classId = CLASS_MODPACKS } = {}) {
  const data = await cfFetch('/mods/search', { search: { gameId: GAME_MINECRAFT, classId, slug } });
  return data.data.length ? normalizeMod(data.data[0]) : null;
}

/** Files (versions) of a project, newest first, optionally filtered. */
async function getFiles(modId, { mcVersion, loader, pageSize = 50 } = {}) {
  const params = { pageSize };
  if (mcVersion) params.gameVersion = mcVersion;
  if (loader) params.modLoaderType = loaderTypeId(loader);
  const data = await cfFetch(`/mods/${modId}/files`, { search: params, ttlMs: 10 * 60 * 1000 });
  return data.data.map(normalizeFile);
}

async function getFile(modId, fileId) {
  const data = await cfFetch(`/mods/${modId}/files/${fileId}`, { ttlMs: 60 * 60 * 1000 });
  return normalizeFile(data.data);
}

/**
 * Project description as an HTML string (GET /v1/mods/{id}/description).
 * CurseForge serves raw author HTML — callers MUST sanitize before rendering.
 */
async function getDescription(modId) {
  const data = await cfFetch(`/mods/${modId}/description`, { ttlMs: 30 * 60 * 1000 });
  return String(data.data || '');
}

/**
 * Resolve a CurseForge URL/slug to {modId, slug, name, iconUrl, fileId?}.
 * Handles …/minecraft/(mc-mods|modpacks|bukkit-plugins)/<slug>[/files/<fileId>].
 */
async function resolveUrl(input) {
  const m = /curseforge\.com\/minecraft\/(mc-mods|modpacks|bukkit-plugins)\/([^/]+)(?:\/files\/(\d+))?/.exec(input);
  let slug = input.trim();
  let fileId = null;
  let classId = CLASS_MODS;
  if (m) {
    classId = m[1] === 'modpacks' ? CLASS_MODPACKS : m[1] === 'bukkit-plugins' ? CLASS_PLUGINS : CLASS_MODS;
    slug = m[2];
    fileId = m[3] ? Number(m[3]) : null;
  }
  const mod = /^\d+$/.test(slug)
    ? await getMod(Number(slug))
    : (await getModBySlug(slug, { classId })) || (await getModBySlug(slug, { classId: CLASS_MODS }));
  if (!mod) throw httpError(404, `CurseForge project "${slug}" not found`);
  return { ...mod, fileId };
}

function normalizeMod(m) {
  return {
    modId: m.id,
    slug: m.slug,
    name: m.name,
    summary: m.summary,
    iconUrl: (m.logo && (m.logo.thumbnailUrl || m.logo.url)) || null,
    downloads: m.downloadCount,
    classId: m.classId,
    latestFiles: (m.latestFiles || []).map(normalizeFile),
  };
}

function normalizeFile(f) {
  return {
    fileId: f.id,
    name: f.displayName,
    fileName: f.fileName,
    downloadUrl: f.downloadUrl || null, // null when author disallows API download
    gameVersions: f.gameVersions || [],
    releaseType: { 1: 'release', 2: 'beta', 3: 'alpha' }[f.releaseType] || 'release',
    fileDate: f.fileDate,
    fileLength: f.fileLength,
    hashes: f.hashes || [],
    serverPackFileId: f.serverPackFileId || null,
    dependencies: (f.dependencies || []).map((d) => ({ modId: d.modId, relation: d.relationType })),
  };
}

function loaderTypeId(loader) {
  return { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }[String(loader).toLowerCase()] || 0;
}

module.exports = { search, getMod, getModBySlug, getFiles, getFile, getDescription, resolveUrl, GAME_MINECRAFT };
