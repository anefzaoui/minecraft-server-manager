// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Mojang username → profile (UUID) resolution, cached in SQLite so repeated
// player actions never hammer the API. Unknown names resolve to null.

const db = require('../db');

const API_BASE = 'https://api.mojang.com/users/profiles/minecraft/';
const CACHE_PREFIX = 'mojang-profile:';
const TTL_MS = 24 * 60 * 60 * 1000;

/** Convert Mojang's undashed UUID form to the dashed form the server files use. */
function uuidToDashed(uuid) {
  const hex = String(uuid).replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Resolve a username to { uuid (dashed), name (canonical casing) }.
 * Returns null when Mojang says the name does not exist (404).
 * Throws on network/API failure so callers can distinguish "unknown player"
 * from "lookup unavailable".
 */
async function resolveProfile(name) {
  const key = CACHE_PREFIX + String(name).toLowerCase();
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', key);
  if (cached && Date.now() - Date.parse(cached.fetched_at + 'Z') < TTL_MS) {
    return JSON.parse(cached.value_json);
  }

  let profile;
  try {
    const res = await fetch(API_BASE + encodeURIComponent(name), { signal: AbortSignal.timeout(8000) });
    if (res.status === 404 || res.status === 204) {
      profile = null;
    } else if (!res.ok) {
      throw new Error(`Mojang API HTTP ${res.status}`);
    } else {
      const body = await res.json();
      profile = { uuid: uuidToDashed(body.id), name: body.name };
    }
  } catch (err) {
    if (cached) return JSON.parse(cached.value_json); // stale beats nothing
    throw err;
  }

  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    key,
    JSON.stringify(profile)
  );
  return profile;
}

module.exports = { resolveProfile, uuidToDashed };
