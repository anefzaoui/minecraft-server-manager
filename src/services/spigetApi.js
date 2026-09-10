// @ts-nocheck - dynamic HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Spiget API client - the SpigotMC resource catalog, no key required.
// Docs: https://spiget.org/documentation - the crucial trick: the
// `/download/proxy` suffix serves files from Spiget's own CDN instead of
// redirecting into spigotmc.org's Cloudflare wall (which blocks non-browser
// clients). Resources hosted off-site ("external") can't be proxied and are
// surfaced as manual downloads, like CurseForge's distribution-denied mods.

const httpError = require('../utils/httpError');
const db = require('../db');

const BASE = 'https://api.spiget.org/v2';
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';

async function spigetFetch(pathname, { ttlMs = 10 * 60 * 1000, search } = {}) {
  const url = new URL(BASE + pathname);
  if (search) for (const [k, v] of Object.entries(search)) if (v !== undefined) url.searchParams.set(k, String(v));
  const cacheKey = `spiget:${url.pathname}${url.search}`;
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < ttlMs) {
    return JSON.parse(cached.value_json);
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    if (cached) return JSON.parse(cached.value_json);
    throw httpError(429, 'Spiget is rate-limiting us. Please try again in a minute.');
  }
  if (res.status === 404) throw httpError(404, "That wasn't found on SpigotMC.");
  if (!res.ok) throw httpError(502, 'Spiget is not responding correctly right now. Please try again shortly.');
  const data = await res.json();
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    cacheKey,
    JSON.stringify(data)
  );
  return data;
}

function normalizeResource(r) {
  return {
    resourceId: r.id,
    name: r.name,
    tag: r.tag || '',
    downloads: r.downloads || 0,
    // Spiget serves icon paths relative to spigotmc.org.
    iconUrl: r.icon && r.icon.url ? `https://www.spigotmc.org/${r.icon.url}` : null,
    testedVersions: r.testedVersions || [],
    external: Boolean(r.external || (r.file && r.file.type === 'external')),
    pageUrl: `https://www.spigotmc.org/resources/${r.id}`,
  };
}

/** Search resources by name. */
async function search({ query = '', limit = 20 }) {
  const q = String(query || '').trim();
  if (!q) return [];
  let data;
  try {
    data = await spigetFetch(`/search/resources/${encodeURIComponent(q)}`, {
      search: { field: 'name', size: Math.min(limit, 50), sort: '-downloads' },
      ttlMs: 5 * 60 * 1000,
    });
  } catch (err) {
    if (err.status === 404) return []; // Spiget 404s an empty search result
    throw err;
  }
  return (Array.isArray(data) ? data : []).map(normalizeResource);
}

async function getResource(resourceId) {
  const data = await spigetFetch(`/resources/${assertId(resourceId)}`, { ttlMs: 30 * 60 * 1000 });
  return normalizeResource(data);
}

/** A resource's versions, newest first. Spiget has no per-version MC tags. */
async function getVersions(resourceId, { limit = 30 } = {}) {
  const data = await spigetFetch(`/resources/${assertId(resourceId)}/versions`, {
    search: { size: Math.min(limit, 50), sort: '-releaseDate' },
    ttlMs: 10 * 60 * 1000,
  });
  return (Array.isArray(data) ? data : []).map((v) => ({
    versionId: String(v.id),
    name: v.name || String(v.id),
    versionNumber: v.name || String(v.id),
    datePublished: v.releaseDate ? new Date(v.releaseDate * 1000).toISOString() : null,
    versionType: 'release',
    gameVersions: [],
    requiredDeps: [],
  }));
}

/** The Cloudflare-dodging CDN download URL for one version of a resource. */
function downloadUrl(resourceId, versionId = 'latest') {
  return `${BASE}/resources/${assertId(resourceId)}/versions/${
    versionId === 'latest' ? 'latest' : assertId(versionId)
  }/download/proxy`;
}

/**
 * Accept the id forms people actually paste: a bare numeric id, SpigotMC's
 * own "name.12345" URL tail, or a full spigotmc.org/resources/... URL. A
 * `?version=<spiget version id>` query pins a specific build (the panel's own
 * updater uses that form).
 * @returns {{resourceId: number, versionId: string|null}|null}
 */
function parseResourceRef(input) {
  const s = String(input || '').trim();
  const pinned = /[?&]version=(\d+)/.exec(s);
  const versionId = pinned ? pinned[1] : null;
  const url = /spigotmc\.org\/resources\/(?:[^/?#]*?\.)?(\d+)/.exec(s);
  if (url) return { resourceId: Number(url[1]), versionId };
  const dotted = /^[\w-]+\.(\d+)$/.exec(s);
  if (dotted) return { resourceId: Number(dotted[1]), versionId };
  if (/^\d+$/.test(s)) return { resourceId: Number(s), versionId };
  return null;
}

function assertId(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, 'Invalid SpigotMC resource id');
  return n;
}

module.exports = { search, getResource, getVersions, downloadUrl, parseResourceRef };
