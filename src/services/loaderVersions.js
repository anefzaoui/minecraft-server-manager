// @ts-nocheck - dynamic HTTP-JSON interop with four loader registries.
'use strict';

// Loader BUILD versions for the "From mods" wizard and the Versions tab's loader
// picker, so a server can pin a specific Fabric/Quilt/NeoForge/Forge loader
// instead of always tracking latest. Each source is a public registry endpoint;
// results are cached in api_cache and getBuilds is best-effort - on any failure
// we still return a usable "Latest" option so the picker never dead-ends. The
// chosen build maps to the itzg env var:
//   fabric → FABRIC_LOADER_VERSION   quilt → QUILT_LOADER_VERSION
//   neoforge → NEOFORGE_VERSION      forge → FORGE_VERSION
// An empty version means "don't pin" - let the image resolve the latest itself.

const path = require('node:path');
const db = require('../db');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_BUILDS = 40; // keep the dropdown sane; the picker also takes a typed build
const LATEST = { version: '', label: 'Latest (recommended)' };
// Registries don't all list builds in order (Forge's maven metadata doesn't), and
// a plain string sort puts 47.4.5 above 47.4.26. Numeric collation compares the
// digit runs as numbers. A pre-release sorts below its own release, as in
// semver: the part before the first "-" decides first, so 0.30.1 is newer than
// 0.30.1-beta.4 (collation alone would put the longer string after it).
const BUILD_COLLATOR = new Intl.Collator('en', { numeric: true });
/** >0 when build a is newer than build b. */
function compareBuilds(a, b) {
  const [coreA, ...preA] = String(a).split('-');
  const [coreB, ...preB] = String(b).split('-');
  const byCore = BUILD_COLLATOR.compare(coreA, coreB);
  if (byCore !== 0) return byCore;
  if (!preA.length || !preB.length) return preB.length - preA.length; // a release beats its pre-release
  return BUILD_COLLATOR.compare(preA.join('-'), preB.join('-'));
}
const byBuildDesc = (a, b) => compareBuilds(b, a);

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

/**
 * Fetch through the api_cache. `parse` turns the response into the JSON-able
 * value that gets cached - the default reads JSON; Forge's XML metadata passes
 * its own so the cache holds the extracted list, not 200 KB of XML. `nonEmpty`
 * says whether a response holds anything: a registry that answers 200 with an
 * error page or a truncated body must not be cached as "no builds" for hours,
 * so an empty one counts as a failure. `fresh` skips a cached copy that is
 * still in date (a stale copy still beats a failed fetch).
 */
async function cachedJson(cacheKey, url, { headers, parse = (res) => res.json(), nonEmpty, fresh = false } = {}) {
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  // SQLite datetime('now') is space-separated; normalize to ISO before parsing.
  if (!fresh && cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < TTL_MS) {
    return JSON.parse(cached.value_json);
  }
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await parse(res);
    if (nonEmpty && !nonEmpty(data)) throw new Error('The registry answered with an empty list');
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

// The builders below return EVERY build they know of, newest first; getBuilds
// caps the dropdown, while isKnownBuild checks a typed build against the lot.
// `fresh` bypasses an in-date cache (see checkBuild).

const isNonEmptyArray = (data) => Array.isArray(data) && data.length > 0;
const hasVersions = (data) => Boolean(data) && Array.isArray(data.versions) && data.versions.length > 0;

// Fabric & Quilt loader versions are independent of the Minecraft version.
async function fabricBuilds({ fresh } = {}) {
  const list = await cachedJson('loader:fabric', 'https://meta.fabricmc.net/v2/versions/loader', {
    nonEmpty: isNonEmptyArray,
    fresh,
  });
  return list
    .filter((v) => v && v.version)
    .map((v) => ({ version: v.version, label: v.stable ? `${v.version} (stable)` : v.version }));
}

async function quiltBuilds({ fresh } = {}) {
  const list = await cachedJson('loader:quilt', 'https://meta.quiltmc.org/v3/versions/loader', {
    nonEmpty: isNonEmptyArray,
    fresh,
  });
  return list.filter((v) => v && v.version).map((v) => ({ version: v.version, label: v.version }));
}

/**
 * NeoForge encodes the MC version in its build: 1.21.1 → "21.1.x", 1.21 → "21.0.x".
 * From the year-based releases on, the build starts with the MC version itself:
 * 26.3 → "26.3.0.x", 26.3.1 → "26.3.1.x".
 */
function neoforgePrefix(mc) {
  const legacy = /^1\.(\d+)(?:\.(\d+))?$/.exec(String(mc || ''));
  if (legacy) return `${legacy[1]}.${legacy[2] || '0'}.`;
  const yearly = /^(\d{2,})\.(\d+)(?:\.(\d+))?$/.exec(String(mc || ''));
  return yearly ? `${yearly[1]}.${yearly[2]}.${yearly[3] || '0'}.` : null;
}

async function neoforgeBuilds(mc, { fresh } = {}) {
  const data = await cachedJson(
    'loader:neoforge',
    'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge',
    { nonEmpty: hasVersions, fresh }
  );
  // Builds for Minecraft snapshots and pre-releases ("26.1.0.0-alpha.1+snapshot-1",
  // "…+pre-3") share the release's prefix; a release server must not be
  // offered them. The API's order is lexicographic in places (alpha.9 above
  // alpha.15), so sort rather than trust it.
  const all = (data.versions || []).filter((v) => !v.includes('+')).sort(byBuildDesc);
  const prefix = neoforgePrefix(mc);
  const matched = prefix ? all.filter((v) => v.startsWith(prefix)) : all;
  return matched.map((v) => ({ version: v, label: /-beta$/i.test(v) ? `${v} (beta)` : v }));
}

/**
 * Forge's maven metadata lists every build ever published as "<mc>-<forge>",
 * some older ones with a trailing "-<mc>" too, in no reliable order.
 */
function parseForgeMaven(xml) {
  return [...String(xml).matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1].trim());
}

/** Every Forge build for one MC version, newest first. */
async function forgeMavenBuilds(mc, { fresh } = {}) {
  const data = await cachedJson(
    'loader:forge-maven',
    'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml',
    {
      headers: { Accept: 'application/xml' },
      parse: async (res) => ({ versions: parseForgeMaven(await res.text()) }),
      nonEmpty: hasVersions,
      fresh,
    }
  );
  const prefix = `${mc}-`;
  const suffix = `-${mc}`;
  return (data.versions || [])
    .filter((v) => v.startsWith(prefix))
    .map((v) => v.slice(prefix.length))
    .map((v) => (v.endsWith(suffix) ? v.slice(0, -suffix.length) : v))
    .sort(byBuildDesc);
}

// The promotions feed names the recommended + latest build per MC, which label
// the full maven list. Either source alone still yields a usable list.
async function forgeBuilds(mc) {
  // Both sources at once: one after the other, two slow hosts would make the
  // wizard wait out both timeouts before it falls back.
  const [promosResult, mavenResult] = await Promise.allSettled([
    cachedJson('loader:forge', 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'),
    forgeMavenBuilds(mc),
  ]);
  let promos = {};
  if (promosResult.status === 'fulfilled') {
    promos = promosResult.value.promos || {};
  } else {
    logger.debug('Fetching the Forge promotions feed failed; listing builds without labels.', {
      mc,
      err: serializeError(promosResult.reason, { includeStack: false }),
    });
  }
  const recommended = promos[`${mc}-recommended`];
  const latest = promos[`${mc}-latest`];
  let versions;
  if (mavenResult.status === 'fulfilled') {
    versions = mavenResult.value;
  } else {
    if (!recommended && !latest) throw mavenResult.reason;
    logger.debug('Fetching the Forge build list failed; offering the promoted builds only.', {
      mc,
      err: serializeError(mavenResult.reason, { includeStack: false }),
    });
    versions = [...new Set([latest, recommended].filter(Boolean))];
  }
  return versions.map((v) => {
    if (v === recommended) return { version: v, label: `${v} (recommended)`, recommended: true };
    if (v === latest) return { version: v, label: `${v} (latest)` };
    return { version: v, label: v };
  });
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
  return builds.map((b) => ({
    version: String(b.id),
    label: channel === 'default' ? String(b.id) : `${b.id} (${String(b.channel).toLowerCase()})`,
  }));
}

/** Every known build, newest first. Throws when the registry can't be reached. */
async function allBuilds(loader, mc, { channel, fresh } = {}) {
  const key = String(loader).toLowerCase();
  if (key === 'fabric') return fabricBuilds({ fresh });
  if (key === 'quilt') return quiltBuilds({ fresh });
  if (key === 'neoforge') return neoforgeBuilds(mc, { fresh });
  if (key === 'forge') return forgeBuilds(mc);
  if (key === 'paper') return paperBuilds(mc, { channel });
  return [];
}

/**
 * Build list for a loader (+ MC where the loader is MC-specific). Always starts
 * with the "Latest" no-pin option, then specific builds newest-first when the
 * registry is reachable. Never throws - a failed fetch yields the Latest option.
 */
async function getBuilds(loader, mc, { channel } = {}) {
  const key = String(loader).toLowerCase();
  let builds;
  try {
    const all = await allBuilds(key, mc, { channel });
    builds = all.slice(0, MAX_BUILDS);
    // The recommended build stays listed even when 40 newer ones push it past
    // the cap: the update checker offers it, and the picker labels it.
    const recommended = all.find((b) => b.recommended);
    if (recommended && !builds.includes(recommended)) builds.push(recommended);
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

/**
 * Whether `version` is a published build of this loader for this MC version -
 * the check behind a typed-in build, which may be older than the dropdown's
 * cap. Unlike getBuilds this throws when the registry can't be reached: an
 * unchecked build would only surface as a server that fails to install.
 */
async function isKnownBuild(loader, mc, version) {
  return (await checkBuild(loader, mc, version)).known;
}

/**
 * isKnownBuild, plus the closest newer build in the same release line when
 * `version` isn't one. Forge skips numbers (there is no 47.4.14 between
 * 47.4.13 and 47.4.15), while a mod's "needs 47.4.14 or above" reads like a
 * build to type - the refusal can then name the build that satisfies it. Only
 * the same line (47.4.x) counts, so a plain typo gets no misleading hint.
 * @returns {Promise<{ known: boolean, closestNewer: string|null }>}
 */
async function checkBuild(loader, mc, version) {
  // Forge's list straight from maven: forgeBuilds would fall back to the two
  // promoted builds and wrongly reject every other one.
  const list = (opts) =>
    String(loader).toLowerCase() === 'forge'
      ? forgeMavenBuilds(mc, opts)
      : allBuilds(loader, mc, opts).then((builds) => builds.map((b) => b.version));
  let versions = await list({});
  // A miss in a list cached up to 6 hours ago may be a build published since:
  // check the registry itself once before calling the build unpublished.
  if (!versions.includes(version)) versions = await list({ fresh: true });
  if (versions.includes(version)) return { known: true, closestNewer: null };
  const line = version.includes('.') ? version.slice(0, version.lastIndexOf('.') + 1) : null;
  const newer = line
    ? versions.filter((v) => v.startsWith(line) && compareBuilds(v, version) > 0).sort(compareBuilds)
    : [];
  return { known: false, closestNewer: newer[0] || null };
}

module.exports = {
  getBuilds,
  isKnownBuild,
  checkBuild,
  compareBuilds,
  envKeyFor,
  neoforgePrefix,
  parseForgeMaven,
};
