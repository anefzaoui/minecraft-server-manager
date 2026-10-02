'use strict';

// Public, read-only, token-authed API. Mounted at /api/v1 in web/app.js BEFORE
// requireAuth - it takes a Bearer token (services/apiTokens.js), never a
// session cookie. Everything here reads the in-memory live cache + DB, exactly
// like GET /api/servers/live and the public /status page; no Docker call per
// request, so anonymous-scale traffic cannot exhaust the daemon.

const express = require('express');
const { z } = require('zod');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const { bearerAuth, readOnly } = require('../middleware/apiToken');
const { publicApiIpLimiter, publicApiTokenLimiter } = require('../middleware/rateLimit');
const settings = require('../../services/settings');
const servers = require('../../services/servers');
const liveCache = require('../../services/liveCache');
const { renderMetrics } = require('../../utils/promMetrics');

const router = express.Router();

// Disabled => 404 (indistinguishable from "this route does not exist"), so the
// surface leaks nothing about its own existence when an admin has turned it off.
router.use((req, res, next) => {
  if (!settings.isPublicApiEnabled()) return res.status(404).json({ ok: false, error: 'Not found' });
  next();
});
router.use(publicApiIpLimiter); // cheapest guard first: per-IP cap on pre-auth probing
router.use(readOnly); // 405 on non-GET before any token/DB work
router.use(bearerAuth); // 401 unless a live, unrevoked, unexpired token
router.use(publicApiTokenLimiter); // the documented per-token budget

// Public status vocabulary - a stable v1 contract that insulates callers from
// internal status churn (e.g. 'unhealthy', 'stalled', 'over-quota').
const STATE_MAP = {
  running: 'running',
  unhealthy: 'running',
  stalled: 'starting',
  starting: 'starting',
  updating: 'starting',
  stopped: 'stopped',
  crashed: 'crashed',
  'over-quota': 'stopped',
};

/**
 * Lean, Docker-free public shape. Deliberately NOT serverVM() / publicServer()
 * - those carry env, ports, docker overrides, notes, and the rcon cipher.
 * @param {Record<string, any>} row  a rowToServer() result
 */
function serverStatusView(row) {
  const live = liveCache.get(row.id);
  return {
    id: row.id,
    name: row.display_name,
    type: row.type,
    state: STATE_MAP[row.status] || 'stopped',
    cpuPct: live.stats ? live.stats.cpuPct : null,
    memoryMb: live.stats ? Math.round((live.stats.memUsedBytes || 0) / 1024 / 1024) : null,
    memoryLimitMb: row.container_memory_mb ?? null,
    uptimeSeconds: live.startedAt
      ? Number.isFinite(Date.parse(live.startedAt))
        ? Math.max(0, Math.floor((Date.now() - Date.parse(live.startedAt)) / 1000))
        : null
      : null,
    players: live.players ? { online: live.players.online, max: live.players.max } : null,
  };
}

/** @param {import('express').Request} req */
function inScope(req, id) {
  return req.apiTokenScope.all || req.apiTokenScope.serverIds.includes(id);
}

router.get('/servers', (req, res) => {
  const rows = servers.listServers().filter((s) => inScope(req, s.id));
  const views = rows.map(serverStatusView);
  res.json({
    ok: true,
    total: views.length,
    online: views.filter((v) => v.state === 'running').length,
    servers: views,
  });
});

// Prometheus scrape target. Same token auth, scope filtering, and rate limit as
// the JSON routes (Prometheus: `authorization: { credentials: <token> }`); reads
// only the in-memory live cache, so a scrape never touches Docker.
router.get('/metrics', (req, res) => {
  const rows = servers.listServers().filter((s) => inScope(req, s.id));
  const per = (pick) =>
    rows.map((row) => ({
      labels: { server_id: row.id, name: row.display_name },
      value: pick(row, serverStatusView(row), liveCache.get(row.id)),
    }));
  const MB = 1024 * 1024;
  const body = renderMetrics([
    {
      name: 'msm_servers',
      help: 'Servers visible to this token.',
      samples: [{ value: rows.length }],
    },
    {
      name: 'msm_server_up',
      help: '1 when the server is running, 0 otherwise.',
      samples: per((row, v) => (v.state === 'running' ? 1 : 0)),
    },
    {
      name: 'msm_server_cpu_percent',
      help: 'Container CPU use as a percent of one core.',
      samples: per((row, v) => v.cpuPct),
    },
    {
      name: 'msm_server_memory_bytes',
      help: 'Container memory in use.',
      samples: per((row, v) => (v.memoryMb == null ? null : v.memoryMb * MB)),
    },
    {
      name: 'msm_server_memory_limit_bytes',
      help: 'Container memory limit.',
      samples: per((row, v) => (v.memoryLimitMb == null ? null : v.memoryLimitMb * MB)),
    },
    {
      name: 'msm_server_uptime_seconds',
      help: 'Seconds since the server container started.',
      samples: per((row, v) => v.uptimeSeconds),
    },
    {
      name: 'msm_server_players_online',
      help: 'Players currently online.',
      samples: per((row, v) => (v.players ? v.players.online : null)),
    },
    {
      name: 'msm_server_players_max',
      help: 'Player slots.',
      samples: per((row, v) => (v.players ? v.players.max : null)),
    },
    {
      name: 'msm_server_tps',
      help: 'Ticks per second over the last minute, where the server reports it.',
      samples: per((row, v, live) => (live.perf ? live.perf.tps1 : null)),
    },
    {
      name: 'msm_server_mspt',
      help: 'Mean milliseconds per tick, where the server reports it.',
      samples: per((row, v, live) => (live.perf ? live.perf.mspt : null)),
    },
  ]);
  res.type('text/plain; version=0.0.4; charset=utf-8').send(body);
});

const idParam = z.object({
  id: z
    .string()
    .trim()
    .regex(/^srv_[A-Za-z0-9_-]{1,40}$/, 'Invalid server id'),
});

router.get('/servers/:id', (req, res) => {
  const { id } = idParam.parse(req.params); // 400 via makeJsonErrorHandler
  const row = servers.getServer(id);
  // Same 404 for "unknown" and "out of scope" - no existence oracle.
  if (!row || !inScope(req, id)) {
    return res.status(404).json({ ok: false, error: 'Server not found' });
  }
  res.json({ ok: true, server: serverStatusView(row) });
});

// Terminal 404: the surface is self-contained. Without this an unknown path
// under /api/v1 would fall through into the session-authenticated /api stack.
router.use((req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

router.use(makeJsonErrorHandler('api-v1'));

module.exports = router;
