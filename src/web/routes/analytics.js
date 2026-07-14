'use strict';

// Player analytics API. Mounted at /api/servers/:id/analytics (mergeParams
// carries :id down from the mount point).

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const { z } = require('zod');
const db = require('../../db');
const servers = require('../../services/servers');
const stats = require('../../analytics/stats');
const { backfillFromLogs } = require('../../analytics/ingest');

const router = express.Router({ mergeParams: true });

const EVENT_TYPES = ['chat', 'join', 'leave', 'death', 'advancement', 'pvp', 'command'];

function mustServer(req) {
  const server = servers.getServer(req.params.id);
  if (!server) {
    const err = new Error('Server not found');
    err.status = 404;
    throw err;
  }
  return server;
}

/** Escape LIKE wildcards so user input only ever matches literally. */
function escapeLike(s) {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

const timelineSchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: z.string().trim().max(120).optional(), // comma-separated type list
  player: z
    .string()
    .trim()
    .regex(/^[[\]A-Za-z0-9_]{1,20}$/)
    .optional(), // [Server] included
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().positive().optional(), // id cursor for "load older"
});

router.get(
  '/timeline',
  asyncHandler((req, res, next) => {
    mustServer(req);
    const query = timelineSchema.parse(req.query);
    const where = ['server_id = ?'];
    const params = [req.params.id];
    if (query.type) {
      const types = query.type
        .split(',')
        .map((t) => t.trim())
        .filter((t) => EVENT_TYPES.includes(t));
      if (types.length) {
        where.push(`type IN (${types.map(() => '?').join(', ')})`);
        params.push(...types);
      }
    }
    if (query.player) {
      where.push('player = ?');
      params.push(query.player);
    }
    if (query.before) {
      where.push('id < ?');
      params.push(query.before);
    }
    if (query.q) {
      const like = '%' + escapeLike(query.q) + '%';
      where.push("(message LIKE ? ESCAPE '\\' OR player LIKE ? ESCAPE '\\')");
      params.push(like, like);
    }
    const events = db.all(
      `SELECT id, ts, type, player, target, message FROM player_events
       WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ?`,
      ...params,
      query.limit
    );
    res.json({
      ok: true,
      events,
      nextBefore: events.length === query.limit ? events[events.length - 1].id : null,
    });
  })
);

router.get(
  '/sessions',
  asyncHandler((req, res, next) => {
    mustServer(req);
    const { player } = z
      .object({
        player: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_]{1,16}$/)
          .optional(),
      })
      .parse(req.query);
    const where = ['server_id = ?'];
    const params = [req.params.id];
    if (player) {
      where.push('player = ?');
      params.push(player);
    }
    const sessions = db
      .all(
        `SELECT id, player, started_at, ended_at FROM player_sessions
       WHERE ${where.join(' AND ')} ORDER BY started_at DESC LIMIT 100`,
        ...params
      )
      .map((s) => ({
        id: s.id,
        player: s.player,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        open: !s.ended_at,
        durationSec: Math.max(
          0,
          Math.round(((s.ended_at ? Date.parse(s.ended_at) : Date.now()) - Date.parse(s.started_at)) / 1000)
        ),
      }));
    res.json({ ok: true, sessions });
  })
);

router.get(
  '/scoreboard',
  asyncHandler((req, res, next) => {
    mustServer(req);
    const { metric, window } = z
      .object({
        metric: z
          .enum([
            'playtimeTicks',
            'deaths',
            'mobKills',
            'playerKills',
            'blocksMinedTotal',
            'stoneMined',
            'diamondsMined',
            'ironMined',
            'ancientDebrisMined',
            'distanceCm',
            'damageDealt',
            'damageTaken',
            'jumps',
            'blocksUsedTotal',
          ])
          .default('playtimeTicks'),
        window: z.enum(['all', '7d', '24h']).default('all'),
      })
      .parse(req.query);
    res.json({ ok: true, metric, window, rows: stats.scoreboard(req.params.id, { metric, window }) });
  })
);

router.get(
  '/profile/:uuid',
  asyncHandler((req, res, next) => {
    mustServer(req);
    const uuid = z
      .string()
      .trim()
      .regex(/^[0-9a-fA-F-]{32,36}$/)
      .parse(req.params.uuid);
    const data = stats.profile(req.params.id, uuid);
    if (!data) return res.status(404).json({ ok: false, error: 'No stats recorded for this player yet' });
    res.json({ ok: true, profile: data });
  })
);

// Distinct players seen in the timeline plus everyone with stat snapshots.
router.get(
  '/players',
  asyncHandler((req, res, next) => {
    mustServer(req);
    const players = db.all(
      `SELECT player AS name, '' AS uuid FROM player_events
       WHERE server_id = ? AND player != '' AND player != '[Server]'
       UNION
       SELECT name, uuid FROM player_stat_snapshots WHERE server_id = ? AND name != ''
       ORDER BY name COLLATE NOCASE`,
      req.params.id,
      req.params.id
    );
    // Collapse duplicate names, preferring rows that carry a uuid.
    const byName = new Map();
    for (const p of players) {
      if (!byName.has(p.name) || p.uuid) byName.set(p.name, p);
    }
    res.json({ ok: true, players: [...byName.values()] });
  })
);

router.get(
  '/xray',
  asyncHandler((req, res, next) => {
    mustServer(req);
    res.json({ ok: true, report: stats.xrayReport(req.params.id) });
  })
);

router.post(
  '/ingest-now',
  asyncHandler(async (req, res, next) => {
    mustServer(req);
    const backfill = await backfillFromLogs(req.params.id).catch(() => ({ inserted: 0 }));
    const statResult = stats.ingestStats(req.params.id);
    res.json({ ok: true, events: backfill.inserted, ...statResult });
  })
);

// JSON error handler, same shape as the main API subtree.
router.use(makeJsonErrorHandler('analytics'));

module.exports = router;
