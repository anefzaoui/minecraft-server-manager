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

const BLUEMAP_CONTAINER_PORT = '8100/tcp';
const HOST_PORT_START = 8123;

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

async function enableMap(serverId, { actor = 'system' } = {}) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  if (!supportsMap(server)) {
    throw httpError(400, `Live map needs a mod loader or plugin server — ${server.type} isn't supported by BlueMap`);
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
  // config edit (BlueMap merges missing keys with its defaults). Plugin
  // servers read plugins/BlueMap/, mod servers config/bluemap/.
  const confDirRel = ['PAPER', 'PURPUR', 'PUFFERFISH', 'LEAF', 'FOLIA', 'SPIGOT'].includes(server.type)
    ? ['plugins', 'BlueMap']
    : ['config', 'bluemap'];
  const confDir = dataPath('servers', serverId, ...confDirRel);
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
  db.run('UPDATE servers SET pending_recreate = 1 WHERE id = ?', serverId);
  recordEvent({
    serverId,
    actor,
    type: 'map-enabled',
    summary: `Live map enabled (BlueMap on port ${hostPort}) — applies on next restart`,
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
  recordEvent({ serverId, actor, type: 'map-disabled', summary: 'Live map disabled — applies on next restart' });
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

module.exports = { getMapConfig, supportsMap, enableMap, disableMap, extraPortsFor, BLUEMAP_CONTAINER_PORT };
