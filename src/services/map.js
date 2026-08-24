'use strict';

// Live world map (MP1): one-click BlueMap install via the overlay pipeline,
// with the map web server exposed on a panel-allocated host port and served
// to the browser only through the panel's authenticated proxy.

const httpError = require('../utils/httpError');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const serversService = require('./servers');
const modsService = require('./mods');
const config = require('../config');

const BLUEMAP_CONTAINER_PORT = '8100/tcp';
// One below the panel's own port, so it numbers cleanly next to it instead of
// landing on BlueMap's traditional default (8123) - which is also Home
// Assistant's default port and collides with it on a lot of home setups.
const HOST_PORT_START = Math.max(1, config.port - 1);

// Server types BlueMap ships builds for (fabric/forge/neoforge mods + paper/spigot plugins).
const SUPPORTED = new Set([
  'FABRIC',
  'QUILT',
  'FORGE',
  'NEOFORGE',
  'PAPER',
  'PURPUR',
  'PUFFERFISH',
  'LEAF',
  'FOLIA',
  'SPIGOT',
]);

function getMapConfig(serverId) {
  const row = db.get("SELECT * FROM integrations WHERE server_id = ? AND kind = 'bluemap'", serverId);
  if (!row) return { enabled: false, hostPort: null };
  const cfg = JSON.parse(row.config_json || '{}');
  return { enabled: Boolean(row.enabled), hostPort: cfg.hostPort || null };
}

function supportsMap(server) {
  return SUPPORTED.has(server.type) || (modsService.isPackServer(server) && modsService.loaderOf(server));
}

/** Plugin servers read plugins/BlueMap/, mod servers config/bluemap/. */
function mapConfDir(serverId, server) {
  const rel = ['PAPER', 'PURPUR', 'PUFFERFISH', 'LEAF', 'FOLIA', 'SPIGOT'].includes(server.type)
    ? ['plugins', 'BlueMap']
    : ['config', 'bluemap'];
  return dataPath('servers', serverId, ...rel);
}

// world/nether/end, matching BlueMap's OWN default map ids exactly - so this
// either preempts BlueMap's auto-generation (fresh install, file doesn't
// exist yet) or self-heals whatever it already auto-generated (existing file
// with a stale `world:` line), rather than creating a second, differently
// named map alongside a still-broken original.
const DIM_CONFIGS = [
  { suffix: '', file: 'world.conf', dimension: 'minecraft:overworld', name: 'Overworld' },
  { suffix: '_nether', file: 'world_nether.conf', dimension: 'minecraft:the_nether', name: 'Nether' },
  { suffix: '_the_end', file: 'world_the_end.conf', dimension: 'minecraft:the_end', name: 'End' },
];

/**
 * Point BlueMap's per-dimension map configs at the server's ACTUAL world
 * folder (server.properties level-name / LEVEL env) instead of BlueMap's own
 * "world" / "world_nether" / "world_the_end" default guess. A server whose
 * active world isn't literally named "world" otherwise makes every
 * auto-generated map invalid - BlueMap logs "problem with your BlueMap
 * setup" for each one and disables itself entirely ("no valid maps
 * configured"), even though the world exists and is fine.
 *
 * Only ever touches the `world:` line - a file BlueMap (or the admin) already
 * created keeps every other setting (name, sky-color, start-pos, …) as-is.
 */
function writeMapConfigs(serverId) {
  const server = serversService.getServer(serverId);
  if (!server) return;
  const level = require('./worlds').activeLevelName(server);
  const mapsDir = path.join(mapConfDir(serverId, server), 'maps');
  fs.mkdirSync(mapsDir, { recursive: true });

  for (const dim of DIM_CONFIGS) {
    const worldFolder = level + dim.suffix;
    // Nether/end aren't generated until first visited - skip rather than
    // point BlueMap at a dir that doesn't exist yet (same failure this fixes).
    if (dim.suffix && !fs.existsSync(dataPath('servers', serverId, worldFolder))) continue;

    const file = path.join(mapsDir, dim.file);
    const worldLine = `world: "${worldFolder}"`;
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, `${worldLine}\ndimension: "${dim.dimension}"\nname: "${dim.name}"\n`);
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const escaped = worldFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^world\\s*:\\s*"?${escaped}"?\\s*$`, 'm').test(text)) continue; // already correct
    const patched = /^world\s*:.*$/m.test(text) ? text.replace(/^world\s*:.*$/m, worldLine) : `${worldLine}\n${text}`;
    fs.writeFileSync(file, patched);
  }
}

async function enableMap(serverId, { actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  if (!supportsMap(server)) {
    throw httpError(400, `Live map needs a mod loader or plugin server - ${server.type} isn't supported by BlueMap`);
  }

  const hostPort = await freePort();
  // BlueMap from Modrinth: the mods service resolves the right build for this
  // server's loader + MC version and installs it as an overlay entry.
  await modsService.installFromUrl(serverId, 'https://modrinth.com/plugin/bluemap', { actor });

  db.run(
    `INSERT INTO integrations (server_id, kind, enabled, config_json) VALUES (?, 'bluemap', 1, ?)
     ON CONFLICT(server_id, kind) DO UPDATE SET enabled = 1, config_json = excluded.config_json, updated_at = datetime('now')`,
    serverId,
    JSON.stringify({ hostPort })
  );

  // Pre-accept BlueMap's resource download so the map works without a manual
  // config edit (BlueMap merges missing keys with its defaults).
  const confDir = mapConfDir(serverId, server);
  fs.mkdirSync(confDir, { recursive: true });
  const coreConf = path.join(confDir, 'core.conf');
  if (!fs.existsSync(coreConf)) {
    fs.writeFileSync(coreConf, 'accept-download: true\n');
  } else if (!/accept-download\s*:\s*true/.test(fs.readFileSync(coreConf, 'utf8'))) {
    fs.writeFileSync(
      coreConf,
      fs.readFileSync(coreConf, 'utf8').replace(/accept-download\s*:\s*false/, 'accept-download: true')
    );
  }
  writeMapConfigs(serverId);
  db.run('UPDATE servers SET pending_recreate = 1 WHERE id = ?', serverId);
  recordEvent({
    serverId,
    actor,
    type: 'map-enabled',
    summary: `Live map enabled (BlueMap on port ${hostPort}) - applies on next restart`,
  });
  return { hostPort };
}

async function disableMap(serverId, { actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  db.run(
    "UPDATE integrations SET enabled = 0, updated_at = datetime('now') WHERE server_id = ? AND kind = 'bluemap'",
    serverId
  );
  // Remove the BlueMap jar (overlay row) if present.
  const row = db.get(
    "SELECT filename FROM server_content WHERE server_id = ? AND managed_by = 'overlay' AND name LIKE 'BlueMap%'",
    serverId
  );
  if (row) await modsService.removeContent(serverId, row.filename, { actor }).catch(() => {});
  db.run('UPDATE servers SET pending_recreate = 1 WHERE id = ?', serverId);
  recordEvent({ serverId, actor, type: 'map-disabled', summary: 'Live map disabled - applies on next restart' });
}

/** Extra container ports for a server, consumed by the servers service. */
function extraPortsFor(serverId) {
  const cfg = getMapConfig(serverId);
  return cfg.enabled && cfg.hostPort ? [{ container: BLUEMAP_CONTAINER_PORT, host: cfg.hostPort }] : [];
}

async function freePort() {
  const used = new Set(
    db
      .all("SELECT config_json FROM integrations WHERE kind = 'bluemap'")
      .map((r) => JSON.parse(r.config_json || '{}').hostPort)
  );
  for (let port = HOST_PORT_START; port < HOST_PORT_START + 500; port += 1) {
    if (used.has(port)) continue;
    const free = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.unref();
      srv.once('error', () => resolve(false));
      srv.listen({ port, host: '0.0.0.0', exclusive: true }, () => srv.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw httpError(503, 'No free port for the map web server');
}

module.exports = {
  getMapConfig,
  supportsMap,
  enableMap,
  disableMap,
  extraPortsFor,
  writeMapConfigs,
  BLUEMAP_CONTAINER_PORT,
};
