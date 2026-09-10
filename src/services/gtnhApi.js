'use strict';

// GT New Horizons release-index client.
//
// GTNH is not served by the Modrinth or CurseForge APIs - its releases are
// published as a single JSON index, the same one the itzg image resolves
// against. The index is an OBJECT keyed by version string and ordered
// newest-first; we preserve that order rather than inventing a comparator,
// because beta suffixes ("2.9.0-beta-2") make string ordering unreliable.

const httpError = require('../utils/httpError');
const db = require('../db');

const INDEX_URL = 'https://downloads.gtnewhorizons.com/versions.json';
// NOT cosmetic: the download host answers HTTP 403 to requests with no User-Agent.
const UA = 'MinecraftServerManager/0.1 (self-hosted panel; contact via repo)';
const CACHE_KEY = 'gtnh:versions';
const TTL_MS = 30 * 60 * 1000;

/**
 * Pull the changelog link out of an entry's HTML blurb. The index is remote
 * content, so only an https github.com link is trusted enough to render.
 * @param {string} description
 * @returns {string|null}
 */
function safeChangelogUrl(description) {
  const match = /href="([^"]+)"/i.exec(String(description || ''));
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== 'github.com' && !url.hostname.endsWith('.github.com')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Raw index object → normalized entries, newest-first.
 * Pure: no network, no db - this is the part under test.
 * @param {any} raw
 */
function normalizeIndex(raw) {
  if (!raw || typeof raw !== 'object') return [];
  // No serverUrl here on purpose: the itzg image downloads the pack itself,
  // keyed by GTNH_PACK_VERSION - the panel never fetches the archive.
  return Object.entries(raw).map(([version, entry]) => {
    const e = entry || {};
    return {
      version,
      channel: /beta/i.test(String(e.title || '')) ? 'beta' : 'stable',
      releaseDate: e.releaseDate || null,
      maxJavaVersion: Number.isInteger(e.maxJavaVersion) ? e.maxJavaVersion : null,
      changelogUrl: safeChangelogUrl(e.description),
    };
  });
}

/**
 * @param {any} entries
 * @param {{includeBeta?: boolean}} opts
 */
function filterVersions(entries, { includeBeta = false } = {}) {
  return includeBeta ? entries : entries.filter((e) => e.channel === 'stable');
}

/**
 * @param {any} entries
 * @param {{includeBeta?: boolean}} opts
 */
function pickLatest(entries, { includeBeta = false } = {}) {
  return filterVersions(entries, { includeBeta })[0] || null;
}

/** Fetch + cache the index. Serves the stale copy rather than failing. */
async function fetchIndex() {
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', CACHE_KEY);
  const stale = () => (cached ? normalizeIndex(JSON.parse(cached.value_json)) : null);
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) return stale();

  let res;
  try {
    res = await fetch(INDEX_URL, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return (
      stale() ||
      Promise.reject(
        httpError(502, 'Could not reach the GT New Horizons download server. Check your connection and try again.')
      )
    );
  }
  if (!res.ok) {
    return (
      stale() ||
      Promise.reject(
        httpError(
          502,
          'The GT New Horizons download server is not responding correctly right now. Please try again shortly.'
        )
      )
    );
  }
  let raw;
  try {
    raw = await res.json();
  } catch {
    return (
      stale() ||
      Promise.reject(httpError(502, 'The GT New Horizons version list could not be read. Please try again shortly.'))
    );
  }
  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    CACHE_KEY,
    JSON.stringify(raw)
  );
  return normalizeIndex(raw);
}

/** @param {{includeBeta?: boolean}} [opts] */
async function listVersions({ includeBeta = false } = {}) {
  return filterVersions(await fetchIndex(), { includeBeta });
}

/** One version by exact key. Unknown keys are a 404 - never passed to container env. */
async function getVersion(version) {
  const entry = (await fetchIndex()).find((e) => e.version === version);
  if (!entry) throw httpError(404, `Unknown GTNH pack version: ${version}`);
  return entry;
}

/** @param {{includeBeta?: boolean}} [opts] */
async function latest({ includeBeta = false } = {}) {
  return pickLatest(await fetchIndex(), { includeBeta });
}

module.exports = { normalizeIndex, filterVersions, pickLatest, listVersions, getVersion, latest, INDEX_URL };
