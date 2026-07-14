'use strict';

// Host-port allocation. Scheme (user-approved): game ports first-free from
// 25565, RCON = game + 1000, Bedrock UDP first-free from 19132. A port is
// "taken" if any DB server claims it OR the OS reports it in use.

const net = require('node:net');
const db = require('../db');
const config = require('../config');

function probe(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', () => resolve(false));
    srv.listen({ port, host, exclusive: true }, () => {
      srv.close(() => resolve(true));
    });
  });
}

function dbPortsInUse() {
  const rows = db.all('SELECT port_game, port_rcon, port_bedrock FROM servers WHERE deleted_at IS NULL');
  const used = new Set();
  for (const r of rows) {
    used.add(r.port_game);
    used.add(r.port_rcon);
    if (r.port_bedrock) used.add(r.port_bedrock);
  }
  used.add(config.port); // never hand out the panel's own port
  return used;
}

async function isPortFree(port) {
  // undefined/null/NaN/'25565xyz' must NOT pass as free — that silently
  // skipped RCON collision validation for explicit game ports.
  if (!Number.isInteger(port)) return false;
  if (port < 1024 || port > 65535) return false;
  if (dbPortsInUse().has(port)) return false;
  return probe(port);
}

/** Suggest a { game, rcon } pair (and bedrock when requested). */
async function suggestPorts({ withBedrock = false } = {}) {
  const used = dbPortsInUse();
  let game = config.ports.gameStart;
  for (;;) {
    const rcon = game + config.ports.rconOffset;
    if (!used.has(game) && !used.has(rcon) && (await probe(game)) && (await probe(rcon))) break;
    game += 1;
    if (game > 65000) throw new Error('No free game ports available');
  }
  const result = { game, rcon: game + config.ports.rconOffset, bedrock: null };
  if (withBedrock) {
    let b = config.ports.bedrockStart;
    while (used.has(b) || !(await probe(b))) {
      b += 1;
      if (b > 65000) throw new Error('No free Bedrock ports available');
    }
    result.bedrock = b;
  }
  return result;
}

module.exports = { isPortFree, suggestPorts };
