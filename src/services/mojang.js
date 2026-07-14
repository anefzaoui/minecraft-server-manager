// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Mojang version manifest, cached in SQLite for 6 hours so the wizard's
// version picker is instant and works briefly offline.

const db = require('../db');

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const CACHE_KEY = 'mojang-version-manifest';
const TTL_MS = 6 * 60 * 60 * 1000;

async function getVersionManifest() {
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', CACHE_KEY);
  // SQLite datetime('now') is space-separated ('2026-07-14 03:00:00'); normalize
  // to ISO 8601 before parsing (matches how the rest of the code reads timestamps).
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) {
    return JSON.parse(cached.value_json);
  }
  try {
    const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const manifest = await res.json();
    const slim = {
      latest: manifest.latest,
      versions: manifest.versions.map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime })),
    };
    db.run(
      `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
      CACHE_KEY,
      JSON.stringify(slim)
    );
    return slim;
  } catch (err) {
    if (cached) return JSON.parse(cached.value_json); // stale beats nothing
    throw err;
  }
}

/** Releases (and optionally snapshots), newest first, for pickers. */
async function listVersions({ includeSnapshots = false, limit = 200 } = {}) {
  const manifest = await getVersionManifest();
  return manifest.versions
    .filter((v) => v.type === 'release' || (includeSnapshots && v.type === 'snapshot'))
    .slice(0, limit);
}

module.exports = { getVersionManifest, listVersions };
