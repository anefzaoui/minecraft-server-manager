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

/**
 * Create a Docker bridge network if it does not already exist. Resolves true
 * when this call created it, false when it already existed (or another create
 * won a concurrent race, Docker's 409). Any other error propagates - a
 * declared network that cannot be created must abort the create/recreate
 * rather than silently dropping the container onto the default bridge.
 */
async function ensureNetwork(name) {
  if (!name) return false;
  if (await networkExists(name)) return false;
  try {
    await getDocker().createNetwork({ Name: name, Driver: 'bridge', CheckDuplicate: true });
    return true;
  } catch (err) {
    if (err.statusCode === 409) return false; // concurrent create won the race
    throw err;
  }
}

module.exports = { listNetworks, networkExists, ensureNetwork, HIDDEN_NETWORKS };
