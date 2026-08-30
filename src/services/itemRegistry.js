// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// JEI-style item registry. The list of every givable item/block on a server is
// derived primarily from the server's OWN files, so mod items always work for
// any loader, version or modpack with zero network dependency:
//
//   - every mod jar in  data/servers/<id>/mods/*.jar  ships lang files at
//     assets/<modid>/lang/en_us.json with keys like
//     "item.<ns>.<path>": "Display Name" / "block.<ns>.<path>": "Block Name"
//   - the vanilla server jar, in theory, ships assets/minecraft/lang/en_us.json
//     the same way, with modern "bundler" Mojang jars nesting the real jar at
//     META-INF/versions/<v>/server-<v>.jar inside the outer jar - BUT in
//     practice official server jars never actually contain assets/ (that's
//     client-jar-only), so this path realistically always comes up empty. See
//     fetchVanillaFallback() below for what actually supplies vanilla items.
//
// Only exact 3-segment keys are taken (item.ns.path - no dots inside path);
// 4+ segment keys are sub-entries (.desc, .tooltip, …) and are skipped.
//
// CACHING: building means opening ~hundreds of zips, so the result is persisted
// in the api_cache table under `item-registry:<serverId>` together with a
// fingerprint of the inputs (jar count + total size + newest mtime + vanilla
// jar identity). Cache loads are instant; a rebuild only happens when the mods
// folder or server jar actually changed. A per-process Map avoids re-parsing
// the JSON blob on every request.

const httpError = require('../utils/httpError');
const fsp = require('node:fs/promises');
const path = require('node:path');
const yauzl = require('yauzl');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');

const CACHE_PREFIX = 'item-registry:';
const LANG_RE = /^assets\/([a-z0-9_.-]+)\/lang\/en_us\.json$/i;
const META_RE = /^(META-INF\/(neoforge\.)?mods\.toml|fabric\.mod\.json|quilt\.mod\.json)$/;
const NESTED_SERVER_RE = /^META-INF\/versions\/[^/]+\/server[^/]*\.jar$/;
const KEY_RE = /^(item|block)\.([a-z0-9_-]+)\.([a-z0-9_-]+)$/;
const JAR_CONCURRENCY = 8;

// Official Mojang SERVER jars (plain or the modern "bundler" form) never ship
// assets/ - no lang files, no textures, that's client-jar-only. So on a vanilla
// (or vanilla-based: Paper/Spigot/Forge/NeoForge with few mods) server,
// readVanillaLang() below finds nothing and every minecraft:* item used to just
// be silently missing from the registry. This offline-cached, MC-version-keyed
// fallback (PrismarineJS/minecraft-data, MIT) fills that gap without needing
// the client jar. Cached in api_cache like every other external fetch in this
// codebase (see loaderVersions.js) - items/blocks lists are static per release,
// so the TTL is long and a network hiccup just falls back to a stale cache.
const MCDATA_BASE = 'https://cdn.jsdelivr.net/gh/PrismarineJS/minecraft-data@master/data/pc';
const MCDATA_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Item/block icons: served locally from public/icons/mc-items/ (one flat PNG
// per vanilla item id, no "minecraft:" prefix) instead of an external CDN -
// see scripts/fetch-wiki-icons.js for how that set is built/refreshed. A
// self-hosted panel commonly sits behind a reverse proxy or restrictive
// firewall that a client-side <img> to a third-party CDN may never reach;
// bundling avoids that dependency entirely. Mod items have no bundled icon
// (the source data is vanilla-only) - callers should skip icons for those.
const ICON_BASE = '/icons/mc-items';

const memory = new Map(); // serverId -> { fingerprint, registry }

// ---------------------------------------------------------------------------
// zip plumbing (yauzl, lazyEntries - only the entries we need are ever read)

function openZip(target) {
  return new Promise((resolve, reject) => {
    const cb = (err, zip) => (err ? reject(err) : resolve(zip));
    if (Buffer.isBuffer(target)) yauzl.fromBuffer(target, { lazyEntries: true }, cb);
    else yauzl.open(target, { lazyEntries: true }, cb);
  });
}

// Cap in-memory read size so a crafted jar whose lang/JSON decompresses to GBs
// can't OOM the panel. Callers (scanJar) already try/catch per entry, so an
// over-limit entry is simply skipped.
const MAX_ZIP_ENTRY_BYTES = 16 * 1024 * 1024;

function readZipEntry(zip, entry, { maxBytes = MAX_ZIP_ENTRY_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const chunks = [];
      let total = 0;
      stream.on('data', (c) => {
        total += c.length;
        if (total > maxBytes) {
          stream.destroy();
          reject(new Error(`zip entry exceeds ${Math.round(maxBytes / 1024 / 1024)}MB: ${entry.fileName}`));
          return;
        }
        chunks.push(c);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

/**
 * Walk a zip's central directory and read only entries `want(name)` selects.
 * `stopWhen(found)` may end the walk early once everything needed was seen.
 * @returns {Promise<Map<string, Buffer>>}
 */
function pickZipEntries(target, want, stopWhen = null) {
  return new Promise((resolve, reject) => {
    const found = new Map();
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(found);
    };
    openZip(target).then((zip) => {
      zip.on('error', (err) => {
        zip.close?.();
        finish(err);
      });
      zip.on('end', () => finish());
      zip.on('entry', (entry) => {
        if (!want(entry.fileName)) return zip.readEntry();
        readZipEntry(zip, entry)
          .then((buf) => {
            found.set(entry.fileName, buf);
            if (stopWhen && stopWhen(found)) {
              zip.close?.();
              return finish();
            }
            zip.readEntry();
          })
          .catch((err) => {
            zip.close?.();
            finish(err);
          });
      });
      zip.readEntry();
    }, finish);
  });
}

// ---------------------------------------------------------------------------
// mod metadata (display names) - cheap line-level parsing, never fatal

/** META-INF/[neoforge.]mods.toml → Map(modId -> displayName). */
function parseModsToml(text) {
  const names = new Map();
  let inMods = false;
  let modId = null;
  let displayName = null;
  const commit = () => {
    if (modId) names.set(modId, displayName || null);
    modId = null;
    displayName = null;
  };
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[[')) {
      if (inMods) commit();
      inMods = line.startsWith('[[mods]]');
      continue;
    }
    if (!inMods) continue;
    let m = /^modId\s*=\s*"([^"]+)"/.exec(line);
    if (m) {
      modId = m[1];
      continue;
    }
    m = /^displayName\s*=\s*"([^"]+)"/.exec(line);
    if (m) displayName = m[1];
  }
  if (inMods) commit();
  return names;
}

/** fabric.mod.json / quilt.mod.json → Map(modId -> name). */
function parseFabricModJson(text) {
  const names = new Map();
  try {
    const data = JSON.parse(String(text));
    if (data.id) names.set(String(data.id), data.name ? String(data.name) : null);
    const quilt = data.quilt_loader;
    if (quilt && quilt.id) {
      const meta = quilt.metadata || {};
      names.set(String(quilt.id), meta.name ? String(meta.name) : null);
    }
  } catch {
    /* malformed metadata - namespace fallback covers it */
  }
  return names;
}

// ---------------------------------------------------------------------------
// lang parsing

/**
 * Pull items/blocks out of one en_us.json.
 * @returns {[{id, name, kind:'item'|'block', ns}]}
 */
function parseLang(buf) {
  let data;
  try {
    data = JSON.parse(String(buf));
  } catch {
    return [];
  }
  const out = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const m = KEY_RE.exec(key); // exact 3 segments - sub-entries never match
    if (!m) continue;
    out.push({ id: `${m[2]}:${m[3]}`, name: value.trim(), kind: m[1], ns: m[2] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// vanilla server jar discovery

/** Candidate vanilla jar paths for a server, best-first. */
async function vanillaJarCandidates(serverId) {
  const base = dataPath('servers', serverId);
  const candidates = [];

  // Top-level jars (vanilla / custom: server.jar, minecraft_server*.jar, …)
  try {
    for (const e of await fsp.readdir(base, { withFileTypes: true })) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.jar')) candidates.push(path.join(base, e.name));
    }
  } catch {
    /* server dir gone */
  }

  // Forge/NeoForge: libraries/net/minecraft/server/<version>/*.jar
  const libDir = path.join(base, 'libraries', 'net', 'minecraft', 'server');
  const walk = async (dir, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) await walk(abs, depth + 1);
      else if (e.isFile() && e.name.endsWith('.jar')) candidates.push(abs);
    }
  };
  await walk(libDir, 0);

  // Paper-family keeps the Mojang jar under cache/.
  await walk(path.join(base, 'cache'), 0);

  // Largest first - the full server jar dwarfs slim/extra variants.
  const sized = [];
  for (const abs of candidates) {
    try {
      sized.push({ abs, size: (await fsp.stat(abs)).size });
    } catch {
      /* raced */
    }
  }
  sized.sort((a, b) => b.size - a.size);
  return sized.map((c) => c.abs);
}

/**
 * Find and parse the vanilla lang file. Handles both plain jars (assets at the
 * top level) and Mojang bundler jars (real jar nested under META-INF/versions).
 * @returns {{entries:[], jarPath:string}|null}
 */
async function readVanillaLang(serverId) {
  for (const jarPath of await vanillaJarCandidates(serverId)) {
    try {
      const found = await pickZipEntries(
        jarPath,
        (n) => LANG_RE.test(n) || NESTED_SERVER_RE.test(n),
        (f) => [...f.keys()].some((n) => LANG_RE.test(n))
      );
      const direct = [...found.entries()].find(([n]) => LANG_RE.test(n));
      if (direct) return { entries: parseLang(direct[1]), jarPath };

      const nested = [...found.entries()].find(([n]) => NESTED_SERVER_RE.test(n));
      if (nested) {
        const inner = await pickZipEntries(
          nested[1],
          (n) => LANG_RE.test(n),
          (f) => f.size > 0
        );
        const lang = [...inner.values()][0];
        if (lang) return { entries: parseLang(lang), jarPath };
      }
    } catch {
      /* not a readable zip / no assets - try the next candidate */
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// minecraft-data fallback (vanilla items when the server jar has no assets/)

async function cachedJson(cacheKey, url, ttlMs) {
  const cached = db.get('SELECT value_json, fetched_at FROM api_cache WHERE key = ?', cacheKey);
  if (cached && Date.now() - Date.parse(cached.fetched_at.replace(' ', 'T') + 'Z') < ttlMs) {
    return JSON.parse(cached.value_json);
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
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

async function fetchMcData(version) {
  const [items, blocks] = await Promise.all([
    cachedJson(`mcdata:items:${version}`, `${MCDATA_BASE}/${version}/items.json`, MCDATA_TTL_MS),
    cachedJson(`mcdata:blocks:${version}`, `${MCDATA_BASE}/${version}/blocks.json`, MCDATA_TTL_MS),
  ]);
  return { items, blocks };
}

const MCDATA_VERSIONS_TTL_MS = 24 * 60 * 60 * 1000;
const MCDATA_VERSIONS_URL = 'https://api.github.com/repos/PrismarineJS/minecraft-data/contents/data/pc';

/** minecraft-data's version folders that actually carry real per-version data
 *  (`latest` is a red herring - it only holds protocol.yml, no items/blocks). */
async function listMcDataVersions() {
  const entries = await cachedJson('mcdata:versions', MCDATA_VERSIONS_URL, MCDATA_VERSIONS_TTL_MS);
  return entries.filter((e) => e.type === 'dir' && /^\d+\.\d+(\.\d+)?$/.test(e.name)).map((e) => e.name);
}

function parseVer(v) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

function cmpVer(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** Closest available minecraft-data version to `requested` - exact, else the
 *  newest one at or below it, else (requested is older than everything we
 *  have) the oldest available. An unparsable/empty request just gets newest. */
function nearestVersion(requested, available) {
  const parsed = available.map((v) => ({ v, p: parseVer(v) })).filter((x) => x.p);
  if (!parsed.length) return null;
  parsed.sort((a, b) => cmpVer(b.p, a.p)); // newest first
  const req = parseVer(requested);
  if (!req) return parsed[0].v;
  const exact = parsed.find((x) => cmpVer(x.p, req) === 0);
  if (exact) return exact.v;
  const notNewer = parsed.find((x) => cmpVer(x.p, req) <= 0);
  return notNewer ? notNewer.v : parsed[parsed.length - 1].v;
}

/**
 * Vanilla item/block entries for a server's MC version, sourced from
 * minecraft-data instead of the (assets-less) server jar. Never throws - an
 * unreachable network just means vanilla items stay absent, same as today.
 * @returns {Promise<[{id, name, kind:'item'|'block', ns:'minecraft'}]|null>}
 */
async function fetchVanillaFallback(mcVersion) {
  const raw = String(mcVersion || '').trim();
  let version = raw && raw.toUpperCase() !== 'LATEST' ? raw : '';
  try {
    const available = await listMcDataVersions();
    version = nearestVersion(version, available) || version;
  } catch {
    /* directory listing unreachable - fall through and try the raw string as-is */
  }
  if (!version) return null;
  let data;
  try {
    data = await fetchMcData(version);
  } catch {
    return null;
  }
  const blockNames = new Set((data.blocks || []).map((b) => b.name));
  return (data.items || [])
    .filter((it) => it && it.name && it.displayName)
    .map((it) => ({
      id: `minecraft:${it.name}`,
      name: it.displayName,
      kind: blockNames.has(it.name) ? 'block' : 'item',
      ns: 'minecraft',
    }));
}

// ---------------------------------------------------------------------------
// item icons - local, bundled (see ICON_BASE above)

/** Base URL to build `${iconBase}/<path>.png` from (vanilla items only). */
function iconBaseUrl() {
  return ICON_BASE;
}

// ---------------------------------------------------------------------------
// fingerprint - cheap change detection over the inputs

async function computeFingerprint(serverId) {
  const modsDir = dataPath('servers', serverId, 'mods');
  let count = 0;
  let totalSize = 0;
  let maxMtime = 0;
  try {
    for (const e of await fsp.readdir(modsDir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.toLowerCase().endsWith('.jar')) continue;
      try {
        const st = await fsp.stat(path.join(modsDir, e.name));
        count += 1;
        totalSize += st.size;
        if (st.mtimeMs > maxMtime) maxMtime = st.mtimeMs;
      } catch {
        /* raced deletion */
      }
    }
  } catch {
    /* no mods dir - vanilla server */
  }

  // Vanilla jar identity: the best candidate's path + size (mtime shifts on
  // container reinstalls without content changes, so path+size is enough).
  let vanilla = 'none';
  const cands = await vanillaJarCandidates(serverId);
  if (cands.length) {
    try {
      const st = await fsp.stat(cands[0]);
      vanilla = `${path.relative(dataPath('servers', serverId), cands[0])}:${st.size}`;
    } catch {
      /* raced */
    }
  }
  // A server with no on-disk vanilla jar yet (never started) has no jar
  // identity to key off - mc_version explicitly, so switching it pre-launch
  // still invalidates the (otherwise empty) cached registry.
  const mcVersion = require('./servers').getServer(serverId)?.mc_version || '';
  return `v2|${count}|${totalSize}|${Math.round(maxMtime)}|${vanilla}|${mcVersion}`;
}

// ---------------------------------------------------------------------------
// build

/**
 * Scan every mod jar + the vanilla server jar and build the registry.
 * @param {string} serverId
 * @param {{onProgress?: (done:number, total:number, label?:string)=>void}} opts
 * @returns {Promise<{items:[], mods:[], builtAt:number, buildMs:number, fingerprint:string}>}
 */
async function buildRegistry(serverId, { onProgress = () => {} } = {}) {
  const server = require('./servers').getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');

  const started = Date.now();
  const fingerprint = await computeFingerprint(serverId);
  const byId = new Map(); // id -> {id, name, mod, kind}
  const modNames = new Map(); // ns -> display name

  // Vanilla first so mod-shipped assets/minecraft overrides never shadow it.
  const vanilla = await readVanillaLang(serverId);
  if (vanilla) {
    for (const e of vanilla.entries) {
      if (!byId.has(e.id)) byId.set(e.id, { id: e.id, name: e.name, mod: 'Minecraft', kind: e.kind });
    }
    modNames.set('minecraft', 'Minecraft');
  } else {
    // Server jars (vanilla or otherwise) never ship a client's assets/ - fall
    // back to the offline-cached, version-keyed vanilla list.
    const fallback = await fetchVanillaFallback(server.mc_version).catch(() => null);
    if (fallback) {
      for (const e of fallback) {
        if (!byId.has(e.id)) byId.set(e.id, { id: e.id, name: e.name, mod: 'Minecraft', kind: e.kind });
      }
      modNames.set('minecraft', 'Minecraft');
    }
  }

  const modsDir = dataPath('servers', serverId, 'mods');
  let jars = [];
  try {
    jars = (await fsp.readdir(modsDir, { withFileTypes: true }))
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.jar'))
      .map((e) => e.name)
      .sort();
  } catch {
    /* vanilla server - no mods dir */
  }

  let done = 0;
  const scanJar = async (name) => {
    let found;
    try {
      found = await pickZipEntries(path.join(modsDir, name), (n) => LANG_RE.test(n) || META_RE.test(n));
    } catch {
      return; // corrupt/unreadable jar - never fatal
    } finally {
      done += 1;
      onProgress(done, jars.length, name);
    }

    // Jar-level display names: modId -> name from whichever metadata is present.
    const jarNames = new Map();
    for (const [entryName, buf] of found) {
      if (entryName.endsWith('mods.toml')) {
        for (const [k, v] of parseModsToml(String(buf))) jarNames.set(k, v);
      } else if (entryName === 'fabric.mod.json' || entryName === 'quilt.mod.json') {
        for (const [k, v] of parseFabricModJson(buf)) jarNames.set(k, v);
      }
    }
    const fallbackName = [...jarNames.values()].find(Boolean) || null;

    for (const [entryName, buf] of found) {
      const langMatch = LANG_RE.exec(entryName);
      if (!langMatch) continue;
      const ns = langMatch[1].toLowerCase();
      const display = jarNames.get(ns) || fallbackName || ns;
      if (!modNames.has(ns) || modNames.get(ns) === ns) modNames.set(ns, display);
      for (const e of parseLang(buf)) {
        if (!byId.has(e.id)) {
          byId.set(e.id, { id: e.id, name: e.name, mod: modNames.get(e.ns) || display, kind: e.kind });
        }
        if (!modNames.has(e.ns)) modNames.set(e.ns, e.ns === ns ? display : e.ns);
      }
    }
  };

  // Bounded parallelism - ~200 jars on big packs, 8 at a time keeps FDs sane.
  const queue = [...jars];
  await Promise.all(
    Array.from({ length: JAR_CONCURRENCY }, async () => {
      while (queue.length) {
        const name = queue.shift();
        if (name) await scanJar(name);
      }
    })
  );

  // Re-resolve mod display names (a lang file may have been scanned before the
  // jar that declares its namespace's pretty name).
  const items = [...byId.values()];
  for (const item of items) {
    const ns = item.id.split(':')[0];
    item.mod = modNames.get(ns) || ns;
  }
  items.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const modCounts = new Map();
  for (const item of items) {
    const ns = item.id.split(':')[0];
    modCounts.set(ns, (modCounts.get(ns) || 0) + 1);
  }
  const mods = [...modCounts.entries()]
    .map(([ns, count]) => ({ id: ns, name: modNames.get(ns) || ns, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const registry = {
    items,
    mods,
    builtAt: Date.now(),
    buildMs: Date.now() - started,
    fingerprint,
    vanillaJar: vanilla ? path.relative(dataPath('servers', serverId), vanilla.jarPath).replace(/\\/g, '/') : null,
    jarCount: jars.length,
  };

  db.run(
    `INSERT INTO api_cache (key, value_json, fetched_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, fetched_at = excluded.fetched_at`,
    CACHE_PREFIX + serverId,
    JSON.stringify(registry)
  );
  memory.set(serverId, { fingerprint, registry });
  return registry;
}

// ---------------------------------------------------------------------------
// cached access

/**
 * Registry for a server: in-process cache → api_cache row → full build. The
 * fingerprint (jar count/size/mtime + vanilla jar) is re-checked every call -
 * it's a directory stat sweep, so cache hits stay in the low milliseconds.
 */
async function getRegistry(serverId, { force = false, onProgress } = {}) {
  const fingerprint = await computeFingerprint(serverId);
  if (!force) {
    const mem = memory.get(serverId);
    if (mem && mem.fingerprint === fingerprint) return mem.registry;

    const row = db.get('SELECT value_json FROM api_cache WHERE key = ?', CACHE_PREFIX + serverId);
    if (row) {
      try {
        const registry = JSON.parse(row.value_json);
        if (registry.fingerprint === fingerprint) {
          memory.set(serverId, { fingerprint, registry });
          return registry;
        }
      } catch {
        /* corrupt cache row - rebuild */
      }
    }
  }
  return buildRegistry(serverId, { onProgress });
}

/** [{id: namespace, name: display, count}] for the mod filter dropdown. */
async function getMods(serverId) {
  return (await getRegistry(serverId)).mods;
}

// ---------------------------------------------------------------------------
// search

/**
 * Search the registry. q matches display name OR id (case-insensitive
 * substring). Rank: exact id > name starts-with > name contains > id contains.
 * @param {string} serverId
 * @param {{q?:string, mod?:string, kind?:'item'|'block', limit?:number, offset?:number}} params
 * @returns {Promise<{items:[], total:number}>}
 */
async function search(serverId, { q = '', mod = '', kind = '', limit = 100, offset = 0 } = {}) {
  const registry = await getRegistry(serverId);
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  const modNs = String(mod || '')
    .trim()
    .toLowerCase();
  const wantKind = kind === 'item' || kind === 'block' ? kind : null;

  const scored = [];
  for (const item of registry.items) {
    if (wantKind && item.kind !== wantKind) continue;
    if (modNs && !item.id.startsWith(modNs + ':')) continue;
    if (!needle) {
      scored.push([2, item]); // no query - keep alphabetical registry order
      continue;
    }
    const id = item.id.toLowerCase();
    const name = item.name.toLowerCase();
    let rank;
    if (id === needle || id === `minecraft:${needle}`) rank = 0;
    else if (name.startsWith(needle)) rank = 1;
    else if (name.includes(needle)) rank = 2;
    else if (id.includes(needle)) rank = 3;
    else continue;
    scored.push([rank, item]);
  }
  if (needle) scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));

  const total = scored.length;
  const start = Math.max(0, Math.trunc(offset) || 0);
  const n = Math.min(500, Math.max(1, Math.trunc(limit) || 100));
  return { items: scored.slice(start, start + n).map(([, item]) => item), total };
}

module.exports = {
  buildRegistry,
  getRegistry,
  getMods,
  search,
  iconBaseUrl,
  // exported for tests
  parseLang,
  parseModsToml,
  computeFingerprint,
  fetchVanillaFallback,
  nearestVersion,
};
