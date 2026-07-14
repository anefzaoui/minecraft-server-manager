'use strict';

// Authenticated reverse proxy for BlueMap's web UI: the map port is never
// exposed to the browser directly — everything flows through the panel's
// session-gated /map/<serverId>/… path. Plain stdlib http, GET/HEAD only.

const http = require('node:http');
const express = require('express');
const { getMapConfig } = require('../../services/map');
const { getServer } = require('../../services/servers');

const router = express.Router();

router.use('/:id', (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method not allowed');
  }
  const server = getServer(req.params.id);
  const cfg = server ? getMapConfig(server.id) : { enabled: false };
  if (!cfg.enabled || !cfg.hostPort) {
    return res.status(404).send('Live map is not enabled for this server');
  }

  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: cfg.hostPort,
      path: req.url === '/' ? '/' : req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${cfg.hostPort}` },
      timeout: 20000,
    },
    (up) => {
      res.status(up.statusCode || 502);
      for (const [k, v] of Object.entries(up.headers)) {
        if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) res.setHeader(k, v);
      }
      up.pipe(res);
    }
  );
  upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) {
      res
        .status(502)
        .send(
          'The map server is not responding — is the Minecraft server running? BlueMap needs a minute after startup to come up.'
        );
    } else {
      res.end();
    }
  });
  req.pipe(upstream);
});

module.exports = router;
