// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Mojang username → profile (UUID) resolution, cached in SQLite so repeated
// player actions never hammer the API. Unknown names resolve to null.

const path = require('node:path');
const db = require('../db');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

const API_BASE = 'https://api.mojang.com/users/profiles/minecraft/';
const CACHE_PREFIX = 'mojang-profile:';
const TTL_MS = 24 * 60 * 60 * 1000;

// Single-flight memo: concurrent lookups of the same name (a spawn list bravo
// resolving several players, or two tabs both banning one person) share a
// single Mojang fetch instead of each hitting the API and each seeing the DB
// miss before any of them writes the cache row.
const inFlight = new Map();

function singleFlight(key, fn) {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

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
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) {
    return JSON.parse(cached.value_json);
  }

  return singleFlight(key, async () => {
    // Re-check the cache inside the flight: a concurrent caller may have
    // populated it while we waited on the single-flight promise for a key
    // whose cache had JUST expired.
    const fresh = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', key);
    if (fresh && Date.now() - Date.parse(fresh.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) {
      return JSON.parse(fresh.value_json);
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
      logger.debug('Resolving a Mojang profile failed.', {
        err: serializeError(err, { includeStack: false }),
        servedStale: Boolean(cached),
      });
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
  });
}

module.exports = { resolveProfile, uuidToDashed };
