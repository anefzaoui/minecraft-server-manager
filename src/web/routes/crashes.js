'use strict';

// Crash-report API. Mounted at /api/servers/:id/crashes (mergeParams gives
// this router access to :id).

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const archiver = require('archiver');
const { z } = require('zod');
const crashes = require('../../crashes');
const { dataPath } = require('../../storage/pathGuard');

const router = express.Router({ mergeParams: true });

const serverIdSchema = z.string().regex(/^srv_[\w-]+$/, 'Invalid server id');
const crashIdSchema = z.string().regex(/^cr_[\w-]+$/, 'Invalid crash report id');

router.get(
  '/',
  asyncHandler(async (req, res, next) => {
    const serverId = serverIdSchema.parse(req.params.id);
    // Opportunistic rescan so a fresh crash shows up without waiting for the watcher.
    await crashes.scanServer(serverId).catch(() => {});
    res.json({ ok: true, crashes: crashes.listCrashes(serverId) });
  })
);

// Must be declared before /:crashId routes.
router.get(
  '/export.zip',
  asyncHandler((req, res, next) => {
    const serverId = serverIdSchema.parse(req.params.id);
    const rows = crashes.listCrashes(serverId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="crash-reports-${serverId}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => next(err));
    archive.pipe(res);
    for (const row of rows) {
      const abs = row.filename.startsWith('hs_err')
        ? dataPath('servers', serverId, row.filename)
        : dataPath('servers', serverId, 'crash-reports', row.filename);
      if (fs.existsSync(abs)) archive.file(abs, { name: path.basename(row.filename) });
    }
    archive.finalize();
  })
);

// Bulk delete — everything older than ?olderThanDays=N for this server.
router.delete(
  '/',
  asyncHandler((req, res, next) => {
    const serverId = serverIdSchema.parse(req.params.id);
    const days = z.coerce.number().int().min(1).max(3650).parse(req.query.olderThanDays);
    const result = crashes.deleteOlderThan(serverId, days, { actor: req.user.username });
    res.json({ ok: true, ...result });
  })
);

router.get(
  '/:crashId/text',
  asyncHandler((req, res, next) => {
    const row = ownedCrash(req);
    const text = crashes.getCrashText(row.server_id, row.filename);
    crashes.markViewed(row.id); // opening the report counts as reading it
    res.type('text/plain').send(text);
  })
);

router.post(
  '/:crashId/viewed',
  asyncHandler((req, res, next) => {
    crashes.markViewed(ownedCrash(req).id);
    res.json({ ok: true });
  })
);

router.delete(
  '/:crashId',
  asyncHandler((req, res, next) => {
    const row = ownedCrash(req);
    const { freedBytes } = crashes.deleteCrash(row.id, { actor: req.user.username });
    res.json({ ok: true, freedBytes });
  })
);

/** Load the crash row and verify it belongs to the :id server (404 otherwise). */
function ownedCrash(req) {
  const serverId = serverIdSchema.parse(req.params.id);
  const crashId = crashIdSchema.parse(req.params.crashId);
  const row = crashes.getCrash(crashId);
  if (!row || row.server_id !== serverId) {
    const err = new Error('Crash report not found');
    err.status = 404;
    throw err;
  }
  return row;
}

// JSON error handler, same shape as routes/api.js
router.use(makeJsonErrorHandler('crashes'));

module.exports = router;
