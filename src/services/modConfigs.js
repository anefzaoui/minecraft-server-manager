'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');
const yauzl = require('yauzl');
const { dataPath, safeJoin } = require('../storage/pathGuard');
const httpError = require('../utils/httpError');
const { parseJarMeta } = require('./modIdentify');
const mods = require('./mods');

const CONFIG_EXTENSIONS = new Set([
  '.cfg',
  '.conf',
  '.ini',
  '.json',
  '.json5',
  '.jsonc',
  '.properties',
  '.toml',
  '.xml',
  '.yaml',
  '.yml',
  '.snbt',
]);
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_CONFIG_FILES = 1500;
const MAX_SCAN_DEPTH = 12;
const MAX_JAR_BYTES = 64 * 1024 * 1024;
const MAX_CONCURRENT_JAR_READS = 4;
const docCache = new Map();
const modMetadataCache = new Map();
const modMetadataInFlight = new Map();
const discoveredFiles = new Map();

function cacheSet(cache, key, value, max = 2000) {
  if (cache.size >= max && !cache.has(key)) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

function readJarEntry(filePath, wanted) {
  return new Promise((resolve) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err) return resolve('');
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        zip.close();
        resolve(value);
      };
      zip.on('error', () => done(''));
      zip.on('end', () => done(''));
      zip.on('entry', (entry) => {
        if (entry.fileName !== wanted || entry.uncompressedSize > 2 * 1024 * 1024) return zip.readEntry();
        zip.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) return done('');
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('error', () => done(''));
          stream.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
        });
      });
      zip.readEntry();
    });
  });
}

function parseLithiumDescriptions(markdown) {
  const descriptions = {};
  const sections = /###\s+`([^`]+)`[^\n]*\n([\s\S]*?)(?=\n###\s+`|$)/g;
  for (const match of markdown.matchAll(sections)) {
    const text = match[2]
      .replace(/^\s*\(default:[^\n]*\)\s*/i, '')
      .split(/\n\s*(?:Requirements:|Sub-options:|Incompatibilities:)/i)[0]
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[`*_>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) descriptions[match[1]] = text.slice(0, 600);
  }
  return descriptions;
}

async function descriptionsForJar(abs, modId, stat) {
  if (modId !== 'lithium') return {};
  const cacheKey = `${abs}:${stat.size}:${stat.mtimeMs}`;
  if (docCache.has(cacheKey)) return docCache.get(cacheKey);
  const markdown = await readJarEntry(abs, 'lithium-fabric-mixin-config.md');
  const descriptions = parseLithiumDescriptions(markdown);
  cacheSet(docCache, cacheKey, descriptions, 100);
  return descriptions;
}

function configRoots(serverId) {
  const server = require('./servers').getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const level = String(server.env?.LEVEL || 'world');
  const safeLevel = /^[A-Za-z0-9 _.-]{1,64}$/.test(level) ? level : 'world';
  return ['config', 'defaultconfigs', `${safeLevel}/serverconfig`];
}

function modTokens(mod, metadata) {
  const tokens = new Set();
  for (const token of [metadata?.modId, metadata?.name, mod.name, path.basename(mod.file, path.extname(mod.file))]) {
    const normalized = String(token || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (normalized.length >= 3) tokens.add(normalized);
  }
  return [...tokens];
}

async function metadataForMods(serverId) {
  const entries = await mods.listContent(serverId);
  const modEntries = entries.filter((item) => item.kind === 'mod');
  const detected = new Array(modEntries.length);
  let nextIndex = 0;
  async function inspectNext() {
    while (nextIndex < modEntries.length) {
      const index = nextIndex++;
      detected[index] = await metadataForMod(serverId, modEntries[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_JAR_READS, modEntries.length) }, inspectNext));
  return detected;
}

async function metadataForMod(serverId, entry) {
  let metadata = null;
  let descriptions = {};
  if (entry.enabled && entry.file.toLowerCase().endsWith('.jar')) {
    for (const folder of ['mods', 'plugins']) {
      const abs = dataPath('servers', serverId, folder, entry.file);
      try {
        const stat = await fsp.stat(abs);
        if (!stat.isFile() || stat.size > MAX_JAR_BYTES) continue;
        const cacheKey = `${abs}:${stat.size}:${stat.mtimeMs}`;
        let pending = modMetadataInFlight.get(cacheKey);
        if (!pending) {
          const cached = modMetadataCache.get(abs);
          if (cached?.cacheKey === cacheKey) metadata = cached.metadata;
          else {
            pending = fsp.readFile(abs).then(parseJarMeta);
            modMetadataInFlight.set(cacheKey, pending);
            try {
              metadata = await pending;
              cacheSet(modMetadataCache, abs, { cacheKey, metadata });
            } finally {
              modMetadataInFlight.delete(cacheKey);
            }
          }
        } else metadata = await pending;
        if (metadata?.modId) descriptions = await descriptionsForJar(abs, metadata.modId, stat);
        if (metadata) break;
      } catch {
        /* another content folder may contain this jar */
      }
    }
  }
  return {
    id: metadata?.modId || entry.file,
    name: metadata?.name || entry.name,
    version: entry.version,
    tokens: modTokens(entry, metadata),
    descriptions,
  };
}

async function scanConfigs(serverId) {
  const roots = configRoots(serverId);
  const found = [];
  async function walk(rel, depth) {
    if (depth > MAX_SCAN_DEPTH || found.length >= MAX_CONFIG_FILES) return;
    const abs = dataPath('servers', serverId, rel);
    let entries;
    try {
      entries = await fsp.readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const child = `${rel}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      const childAbs = safeJoin(dataPath('servers', serverId), child);
      if (entry.isDirectory()) await walk(child, depth + 1);
      else if (entry.isFile() && CONFIG_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const stat = await fsp.stat(childAbs).catch(() => null);
        if (stat && stat.size <= MAX_CONFIG_BYTES) found.push({ path: child, size: stat.size });
        if (found.length >= MAX_CONFIG_FILES) break;
      }
    }
  }
  for (const root of roots) await walk(root, 0);
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function matchesConfig(file, mod) {
  const pathTokens = file.path.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const base = path
    .basename(file.path)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
  return mod.tokens.some((token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[^a-z0-9]+');
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`);
    return pattern.test(pathTokens) || pattern.test(base);
  });
}

async function list(serverId) {
  const [detected, files] = await Promise.all([metadataForMods(serverId), scanConfigs(serverId)]);
  const discovered = new Map();
  const groups = detected.map((mod) => ({
    id: mod.id,
    name: mod.name,
    version: mod.version,
    files: [],
    descriptions: mod.descriptions,
  }));
  const unassigned = [];
  for (const file of files) {
    discovered.set(file.path, {});
    const matches = groups
      .map((group, index) => (matchesConfig(file, detected[index]) ? index : -1))
      .filter((i) => i >= 0);
    if (matches.length === 1) {
      groups[matches[0]].files.push(file);
      discovered.set(file.path, groups[matches[0]].descriptions);
    } else unassigned.push(file);
  }
  discoveredFiles.set(serverId, discovered);
  return { groups, unassigned };
}

function configFilePath(serverId, relPath) {
  const normalized = String(relPath || '').replace(/\\/g, '/');
  if (!CONFIG_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase())) return null;
  if (!configRoots(serverId).some((root) => normalized.startsWith(`${root}/`))) return null;
  const serverRoot = dataPath('servers', serverId);
  return safeJoin(serverRoot, normalized);
}

async function existingConfig(serverId, relPath) {
  const normalized = String(relPath || '').replace(/\\/g, '/');
  if (!discoveredFiles.get(serverId)?.has(normalized)) throw httpError(404, 'Config file not found.');
  const abs = configFilePath(serverId, normalized);
  if (!abs) throw httpError(404, 'Config file not found.');
  const stat = await fsp.lstat(abs).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > MAX_CONFIG_BYTES) {
    throw httpError(404, 'Config file not found.');
  }
  return abs;
}

async function read(serverId, relPath) {
  const abs = await existingConfig(serverId, relPath);
  const content = await fsp.readFile(abs);
  if (content.includes(0)) throw httpError(415, 'This config is not a text file.');
  const normalized = String(relPath).replace(/\\/g, '/');
  return {
    path: normalized,
    content: content.toString('utf8'),
    descriptions: discoveredFiles.get(serverId)?.get(normalized) || {},
  };
}

/** @param {string} serverId @param {string} relPath @param {string} content @param {{actor?: string}} [options] */
async function write(serverId, relPath, content, { actor } = {}) {
  await existingConfig(serverId, relPath);
  const files = require('./files');
  return files.writeText(serverId, String(relPath).replace(/\\/g, '/'), content, { actor });
}

module.exports = { list, read, write, CONFIG_EXTENSIONS };
