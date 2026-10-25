'use strict';

const httpError = require('../utils/httpError');

// Host-port allocation. Scheme (user-approved): game ports first-free from
// 25565, RCON = game + 1000, Bedrock UDP first-free from 19132. A port is
// "taken" if any DB server claims it, any Docker container publishes it, OR
// the OS reports it in use.

const net = require('node:net');
const path = require('node:path');
const db = require('../db');
const config = require('../config');
const containers = require('../docker/containers');
const logger = require('../logger')(path.basename(__filename));

/** OS availability probe. Bounded by a timeout so a wedged bind/close can't
 *  leave the caller (and a server create) hanging forever. */
function probe(port, host = '0.0.0.0', timeoutMs = 2000) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        srv.close();
      } catch {
        /* not listening */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    timer.unref();
    srv.once('error', () => finish(false)); // EADDRINUSE or any bind failure = not free
    srv.listen({ port, host, exclusive: true }, () => {
      // If the timeout already answered "not free", finish() is a no-op and
      // would leave this late-but-successful listener holding the port.
      if (settled) {
        try {
          srv.close();
        } catch {
          /* ignore */
        }
        return;
      }
      finish(true);
    });
  });
}

/**
 * Every host port a panel server or integration claims. `exceptServerId`'s own
 * game + RCON ports are left out (they are the ones it is moving off); its
 * Bedrock, extra and BlueMap ports still count, since it keeps holding those.
 * @param {{ exceptServerId?: string }} [opts]
 */
function dbPortsInUse({ exceptServerId } = {}) {
  const rows = db.all(
    'SELECT id, port_game, port_rcon, port_bedrock, extra_ports_json FROM servers WHERE deleted_at IS NULL'
  );
  const used = new Set();
  for (const r of rows) {
    if (r.id !== exceptServerId) {
      used.add(r.port_game);
      used.add(r.port_rcon);
    }
    if (r.port_bedrock) used.add(r.port_bedrock);
    for (const p of JSON.parse(r.extra_ports_json || '[]')) {
      if (p && p.hostPort) used.add(p.hostPort);
    }
  }
  // BlueMap's web-server port lives in `integrations`, not on the server row -
  // it must be unioned in too, or a fresh port allocation could collide with it.
  for (const row of db.all("SELECT config_json FROM integrations WHERE kind = 'bluemap' AND enabled = 1")) {
    const hostPort = JSON.parse(row.config_json || '{}').hostPort;
    if (hostPort) used.add(hostPort);
  }
  used.add(config.port); // never hand out the panel's own port
  return used;
}

/** Bounded so a wedged daemon degrades to "no extra ports known", never a hang. */
const DOCKER_LIST_TIMEOUT_MS = 3000;

/**
 * Host ports other containers publish. Unreachable Docker = empty set: the DB
 * and OS checks still apply, exactly as before this check existed.
 * @param {string} [exceptServerId]
 * @returns {Promise<Set<number>>}
 */
async function dockerPortsInUse(exceptServerId) {
  let timer;
  try {
    return await Promise.race([
      containers.publishedHostPorts({ exceptServerId }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Docker container list timed out')), DOCKER_LIST_TIMEOUT_MS);
        timer.unref();
      }),
    ]);
  } catch (err) {
    logger.debug('Skipped the Docker published-port check.', { err: err.message });
    return new Set();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One snapshot of every taken port plus a check against it. A server's own
 * current game + RCON ports count as free FOR IT without an OS probe: while it
 * runs, Docker holds them, and moving back onto them must not read as a clash.
 * @param {{ exceptServerId?: string }} [opts]
 */
async function portChecker({ exceptServerId } = {}) {
  const used = dbPortsInUse({ exceptServerId });
  for (const p of await dockerPortsInUse(exceptServerId)) used.add(p);
  const own = new Set();
  if (exceptServerId) {
    const row = db.get('SELECT port_game, port_rcon FROM servers WHERE id = ?', exceptServerId);
    if (row) own.add(row.port_game).add(row.port_rcon);
  }
  /** @param {number} port */
  return async (port) => {
    // undefined/null/NaN/'25565xyz' must NOT pass as free - that silently
    // skipped RCON collision validation for explicit game ports.
    if (!Number.isInteger(port)) return false;
    if (port < 1024 || port > 65535) return false;
    if (used.has(port)) return false;
    if (own.has(port)) return true;
    return probe(port);
  };
}

/**
 * @param {number} port
 * @param {{ exceptServerId?: string }} [opts]
 */
async function isPortFree(port, opts = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return false; // no DB/Docker work for junk
  return (await portChecker(opts))(port);
}

/**
 * Throw a friendly 400 naming the first taken port in `list`. Shared by create
 * and the port change so both enforce the same rules.
 * @param {number[]} list
 * @param {{ exceptServerId?: string }} [opts]
 */
async function assertPortsFree(list, opts = {}) {
  if (new Set(list).size !== list.length) {
    throw httpError(400, 'The game and RCON ports must be different. Pick another game port.');
  }
  const isFree = await portChecker(opts);
  for (const p of list) {
    if (!(await isFree(p))) {
      throw httpError(400, `Port ${p} is already in use or not allowed. Pick another, or use the next free port.`);
    }
  }
}

/**
 * Suggest a { game, rcon } pair (and bedrock when requested). With
 * `exceptServerId`, the answer may be that server's current pair.
 * @param {{ withBedrock?: boolean, exceptServerId?: string }} [opts]
 */
async function suggestPorts({ withBedrock = false, exceptServerId } = {}) {
  const isFree = await portChecker({ exceptServerId });
  // RCON = game + offset, so the largest LEGAL game port is 65535 - offset.
  // Probing an rcon > 65535 would fail every candidate and misreport "no free
  // game ports" for a perfectly good range.
  const maxGame = 65535 - config.ports.rconOffset;
  let game = config.ports.gameStart;
  for (;;) {
    const rcon = game + config.ports.rconOffset;
    if ((await isFree(game)) && (await isFree(rcon))) break;
    game += 1;
    if (game > maxGame)
      throw httpError(409, 'No free game ports are available. Delete a server or widen the port range in your .env.');
  }
  const result = { game, rcon: game + config.ports.rconOffset, bedrock: null };
  if (withBedrock) {
    let b = config.ports.bedrockStart;
    while (!(await isFree(b))) {
      b += 1;
      if (b > 65000)
        throw httpError(
          409,
          'No free Bedrock ports are available. Delete a server or widen the port range in your .env.'
        );
    }
    result.bedrock = b;
  }
  return result;
}

module.exports = { isPortFree, assertPortsFree, suggestPorts, probe, dbPortsInUse };
