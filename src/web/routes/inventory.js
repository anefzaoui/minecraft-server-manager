// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Inventory forensics API. Mounted at /api/servers/:id/inventory (mergeParams
// carries :id down from the mount point). A second router — exported as
// `module.exports.globalSearch` — serves GET /api/inventory/search across all
// servers.

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const { z } = require('zod');
const servers = require('../../services/servers');
const inventory = require('../../services/inventory');
const { inspectStatus } = require('../../docker/containers');

const router = express.Router({ mergeParams: true });

const RUNNING_STATES = new Set(['running', 'unhealthy']);

const uuidSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, 'Invalid player UUID');
const nameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{1,16}$/, 'Player names are 1-16 letters, digits or _');
const itemSchema = z
  .string()
  .trim()
  .regex(/^([a-z0-9_.-]+:)?[a-z0-9_./-]{1,120}$/, 'Enter a valid item id (e.g. minecraft:diamond_sword)');
const snapshotFileSchema = z.string().trim().min(1).max(300);
const querySchema = z.string().trim().min(1, 'Enter something to search for').max(100);

const giveSchema = z.object({
  player: nameSchema,
  item: itemSchema,
  count: z.coerce.number().int().min(1).max(6400).optional(),
});
const clearSchema = z.object({
  player: nameSchema,
  item: itemSchema.optional(),
});

// God-mode slot editing
const containerSchema = z.enum(['hotbar', 'inventory', 'enderchest', 'armor', 'offhand']);
const slotRefSchema = z.object({
  container: containerSchema,
  slot: z.coerce.number().int().min(0).max(26),
});
const nestedSchema = z.object({
  // path segments into the item's NBT: compound keys (strings) and list indexes (numbers)
  path: z
    .array(
      z.union([z.string().regex(/^[A-Za-z0-9_:./ -]{1,80}$/, 'Invalid nested path'), z.number().int().min(0).max(255)])
    )
    .min(1)
    .max(10),
  index: z.number().int().min(0).max(255),
});
const slotEditSchema = z
  .object({
    container: containerSchema,
    slot: z.coerce.number().int().min(0).max(26),
    op: z.enum(['set', 'delete', 'count']),
    item: itemSchema.optional(),
    count: z.coerce.number().int().min(1).max(99).optional(),
    nested: nestedSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.op === 'set' && !v.item) ctx.addIssue({ code: 'custom', message: 'op "set" needs an item id' });
    if (v.op === 'count' && v.count === undefined)
      ctx.addIssue({ code: 'custom', message: 'op "count" needs a count' });
  });
const moveSchema = z.object({ from: slotRefSchema, to: slotRefSchema });
const addSchema = z.object({
  item: itemSchema,
  count: z.coerce.number().int().min(1).max(99).optional(),
});

function actorOf(req) {
  return req.user ? req.user.username : 'admin';
}

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
    /* docker down — offline reads still work */
  }
  return { server, running };
}

router.get(
  '/players',
  asyncHandler(async (req, res, next) => {
    const { server, running } = await loadContext(req);
    res.json({ ok: true, running, players: await inventory.listPlayersWithData(server.id) });
  })
);

router.get(
  '/player/:uuid',
  asyncHandler(async (req, res, next) => {
    const uuid = uuidSchema.parse(req.params.uuid);
    const { server, running } = await loadContext(req);
    // ?fresh=1 -> flush live player data to disk first, so the grid shows the
    // CURRENT online state (used by the Reload button and after live edits).
    if (running && req.query.fresh === '1') await inventory.flushPlayerData(server.id);
    const player = await inventory.readPlayerData(server.id, uuid);
    // Edit metadata: which mechanism a slot edit would use right now.
    const ctx = await inventory.editContext(server.id, uuid);
    res.json({
      ok: true,
      running,
      player,
      edit: {
        online: ctx.online,
        mechanism: ctx.mechanism, // 'rcon' (live commands) | 'file' (.dat rewrite + backup)
        nestedEditable: ctx.mechanism === 'file', // backpack contents are file-only
      },
    });
  })
);

// One-slot god-mode edit: set / delete / count — optionally inside a nested
// sub-inventory (backpack) via `nested: {path, index}` (offline mechanism only).
router.post(
  '/player/:uuid/slot',
  asyncHandler(async (req, res, next) => {
    const uuid = uuidSchema.parse(req.params.uuid);
    const body = slotEditSchema.parse(req.body);
    const { server } = await loadContext(req);
    res.json({ ok: true, result: await inventory.editSlot(server.id, uuid, body, { actor: actorOf(req) }) });
  })
);

// Move/swap between any two slots (main inventory <-> ender chest included).
router.post(
  '/player/:uuid/move',
  asyncHandler(async (req, res, next) => {
    const uuid = uuidSchema.parse(req.params.uuid);
    const { from, to } = moveSchema.parse(req.body);
    const { server } = await loadContext(req);
    res.json({ ok: true, result: await inventory.moveItem(server.id, uuid, from, to, { actor: actorOf(req) }) });
  })
);

// Add to the first free slot — /give when online, .dat insert when offline.
router.post(
  '/player/:uuid/add',
  asyncHandler(async (req, res, next) => {
    const uuid = uuidSchema.parse(req.params.uuid);
    const { item, count } = addSchema.parse(req.body);
    const { server } = await loadContext(req);
    res.json({ ok: true, result: await inventory.addItem(server.id, uuid, item, count ?? 1, { actor: actorOf(req) }) });
  })
);

router.get(
  '/player/:uuid/snapshots',
  asyncHandler(async (req, res, next) => {
    const uuid = uuidSchema.parse(req.params.uuid);
    const { server } = await loadContext(req);
    res.json({ ok: true, snapshots: await inventory.listSnapshots(server.id, uuid) });
  })
);

// Manual "take snapshot" (automatic ones ride on join/death events).
router.post(
  '/player/:uuid/snapshot',
  asyncHandler(async (req, res, next) => {
    const uuid = uuidSchema.parse(req.params.uuid);
    const { server } = await loadContext(req);
    const snap = await inventory.snapshot(server.id, uuid, 'manual');
    await inventory.pruneSnapshots(server.id);
    res.status(201).json({ ok: true, snapshot: snap });
  })
);

router.get(
  '/snapshot',
  asyncHandler(async (req, res, next) => {
    const file = snapshotFileSchema.parse(req.query.file);
    await loadContext(req); // 404 on unknown server; the service re-validates the path shape
    res.json({ ok: true, snapshot: inventory.getSnapshot(file) });
  })
);

router.get(
  '/diff',
  asyncHandler(async (req, res, next) => {
    const a = snapshotFileSchema.parse(req.query.a);
    const b = snapshotFileSchema.parse(req.query.b);
    await loadContext(req);
    res.json({ ok: true, diff: inventory.diffSnapshots(a, b) });
  })
);

router.get(
  '/search',
  asyncHandler(async (req, res, next) => {
    const q = querySchema.parse(req.query.q);
    const { server } = await loadContext(req);
    res.json({ ok: true, results: await inventory.searchItems(server.id, q) });
  })
);

router.post(
  '/give',
  asyncHandler(async (req, res, next) => {
    const { player, item, count } = giveSchema.parse(req.body);
    const { server } = await loadContext(req);
    res.json({
      ok: true,
      result: await inventory.giveItem(server.id, player, item, count ?? 1, { actor: actorOf(req) }),
    });
  })
);

router.post(
  '/clear',
  asyncHandler(async (req, res, next) => {
    const { player, item } = clearSchema.parse(req.body);
    const { server } = await loadContext(req);
    res.json({ ok: true, result: await inventory.clearItem(server.id, player, item || null, { actor: actorOf(req) }) });
  })
);

// ---------------------------------------------------------------------------
// Global search across every server — mount at /api/inventory

const globalSearch = express.Router();

globalSearch.get(
  '/search',
  asyncHandler(async (req, res, next) => {
    const q = querySchema.parse(req.query.q);
    res.json({ ok: true, results: await inventory.searchAllServers(q) });
  })
);

// JSON error handler shared by both subtrees (mirrors routes/api.js)

const errorHandler = makeJsonErrorHandler('inventory-api');

router.use(errorHandler);
globalSearch.use(errorHandler);

module.exports = router;
module.exports.globalSearch = globalSearch;
