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
const { makeFailureThrottle } = require('../logger');

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
 * Every host port a panel server or integration claims, including a server's
 * pending (not yet live) game + RCON pair. `exceptServerId`'s own live and
 * pending game + RCON pairs are left out (it may move between them); its
 * Bedrock, extra and BlueMap ports still count, since it keeps holding those.
 * @param {{ exceptServerId?: string }} [opts]
 */
function dbPortsInUse({ exceptServerId } = {}) {
  const rows = db.all(
    `SELECT id, port_game, port_rcon, port_game_pending, port_rcon_pending, port_bedrock, extra_ports_json
       FROM servers WHERE deleted_at IS NULL`
  );
  const used = new Set();
  for (const r of rows) {
    if (r.id !== exceptServerId) {
      for (const p of [r.port_game, r.port_rcon, r.port_game_pending, r.port_rcon_pending]) if (p) used.add(p);
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

// Docker's view is cached briefly: the wizard and the Game Port card check on
// every pause in typing, and other containers' ports rarely change within
// seconds. Panel servers' own ports always come fresh from the DB.
const DOCKER_CACHE_MS = 3000;
/** @type {Map<string, { at: number, ports: Set<number> }>} */
const dockerCache = new Map();
const dockerThrottle = makeFailureThrottle();

/** Drop the cached Docker snapshot (tests, and anything that just changed containers). */
function clearPortCache() {
  dockerCache.clear();
}

/**
 * Host ports other containers publish. Unreachable or slow Docker = empty set:
 * the DB and OS checks still apply, exactly as before this check existed.
 * @param {string} [exceptServerId]
 * @returns {Promise<Set<number>>}
 */
async function dockerPortsInUse(exceptServerId) {
  const key = exceptServerId || '';
  const hit = dockerCache.get(key);
  if (hit && Date.now() - hit.at < DOCKER_CACHE_MS) return hit.ports;
  try {
    const ports = await containers.publishedHostPorts({ exceptServerId });
    dockerThrottle.ok(logger.info, 'The Docker published-port check works again.');
    dockerCache.set(key, { at: Date.now(), ports });
    return ports;
  } catch (err) {
    dockerThrottle.fail(logger.warn, 'Skipped the Docker published-port check because Docker did not answer.', {
      err: err.message,
    });
    return new Set();
  }
}

/**
 * One snapshot of every taken port plus a check against it. A server's own live
 * and pending game + RCON ports count as free FOR IT without an OS probe: while
 * it runs, Docker holds the live pair, and moving back onto it must not read as
 * a clash.
 * @param {{ exceptServerId?: string }} [opts]
 */
async function portChecker({ exceptServerId } = {}) {
  const used = dbPortsInUse({ exceptServerId });
  for (const p of await dockerPortsInUse(exceptServerId)) used.add(p);
  const own = new Set();
  if (exceptServerId) {
    const row = db.get(
      'SELECT port_game, port_rcon, port_game_pending, port_rcon_pending FROM servers WHERE id = ?',
      exceptServerId
    );
    if (row) for (const p of Object.values(row)) if (p) own.add(p);
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
 * Throw a friendly 400 naming the first taken port in `list`. Used by create
 * for an explicitly chosen set of ports.
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
 * The game ports a user may move a server to. RCON lands at game + offset, so
 * non-admins stay inside the game runway: a game port below it could drop RCON
 * into the range an admin opened to the internet for players.
 * @param {{ isAdmin?: boolean }} [opts]
 */
function gamePortRange({ isAdmin = false } = {}) {
  return { min: isAdmin ? 1024 : config.ports.gameStart, max: 65535 - config.ports.rconOffset };
}

/**
 * Check a game port for an existing server: the range rule, then its derived
 * RCON port, then both against everything taken. `reason` says why it isn't
 * usable so the UI can say something precise.
 * @param {number} port
 * @param {{ exceptServerId?: string, isAdmin?: boolean }} [opts]
 * @returns {Promise<{ port: number, rcon: number, free: boolean, reason: null | 'range' | 'taken', min: number, max: number }>}
 */
async function checkGamePort(port, { exceptServerId, isAdmin = false } = {}) {
  const { min, max } = gamePortRange({ isAdmin });
  const rcon = port + config.ports.rconOffset;
  const base = { port, rcon, min, max };
  if (!Number.isInteger(port) || port < min || port > max) return { ...base, free: false, reason: 'range' };
  const isFree = await portChecker({ exceptServerId });
  const free = (await isFree(port)) && (await isFree(rcon));
  return { ...base, free, reason: free ? null : 'taken' };
}

/**
 * Throw the friendly 400 matching checkGamePort's verdict.
 * @param {number} port
 * @param {{ exceptServerId?: string, isAdmin?: boolean }} [opts]
 */
async function assertGamePortFree(port, opts = {}) {
  const r = await checkGamePort(port, opts);
  if (r.reason === 'range') {
    throw httpError(400, `Pick a game port from ${r.min} to ${r.max}.`);
  }
  if (r.reason === 'taken') {
    throw httpError(
      400,
      `Port ${port} or its RCON port ${r.rcon} is already in use. Pick another, or use the next free port.`
    );
  }
  return r;
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

module.exports = {
  isPortFree,
  assertPortsFree,
  checkGamePort,
  assertGamePortFree,
  gamePortRange,
  suggestPorts,
  probe,
  dbPortsInUse,
  clearPortCache,
};
