// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Host Docker network discovery - lets a server attach to an existing network
// (e.g. one shared with a reverse proxy like Pangolin or NGINX) instead of
// the default bridge.

const { getDocker } = require('./connect');

// Pseudo-networks that aren't valid attach targets for a container's
// NetworkingConfig the way a real bridge/overlay network is.
const HIDDEN_NETWORKS = new Set(['none', 'host']);

async function listNetworks() {
  const nets = await getDocker().listNetworks();
  return nets
    .filter((n) => !HIDDEN_NETWORKS.has(n.Name))
    .map((n) => ({ id: n.Id, name: n.Name, driver: n.Driver, scope: n.Scope }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function networkExists(name) {
  if (!name) return false;
  const nets = await listNetworks();
  return nets.some((n) => n.name === name);
}

module.exports = { listNetworks, networkExists };
