'use strict';

// World management API.
//   module.exports          → mount at /api/worlds        (global world library)
//   module.exports.serverWorlds → mount at /api/servers/:id/worlds (mergeParams)

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const fsp = require('node:fs/promises');
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const worlds = require('../../services/worlds');
const { dataPath } = require('../../storage/pathGuard');
const logger = require('../../logger')('worlds');
const { serializeError } = require('../../utils/logSanitize');

const onTempCleanupFailed = (err) =>
  logger.debug('Could not remove a temporary file.', { err: serializeError(err, { includeStack: false }) });
const { rejectCrossSiteGet } = require('../middleware/auth');
const permissions = require('../../services/permissions');
const httpError = require('../../utils/httpError');

/** Writing a world into a server needs `content` there; a hidden server reads as missing. */
function requireContentOn(req, serverId) {
  const perms = permissions.effective(req.user, serverId);
  if (!perms.includes('view')) throw httpError(404, 'Server not found');
  if (!perms.includes('content')) throw httpError(403, "You don't have the content permission on this server.");
}
const db = require('../../db');

// requireAuth guarantees req.user on every /api request.
const actorOf = (req) => req.user.username;

const upload = multer({
  dest: dataPath('tmp'),
  limits: { fileSize: 20 * 1024 ** 3 }, // worlds get big
});

const files = require('../../services/files');
const MAX_WORLD_UPLOAD_BYTES = 20 * 1024 ** 3;

// Reject on the declared Content-Length before multer streams the whole world
// archive into data/tmp (which would otherwise fill the disk regardless of quota).
async function worldUploadPreflight(req, res, next) {
  try {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_WORLD_UPLOAD_BYTES) {
      return res.status(413).json({
        ok: false,
        error: `World archive too large (limit ${Math.round(MAX_WORLD_UPLOAD_BYTES / 1024 ** 3)} GB).`,
      });
    }
    // A world archive is extracted after upload, so it needs headroom for both the
    // upload and the (larger) extracted copy - check disk against ~3× the upload.
    if (declared > 0) await files.assertDiskFree(declared * 3);
    next();
  } catch (err) {
    next(err);
  }
}

const worldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[^\\/\0]+$/, 'World names cannot contain path separators.')
  .refine((v) => !v.startsWith('.'), { message: 'World names cannot start with a dot.' });
const modeSchema = z.enum(['replace', 'alongside']);

// ---------------------------------------------------------------------------
// Global library router (/api/worlds)

const router = express.Router();

router.get(
  '/',
  asyncHandler((req, res, next) => {
    res.json({ ok: true, worlds: worlds.libraryWorlds({ visibleServerIds: permissions.visibleServerIds(req.user) }) });
  })
);

// Discover feed for the empty world library: popular CurseForge worlds.
// CurseForge-only (no other registry publishes worlds); needs the stored key.
router.get(
  '/discover',
  asyncHandler(async (req, res, next) => {
    const { limit, offset } = z
      .object({
        limit: z.coerce.number().int().min(1).max(12).default(6),
        offset: z.coerce.number().int().min(0).max(1000).default(0),
      })
      .parse({ limit: req.query.limit ?? undefined, offset: req.query.offset ?? undefined });
    const curseforge = require('../../services/curseforgeApi');
    const results = (await curseforge.searchWorlds({ limit, offset })).map((m) => ({
      platform: 'curseforge',
      ref: m.slug,
      modId: m.modId,
      name: m.name,
      iconUrl: m.iconUrl,
      downloads: m.downloads,
      description: m.summary,
    }));
    res.json({ ok: true, results });
  })
);

// Worlds get big: same 20 GB ceiling as the archive upload route.
const MAX_WORLD_DOWNLOAD_BYTES = 20 * 1024 ** 3;

// Save a CurseForge world straight into the library (download + import).
// Downloading then importing a big archive takes minutes, so this runs as a
// task like the other world imports. Names no existing world: the result lands
// in the shared library.
router.post(
  '/discover-save',
  asyncHandler(async (req, res, next) => {
    const { modId, fileId, name } = z
      .object({
        modId: z.coerce.number().int().positive(),
        fileId: z.coerce.number().int().positive().optional(),
        name: z.string().trim().max(120).optional(),
      })
      .parse(req.body);
    const actor = actorOf(req);
    const tasks = require('../../services/tasks');
    const taskId = tasks.run('Saving a world to the library…', { actor }, async (t) => {
      const curseforge = require('../../services/curseforgeApi');
      t.step('Finding the download…');
      const files = await curseforge.getWorldFiles(modId);
      const file = fileId ? files.find((f) => f.fileId === fileId) : files[0];
      if (!file) throw httpError(404, 'No downloadable file found for that world.');
      if (!file.downloadUrl) throw httpError(409, 'The author disallows automated downloads for that world.');
      t.step(`Downloading ${file.fileName}…`);
      const { safeFetch } = require('../../utils/urlGuard');
      const fs = require('node:fs');
      const { pipeline } = require('node:stream/promises');
      const { nanoid } = require('nanoid');
      const tmp = dataPath('tmp', `world-discover-${nanoid(6)}.zip`);
      const dl = await safeFetch(file.downloadUrl, {
        headers: { 'User-Agent': 'MinecraftServerManager/0.1' },
        signal: AbortSignal.timeout(30 * 60 * 1000),
      });
      if (!dl.ok) throw httpError(502, `Download failed: HTTP ${dl.status}.`);
      const totalBytes = Number(dl.headers.get('content-length')) || 0;
      if (totalBytes > MAX_WORLD_DOWNLOAD_BYTES) throw httpError(413, 'That world archive is over the 20 GB limit.');
      if (totalBytes > 0) {
        const { free } = await require('../../storage/indexer').diskFree();
        if (free < totalBytes * 1.2) throw httpError(507, 'Not enough disk space for this download.');
      }
      let received = 0;
      const counter = new (require('node:stream').Transform)({
        transform(chunk, enc, cb) {
          received += chunk.length;
          // Hard abort - content-length can lie or be absent entirely.
          if (received > MAX_WORLD_DOWNLOAD_BYTES)
            return cb(httpError(413, 'Download aborted: archive over the 20 GB limit.'));
          cb(null, chunk);
        },
      });
      try {
        await pipeline(dl.body, counter, fs.createWriteStream(tmp));
        t.step('Importing into the library…');
        const row = await worlds.importArchive(tmp, {
          name: name || '',
          originalName: file.fileName,
          actor,
          source: 'curseforge',
        });
        return { ok: true, world: libVM(row) };
      } finally {
        await fsp.rm(tmp, { force: true }).catch(onTempCleanupFailed);
      }
    });
    res.status(202).json({ ok: true, taskId });
  })
);

router.post('/upload', worldUploadPreflight, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw badRequest('Attach a world archive (zip, .mcworld, tar, or tar.gz).');
    const { name } = z.object({ name: z.string().trim().max(120).optional() }).parse(req.body || {});
    const row = await worlds.importArchive(req.file.path, {
      name,
      originalName: req.file.originalname,
      actor: actorOf(req),
    });
    res.status(201).json({ ok: true, world: libVM(row) });
  } catch (err) {
    if (req.file) await fsp.rm(req.file.path, { force: true }).catch(onTempCleanupFailed);
    next(err);
  }
});

router.post(
  '/extract',
  asyncHandler(async (req, res, next) => {
    const { serverId, name } = z
      .object({
        serverId: z.string().trim().min(1).max(40),
        name: z.string().trim().max(120).optional(),
      })
      .parse(req.body);
    requireContentOn(req, serverId);
    const row = await worlds.extractFromServer(serverId, { name, actor: actorOf(req) });
    res.status(201).json({ ok: true, world: libVM(row) });
  })
);

router.post(
  '/:id/install',
  asyncHandler(async (req, res, next) => {
    const { serverId, mode, newName, confirm } = z
      .object({
        serverId: z.string().trim().min(1).max(40),
        mode: modeSchema.default('replace'),
        newName: worldNameSchema.optional(),
        confirm: z.coerce.boolean().optional(),
      })
      .parse(req.body);

    // Compat check first: warnings block the install until confirmed.
    requireContentOn(req, serverId);
    const warnings = worlds.installWarnings(req.params.id, serverId);
    if (warnings.length && !confirm) {
      return res.json({ ok: true, requiresConfirm: true, warnings });
    }
    const result = await worlds.installToServer(req.params.id, serverId, { mode, newName, actor: actorOf(req) });
    res.json({ ok: true, ...result });
  })
);

router.get(
  '/:id/download',
  asyncHandler((req, res, next) => {
    const lib = db.get("SELECT * FROM library_files WHERE id = ? AND category = 'world'", req.params.id);
    if (!lib) throw notFound('World not found in the library');
    res.download(dataPath(lib.rel_path), lib.filename.endsWith('.zip') ? lib.filename : `${lib.filename}.zip`);
  })
);

// Rename a library world (display name only - the archive is untouched).
router.patch(
  '/:id',
  asyncHandler((req, res, next) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(req.body);
    const lib = db.get("SELECT * FROM library_files WHERE id = ? AND category = 'world'", req.params.id);
    if (!lib) throw notFound('World not found in the library');
    db.run('UPDATE library_files SET name = ? WHERE id = ?', name, lib.id);
    require('../../events').recordEvent({
      actor: actorOf(req),
      type: 'world-renamed',
      summary: `Library world renamed: "${lib.name}" → "${name}".`,
      details: { libraryId: lib.id },
    });
    res.json({ ok: true, world: { id: lib.id, name } });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, ...(await worlds.deleteLibraryWorld(req.params.id, { actor: actorOf(req) })) });
  })
);

// ---------------------------------------------------------------------------
// Per-server router (/api/servers/:id/worlds)

const serverWorlds = express.Router({ mergeParams: true });

serverWorlds.get(
  '/',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, worlds: await worlds.listServerWorlds(req.params.id) });
  })
);

serverWorlds.post(
  '/copy-to',
  asyncHandler(async (req, res, next) => {
    const { targetServerId, mode, newName, confirm } = z
      .object({
        targetServerId: z.string().trim().min(1).max(40),
        mode: modeSchema.default('replace'),
        newName: worldNameSchema.optional(),
        confirm: z.coerce.boolean().optional(),
      })
      .parse(req.body);

    requireContentOn(req, targetServerId);
    const warnings = worlds.copyWarnings(req.params.id, targetServerId);
    if (warnings.length && !confirm) {
      return res.json({ ok: true, requiresConfirm: true, warnings });
    }
    const result = await worlds.copyBetweenServers(req.params.id, targetServerId, {
      mode,
      newName,
      actor: actorOf(req),
    });
    res.json({
      ok: true,
      installedAs: result.installedAs,
      mode: result.mode,
      sizeBytes: result.sizeBytes,
      warnings: result.warnings,
    });
  })
);

serverWorlds.post(
  '/duplicate',
  asyncHandler(async (req, res, next) => {
    const { world } = z.object({ world: worldNameSchema }).parse(req.body);
    res.json({ ok: true, ...(await worlds.duplicateWorld(req.params.id, world, { actor: actorOf(req) })) });
  })
);

serverWorlds.post(
  '/rename',
  asyncHandler(async (req, res, next) => {
    const { world, newName } = z.object({ world: worldNameSchema, newName: worldNameSchema }).parse(req.body);
    res.json({ ok: true, ...(await worlds.renameWorld(req.params.id, world, newName, { actor: actorOf(req) })) });
  })
);

serverWorlds.post(
  '/reset',
  asyncHandler(async (req, res, next) => {
    const opts = z
      .object({
        seedMode: z.enum(['keep', 'random', 'custom']).default('random'),
        seed: z.string().trim().max(200).optional(),
        levelType: z.enum(['DEFAULT', 'FLAT', 'LARGEBIOMES', 'AMPLIFIED']).optional(),
        backup: z.coerce.boolean().default(true),
      })
      .parse(req.body);
    res.json({ ok: true, ...(await worlds.resetWorld(req.params.id, { ...opts, actor: actorOf(req) })) });
  })
);

serverWorlds.post(
  '/activate',
  asyncHandler(async (req, res, next) => {
    const { world } = z.object({ world: worldNameSchema }).parse(req.body);
    res.json({ ok: true, ...(await worlds.activateWorld(req.params.id, world, { actor: actorOf(req) })) });
  })
);

// Staging a consistent world snapshot (save-off / copy / save-on, then a zip in
// data/tmp) is real work - keep it off the viewer role even though it's a GET.
serverWorlds.get(
  '/:world/download',
  require('../middleware/serverAccess').requireCap('content'),
  rejectCrossSiteGet,
  asyncHandler(async (req, res, next) => {
    const world = worldNameSchema.parse(req.params.world);
    const staged = await worlds.prepareWorldDownload(req.params.id, world, { actor: actorOf(req) });
    res.download(staged.absPath, staged.filename, () => {
      fsp.rm(staged.absPath, { force: true }).catch(onTempCleanupFailed);
    });
  })
);

serverWorlds.delete(
  '/:world',
  asyncHandler(async (req, res, next) => {
    const world = worldNameSchema.parse(req.params.world);
    res.json({ ok: true, ...(await worlds.deleteServerWorld(req.params.id, world, { actor: actorOf(req) })) });
  })
);

// ---------------------------------------------------------------------------

function libVM(row) {
  return {
    id: row.id,
    name: row.name,
    filename: row.filename,
    size: row.size_bytes,
    flavor: row.world_flavor,
    mcVersion: row.version,
    source: row.world_source,
    created: row.created_at,
  };
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

// JSON error handlers (same contract as /api): friendly zod messages + status.
for (const r of [router, serverWorlds]) {
  r.use(makeJsonErrorHandler('worlds', { fileTooLarge: 'That archive is too large (20 GB limit).' }));
}

router.serverWorlds = serverWorlds;
module.exports = router;
