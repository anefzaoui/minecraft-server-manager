'use strict';

const httpError = require('../utils/httpError');

// Host-port allocation. Scheme (user-approved): game ports first-free from
// 25565, RCON = game + 1000, Bedrock UDP first-free from 19132. A port is
// "taken" if any DB server claims it OR the OS reports it in use.

const net = require('node:net');
const db = require('../db');
const config = require('../config');

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

function dbPortsInUse() {
  const rows = db.all(
    `SELECT port_game, port_rcon, port_bedrock, nethernet_udp_start, nethernet_udp_end, extra_ports_json
       FROM servers WHERE deleted_at IS NULL`
  );
  const used = new Set();
  for (const r of rows) {
    used.add(r.port_game);
    used.add(r.port_rcon);
    if (r.port_bedrock) used.add(r.port_bedrock);
    if (Number.isInteger(r.nethernet_udp_start) && Number.isInteger(r.nethernet_udp_end)) {
      for (let port = r.nethernet_udp_start; port <= r.nethernet_udp_end; port += 1) used.add(port);
    }
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

async function isPortFree(port) {
  // undefined/null/NaN/'25565xyz' must NOT pass as free - that silently
  // skipped RCON collision validation for explicit game ports.
  if (!Number.isInteger(port)) return false;
  if (port < 1024 || port > 65535) return false;
  if (dbPortsInUse().has(port)) return false;
  return probe(port);
}

/** Suggest a { game, rcon } pair (and bedrock when requested). */
async function suggestPorts({ withBedrock = false } = {}) {
  const used = dbPortsInUse();
  // RCON = game + offset, so the largest LEGAL game port is 65535 - offset.
  // Probing an rcon > 65535 would fail every candidate and misreport "no free
  // game ports" for a perfectly good range.
  const maxGame = 65535 - config.ports.rconOffset;
  let game = config.ports.gameStart;
  for (;;) {
    const rcon = game + config.ports.rconOffset;
    if (!used.has(game) && !used.has(rcon) && (await probe(game)) && (await probe(rcon))) break;
    game += 1;
    if (game > maxGame)
      throw httpError(409, 'No free game ports are available. Delete a server or widen the port range in your .env.');
  }
  const result = { game, rcon: game + config.ports.rconOffset, bedrock: null };
  if (withBedrock) {
    let b = config.ports.bedrockStart;
    while (used.has(b) || !(await probe(b))) {
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

/** Allocate NetherNet's TCP signaling endpoint plus a contiguous UDP range. */
async function suggestNetherNetPorts({ capacity = 16, signalingPort } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
    throw httpError(400, 'NetherNet player capacity must be between 1 and 1000.');
  }
  const signal = signalingPort ? { game: signalingPort, rcon: 0 } : await suggestPorts();
  if (signalingPort && !(await isPortFree(signalingPort))) {
    throw httpError(400, `Port ${signalingPort} is already in use or invalid`);
  }
  const used = dbPortsInUse();
  used.add(signal.game);
  let start = config.ports.nethernetUdpStart;
  const maxStart = 65535 - capacity + 1;
  while (start <= maxStart) {
    const range = Array.from({ length: capacity }, (_, i) => start + i);
    if (range.every((port) => !used.has(port) && port !== signal.rcon && port !== signal.game)) {
      const free = await Promise.all(range.map((port) => probe(port)));
      if (free.every(Boolean)) {
        return { game: signal.game, rcon: 0, bedrock: null, nethernetUdpStart: start, nethernetUdpEnd: start + capacity - 1 };
      }
    }
    start += 1;
  }
  throw httpError(409, 'No free contiguous NetherNet UDP range is available.');
}

/** Allocate RakNet's fixed IPv4 and IPv6 UDP host-port pair. */
async function suggestRakNetPorts({ ipv4Port, ipv6Port } = {}) {
  if ((ipv4Port == null) !== (ipv6Port == null)) {
    throw httpError(400, 'Set both RakNet IPv4 and IPv6 UDP ports, or leave both automatic.');
  }
  if (ipv4Port != null) {
    if (ipv4Port === ipv6Port || !(await isPortFree(ipv4Port)) || !(await isPortFree(ipv6Port))) {
      throw httpError(400, 'RakNet IPv4 and IPv6 UDP ports must be distinct free valid ports.');
    }
    return { game: ipv4Port, rcon: 0, bedrock: ipv6Port, nethernetUdpStart: null, nethernetUdpEnd: null };
  }

  let ipv4 = config.ports.bedrockStart;
  while (ipv4 < 65535) {
    const ipv6 = ipv4 + 1;
    if ((await isPortFree(ipv4)) && (await isPortFree(ipv6))) {
      return { game: ipv4, rcon: 0, bedrock: ipv6, nethernetUdpStart: null, nethernetUdpEnd: null };
    }
    ipv4 += 1;
  }
  throw httpError(409, 'No free RakNet IPv4 and IPv6 UDP port pair is available.');
}

module.exports = { isPortFree, suggestPorts, suggestNetherNetPorts, suggestRakNetPorts, probe, dbPortsInUse };
