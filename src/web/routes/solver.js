// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Compatibility solver API. Mounted at /api/solver.

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const { z } = require('zod');
const solver = require('../../services/solver');
const modBrowser = require('../../services/modBrowser');

const router = express.Router();

// Mod search for the "Start from mods" wizard panel. Deliberately unfiltered
// by loader/MC version — the solver decides those from the final selection.
// Both platforms; CurseForge needs the stored API key (412 without it).
router.get(
  '/search',
  asyncHandler(async (req, res, next) => {
    const { q, platform } = z
      .object({
        q: z.string().trim().max(120).default(''),
        platform: z.enum(['modrinth', 'curseforge']).default('modrinth'),
      })
      .parse({ q: req.query.q || '', platform: req.query.platform || undefined });
    if (!q) return res.json({ ok: true, results: [] });
    const results = await modBrowser.search({ query: q, platform, kind: 'mod' });
    res.json({
      ok: true,
      results: results.map((r) => ({
        platform: r.platform,
        slug: r.ref,
        title: r.name,
        iconUrl: r.iconUrl,
        description: r.description,
        downloads: r.downloads,
      })),
    });
  })
);

router.post(
  '/solve',
  asyncHandler(async (req, res, next) => {
    const { projects } = z
      .object({
        projects: z
          .array(
            z.union([
              // Original contract: a bare string is a Modrinth slug/id.
              z.string().trim().min(1).max(100),
              z.object({
                platform: z.enum(['modrinth', 'curseforge']).default('modrinth'),
                ref: z.string().trim().min(1).max(100),
              }),
            ])
          )
          .min(1)
          .max(solver.MAX_PROJECTS),
      })
      .parse(req.body);
    res.json({ ok: true, ...(await solver.solve(projects)) });
  })
);

// JSON error handler (this router is mounted outside the /api router's own).
router.use(makeJsonErrorHandler('solver'));

module.exports = router;
