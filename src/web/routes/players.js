'use strict';

// Player management API. Mounted at /api/servers/:id/players (mergeParams
// carries :id down from the mount point).

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const { z } = require('zod');
const servers = require('../../services/servers');
const players = require('../../services/players');
const { inspectStatus } = require('../../docker/containers');
const biomes = require('../../config/biomes');

const router = express.Router({ mergeParams: true });

const RUNNING_STATES = new Set(['running', 'unhealthy']); // rcon still answers while unhealthy

const nameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{1,16}$/, 'Player names are 1-16 letters, digits or _');
const reasonSchema = z.string().trim().max(256).optional();
const ipSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F.:]{3,45}$/, 'Enter a valid IPv4 or IPv6 address');

const whitelistSchema = z.object({ name: nameSchema, on: z.coerce.boolean() });
const enforceSchema = z.object({ on: z.coerce.boolean() });
const opSchema = z.object({
  name: nameSchema,
  on: z.coerce.boolean(),
  level: z.coerce.number().int().min(1).max(4).optional(),
});
const banSchema = z.object({ name: nameSchema, reason: reasonSchema });
const pardonSchema = z.object({ name: nameSchema });
const banIpSchema = z.object({ ip: ipSchema, reason: reasonSchema });
const pardonIpSchema = z.object({ ip: ipSchema });
const kickSchema = z.object({ name: nameSchema, message: z.string().trim().max(256).optional() });
const teleportSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('coords'),
    player: nameSchema,
    x: z.coerce.number().finite(),
    // Y omitted/empty = land on the surface (spreadplayers) — never mid-air.
    y: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.coerce.number().finite().optional()
    ),
    z: z.coerce.number().finite(),
    dimension: z.enum(['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end']).optional(),
    safe: z.coerce.boolean().optional(),
  }),
  z.object({ mode: z.literal('player'), player: nameSchema, target: nameSchema }),
  z.object({
    mode: z.literal('biome'),
    player: nameSchema,
    biome: z
      .string()
      .trim()
      .regex(/^[a-z0-9_.-]+:[a-z0-9_/.-]+$/),
  }),
  z.object({
    mode: z.literal('rtp'),
    player: nameSchema,
    minDistance: z.coerce.number().int().min(0).max(1000000).optional(),
    maxDistance: z.coerce.number().int().min(16).max(1000000).optional(),
    center: z.enum(['player', 'origin']).optional(),
  }),
  z.object({
    mode: z.literal('structure'),
    player: nameSchema,
    structure: z
      .string()
      .trim()
      .regex(/^#?[a-z0-9_.-]+:[a-z0-9_/.-]+$/),
    random: z.coerce.boolean().optional(),
    maxDistance: z.coerce.number().int().min(16).max(1000000).optional(),
  }),
]);

/** 404 unless the server exists; resolve whether rcon is available. */
async function loadContext(req) {
  const server = servers.getServer(req.params.id);
  if (!server) {
    const err = new Error('Server not found');
    err.status = 404;
    throw err;
  }
  let running = false;
  try {
    const info = await inspectStatus(server.id);
    running = info.exists && RUNNING_STATES.has(info.status);
  } catch {
    /* docker down — fall back to file edits */
  }
  return { server, ctx: { running, actor: req.user.username } };
}

router.get(
  '/',
  asyncHandler(async (req, res, next) => {
    const { server, ctx } = await loadContext(req);
    const onlineNames = ctx.running ? await players.listOnlineNames(server.id) : [];
    res.json({
      ok: true,
      running: ctx.running,
      players: players.listPlayers(server.id, onlineNames),
      bannedIps: players.listBannedIps(server.id),
      whitelistEnforced: players.getWhitelistEnforced(server.id),
    });
  })
);

router.get('/structures', async (req, res) => {
  try {
    const { ctx } = await loadContext(req);
    res.json({ ok: true, structures: await players.getServerStructures(req.params.id, { running: ctx.running }) });
  } catch {
    res.json({ ok: true, structures: [] });
  }
});

router.get('/biomes', async (req, res, next) => {
  try {
    // Server-derived registry when possible (modded packs add biomes the
    // bundled vanilla list can't know); bundled fallback otherwise. Each biome is
    // tagged with its "special" (non-overworld) home dimension for the UI prefix.
    const { ctx } = await loadContext(req);
    const registry = await players.getServerBiomes(req.params.id, { running: ctx.running });
    const seen = new Map();
    for (const b of registry.biomes) {
      if (seen.has(b.id)) continue;
      const dims = registry.byId.get(b.id) || [b.dimension];
      const primary = dims.find((d) => d && d !== 'minecraft:overworld') || dims[0] || 'minecraft:overworld';
      seen.set(b.id, { id: b.id, dimension: primary });
    }
    const list = [...seen.values()];
    res.json({ ok: true, biomes: list, source: list.length > 70 ? 'server' : 'bundled' });
  } catch {
    res.json({ ok: true, biomes: biomes.map((id) => ({ id, dimension: 'minecraft:overworld' })), source: 'bundled' });
  }
});

router.post(
  '/whitelist',
  asyncHandler(async (req, res, next) => {
    const { name, on } = whitelistSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.setWhitelisted(server.id, name, on, ctx) });
  })
);

router.post(
  '/whitelist-enforce',
  asyncHandler(async (req, res, next) => {
    const { on } = enforceSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.setWhitelistEnforced(server.id, on, ctx) });
  })
);

router.post(
  '/op',
  asyncHandler(async (req, res, next) => {
    const { name, on, level } = opSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.setOp(server.id, name, on, level ?? 4, ctx) });
  })
);

router.post(
  '/ban',
  asyncHandler(async (req, res, next) => {
    const { name, reason } = banSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.banPlayer(server.id, name, reason, ctx) });
  })
);

router.post(
  '/pardon',
  asyncHandler(async (req, res, next) => {
    const { name } = pardonSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.pardonPlayer(server.id, name, ctx) });
  })
);

router.post(
  '/ban-ip',
  asyncHandler(async (req, res, next) => {
    const { ip, reason } = banIpSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.banIp(server.id, ip, reason, ctx) });
  })
);

router.post(
  '/pardon-ip',
  asyncHandler(async (req, res, next) => {
    const { ip } = pardonIpSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.pardonIp(server.id, ip, ctx) });
  })
);

router.post(
  '/kick',
  asyncHandler(async (req, res, next) => {
    const { name, message } = kickSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    res.json({ ok: true, result: await players.kickPlayer(server.id, name, message, ctx) });
  })
);

router.post(
  '/teleport',
  asyncHandler(async (req, res, next) => {
    const body = teleportSchema.parse(req.body);
    const { server, ctx } = await loadContext(req);
    // One teleport at a time per server — parallel /locate searches stall the
    // server's main thread hard enough to time out every online player.
    const result = await players.withTeleportSlot(server.id, async () => {
      if (body.mode === 'coords') {
        return players.tpToCoords(
          server.id,
          body.player,
          { x: body.x, y: body.y, z: body.z, dimension: body.dimension, safe: body.safe !== false },
          ctx
        );
      }
      if (body.mode === 'player') {
        return players.tpToPlayer(server.id, body.player, body.target, ctx);
      }
      if (body.mode === 'rtp') {
        return players.rtpPlayer(
          server.id,
          body.player,
          { minDistance: body.minDistance, maxDistance: body.maxDistance, center: body.center },
          ctx
        );
      }
      if (body.mode === 'structure') {
        return players.tpToStructure(
          server.id,
          body.player,
          body.structure,
          { random: body.random !== false, maxDistance: body.maxDistance },
          ctx
        );
      }
      return players.tpToBiome(server.id, body.player, body.biome, ctx);
    });
    res.json({ ok: true, result });
  })
);

// JSON error handler for this subtree (mirrors routes/api.js)
router.use(makeJsonErrorHandler('players-api'));

module.exports = router;
