// @ts-nocheck - dynamic HTTP-JSON interop with four loader registries.
'use strict';

// Loader BUILD versions for the "From mods" wizard, so a server can pin a
// specific Fabric/Quilt/NeoForge/Forge loader instead of always tracking latest.
// Each source is a public JSON endpoint; results are cached in api_cache and the
// call is best-effort - on any failure we still return a usable "Latest" option
// so the picker never dead-ends. The chosen build maps to the itzg env var:
//   fabric → FABRIC_LOADER_VERSION   quilt → QUILT_LOADER_VERSION
//   neoforge → NEOFORGE_VERSION      forge → FORGE_VERSION
// An empty version means "don't pin" - let the image resolve the latest itself.

const path = require('node:path');
const db = require('../db');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');
const mojang = require('./mojang');

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_BUILDS = 40; // keep the dropdown sane; power users have the advanced env field
const LATEST = { version: '', label: 'Latest (recommended)' };

const ENV_KEY = {
  fabric: 'FABRIC_LOADER_VERSION',
  quilt: 'QUILT_LOADER_VERSION',
  neoforge: 'NEOFORGE_VERSION',
  forge: 'FORGE_VERSION',
  paper: 'PAPER_BUILD',
};

/** itzg env var that pins this loader's build (null for loaders without one). */
function envKeyFor(loader) {
  return ENV_KEY[String(loader).toLowerCase()] || null;
}

async function cachedJson(cacheKey, url, { headers } = {}) {
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  // SQLite datetime('now') is space-separated; normalize to ISO before parsing.
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) {
    return JSON.parse(cached.value_json);
  }
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    db.run(
      `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
      cacheKey,
      JSON.stringify(data)
    );
    return data;
  } catch (err) {
    if (cached) return JSON.parse(cached.value_json); // stale beats nothing
    throw err;
  }
}

// Fabric & Quilt loader versions are independent of the Minecraft version.
async function fabricBuilds() {
  const list = await cachedJson('loader:fabric', 'https://meta.fabricmc.net/v2/versions/loader');
  return list
    .filter((v) => v && v.version)
    .slice(0, MAX_BUILDS)
    .map((v) => ({ version: v.version, label: v.stable ? `${v.version} (stable)` : v.version }));
}

async function quiltBuilds() {
  const list = await cachedJson('loader:quilt', 'https://meta.quiltmc.org/v3/versions/loader');
  return list
    .filter((v) => v && v.version)
    .slice(0, MAX_BUILDS)
    .map((v) => ({ version: v.version, label: v.version }));
}

/** NeoForge encodes the MC version in its build: 1.21.1 → "21.1.x", 1.21 → "21.0.x". */
function neoforgePrefix(mc) {
  const m = /^1\.(\d+)(?:\.(\d+))?$/.exec(String(mc || ''));
  return m ? `${m[1]}.${m[2] || '0'}.` : null;
}

async function neoforgeBuilds(mc) {
  const data = await cachedJson(
    'loader:neoforge',
    'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
  );
  const all = (data.versions || []).slice().reverse(); // maven returns ascending; newest first
  const prefix = neoforgePrefix(mc);
  const matched = prefix ? all.filter((v) => v.startsWith(prefix)) : all;
  return matched.slice(0, MAX_BUILDS).map((v) => ({ version: v, label: /-beta$/i.test(v) ? `${v} (beta)` : v }));
}

// Forge's promotions feed only surfaces the recommended + latest build per MC -
// that covers what almost everyone pins; the advanced FORGE_VERSION field remains
// for arbitrary builds.
async function forgeBuilds(mc) {
  const data = await cachedJson(
    'loader:forge',
    'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
  );
  const promos = data.promos || {};
  const recommended = promos[`${mc}-recommended`];
  const latest = promos[`${mc}-latest`];
  const builds = [];
  if (recommended) builds.push({ version: recommended, label: `${recommended} (recommended)` });
  if (latest && latest !== recommended) builds.push({ version: latest, label: `${latest} (latest)` });
  return builds;
}

// Paper's build list is scoped to a single MC version, unlike the other
// loaders' one-global-fetch-then-filter shape - cache key includes `mc`.
//
// PaperMC moved distribution to the "Fill" v3 API (fill.papermc.io); the
// legacy api.papermc.io/v2 stopped receiving versions and 404s for MC
// releases above 1.21.11. v3 returns a BARE newest-first array of builds and
// names channels STABLE/RECOMMENDED/ALPHA/BETA - itzg's PAPER_CHANNEL
// vocabulary stays default/experimental, so map default → the release
// channels and experimental → the pre-release ones. Fill asks for a real
// User-Agent (its docs reserve the right to 403 anonymous clients).
const PAPER_CHANNEL_MAP = {
  default: new Set(['STABLE', 'RECOMMENDED']),
  experimental: new Set(['ALPHA', 'BETA']),
};
async function paperBuilds(mc, { channel = 'default' } = {}) {
  const data = await cachedJson(
    `loader:paper3:${mc}`,
    `https://fill.papermc.io/v3/projects/paper/versions/${mc}/builds`,
    { headers: { 'User-Agent': 'MinecraftServerManager (self-hosted panel; github.com/anefzaoui)' } }
  );
  const wanted = PAPER_CHANNEL_MAP[channel] || PAPER_CHANNEL_MAP.default;
  const builds = (Array.isArray(data) ? data : []).filter((b) => b && wanted.has(String(b.channel).toUpperCase()));
  return builds.slice(0, MAX_BUILDS).map((b) => ({
    version: String(b.id),
    label: channel === 'default' ? String(b.id) : `${b.id} (${String(b.channel).toLowerCase()})`,
  }));
}

/**
 * Build list for a loader (+ MC where the loader is MC-specific). Always starts
 * with the "Latest" no-pin option, then specific builds newest-first when the
 * registry is reachable. Never throws - a failed fetch yields the Latest option.
 */
async function getBuilds(loader, mc, { channel } = {}) {
  const key = String(loader).toLowerCase();
  let builds = [];
  try {
    if (key === 'fabric') builds = await fabricBuilds();
    else if (key === 'quilt') builds = await quiltBuilds();
    else if (key === 'neoforge') builds = await neoforgeBuilds(mc);
    else if (key === 'forge') builds = await forgeBuilds(mc);
    else if (key === 'paper') builds = await paperBuilds(mc, { channel });
  } catch (err) {
    logger.debug('Fetching loader builds failed; offering the "Latest" option only.', {
      loader: key,
      mc,
      err: serializeError(err, { includeStack: false }),
    });
    builds = []; // best-effort - fall through to Latest-only
  }
  return { loader: key, envKey: envKeyFor(key), builds: [LATEST, ...builds], default: '' };
}

// Per-MC-version support probe for the plugin family. 'paper' is the loader for
// every PLUGIN_TYPES flavor (mods.loaderOf collapses them), but the FLAVOR ships
// the build: probe Paper's Fill list channel-wise, Purpur's own registry by
// existence, and the other Paper forks by the Paper bellwether (they cannot ship
// a Minecraft version Paper has not built). A probe that throws (registry down,
// nothing cached) is treated as supported so a PaperMC outage never invents a
// false hold; a present cache entry - even an empty one - is authoritative.
const BELLWETHER_TYPES = new Set(['PUFFERFISH', 'LEAF', 'FOLIA', 'SPIGOT', 'BUKKIT', 'CANYON']);

/**
 * @returns {Promise<{supported: boolean, heard: boolean}>} `heard` is false only
 *   when the registry itself could not be reached (no data at all); callers then
 *   treat the version as supported rather than inventing a hold.
 */
async function mcAvailableOnServerType(type, mc, { channel = 'default' } = {}) {
  try {
    if (type === 'PAPER' || BELLWETHER_TYPES.has(type)) {
      const builds = await paperBuilds(mc, { channel });
      return { supported: builds.length > 0, heard: true };
    }
    if (type === 'PURPUR') {
      const data = await cachedJson(
        `loader:purpur:${mc}`,
        `https://api.purpurmc.org/v2/purpur/${encodeURIComponent(mc)}`
      );
      const list = data && data.builds && Array.isArray(data.builds.all) ? data.builds.all : [];
      return { supported: list.length > 0, heard: true };
    }
  } catch {
    // registry down: never gate on a guess
  }
  return { supported: true, heard: false };
}

// Single-flight + TTL memo of "the newest Minecraft version this server type
// actually supports" (mirrors mojang.getVersionManifest's memo + singleFlight).
// A dashboard render of N LATEST-pinned plugin servers performs one flight and
// every probe after the first is a hot api_cache read; registry-down resolves
// null and callers fall back to Mojang's latest.release (current behaviour).
// Flights are keyed per (type, channel): a concurrent call for a *different*
// server type must never receive the first caller's answer - e.g. Paper and
// Purpur resolve against different registries and ship on different schedules.
let latestMcMemo = null; // { key, mc, atMs }
const latestMcInFlight = new Map(); // key -> Promise

async function newestMcSupportedByServerType(type, { channel = 'default', maxProbes = 8 } = {}) {
  const key = `${type}:${channel}`;
  if (latestMcMemo && latestMcMemo.key === key && Date.now() - latestMcMemo.atMs < TTL_MS) {
    return latestMcMemo.mc;
  }
  if (latestMcInFlight.has(key)) return latestMcInFlight.get(key);
  latestMcInFlight.set(
    key,
    (async () => {
      const manifest = await mojang.getVersionManifest();
      let mc = null;
      let probed = 0;
      for (const v of manifest.versions) {
        if (v.type !== 'release') continue;
        if (probed++ >= maxProbes) break;
        const ok = await mcAvailableOnServerType(type, v.id, { channel });
        if (ok.supported) {
          mc = v.id;
          break;
        }
      }
      latestMcMemo = { key, mc, atMs: Date.now() };
      return mc;
    })().finally(() => {
      latestMcInFlight.delete(key);
    })
  );
  return latestMcInFlight.get(key);
}

module.exports = { getBuilds, envKeyFor, mcAvailableOnServerType, newestMcSupportedByServerType };
