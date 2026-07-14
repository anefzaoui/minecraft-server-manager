// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Item registry API (JEI-style browser). Mounted at /api/servers/:id/items
// (mergeParams carries :id down from the mount point).
//
//   GET  /          search — q / mod / kind / limit / offset
//   POST /rebuild   force a full re-scan (task-wrapped; poll /api/tasks/:id)

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const { z } = require('zod');
const servers = require('../../services/servers');
const itemRegistry = require('../../services/itemRegistry');
const tasks = require('../../services/tasks');

const router = express.Router({ mergeParams: true });

const searchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  mod: z.string().trim().max(120).optional(),
  kind: z.enum(['item', 'block']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
});

function requireServer(id) {
  const server = servers.getServer(id);
  if (!server) {
    const err = new Error('Server not found');
    err.status = 404;
    throw err;
  }
  return server;
}

router.get(
  '/',
  asyncHandler(async (req, res, next) => {
    const server = requireServer(req.params.id);
    const params = searchSchema.parse({
      q: req.query.q || undefined,
      mod: req.query.mod || undefined,
      kind: req.query.kind || undefined,
      limit: req.query.limit || undefined,
      offset: req.query.offset || undefined,
    });
    const { items, total } = await itemRegistry.search(server.id, params);
    const registry = await itemRegistry.getRegistry(server.id); // cache hit — just built above
    res.json({
      ok: true,
      items,
      total,
      mods: registry.mods,
      registry: { count: registry.items.length, builtAt: registry.builtAt, buildMs: registry.buildMs },
    });
  })
);

// Long operation on big packs — returns {ok, taskId}; poll /api/tasks/:id.
router.post(
  '/rebuild',
  asyncHandler((req, res, next) => {
    const server = requireServer(req.params.id);
    const actor = req.user ? req.user.username : 'admin';
    const taskId = tasks.run(
      `Rebuilding item registry for ${server.display_name}`,
      { serverId: server.id, actor },
      async (t) => {
        t.step('Scanning mod jars & the server jar for item names');
        const registry = await itemRegistry.getRegistry(server.id, {
          force: true,
          onProgress: (done, total, label) => {
            t.progress(done, total);
            if (label) t.log(label);
          },
        });
        return { items: registry.items.length, mods: registry.mods.length, buildMs: registry.buildMs };
      }
    );
    res.status(202).json({ ok: true, taskId });
  })
);

// JSON error handler (mirrors routes/api.js)
router.use(makeJsonErrorHandler('items-api'));

module.exports = router;
