// @ts-nocheck - dynamic HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// GitHub Releases client - many plugins/mods (EssentialsX-style) only publish
// jars as release assets. No token needed for public repos; the unauthenticated
// quota (60/hr) is made livable by ETag revalidation: every response is cached
// as {etag, data} and replayed with If-None-Match - a 304 serves the cache AND
// does not count against the rate limit. An optional GITHUB_TOKEN env var
// raises the quota for heavy users.

const httpError = require('../utils/httpError');
const db = require('../db');

const BASE = 'https://api.github.com';
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';

async function ghFetch(pathname, { ttlMs = 10 * 60 * 1000 } = {}) {
  const cacheKey = `github:${pathname}`;
  const row = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  const cached = row ? JSON.parse(row.value_json) : null; // {etag, data}
  if (cached && Date.now() - Date.parse(row.fetched_at + 'Z') < ttlMs) return cached.data;

  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  if (cached && cached.etag) headers['If-None-Match'] = cached.etag;

  const res = await fetch(BASE + pathname, { headers, signal: AbortSignal.timeout(15000) });

  if (res.status === 304 && cached) {
    // Revalidated: refresh the timestamp so the TTL window restarts.
    db.run("UPDATE api_cache SET fetched_at = datetime('now') WHERE key = ?", cacheKey);
    return cached.data;
  }
  if (res.status === 403 || res.status === 429) {
    // Primary rate limit: remaining=0 with reset as an EPOCH timestamp
    // (Modrinth's same-named header counts seconds - don't conflate).
    if (cached) return cached.data; // stale beats a hard failure
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    const mins = Number.isFinite(reset) ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null;
    throw httpError(
      429,
      `GitHub is rate-limiting us${mins ? ` (resets in ~${mins} min)` : ''}. ` +
        'Set a GITHUB_TOKEN env var on the panel to raise the quota.'
    );
  }
  if (res.status === 404) throw httpError(404, "That repository or release wasn't found on GitHub.");
  if (!res.ok) throw httpError(502, 'GitHub is not responding correctly right now. Please try again shortly.');

  const data = await res.json();
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    cacheKey,
    JSON.stringify({ etag: res.headers.get('etag') || null, data })
  );
  return data;
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

function assertRepo(repo) {
  const r = String(repo || '').trim();
  if (!REPO_RE.test(r) || r.includes('..')) throw httpError(400, 'Invalid GitHub repository (expected owner/repo)');
  return r;
}

async function getRepo(repo) {
  const r = await ghFetch(`/repos/${assertRepo(repo)}`, { ttlMs: 30 * 60 * 1000 });
  return {
    repo: r.full_name,
    name: r.name,
    description: r.description || '',
    iconUrl: (r.owner && r.owner.avatar_url) || null,
  };
}

/** Releases newest first, each with its jar assets. Drafts are excluded. */
async function getReleases(repo, { limit = 30 } = {}) {
  const list = await ghFetch(`/repos/${assertRepo(repo)}/releases?per_page=${Math.min(limit, 50)}`);
  return (Array.isArray(list) ? list : [])
    .filter((rel) => !rel.draft)
    .map((rel) => ({
      tag: rel.tag_name,
      name: rel.name || rel.tag_name,
      prerelease: Boolean(rel.prerelease),
      publishedAt: rel.published_at || null,
      htmlUrl: rel.html_url,
      assets: (rel.assets || [])
        .filter((a) => /\.jar$/i.test(a.name))
        .map((a) => ({
          name: a.name,
          size: a.size,
          // Built by hand - the plain download URL works unauthenticated for public repos.
          downloadUrl: `https://github.com/${assertRepo(repo)}/releases/download/${encodeURIComponent(rel.tag_name)}/${encodeURIComponent(a.name)}`,
        })),
    }));
}

/**
 * Pick the asset a person most likely wants: a lone jar wins outright; with
 * several, prefer one that isn't a sources/javadoc/dev/api sidecar.
 */
function pickAsset(assets, preferredName = null) {
  if (!assets || !assets.length) return null;
  if (preferredName) {
    const exact = assets.find((a) => a.name === preferredName);
    if (exact) return exact;
    const contains = assets.find((a) => a.name.includes(preferredName));
    if (contains) return contains;
  }
  return assets.find((a) => !/(-sources|-javadoc|-dev|-api|-slim)\.jar$/i.test(a.name)) || assets[0];
}

/**
 * Parse a GitHub URL or "owner/repo" string.
 * Handles github.com/owner/repo[/releases[/tag/<tag>|/download/<tag>/<asset>]].
 * @returns {repo, tag?, asset?} or null when it isn't GitHub-shaped.
 */
function parseRepoRef(input) {
  const s = String(input || '').trim();
  const url =
    /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/releases(?:\/tag\/([^/?#]+)|\/download\/([^/?#]+)\/([^/?#]+))?)?(?:[/?#]|$)/.exec(
      s
    );
  if (url) {
    return {
      repo: `${url[1]}/${url[2]}`,
      tag: decodeURIComponent(url[3] || url[4] || '') || null,
      asset: url[5] ? decodeURIComponent(url[5]) : null,
    };
  }
  if (REPO_RE.test(s) && !s.includes('..')) return { repo: s, tag: null, asset: null };
  return null;
}

module.exports = { getRepo, getReleases, pickAsset, parseRepoRef };
