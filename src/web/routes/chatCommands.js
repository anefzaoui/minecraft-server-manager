'use strict';

// Custom chat commands API. Mounted at /api/servers/:id/chat-commands
// (mergeParams carries :id down from the mount point).

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const { z } = require('zod');
const servers = require('../../services/servers');
const chatCommands = require('../../services/chatCommands');
const { inspectStatus } = require('../../docker/containers');

const router = express.Router({ mergeParams: true });

const RUNNING_STATES = new Set(['running', 'unhealthy']); // rcon still answers while unhealthy

const triggerSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9_-]{1,24}$/i, 'Triggers are 1-24 letters, digits, - or _');
const paramsSchema = z.record(z.string(), z.any());

const messageSchema = z.string().max(200); // '' clears it (back to the built-in default)

const createSchema = z.object({
  trigger: triggerSchema,
  description: z.string().trim().max(200).optional(),
  action: z.enum(['rtp', 'structure', 'biome', 'console']),
  params: paramsSchema.default({}),
  permission: z.enum(['everyone', 'whitelist', 'ops']).default('everyone'),
  cooldownSec: z.coerce.number().int().min(0).max(86400).default(30),
  enabled: z.coerce.boolean().optional(),
  msgPending: messageSchema.optional(),
  msgSuccess: messageSchema.optional(),
  msgFailure: messageSchema.optional(),
});

const patchSchema = z
  .object({
    trigger: triggerSchema.optional(),
    description: z.string().trim().max(200).optional(),
    action: z.enum(['rtp', 'structure', 'biome', 'console']).optional(),
    params: paramsSchema.optional(),
    permission: z.enum(['everyone', 'whitelist', 'ops']).optional(),
    cooldownSec: z.coerce.number().int().min(0).max(86400).optional(),
    enabled: z.coerce.boolean().optional(),
    msgPending: messageSchema.optional(),
    msgSuccess: messageSchema.optional(),
    msgFailure: messageSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change' });

function requireServer(id) {
  const server = servers.getServer(id);
  if (!server) {
    const err = new Error('Server not found');
    err.status = 404;
    throw err;
  }
  return server;
}

async function isRunning(serverId) {
  try {
    const info = await inspectStatus(serverId);
    return info.exists && RUNNING_STATES.has(info.status);
  } catch {
    return false;
  }
}

router.get(
  '/',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    const commands = chatCommands.listCommands(req.params.id);
    res.json({
      ok: true,
      prefix: chatCommands.getPrefix(req.params.id),
      commands: commands.map((c) => ({ ...c, actionSummary: chatCommands.actionSummary(c) })),
      stats: {
        total: commands.length,
        enabled: commands.filter((c) => c.enabled).length,
        uses: commands.reduce((n, c) => n + (c.uses || 0), 0),
      },
    });
  })
);

router.post(
  '/',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    const input = createSchema.parse(req.body);
    const command = chatCommands.createCommand(req.params.id, input, { actor: req.user.username });
    res.status(201).json({ ok: true, command });
  })
);

router.patch(
  '/:cmdId',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    const changes = patchSchema.parse(req.body);
    const command = chatCommands.updateCommand(req.params.id, req.params.cmdId, changes, { actor: req.user.username });
    res.json({ ok: true, command });
  })
);

router.delete(
  '/:cmdId',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    chatCommands.deleteCommand(req.params.id, req.params.cmdId, { actor: req.user.username });
    res.json({ ok: true });
  })
);

// Execute NOW as a named player — same path as chat, minus cooldown/permission.
router.post(
  '/:cmdId/test',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    const { player } = z
      .object({
        player: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9_]{1,16}$/, 'Player names are 1-16 letters, digits or _'),
      })
      .parse(req.body);
    if (!(await isRunning(req.params.id))) {
      throw Object.assign(new Error('The server must be running to test a chat command'), { status: 409 });
    }
    const result = await chatCommands.testCommand(req.params.id, req.params.cmdId, player, {
      actor: req.user.username,
    });
    res.json({ ok: true, ...result });
  })
);

router.put(
  '/prefix',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    const { prefix } = z.object({ prefix: z.string().trim().min(1).max(2) }).parse(req.body);
    res.json({ ok: true, ...chatCommands.setPrefix(req.params.id, prefix, { actor: req.user.username }) });
  })
);

// JSON error handler for this subtree (mirrors routes/api.js)
router.use(makeJsonErrorHandler('chat-commands-api'));

module.exports = router;
