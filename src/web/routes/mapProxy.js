'use strict';

// Authenticated reverse proxy for BlueMap's web UI: the map port is never
// exposed to the browser directly - everything flows through the panel's
// session-gated /map/<serverId>/… path. Plain stdlib http, GET/HEAD only.
//
// BlueMap's HOST-published port (127.0.0.1 bare metal, host.docker.internal
// when the panel is containerized - see config.mapProxyHost) is only ONE of
// several ways this proxy might actually reach it. A server whose Docker
// network was set (Advanced Docker Settings - e.g. a network shared with a
// reverse proxy like Pangolin) is reachable directly on its CONTAINER port
// over that network, with no host-port-publish involved at all - and if the
// panel container is ALSO joined to that network, that direct path is both
// more robust and required (the host-port path may not reach it at all in
// that topology). So on each server we try candidate targets in order -
// every network IP the sibling container has, THEN the host-published-port
// fallback - cache whichever one actually answers, and only re-probe when
// the cached one stops working (a fresh probe on every tile/asset request
// would be far too slow).

const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const express = require('express');
const config = require('../../config');
const logger = require('../../logger')(path.basename(__filename));
const { getDocker } = require('../../docker/connect');
const containers = require('../../docker/containers');
const { getMapConfig, BLUEMAP_CONTAINER_PORT } = require('../../services/map');
const { getServer } = require('../../services/servers');

const router = express.Router();

const CONTAINER_PORT = parseInt(BLUEMAP_CONTAINER_PORT, 10); // '8100/tcp' -> 8100
const CACHE_TTL_MS = 5 * 60 * 1000;
const PROBE_TIMEOUT_MS = 1500;

// serverId -> { target: {host, port}, expiresAt }
const targetCache = new Map();

/** Every network IP the sibling container has, on its own CONTAINER port - no
 *  host-port-publish or host-gateway routing needed if the panel can reach it. */
async function containerNetworkTargets(server) {
  const ref = containers.containerRef(server.id);
  try {
    const info = await getDocker().getContainer(ref).inspect();
    const nets = (info.NetworkSettings && info.NetworkSettings.Networks) || {};
    return Object.values(nets)
      .map((n) => n.IPAddress)
      .filter(Boolean)
      .map((ip) => ({ host: ip, port: CONTAINER_PORT }));
  } catch {
    // container gone/uninspectable - fall through to the host-port candidate
    logger.debug('Could not inspect a container while resolving map proxy targets.', { serverId: server.id });
    return [];
  }
}

/** Raw TCP connect probe - cheap, and sidesteps whether BlueMap's bundled
 *  webserver implements any particular HTTP method correctly. */
function probeConnect(target, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: target.host, port: target.port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function resolveTarget(server, cfg) {
  const cached = targetCache.get(server.id);
  if (cached && cached.expiresAt > Date.now()) return cached.target;

  const candidates = [...(await containerNetworkTargets(server)), { host: config.mapProxyHost, port: cfg.hostPort }];
  for (const target of candidates) {
    if (await probeConnect(target)) {
      targetCache.set(server.id, { target, expiresAt: Date.now() + CACHE_TTL_MS });
      return target;
    }
  }
  // Nothing answered - return the last (host-port) candidate so the error
  // message below at least reflects the "final" attempt, uncached (so the
  // very next request re-probes everything instead of being stuck on a dead
  // target for the full TTL).
  return candidates[candidates.length - 1];
}

router.use('/:id', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    logger.debug('Rejected a non-GET request to the map proxy.', { serverId: req.params.id, method: req.method });
    return res.status(405).send('Method not allowed');
  }
  const server = getServer(req.params.id);
  const cfg = server ? getMapConfig(server.id) : { enabled: false };
  if (!server || !cfg.enabled || !cfg.hostPort) {
    logger.debug('Rejected a map proxy request for a server without a live map.', { serverId: req.params.id });
    return res.status(404).send('Live map is not enabled for this server');
  }

  const target = await resolveTarget(server, cfg);

  // BlueMap's bundled webserver only serves static tiles/assets, so forward a
  // small allowlist of request headers rather than the client's whole set -
  // nothing else (cookies, auth, x-forwarded-*, custom headers) has any business
  // reaching a target that may sit on a shared Docker network.
  const FORWARD_REQ = ['accept', 'accept-encoding', 'accept-language', 'range', 'if-none-match', 'if-modified-since'];
  const fwd = { host: `${target.host}:${target.port}` };
  for (const h of FORWARD_REQ) if (req.headers[h] != null) fwd[h] = req.headers[h];

  // Symmetrically, copy back only headers a static asset legitimately needs -
  // never a Set-Cookie / CSP / auth header BlueMap might emit.
  const COPY_RES = new Set([
    'content-type',
    'content-length',
    'content-encoding',
    'content-range',
    'accept-ranges',
    'cache-control',
    'last-modified',
    'etag',
    'expires',
    'vary',
  ]);

  const upstream = http.request(
    {
      host: target.host,
      port: target.port,
      path: req.url === '/' ? '/' : req.url,
      method: req.method,
      headers: fwd,
      timeout: 20000,
    },
    (up) => {
      res.status(up.statusCode || 502);
      for (const [k, v] of Object.entries(up.headers)) {
        if (COPY_RES.has(k.toLowerCase())) res.setHeader(k, v);
      }
      up.pipe(res);
    }
  );
  upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
  upstream.on('error', (err) => {
    targetCache.delete(server.id); // stale - the next request re-probes every candidate
    logger.warn('A live-map proxy request failed.', {
      serverId: server.id,
      target: `${target.host}:${target.port}`,
      code: err.code || 'timeout',
    });
    if (res.headersSent) return res.end();
    if (err.code === 'ENOTFOUND') {
      return res
        .status(502)
        .send(
          `Cannot resolve map-proxy host "${target.host}" - if the panel runs in its own container, ` +
            'add `extra_hosts: ["host.docker.internal:host-gateway"]` to its compose service ' +
            '(see docker-compose.yml), or set MAP_PROXY_HOST explicitly.'
        );
    }
    res
      .status(502)
      .send(
        'The map server is not responding - is the Minecraft server running? BlueMap needs a minute after startup to come up.'
      );
  });
  req.pipe(upstream);
});

module.exports = router;
