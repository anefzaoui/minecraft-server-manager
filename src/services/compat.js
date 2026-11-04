// @ts-nocheck - dynamic registry JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Minecraft version compatibility for a server's installed mods.
//
// The question this answers: "if I moved this server to Minecraft X, which of
// my mods would come with me?" Before this existed the panel offered a version
// update whenever Mojang published a newer release, which on a 1.20.1 modded
// server is never true (#52).
//
// Shape of a scan:
//   1. inventory  - every jar in the server's mod/plugin folder, resolved to a
//                   platform project: panel-installed rows first (free), then
//                   the CurseForge pack manifest (free), then - for what is
//                   left - the file's own hash, answered from the identity
//                   cache or by asking the registries.
//   2. support    - each distinct project's (loader, Minecraft version) matrix.
//                   CurseForge answers 200 projects per request out of its
//                   latestFilesIndexes; Modrinth needs one request per project
//                   to keep loader and version PAIRED (its project-level list
//                   flattens them, which would call a NeoForge-only 1.21 build
//                   a Forge build). Both are cached in project_support.
//   3. matrix     - per candidate Minecraft version: which mods have a build,
//                   which do not, which could not be identified at all.
//
// Everything is driven by the manual "check future versions" button - scans
// read hundreds of files and make real API calls, and the result decides
// whether an upgrade is offered, so it is never something the panel starts on
// its own. Progress and partial results live in the DB (see migration 027), so
// a browser refresh or a panel restart mid-scan resumes instead of restarting.

const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const db = require('../db');
const httpError = require('../utils/httpError');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');
const { dataPath } = require('../storage/pathGuard');
const { curseforgeFingerprint } = require('../utils/murmur2');
const { compatibleLoaders } = require('../utils/loaderCompat');
const modrinth = require('./modrinthApi');
const curseforge = require('./curseforgeApi');
const mojang = require('./mojang');

const SUPPORT_TTL_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 25; // projects between partial-result writes
const MAX_JAR_BYTES = 512 * 1024 * 1024; // a jar bigger than this is not a mod

// CurseForge modLoader ids, as they appear in latestFilesIndexes. 0 ("Any")
// carries no loader claim, so it is stored as null and accepted everywhere.
const CF_LOADER = { 1: 'forge', 2: 'cauldron', 3: 'liteloader', 4: 'fabric', 5: 'quilt', 6: 'neoforge' };

/** Plain release versions only - "1.21.4", "26.3", never "26.3-rc-1". */
function isPlainVersion(v) {
  return /^\d+(\.\d+){0,2}$/.test(String(v || ''));
}

// ---- Identity ---------------------------------------------------------------

/**
 * A previously established identity for these exact bytes. Keyed on the
 * content hash and nothing else: file names repeat across projects and sizes
 * collide, and an identity that drives a compatibility gate must not rest on a
 * guess that two files with the same name are the same mod.
 */
function cachedIdentity(sha256) {
  const row = db.get('SELECT * FROM content_identity WHERE sha256 = ?', sha256);
  // A row with no project is not an answer, it is the absence of one, and must
  // never short-circuit a fresh lookup (see rememberIdentity: only positive
  // identities are stored, so this only guards rows from an older shape).
  return row && row.platform && row.project_id ? row : null;
}

function rememberIdentity(sha256, { filename, size, platform, projectId, name, version }) {
  db.run(
    `INSERT INTO content_identity (sha256, filename, size, platform, project_id, name, version, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(sha256) DO UPDATE SET
       filename = excluded.filename, size = excluded.size, platform = excluded.platform,
       project_id = excluded.project_id, name = excluded.name, version = excluded.version,
       checked_at = excluded.checked_at`,
    sha256,
    filename,
    size,
    platform || null,
    projectId || null,
    name || null,
    version || null
  );
}

/**
 * Every jar the server actually loads, with a platform project attached
 * wherever one can be found.
 * @returns {Promise<{file, name, platform, projectId, source}[]>} `platform`
 *   is null for a jar nothing could identify - the caller must treat those as
 *   "compatibility unknown", never as compatible.
 */
async function inventory(serverId, { onProgress = () => {} } = {}) {
  const serversService = require('./servers');
  const modsService = require('./mods');
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');

  const kind = modsService.contentKindOf(server); // 'mod' | 'plugin'
  const dirRel = modsService.contentDir(server, kind);
  const dirAbs = dataPath('servers', serverId, dirRel);
  let entries;
  try {
    entries = await fsp.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return [];
  }

  // Free lookups first: rows the panel installed itself, then the pack manifest.
  const byFilename = new Map();
  for (const row of db.all(
    `SELECT sc.filename, sc.name, lf.platform, lf.project_id
       FROM server_content sc LEFT JOIN library_files lf ON lf.id = sc.library_id
      WHERE sc.server_id = ?`,
    serverId
  )) {
    byFilename.set(row.filename.replace(/\.disabled$/, ''), row);
  }
  const manifest = modsService.packManifestIndex(serverId);

  const items = [];
  const needIdentify = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // A disabled jar is not loaded by the server, so it has no say in which
    // versions the server can move to - and blocking an upgrade on one would
    // make "turn the blocker off" not work, which is the obvious way out of a
    // mod that has not caught up yet.
    if (entry.name.endsWith('.disabled')) continue;
    const filename = entry.name;
    if (!filename.endsWith('.jar')) continue; // datapacks/resource packs are version-agnostic
    const abs = path.join(dirAbs, entry.name);

    const row = byFilename.get(filename);
    if (row && row.platform && row.project_id) {
      items.push({ file: filename, name: row.name, platform: row.platform, projectId: String(row.project_id) });
      continue;
    }
    const fromManifest = manifest.get(filename);
    if (fromManifest && fromManifest.projectId) {
      items.push({
        file: filename,
        name: (row && row.name) || prettyName(filename),
        platform: 'curseforge',
        projectId: String(fromManifest.projectId),
      });
      continue;
    }
    // Only what is left needs its size: the two lookups above answered without
    // touching the file at all.
    const stat = await fsp.stat(abs).catch(() => null);
    const size = stat ? stat.size : 0;
    if (size > 0 && size <= MAX_JAR_BYTES) needIdentify.push({ filename, abs, size });
    else items.push({ file: filename, name: prettyName(filename), platform: null, projectId: null });
  }

  // What is left has to be read off disk and hashed. A hash that has been seen
  // before answers from the cache; only genuinely new bytes cost a registry
  // lookup. Batched so one unreachable registry cannot strand the whole scan,
  // and so the progress bar moves on a big pack.
  // (idempotent require — the file is already loaded on the first scan)
  const { identifyJars, parseJarMeta } = require('./modIdentify');
  for (let i = 0; i < needIdentify.length; i += BATCH_SIZE) {
    const chunk = needIdentify.slice(i, i + BATCH_SIZE);
    const hashed = [];
    for (const f of chunk) {
      try {
        const buffer = await fsp.readFile(f.abs);
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const cached = cachedIdentity(sha256);
        if (cached) {
          items.push({
            file: f.filename,
            name: cached.name || prettyName(f.filename),
            platform: cached.platform,
            projectId: cached.project_id,
          });
          continue;
        }
        hashed.push({
          ...f,
          sha1: crypto.createHash('sha1').update(buffer).digest('hex'),
          sha256,
          fingerprint: curseforgeFingerprint(buffer),
          // Resolved while the bytes are still in hand: identifyJars never needs
          // the raw jar once the hashes and this metadata exist, and keeping a
          // whole up-to-25-jar batch out of memory during the registry round-trip
          // below is the whole point.
          meta: (await parseJarMeta(buffer)) || null,
        });
      } catch (err) {
        logger.debug('Reading a mod file for identification failed; treating it as unknown.', {
          serverId,
          file: f.filename,
          err: serializeError(err, { includeStack: false }),
        });
        items.push({ file: f.filename, name: prettyName(f.filename), platform: null, projectId: null });
      }
    }
    if (!hashed.length) {
      // Every jar in this batch was already known by its hash - nothing to ask.
      onProgress(Math.min(i + chunk.length, needIdentify.length), needIdentify.length);
      continue;
    }
    let identified = [];
    try {
      identified = await identifyJars(
        hashed.map((h) => ({
          name: h.filename,
          size: h.size,
          sha1: h.sha1,
          sha256: h.sha256,
          fingerprint: h.fingerprint,
          meta: h.meta,
        }))
      );
    } catch (err) {
      logger.debug('A batch of mods could not be identified; treating them as unknown.', {
        serverId,
        err: serializeError(err, { includeStack: false }),
      });
    }
    for (const h of hashed) {
      const hit = identified.find((r) => r.filename === h.filename);
      const identity = hit && hit.identity ? hit.identity : null;
      const platform = identity && identity.projectId ? identity.platform : null;
      const projectId = platform ? String(identity.projectId) : null;
      const name = (identity && identity.name) || prettyName(h.filename);
      // Only a POSITIVE identity is cached. "Nobody recognised this jar" is
      // just as often a registry having a bad minute as a genuinely private
      // build, and caching that answer would gate the server on a stale
      // failure forever - the lookup is bulk and cheap, so it is re-asked.
      if (platform && projectId) {
        rememberIdentity(h.sha256, {
          filename: h.filename,
          size: h.size,
          platform,
          projectId,
          name,
          version: identity.version,
        });
      }
      items.push({ file: h.filename, name, platform, projectId });
    }
    onProgress(Math.min(i + chunk.length, needIdentify.length), needIdentify.length);
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function prettyName(filename) {
  return String(filename).replace(/\.jar$/i, '');
}

/**
 * Whether version compatibility is a question this panel can answer for a
 * server at all. Mod loaders only: a plugin server's content comes from Hangar
 * and SpigotMC as well, which publish no per-version build list the panel can
 * query, so every plugin would land in "could not be checked" and the server
 * would be gated on an answer that never arrives. Paper plugins also declare an
 * API version rather than a per-version build, so the question is a different
 * one. Plugin servers keep the plain newest-release behaviour.
 */
function appliesTo(serverId) {
  const serversService = require('./servers');
  const modsService = require('./mods');
  const server = serversService.getServer(serverId);
  if (!server) return false;
  return modsService.contentKindOf(server) === 'mod';
}

/**
 * The server's ENABLED mod/plugin jars as [{name, size}], sorted, or [] if none.
 * Always reads the folder fresh - the signature below must stay alive to a
 * same-name jar swap (rewriting one jar's bytes does not bump the parent
 * folder's mtime), and a re-read on this hot path is the point of correctness.
 * modCount is the cheap one and IS memoized - a count depends only on the set
 * of entries, which folder mtime captures exactly.
 */
function modFiles(serverId) {
  const serversService = require('./servers');
  const modsService = require('./mods');
  const server = serversService.getServer(serverId);
  if (!server) return [];
  const kind = modsService.contentKindOf(server);
  const dirAbs = dataPath('servers', serverId, modsService.contentDir(server, kind));
  let names;
  try {
    // Enabled jars only - the same set inventory() reads, so the signature
    // changes when a mod is enabled or disabled and the report re-checks.
    names = fs.readdirSync(dirAbs).filter((f) => /\.jar$/i.test(f));
  } catch {
    return [];
  }
  return names
    .map((name) => {
      let size;
      try {
        size = fs.statSync(path.join(dirAbs, name)).size;
      } catch {
        size = 0; // vanished between the listing and the stat
      }
      return { name, size };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * How many jars the server loads, without the per-file stat modFiles pays for -
 * memoized per (server, folder) against the folder's mtime. A count can only
 * change when an entry appears or disappears, which is exactly what the folder
 * mtime records, so this is safe to cache where the file-based signature is not.
 */
const modCountMemo = new Map(); // `${serverId}:${dirAbs}` → { mtimeMs, count }
function modCount(serverId) {
  const serversService = require('./servers');
  const modsService = require('./mods');
  const server = serversService.getServer(serverId);
  if (!server) return 0;
  const kind = modsService.contentKindOf(server);
  const dirAbs = dataPath('servers', serverId, modsService.contentDir(server, kind));
  let st;
  try {
    st = fs.statSync(dirAbs);
  } catch {
    return 0;
  }
  const key = `${serverId}:${dirAbs}`;
  const hit = modCountMemo.get(key);
  if (hit && hit.mtimeMs === st.mtimeMs) return hit.count;
  let names;
  try {
    names = fs.readdirSync(dirAbs).filter((f) => /\.jar$/i.test(f));
  } catch {
    return 0;
  }
  modCountMemo.set(key, { mtimeMs: st.mtimeMs, count: names.length });
  return names.length;
}

/**
 * A fingerprint of WHICH mods are installed, stored alongside a report. A
 * report only answers for the set of mods it was built from: add one, swap a
 * build, disable one, and the answer may be different, so the report is marked
 * stale rather than quietly driving an upgrade offer it never covered.
 */
function modsSignature(serverId) {
  const files = modFiles(serverId);
  if (!files.length) return 'none';
  const h = crypto.createHash('sha1');
  for (const f of files) h.update(`${f.name}:${f.size}\n`);
  return h.digest('hex');
}

// ---- Support matrices -------------------------------------------------------

/**
 * A project's support map as stored in project_support:
 *   { versions: { "1.20.1": ["forge","fabric"], … } }
 * A null loader entry means the build claims no loader (CurseForge "Any").
 */
function cachedSupport(platform, projectId) {
  const row = db.get(
    'SELECT * FROM project_support WHERE platform = ? AND project_id = ?',
    platform,
    String(projectId)
  );
  if (!row) return null;
  const age = Date.now() - Date.parse(String(row.checked_at).replace(' ', 'T') + 'Z');
  if (!Number.isFinite(age) || age > SUPPORT_TTL_MS) return null;
  try {
    return JSON.parse(row.support_json);
  } catch {
    return null;
  }
}

function rememberSupport(platform, projectId, name, support) {
  db.run(
    `INSERT INTO project_support (platform, project_id, name, support_json, checked_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(platform, project_id) DO UPDATE SET
       name = excluded.name, support_json = excluded.support_json, checked_at = excluded.checked_at`,
    platform,
    String(projectId),
    name || null,
    JSON.stringify(support)
  );
}

/** CurseForge: one request per 200 projects, straight out of latestFilesIndexes. */
async function fetchCurseforgeSupport(projectIds) {
  const out = new Map();
  if (!projectIds.length) return out;
  const mods = await curseforge.getModsBulk(projectIds);
  for (const mod of mods) {
    const versions = {};
    for (const idx of mod.latestFilesIndexes || []) {
      if (idx.releaseType === 'alpha') continue; // alphas are not an upgrade path
      if (!isPlainVersion(idx.gameVersion)) continue;
      const loader = CF_LOADER[idx.modLoader] || null;
      const list = (versions[idx.gameVersion] ||= []);
      if (!list.includes(loader)) list.push(loader);
    }
    out.set(String(mod.modId), { name: mod.name, support: { versions } });
  }
  return out;
}

/** Modrinth: one request per project, so loader and version stay paired. */
async function fetchModrinthSupport(projectId) {
  const versions = {};
  for (const v of await modrinth.getVersions(projectId)) {
    if (v.version_type === 'alpha') continue;
    const loaders = (v.loaders || []).map((l) => String(l).toLowerCase());
    for (const gv of v.game_versions || []) {
      if (!isPlainVersion(gv)) continue;
      const list = (versions[gv] ||= []);
      for (const l of loaders) if (!list.includes(l)) list.push(l);
    }
  }
  return { versions };
}

/**
 * Support maps for every distinct project in an inventory, cached in
 * project_support. Returns Map("platform:projectId" → {versions}).
 * `onProgress(done, total)` ticks once per project, cached ones included.
 */
async function fetchSupport(items, { onProgress = () => {}, onBatch = null } = {}) {
  const projects = new Map(); // key → {platform, projectId}
  for (const item of items) {
    if (!item.platform || !item.projectId) continue;
    projects.set(`${item.platform}:${item.projectId}`, { platform: item.platform, projectId: item.projectId });
  }
  const support = new Map();
  const total = projects.size;
  let done = 0;

  const cfPending = [];
  for (const [key, p] of projects) {
    const hit = cachedSupport(p.platform, p.projectId);
    if (hit) {
      support.set(key, hit);
      done += 1;
    } else if (p.platform === 'curseforge') {
      cfPending.push(p.projectId);
    }
  }
  onProgress(done, total);

  for (let i = 0; i < cfPending.length; i += 200) {
    const chunk = cfPending.slice(i, i + 200);
    try {
      const fetched = await fetchCurseforgeSupport(chunk);
      for (const id of chunk) {
        const hit = fetched.get(String(id));
        // A project CurseForge no longer serves stays absent from `support`,
        // which reads downstream as "no build for any version" rather than as
        // a silent pass.
        if (!hit) continue;
        rememberSupport('curseforge', id, hit.name, hit.support);
        support.set(`curseforge:${id}`, hit.support);
      }
    } catch (err) {
      logger.debug('A CurseForge compatibility lookup failed; those mods stay unresolved.', {
        count: chunk.length,
        err: serializeError(err, { includeStack: false }),
      });
    }
    done += chunk.length;
    onProgress(Math.min(done, total), total);
    if (onBatch) await onBatch(support, Math.min(done, total), total);
  }

  let sinceBatch = 0;
  for (const [key, p] of projects) {
    if (support.has(key) || p.platform !== 'modrinth') continue;
    try {
      const fetched = await fetchModrinthSupport(p.projectId);
      rememberSupport('modrinth', p.projectId, null, fetched);
      support.set(key, fetched);
    } catch (err) {
      logger.debug('A Modrinth compatibility lookup failed; that mod stays unresolved.', {
        projectId: p.projectId,
        err: serializeError(err, { includeStack: false }),
      });
    }
    done += 1;
    sinceBatch += 1;
    onProgress(Math.min(done, total), total);
    if (onBatch && sinceBatch >= BATCH_SIZE) {
      sinceBatch = 0;
      await onBatch(support, Math.min(done, total), total);
    }
  }

  // Anything neither registry answers for (Hangar, Spiget, GitHub, a delisted
  // project) is deliberately left out: it has no version matrix to offer, so
  // the matrix below counts it as unknown, not as ready.
  return support;
}

// ---- The matrix -------------------------------------------------------------

/** Does this project have a build for `mcVersion` that runs on `loader`? */
function supportsVersion(support, mcVersion, loader) {
  if (!support || !support.versions) return false;
  const loaders = support.versions[mcVersion];
  if (!loaders) return false;
  if (!loader) return true; // vanilla-ish server: any build counts
  const accepted = new Set(compatibleLoaders(loader));
  // A build with no loader claim (CurseForge "Any", a datapack-style jar) is
  // accepted rather than dropped - claiming it breaks would be a false block.
  return loaders.some((l) => l == null || accepted.has(String(l).toLowerCase()));
}

/**
 * Roll an inventory + support maps up into one report.
 * @param {object[]} items inventory()
 * @param {Map} support fetchSupport()
 * @param {{loader?: string, mcVersion: string, candidates: string[], partial?: boolean}} opts
 *   `candidates` is newest-LAST (the page and the scan both walk it upward).
 */
function buildMatrix(items, support, { loader, mcVersion, candidates, partial = false }) {
  // Three buckets, and the difference between the last two matters:
  //   checked   - identified AND answered for by its registry.
  //   unchecked - identified, but nothing answered: a project on a registry
  //               this scan cannot query (GitHub, Hangar, SpigotMC), or one
  //               the registry no longer serves. Saying "no build for 1.21.1"
  //               about these would be inventing an answer nobody gave.
  //   unknown   - no identity at all (a hand-built or private jar).
  const checked = [];
  const unchecked = [];
  const unknown = [];
  for (const item of items) {
    if (!item.platform || !item.projectId) unknown.push(item);
    else if (support.has(`${item.platform}:${item.projectId}`)) checked.push(item);
    else unchecked.push(item);
  }

  const versions = candidates.map((version) => {
    const ready = [];
    const missing = [];
    for (const item of checked) {
      const map = support.get(`${item.platform}:${item.projectId}`);
      if (supportsVersion(map, version, loader)) ready.push(item);
      else missing.push(item);
    }
    return {
      version,
      readyCount: ready.length,
      missingCount: missing.length,
      unknownCount: unknown.length + unchecked.length,
      // Ready means: every mod that COULD be checked has a build, and there is
      // nothing the scan had to leave open. One jar nobody could answer for is
      // enough to make the whole answer a guess, and a guess must not drive a
      // one-click upgrade.
      status: missing.length ? 'blocked' : unknown.length + unchecked.length ? 'unknown' : 'ready',
      ready: ready.map(slim),
      missing: missing.map(slim),
    };
  });

  // Highest common denominator: the newest candidate every mod can follow.
  let highest = null;
  for (const v of versions) if (v.status === 'ready') highest = v.version;

  return {
    loader: loader || null,
    mcVersion,
    modCount: items.length,
    knownCount: checked.length,
    // One number for "the scan could not answer for this jar", because that is
    // the only distinction the gate makes; the two lists stay separate so the
    // page can explain WHY for each.
    unknownCount: unknown.length + unchecked.length,
    unknown: unknown.map(slim),
    unchecked: unchecked.map(slim),
    highestCompatible: highest,
    partial,
    versions,
  };
}

function slim(item) {
  return { file: item.file, name: item.name, platform: item.platform || null, projectId: item.projectId || null };
}

/** Mojang releases strictly newer than `mcVersion`, oldest first. */
async function candidateVersions(mcVersion) {
  const manifest = await mojang.getVersionManifest();
  const releases = manifest.versions.filter((v) => v.type === 'release' && isPlainVersion(v.id));
  const idx = releases.findIndex((v) => v.id === mcVersion);
  // The manifest is newest-first; everything BEFORE the current version in it
  // is newer than the current version. An unknown pin yields no candidates -
  // better to offer nothing than to offer a list built on a guess.
  if (idx === -1) return [];
  return releases
    .slice(0, idx)
    .map((v) => v.id)
    .reverse();
}

// ---- Scan state -------------------------------------------------------------

// Scans running in THIS process. The DB says a scan is running; this says it is
// running here. A row marked running with no entry here is one a restart cut
// off - the page offers to resume it rather than spinning forever.
const running = new Map(); // serverId -> { taskId, startedAt }

const PHASE_LABEL = {
  identifying: 'Identifying installed mods…',
  checking: 'Asking Modrinth and CurseForge…',
  building: 'Building the version report…',
};

function stateRow(serverId) {
  return db.get('SELECT * FROM version_compat WHERE server_id = ?', serverId) || null;
}

// Everything except the report itself. A scan writes progress hundreds of
// times; reading (and rewriting) a report that can be most of a megabyte on a
// large pack once per mod is pure churn, so the progress path never touches it.
const STATE_COLUMNS =
  'server_id, loader, mc_version, mods_signature, status, phase, done, total, error, started_at, updated_at, completed_at';

/**
 * Merge `fields` into the server's scan state. Omitting payload_json KEEPS the
 * stored report (that is what lets a fresh scan keep showing the previous one
 * while it runs); passing it replaces it.
 */
function writeState(serverId, fields) {
  const row = db.get(`SELECT ${STATE_COLUMNS} FROM version_compat WHERE server_id = ?`, serverId);
  const next = {
    loader: null,
    mc_version: null,
    mods_signature: null,
    status: 'idle',
    phase: null,
    done: 0,
    total: 0,
    error: null,
    payload_json: null,
    started_at: null,
    completed_at: null,
    ...(row || {}),
    ...fields,
  };
  db.run(
    `INSERT INTO version_compat
       (server_id, loader, mc_version, mods_signature, status, phase, done, total, error, payload_json, started_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
     ON CONFLICT(server_id) DO UPDATE SET
       loader = excluded.loader, mc_version = excluded.mc_version,
       mods_signature = excluded.mods_signature, status = excluded.status,
       phase = excluded.phase, done = excluded.done, total = excluded.total, error = excluded.error,
       payload_json = COALESCE(excluded.payload_json, version_compat.payload_json),
       started_at = excluded.started_at, updated_at = excluded.updated_at, completed_at = excluded.completed_at`,
    serverId,
    next.loader,
    next.mc_version,
    next.mods_signature,
    next.status,
    next.phase,
    next.done,
    next.total,
    next.error,
    next.payload_json,
    next.started_at,
    next.completed_at
  );
  return next;
}

/**
 * The stored report plus scan state, as the Updates tab renders it.
 * `stale` means the report answers for a different server than the one in
 * front of us - another Minecraft version, another loader, or another set of
 * mods. It is still shown, clearly marked, but nothing may act on it.
 */
function getReport(serverId) {
  const serversService = require('./servers');
  const modsService = require('./mods');
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const row = stateRow(serverId);
  const loader = modsService.loaderOf(server) || null;
  const liveHere = running.has(serverId);
  // A row left 'running' by a restart is reported as interrupted, not running,
  // so the page shows a Resume button instead of a spinner that never ends.
  const status = row ? (row.status === 'running' && !liveHere ? 'interrupted' : row.status) : 'idle';

  let report = null;
  if (row && row.payload_json) {
    try {
      report = JSON.parse(row.payload_json);
    } catch {
      report = null;
    }
  }
  const stale = Boolean(
    report &&
    (row.mc_version !== server.mc_version ||
      (row.loader || null) !== loader ||
      row.mods_signature !== modsSignature(serverId))
  );

  return {
    serverId,
    status,
    phase: row ? row.phase : null,
    phaseLabel: row && row.phase ? PHASE_LABEL[row.phase] || row.phase : null,
    done: row ? row.done : 0,
    total: row ? row.total : 0,
    error: row ? row.error : null,
    startedAt: row ? row.started_at : null,
    updatedAt: row ? row.updated_at : null,
    completedAt: row ? row.completed_at : null,
    taskId: liveHere ? running.get(serverId).taskId : null,
    mcVersion: server.mc_version,
    loader,
    stale,
    report,
  };
}

/**
 * The compatibility ceiling other code should trust: the newest Minecraft
 * version every installed mod has a build for, or null when that cannot be
 * answered (no scan yet, a stale scan, a jar nobody could identify, a scan
 * still running). Null always means "do not offer a version upgrade" - this
 * function never guesses.
 * @param {ReturnType<typeof getReport>} [state] the already-parsed report state,
 *   so callers that hold one (upgradeVerdict) do not re-read + re-parse the
 *   stored report just to reach the ceiling.
 * @returns {{ceiling: string|null, reason: string, unknownCount: number, scannedAt: string|null}}
 */
function compatCeiling(serverId, state = getReport(serverId)) {
  if (!state.report) return reason('no-scan', state);
  // A failed scan is no answer, but it is NOT "never been checked" - the real
  // failure reason is kept in state.error and surfaced on the Updates tab.
  if (state.status === 'failed') return reason('failed', state);
  if (state.stale) return reason('stale', state);
  if (state.report.partial || state.status === 'running' || state.status === 'interrupted')
    return reason('incomplete', state);
  if (state.report.unknownCount > 0) return reason('unknown-mods', state);
  if (state.report.modCount === 0)
    return { ceiling: null, reason: 'no-mods', unknownCount: 0, scannedAt: state.completedAt };
  return {
    ceiling: state.report.highestCompatible,
    reason: state.report.highestCompatible ? 'ok' : 'no-compatible-version',
    unknownCount: 0,
    scannedAt: state.completedAt,
  };
}

function reason(why, state) {
  return {
    ceiling: null,
    reason: why,
    unknownCount: state.report ? state.report.unknownCount : 0,
    scannedAt: state.completedAt,
  };
}

// Why a version cannot be offered, in words a player can act on.
const HOLD_REASON = {
  'no-scan': 'This server has mods, but its versions have never been checked. Run a version check first.',
  failed: 'The last version check failed. Run it again.',
  stale: 'The mods, Minecraft version or loader have changed since the last version check. Run it again.',
  incomplete: 'The last version check did not finish. Run it again.',
  'unknown-mods': 'Some mods could not be identified, so there is no way to tell what they support.',
  'no-compatible-version': 'No newer Minecraft version has a build for every mod on this server.',
  'not-scanned': 'That Minecraft version was not part of the last version check. Run the check again.',
};

/**
 * Whether a server may move to `targetVersion`, and why not when it may not.
 * A server with no mods is always allowed - there is nothing to break.
 * @returns {{allowed: boolean, reason: string, message: string|null,
 *            missing: object[], missingCount: number, unknownCount: number}}
 */
function upgradeVerdict(serverId, targetVersion) {
  const empty = { missing: [], missingCount: 0, unknownCount: 0 };
  if (!appliesTo(serverId)) return { allowed: true, reason: 'not-applicable', message: null, ...empty };
  if (modCount(serverId) === 0) return { allowed: true, reason: 'no-mods', message: null, ...empty };

  const ceiling = compatCeiling(serverId, getReport(serverId));
  if (ceiling.reason !== 'ok' && ceiling.reason !== 'no-compatible-version') {
    return {
      allowed: false,
      reason: ceiling.reason,
      message: HOLD_REASON[ceiling.reason] || HOLD_REASON['no-scan'],
      ...empty,
      unknownCount: ceiling.unknownCount,
    };
  }
  const state = getReport(serverId);
  const entry = state.report && state.report.versions.find((v) => v.version === targetVersion);
  if (!entry) {
    return { allowed: false, reason: 'not-scanned', message: HOLD_REASON['not-scanned'], ...empty };
  }
  if (entry.status === 'ready') {
    return { allowed: true, reason: 'ok', message: null, ...empty };
  }
  const missing = entry.missing.slice(0, 50);
  return {
    allowed: false,
    reason: entry.status === 'unknown' ? 'unknown-mods' : 'blocked',
    message:
      entry.status === 'unknown'
        ? HOLD_REASON['unknown-mods']
        : `${entry.missingCount} of ${state.report.knownCount} mods have no build for Minecraft ${targetVersion}.`,
    missing,
    missingCount: entry.missingCount,
    unknownCount: entry.unknownCount,
  };
}

/**
 * Run a scan. Manual only - nothing in the panel calls this on a timer.
 * Resolves as soon as the scan is registered; progress lands in the DB and in
 * the returned task.
 */
async function startScan(serverId, { actor = 'system' } = {}) {
  const serversService = require('./servers');
  const modsService = require('./mods');
  const tasks = require('./tasks');
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  if (!appliesTo(serverId)) {
    throw httpError(
      400,
      'Version checks cover mods. This server runs plugins, which publish no per-version build list to check.'
    );
  }
  if (running.has(serverId)) throw httpError(409, 'A version check is already running for this server.');
  if (!server.mc_version || ['LATEST', 'SNAPSHOT'].includes(server.mc_version)) {
    throw httpError(400, 'This server follows the newest Minecraft version, so there is nothing ahead to check.');
  }

  const loader = modsService.loaderOf(server) || null;
  const candidates = await candidateVersions(server.mc_version);
  if (!candidates.length) {
    // Nothing ahead of this pin (or Mojang has never heard of it). Record the
    // empty result rather than leaving the page on a stale one.
    writeState(serverId, {
      loader,
      mc_version: server.mc_version,
      mods_signature: modsSignature(serverId),
      status: 'done',
      phase: null,
      done: 0,
      total: 0,
      error: null,
      payload_json: JSON.stringify(
        buildMatrix([], new Map(), { loader, mcVersion: server.mc_version, candidates: [] })
      ),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
    return { ...getReport(serverId), taskId: null };
  }

  writeState(serverId, {
    loader,
    mc_version: server.mc_version,
    // Recorded at the START: the report about to be built answers for the mods
    // as they are right now, and a scan does not freeze the folder.
    mods_signature: modsSignature(serverId),
    status: 'running',
    phase: 'identifying',
    done: 0,
    total: 0,
    error: null,
    started_at: new Date().toISOString(),
    completed_at: null,
  });

  const task = tasks.createTask('Checking future Minecraft versions…', { serverId, actor });
  running.set(serverId, { taskId: task.id, startedAt: Date.now() });
  logger.info('Started a version compatibility scan.', { serverId, actor, candidates: candidates.length });

  // Deliberately not awaited: the route answers immediately and the page polls
  // the DB (which survives a restart) rather than holding a request open.
  (async () => {
    try {
      task.step(PHASE_LABEL.identifying);
      const items = await inventory(serverId, {
        onProgress: (done, total) => {
          task.progress(done, total);
          writeState(serverId, { phase: 'identifying', done, total, status: 'running' });
        },
      });

      writeState(serverId, { phase: 'checking', done: 0, total: 0, status: 'running' });
      task.step(PHASE_LABEL.checking);
      const support = await fetchSupport(items, {
        onProgress: (done, total) => {
          task.progress(done, total);
          writeState(serverId, { phase: 'checking', done, total, status: 'running' });
        },
        // Partial results after each batch: a refresh mid-scan renders the
        // versions resolved so far instead of an empty page.
        onBatch: async (partialSupport, done, total) => {
          const partial = buildMatrix(items, partialSupport, {
            loader,
            mcVersion: server.mc_version,
            candidates,
            partial: true,
          });
          writeState(serverId, {
            phase: 'checking',
            done,
            total,
            status: 'running',
            payload_json: JSON.stringify(partial),
          });
        },
      });

      task.step(PHASE_LABEL.building);
      const matrix = buildMatrix(items, support, { loader, mcVersion: server.mc_version, candidates });
      writeState(serverId, {
        status: 'done',
        phase: null,
        done: matrix.knownCount,
        total: matrix.modCount,
        error: null,
        payload_json: JSON.stringify(matrix),
        completed_at: new Date().toISOString(),
      });
      task.done({ highestCompatible: matrix.highestCompatible, modCount: matrix.modCount });
      recordScanEvent(serverId, actor, matrix);
      logger.info('Finished a version compatibility scan.', {
        serverId,
        actor,
        mods: matrix.modCount,
        unknown: matrix.unknownCount,
        highestCompatible: matrix.highestCompatible,
      });
    } catch (err) {
      logger.warn('A version compatibility scan failed.', { serverId, err: serializeError(err) });
      try {
        writeState(serverId, {
          status: 'failed',
          phase: null,
          error: String(err && err.message ? err.message : err).slice(0, 300),
          completed_at: new Date().toISOString(),
        });
      } catch (writeErr) {
        // Nothing is left to salvage the state with; the row stays 'running'
        // and the next boot marks it interrupted. What must NOT happen is an
        // unhandled rejection out of a fire-and-forget scan.
        logger.error('Recording a failed version check also failed.', { serverId, err: serializeError(writeErr) });
      }
      task.fail(err);
    } finally {
      running.delete(serverId);
    }
  })();

  return { ...getReport(serverId), taskId: task.id };
}

function recordScanEvent(serverId, actor, matrix) {
  const { recordEvent } = require('../events');
  const summary = matrix.unknownCount
    ? `Version check: ${matrix.unknownCount} of ${matrix.modCount} mods could not be identified, so compatibility is unknown.`
    : matrix.highestCompatible
      ? `Version check: every mod has a build for Minecraft ${matrix.highestCompatible}.`
      : `Version check: no Minecraft version ahead of ${matrix.mcVersion} has a build for every mod.`;
  recordEvent({ serverId, actor, type: 'version-check', summary });
}

/**
 * Boot housekeeping: a scan can only run in the process that started it, so
 * rows left 'running' by a shutdown are marked interrupted once, at boot,
 * rather than being discovered as a stuck spinner later.
 */
function reconcileScans() {
  const stuck = db.all("SELECT server_id FROM version_compat WHERE status = 'running'");
  if (!stuck.length) return 0;
  db.run("UPDATE version_compat SET status = 'interrupted', updated_at = datetime('now') WHERE status = 'running'");
  logger.info('Marked interrupted version compatibility scans.', { count: stuck.length });
  return stuck.length;
}

module.exports = {
  inventory,
  fetchSupport,
  buildMatrix,
  candidateVersions,
  supportsVersion,
  isPlainVersion,
  modCount,
  modsSignature,
  appliesTo,
  getReport,
  upgradeVerdict,
  compatCeiling,
  startScan,
  reconcileScans,
};
