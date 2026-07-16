// @ts-nocheck — dynamic HTTP-JSON interop with four loader registries.
'use strict';

// Loader BUILD versions for the "From mods" wizard, so a server can pin a
// specific Fabric/Quilt/NeoForge/Forge loader instead of always tracking latest.
// Each source is a public JSON endpoint; results are cached in api_cache and the
// call is best-effort — on any failure we still return a usable "Latest" option
// so the picker never dead-ends. The chosen build maps to the itzg env var:
//   fabric → FABRIC_LOADER_VERSION   quilt → QUILT_LOADER_VERSION
//   neoforge → NEOFORGE_VERSION      forge → FORGE_VERSION
// An empty version means "don't pin" — let the image resolve the latest itself.

const db = require('../db');

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_BUILDS = 40; // keep the dropdown sane; power users have the advanced env field
const LATEST = { version: '', label: 'Latest (recommended)' };

const ENV_KEY = {
  fabric: 'FABRIC_LOADER_VERSION',
  quilt: 'QUILT_LOADER_VERSION',
  neoforge: 'NEOFORGE_VERSION',
  forge: 'FORGE_VERSION',
};

/** itzg env var that pins this loader's build (null for loaders without one). */
function envKeyFor(loader) {
  return ENV_KEY[String(loader).toLowerCase()] || null;
}

async function cachedJson(cacheKey, url) {
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  // SQLite datetime('now') is space-separated; normalize to ISO before parsing.
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) {
    return JSON.parse(cached.value_json);
  }
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
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

// Forge's promotions feed only surfaces the recommended + latest build per MC —
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

/**
 * Build list for a loader (+ MC where the loader is MC-specific). Always starts
 * with the "Latest" no-pin option, then specific builds newest-first when the
 * registry is reachable. Never throws — a failed fetch yields the Latest option.
 */
async function getBuilds(loader, mc) {
  const key = String(loader).toLowerCase();
  let builds = [];
  try {
    if (key === 'fabric') builds = await fabricBuilds();
    else if (key === 'quilt') builds = await quiltBuilds();
    else if (key === 'neoforge') builds = await neoforgeBuilds(mc);
    else if (key === 'forge') builds = await forgeBuilds(mc);
  } catch {
    builds = []; // best-effort — fall through to Latest-only
  }
  return { loader: key, envKey: envKeyFor(key), builds: [LATEST, ...builds], default: '' };
}

module.exports = { getBuilds, envKeyFor };
