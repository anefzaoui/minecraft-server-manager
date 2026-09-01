// @ts-nocheck - dynamic HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Hangar public API client (PaperMC's own plugin registry - no key required).
// Docs: https://hangar.papermc.io/api-docs - a natural first-class source for
// Paper-family servers: versions are platform-tagged (PAPER/VELOCITY/WATERFALL),
// carry the compatible MC versions per platform, and every Hangar-hosted file
// publishes a sha256 for download verification.

const httpError = require('../utils/httpError');
const db = require('../db');

const BASE = 'https://hangar.papermc.io/api/v1';
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';

// The panel manages Paper-family game servers; proxy platforms exist in the
// API but nothing here targets them yet.
const PLATFORM = 'PAPER';

async function hangarFetch(pathname, { ttlMs = 10 * 60 * 1000, search } = {}) {
  const url = new URL(BASE + pathname);
  if (search) for (const [k, v] of Object.entries(search)) if (v !== undefined) url.searchParams.set(k, String(v));
  const cacheKey = `hangar:${url.pathname}${url.search}`;
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  if (cached && Date.now() - Date.parse(cached.fetched_at + 'Z') < ttlMs) {
    return JSON.parse(cached.value_json);
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 429) {
    if (cached) return JSON.parse(cached.value_json); // stale beats a hard failure
    throw httpError(429, 'Hangar is rate-limiting us. Please try again in a minute.');
  }
  if (res.status === 404) throw httpError(404, "That wasn't found on Hangar.");
  if (!res.ok) throw httpError(502, 'Hangar is not responding correctly right now. Please try again shortly.');
  const data = await res.json();
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    cacheKey,
    JSON.stringify(data)
  );
  return data;
}

function normalizeProject(p) {
  return {
    slug: (p.namespace && p.namespace.slug) || p.name,
    owner: (p.namespace && p.namespace.owner) || null,
    name: p.name,
    description: p.description || '',
    iconUrl: p.avatarUrl || null,
    downloads: (p.stats && p.stats.downloads) || 0,
  };
}

/** Search plugins. mcVersion narrows to versions compatible on PAPER. */
async function search({ query = '', mcVersion, limit = 20, offset = 0 }) {
  const data = await hangarFetch('/projects', {
    search: { q: query, limit, offset, platform: PLATFORM, version: mcVersion || undefined },
    ttlMs: 5 * 60 * 1000,
  });
  return (data.result || []).map(normalizeProject);
}

async function getProject(slug) {
  const p = await hangarFetch(`/projects/${encodeURIComponent(refSlug(slug))}`, { ttlMs: 30 * 60 * 1000 });
  return normalizeProject(p);
}

/**
 * A project's versions, newest first. Each carries the PAPER download (Hangar-
 * hosted files publish name/sizeBytes/sha256Hash; external ones only a URL)
 * and the MC versions it supports on PAPER.
 */
async function getVersions(slug, { mcVersion, limit = 30 } = {}) {
  const data = await hangarFetch(`/projects/${encodeURIComponent(refSlug(slug))}/versions`, {
    search: { limit: Math.min(limit, 50), offset: 0, platform: PLATFORM },
    ttlMs: 10 * 60 * 1000,
  });
  let versions = (data.result || []).map(normalizeVersion).filter((v) => v.gameVersions.length || v.downloadUrl);
  if (mcVersion) {
    versions = versions.filter((v) => !v.gameVersions.length || compatibleWith(v.gameVersions, mcVersion));
  }
  return versions;
}

function normalizeVersion(v) {
  const dl = (v.downloads && v.downloads[PLATFORM]) || {};
  const fileInfo = dl.fileInfo || {};
  return {
    versionId: v.name, // Hangar version names are unique per project and address the version endpoints
    name: v.name,
    versionNumber: v.name,
    datePublished: v.createdAt || null,
    versionType: v.channel && /snapshot|alpha|beta/i.test(v.channel.name || '') ? 'beta' : 'release',
    channel: (v.channel && v.channel.name) || null,
    gameVersions: (v.platformDependencies && v.platformDependencies[PLATFORM]) || [],
    downloadUrl: dl.downloadUrl || dl.externalUrl || null,
    external: Boolean(!dl.downloadUrl && dl.externalUrl),
    filename: fileInfo.name || null,
    sizeBytes: fileInfo.sizeBytes || null,
    sha256: fileInfo.sha256Hash || null,
  };
}

/**
 * Hangar tags compatibility with version RANGES rendered as a list that may
 * hold bare minors ("1.21") next to patches ("1.21.4") - accept an exact match
 * or a bare-minor prefix match (server 1.21.1 fits a "1.21" tag).
 */
function compatibleWith(gameVersions, mcVersion) {
  return gameVersions.some((g) => g === mcVersion || (!/^\d+\.\d+\.\d+/.test(g) && mcVersion.startsWith(`${g}.`)));
}

/**
 * Resolve a Hangar URL or slug to {slug, owner, name, iconUrl, versionName?}.
 * Handles hangar.papermc.io/<owner>/<slug>[/versions/<version>].
 */
async function resolveUrl(input) {
  let ref = String(input || '').trim();
  let versionName = null;
  const m = /hangar\.papermc\.io\/([^/?#]+)\/([^/?#]+)(?:\/versions\/([^/?#]+))?/.exec(ref);
  if (m) {
    ref = `${m[1]}/${m[2]}`;
    versionName = m[3] ? decodeURIComponent(m[3]) : null;
  }
  const project = await getProject(ref);
  return { ...project, versionName };
}

/** Hangar version endpoints address projects by slug alone; accept owner/slug too. */
function refSlug(ref) {
  const s = String(ref || '').trim();
  const slash = s.indexOf('/');
  return slash === -1 ? s : s.slice(slash + 1);
}

module.exports = { search, getProject, getVersions, resolveUrl, compatibleWith, PLATFORM };
