// @ts-nocheck — dynamic zip/JSON interop across mod metadata formats.
'use strict';

// Identify mod/plugin jars and judge whether they fit a server.
// Three identification layers, best first:
//   1. Modrinth reverse lookup by sha1   (exact project + version, free API)
//   2. CurseForge fingerprint lookup     (exact match, needs the stored key)
//   3. The jar's own metadata            (fabric.mod.json / mods.toml /
//      neoforge.mods.toml / quilt.mod.json / plugin.yml) — still yields name,
//      version and loader for jars neither registry knows.

const crypto = require('node:crypto');
const yauzl = require('yauzl');
const yaml = require('js-yaml');
const modrinth = require('./modrinthApi');
const curseforge = require('./curseforgeApi');
const apiKeys = require('./apiKeys');
const { curseforgeFingerprint } = require('../utils/murmur2');

const PLUGIN_LOADERS = new Set(['paper', 'spigot', 'bukkit', 'purpur', 'folia']);
const MOD_LOADERS = new Set(['fabric', 'forge', 'neoforge', 'quilt']);

// ---- Jar metadata (layer 3) -------------------------------------------------

const META_ENTRIES = new Set([
  'fabric.mod.json',
  'quilt.mod.json',
  'META-INF/mods.toml',
  'META-INF/neoforge.mods.toml',
  'plugin.yml',
  'paper-plugin.yml',
  'META-INF/MANIFEST.MF',
]);

/** Read the known metadata entries out of a jar buffer. */
function readJarMetaEntries(buffer) {
  return new Promise((resolve) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err) return resolve(new Map()); // not a readable zip — metadata layer just yields nothing
      const texts = new Map();
      zip.on('error', () => resolve(texts));
      zip.on('end', () => resolve(texts));
      zip.on('entry', (entry) => {
        if (!META_ENTRIES.has(entry.fileName) || entry.uncompressedSize > 1024 * 1024) return zip.readEntry();
        zip.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr) return zip.readEntry();
          const chunks = [];
          readStream.on('data', (c) => chunks.push(c));
          readStream.on('error', () => zip.readEntry());
          readStream.on('end', () => {
            texts.set(entry.fileName, Buffer.concat(chunks).toString('utf8'));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

/** Minimal mods.toml field extraction — full TOML parsing is overkill for 3 fields. */
function tomlField(text, field) {
  const m = new RegExp(`^\\s*${field}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'm').exec(text);
  return m ? (m[1] ?? m[2]) : null;
}

function manifestVersion(manifestText) {
  const m = /^Implementation-Version:\s*(.+)$/m.exec(manifestText || '');
  return m ? m[1].trim() : null;
}

/**
 * Parse a jar's own metadata. Returns null when nothing recognizable exists,
 * else { loader, kind, modId, name, version, mcConstraint }.
 * mcConstraint is the raw dependency string (often a range) — informative,
 * not a verdict-grade version list.
 */
async function parseJarMeta(buffer) {
  const texts = await readJarMetaEntries(buffer);
  if (!texts.size) return null;

  const fabric = texts.get('fabric.mod.json');
  if (fabric) {
    try {
      const j = JSON.parse(fabric);
      const dep = j.depends && j.depends.minecraft;
      return {
        loader: 'fabric',
        kind: 'mod',
        modId: j.id || null,
        name: j.name || j.id || null,
        version: j.version || null,
        mcConstraint: Array.isArray(dep) ? dep.join(' || ') : dep || null,
      };
    } catch {
      /* fall through to other formats */
    }
  }

  const quilt = texts.get('quilt.mod.json');
  if (quilt) {
    try {
      const j = JSON.parse(quilt);
      const ql = j.quilt_loader || {};
      return {
        loader: 'quilt',
        kind: 'mod',
        modId: ql.id || null,
        name: (ql.metadata && ql.metadata.name) || ql.id || null,
        version: ql.version || null,
        mcConstraint: null,
      };
    } catch {
      /* fall through */
    }
  }

  for (const [entry, loader] of [
    ['META-INF/neoforge.mods.toml', 'neoforge'],
    ['META-INF/mods.toml', 'forge'],
  ]) {
    const toml = texts.get(entry);
    if (!toml) continue;
    let version = tomlField(toml, 'version');
    if (!version || version.includes('${')) version = manifestVersion(texts.get('META-INF/MANIFEST.MF')) || null;
    return {
      loader,
      kind: 'mod',
      modId: tomlField(toml, 'modId'),
      name: tomlField(toml, 'displayName') || tomlField(toml, 'modId'),
      version,
      mcConstraint: null,
    };
  }

  const plugin = texts.get('paper-plugin.yml') || texts.get('plugin.yml');
  if (plugin) {
    try {
      // FAILSAFE keeps scalars as strings — YAML would read api-version: 1.20
      // as the float 1.2 and corrupt the constraint.
      const y = yaml.load(plugin, { schema: yaml.FAILSAFE_SCHEMA }) || {};
      return {
        loader: 'paper',
        kind: 'plugin',
        modId: y.name || null,
        name: y.name || null,
        version: y.version != null ? String(y.version) : null,
        mcConstraint: y['api-version'] != null ? String(y['api-version']) : null,
      };
    } catch {
      /* unparseable yaml */
    }
  }
  return null;
}

// ---- Platform data normalization -------------------------------------------

/** CF gameVersions mixes MC versions and loader names — split them. */
function splitCfGameVersions(gameVersions) {
  const mcVersions = [];
  const loaders = [];
  for (const v of gameVersions || []) {
    const s = String(v);
    if (/^\d+\.\d+(\.\d+)?$/.test(s)) mcVersions.push(s);
    else if (MOD_LOADERS.has(s.toLowerCase()) || PLUGIN_LOADERS.has(s.toLowerCase())) loaders.push(s.toLowerCase());
  }
  return { mcVersions, loaders };
}

// ---- Identification (layers 1+2+3, batched) --------------------------------

/**
 * Identify a batch of jar files.
 * @param {{name: string, buffer: Buffer}[]} files
 * @returns per input file:
 *   {filename, size, sha1, sha256, fingerprint,
 *    identity: null | {source: 'modrinth'|'curseforge'|'metadata', platform?,
 *      projectId?, versionId?, slug?, name, version, iconUrl?, loaders: [],
 *      mcVersions: [], mcConstraint?, kind}}
 */
async function identifyJars(files) {
  const items = files.map((f) => ({
    filename: f.name,
    size: f.buffer.length,
    sha1: crypto.createHash('sha1').update(f.buffer).digest('hex'),
    sha256: crypto.createHash('sha256').update(f.buffer).digest('hex'),
    fingerprint: curseforgeFingerprint(f.buffer),
    buffer: f.buffer,
    identity: null,
  }));

  // Layer 1: Modrinth by sha1 (no key needed).
  try {
    const byHash = await modrinth.getVersionsByHashes(items.map((i) => i.sha1));
    const projectIds = Object.values(byHash).map((v) => v.project_id);
    const projects = projectIds.length ? await modrinth.getProjectsBulk(projectIds) : {};
    for (const item of items) {
      const v = byHash[item.sha1];
      if (!v) continue;
      const p = projects[v.project_id] || {};
      item.identity = {
        source: 'modrinth',
        platform: 'modrinth',
        projectId: v.project_id,
        versionId: v.id,
        slug: p.slug || v.project_id,
        name: p.title || v.name || item.filename,
        version: v.version_number || null,
        iconUrl: p.icon_url || null,
        loaders: v.loaders || [],
        mcVersions: v.game_versions || [],
        kind: p.project_type === 'plugin' || (v.loaders || []).some((l) => PLUGIN_LOADERS.has(l)) ? 'plugin' : 'mod',
      };
    }
  } catch {
    /* Modrinth unreachable — the other layers still run */
  }

  // Layer 2: CurseForge fingerprints (only with a stored key).
  const unresolved = items.filter((i) => !i.identity);
  if (unresolved.length && apiKeys.getKey('curseforge')) {
    try {
      const { matches } = await curseforge.getFingerprintMatches(unresolved.map((i) => i.fingerprint));
      const byPrint = new Map(matches.map((m) => [Number(m.file.fingerprint), m]));
      const mods = matches.length ? await curseforge.getModsBulk(matches.map((m) => m.modId)) : [];
      const modById = new Map(mods.map((m) => [m.modId, m]));
      for (const item of unresolved) {
        const match = byPrint.get(item.fingerprint);
        if (!match) continue;
        const mod = modById.get(match.modId);
        const { mcVersions, loaders } = splitCfGameVersions(match.file.gameVersions);
        item.identity = {
          source: 'curseforge',
          platform: 'curseforge',
          projectId: String(match.modId),
          versionId: String(match.file.fileId),
          slug: (mod && mod.slug) || String(match.modId),
          name: (mod && mod.name) || match.file.name || item.filename,
          version: match.file.name || null,
          iconUrl: (mod && mod.iconUrl) || null,
          loaders,
          mcVersions,
          kind: mod && mod.classId === 5 ? 'plugin' : 'mod',
        };
      }
    } catch {
      /* CF unreachable / key invalid — metadata layer still runs */
    }
  }

  // Layer 3: the jar's own metadata.
  for (const item of items) {
    if (!item.identity) {
      const meta = await parseJarMeta(item.buffer);
      if (meta) {
        item.identity = {
          source: 'metadata',
          name: meta.name || item.filename,
          version: meta.version,
          loaders: meta.loader ? [meta.loader] : [],
          mcVersions: [],
          mcConstraint: meta.mcConstraint || null,
          kind: meta.kind,
        };
      }
    }
    delete item.buffer; // results are JSON-serialized — never carry megabytes along
  }
  return items;
}

// ---- Compatibility verdict --------------------------------------------------

/**
 * Judge one identified jar against a server.
 * @param {object|null} identity from identifyJars
 * @param {{kind: 'mod'|'plugin', loader?: string, mc?: string}} server
 * @returns {{status: 'ok'|'wrong-loader'|'wrong-mc'|'wrong-kind'|'unknown', loaderOk, mcOk}}
 *   loaderOk/mcOk are true/false/null (null = not enough data to judge).
 */
function verdictFor(identity, { kind, loader, mc }) {
  if (!identity) return { status: 'unknown', loaderOk: null, mcOk: null };

  if (identity.kind && identity.kind !== kind) {
    return { status: 'wrong-kind', loaderOk: false, mcOk: null };
  }

  let loaderOk = null;
  const loaders = (identity.loaders || []).map((l) => String(l).toLowerCase());
  if (loaders.length) {
    if (kind === 'plugin') loaderOk = loaders.some((l) => PLUGIN_LOADERS.has(l));
    else if (loader) loaderOk = loaders.includes(String(loader).toLowerCase());
  }

  let mcOk = null;
  const mcList = identity.mcVersions || [];
  if (mcList.length && mc && !/^(LATEST|SNAPSHOT)/.test(mc)) mcOk = mcList.includes(mc);

  if (loaderOk === false) return { status: 'wrong-loader', loaderOk, mcOk };
  if (mcOk === false) return { status: 'wrong-mc', loaderOk, mcOk };
  if (loaderOk === null && mcOk === null) return { status: 'unknown', loaderOk, mcOk };
  return { status: 'ok', loaderOk, mcOk };
}

module.exports = { identifyJars, verdictFor, parseJarMeta, splitCfGameVersions, PLUGIN_LOADERS };
