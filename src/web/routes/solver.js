// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Compatibility solver API. Mounted at /api/solver.

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const { z } = require('zod');
const solver = require('../../services/solver');
const modrinth = require('../../services/modrinthApi');

const router = express.Router();

// Mod search for the "Start from mods" wizard panel. Deliberately unfiltered
// by loader/MC version — the solver decides those from the final selection.
router.get(
  '/search',
  asyncHandler(async (req, res, next) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ ok: true, results: [] });
    const results = await modrinth.search({ query: q, kind: 'mod' });
    res.json({
      ok: true,
      results: results.map((r) => ({
        slug: r.slug,
        title: r.title,
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
        projects: z.array(z.string().trim().min(1).max(100)).min(1).max(solver.MAX_PROJECTS),
      })
      .parse(req.body);
    res.json({ ok: true, ...(await solver.solve(projects)) });
  })
);

// JSON error handler (this router is mounted outside the /api router's own).
router.use(makeJsonErrorHandler('solver'));

module.exports = router;
