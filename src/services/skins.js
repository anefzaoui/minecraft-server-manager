// @ts-nocheck - dynamic HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Mojang session profile → skin description (texture URL + model), cached in
// SQLite so the per-player head image in the UI never re-hits the API on every
// page load. Unknown uuids resolve to null; network failures throw so callers
// can fall back to a placeholder head.
//
// The skin image itself is proxied through the panel (so the client canvas can
// crop the head without the texture CDN tainting it) and held in an in-memory
// cache - skins are a few KB and content-addressed, so this never goes stale.

const path = require('node:path');
const db = require('../db');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

const API_BASE = 'https://sessionserver.mojang.com/session/minecraft/profile/';
const CACHE_PREFIX = 'mojang-skin:';
// Skins change rarely; a long TTL keeps the panel fast without getting stale.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

// textureUrl -> { buffer, fetchedAt } held in-process for the proxy. Content-
// addressed URLs never change, so this is effectively a permanent cache that
// only re-fetches after a process restart. Eviction is amortized O(1): we only
// scan when we're already over the cap (insertions), never on the hot read path.
const imageCache = new Map();
const IMAGE_CACHE_CAP = 200;
const IMAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Decode a base64 textures blob into { SKIN: {url, model?} } (or null). */
function decodeTextures(encoded) {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(encoded), 'base64').toString('utf8'));
    return parsed && parsed.textures ? parsed.textures : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a player uuid (dashed or undashed) to their skin description:
 * { url, model: 'slim' | 'wide' }. Returns null when Mojang has no profile.
 * Throws on network/API failure so callers can tell "no skin" from "offline".
 */
async function resolveSkin(uuid) {
  const key = CACHE_PREFIX + String(uuid).replace(/-/g, '').toLowerCase();
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', key);
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) {
    return JSON.parse(cached.value_json);
  }

  let skin;
  try {
    const res = await fetch(API_BASE + key.slice(CACHE_PREFIX.length), {
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 204 || res.status === 404) {
      skin = null;
    } else if (!res.ok) {
      throw new Error(`Mojang session API HTTP ${res.status}`);
    } else {
      const body = await res.json();
      const textures = Array.isArray(body.properties)
        ? decodeTextures(body.properties.find((p) => p && p.name === 'textures')?.value)
        : null;
      const skinTex = textures && textures.SKIN;
      skin =
        skinTex && skinTex.url
          ? { url: skinTex.url, model: skinTex.metadata?.model === 'slim' ? 'slim' : 'wide' }
          : null;
    }
  } catch (err) {
    logger.debug('Resolving a Mojang skin failed.', {
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
    JSON.stringify(skin)
  );
  return skin;
}

module.exports = { resolveSkin, getSkinImage };

/**
 * Fetch a skin texture's PNG bytes for proxying, with an in-memory cache keyed
 * on the content-addressed texture URL. Throws on network failure so the route
 * can turn that into a placeholder.
 */
async function getSkinImage(url) {
  const hit = imageCache.get(url);
  if (hit) {
    if (Date.now() - hit.fetchedAt < IMAGE_CACHE_TTL_MS) {
      // Refresh recency so frequently-requested skins stay in the LRU golden
      // path without digging through the eviction scan.
      imageCache.delete(url);
      imageCache.set(url, hit);
      return hit.buffer;
    }
    imageCache.delete(url); // expired; fall through to re-fetch
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Mojang texture HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // Drop expired entries and trim back to the cap when over it. Runs only on a
  // miss (which is already paying a network fetch), so it stays amortized.
  if (imageCache.size >= IMAGE_CACHE_CAP) {
    const now = Date.now();
    for (const [key, entry] of imageCache) {
      if (now - entry.fetchedAt >= IMAGE_CACHE_TTL_MS) imageCache.delete(key);
      if (imageCache.size < IMAGE_CACHE_CAP) break;
    }
    while (imageCache.size >= IMAGE_CACHE_CAP) imageCache.delete(imageCache.keys().next().value);
  }
  imageCache.set(url, { buffer, fetchedAt: Date.now() });
  return buffer;
}
