'use strict';

// Bedrock packs are unpacked into the directories that the Bedrock Dedicated
// Server image reads at boot. They intentionally do not use the Java content
// library: a Bedrock pack has its own manifest and is enabled by the world.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { nanoid } = require('nanoid');
const { dataPath } = require('../storage/pathGuard');
const httpError = require('../utils/httpError');
const { readZipIndex, extractZipSafe } = require('../utils/zip');
const servers = require('./servers');
const runtime = require('./serverRuntime');

const PACK_TYPES = new Map([
  ['behavior', { directory: 'behavior_packs', moduleType: 'data' }],
  ['resource', { directory: 'resource_packs', moduleType: 'resources' }],
]);

function requireBedrockServer(serverId) {
  const server = servers.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  if (!runtime.supports(server, 'bedrockPacks'))
    throw httpError(400, 'Bedrock packs are only available for Native Bedrock servers.');
  return server;
}

function packConfig(kind) {
  const config = PACK_TYPES.get(kind);
  if (!config) throw httpError(400, 'Pack type must be behavior or resource.');
  return config;
}

function parseManifest(text, kind) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw httpError(400, 'Pack manifest.json is not valid JSON.');
  }
  const config = packConfig(kind);
  const name = typeof manifest?.header?.name === 'string' ? manifest.header.name.trim() : '';
  const uuid = typeof manifest?.header?.uuid === 'string' ? manifest.header.uuid.trim() : '';
  if (
    !name ||
    !uuid ||
    !Array.isArray(manifest.modules) ||
    !manifest.modules.some((m) => m && m.type === config.moduleType)
  ) {
    throw httpError(400, `This is not a valid Bedrock ${kind} pack.`);
  }
  return { name: name.slice(0, 120), uuid };
}

function packId(name, uuid) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `${slug || 'bedrock-pack'}-${uuid.replace(/[^a-z0-9]/gi, '').slice(0, 12) || nanoid(8)}`;
}

async function list(serverId) {
  requireBedrockServer(serverId);
  const packs = [];
  for (const [kind, config] of PACK_TYPES) {
    const root = dataPath('servers', serverId, config.directory);
    let entries = [];
    try {
      entries = await fsp.readdir(root, { withFileTypes: true });
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]{0,90}$/i.test(entry.name)) continue;
      try {
        const manifest = parseManifest(await fsp.readFile(path.join(root, entry.name, 'manifest.json'), 'utf8'), kind);
        packs.push({ id: entry.name, kind, ...manifest });
      } catch {
        // A manually-created non-pack directory must not break this page.
      }
    }
  }
  return packs.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

async function installUpload(serverId, kind, uploadPath) {
  requireBedrockServer(serverId);
  const config = packConfig(kind);
  const { texts } = await readZipIndex(uploadPath, {
    textEntry: (name) => /^(?:[^/]+\/)?manifest\.json$/i.test(name),
    maxTextBytes: 1024 * 1024,
  });
  const manifests = [...texts.entries()].filter(([name]) => /^(?:[^/]+\/)?manifest\.json$/i.test(name));
  if (manifests.length !== 1)
    throw httpError(400, 'A Bedrock pack archive must contain exactly one manifest.json at its root.');
  const [manifestPath, manifestText] = manifests[0];
  const manifest = parseManifest(manifestText, kind);
  const prefix = manifestPath === 'manifest.json' ? '' : manifestPath.slice(0, -'manifest.json'.length);
  const id = packId(manifest.name, manifest.uuid);
  const root = dataPath('servers', serverId, config.directory);
  const destination = dataPath('servers', serverId, config.directory, id);
  if (fs.existsSync(destination)) throw httpError(409, 'This Bedrock pack is already installed.');
  const staging = dataPath('tmp', `bedrock-pack-${nanoid(10)}`);
  await fsp.mkdir(staging, { recursive: true });
  try {
    await extractZipSafe(uploadPath, staging, {
      maxBytes: 2 * 1024 ** 3,
      maxEntries: 50_000,
      map: (entry) => {
        if (prefix && !entry.startsWith(prefix)) return null;
        return prefix ? entry.slice(prefix.length) : entry;
      },
    });
    await fsp.mkdir(root, { recursive: true });
    await fsp.rename(staging, destination);
  } catch (err) {
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
  return { id, kind, ...manifest };
}

async function remove(serverId, kind, id) {
  requireBedrockServer(serverId);
  const config = packConfig(kind);
  if (!/^[a-z0-9][a-z0-9-]{0,90}$/i.test(id)) throw httpError(400, 'Invalid Bedrock pack ID.');
  const destination = dataPath('servers', serverId, config.directory, id);
  try {
    await fsp.access(destination);
  } catch {
    throw httpError(404, 'Bedrock pack not found.');
  }
  await fsp.rm(destination, { recursive: true, force: true });
}

module.exports = { list, installUpload, remove };
