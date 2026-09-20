'use strict';

// Blueprint API. Mounted at /api/blueprints.
// Upload flow: POST /import-preview with multipart file → validation + preview
// + an uploadToken (the tmp filename); POST /import with that token (or a
// library blueprintId) creates the server.

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { nanoid } = require('nanoid');
const blueprints = require('../../blueprints');
const permissions = require('../../services/permissions');
const httpError = require('../../utils/httpError');
const { dataPath } = require('../../storage/pathGuard');
const { dockerOverridesSchema, requireAdminForOverrides } = require('./dockerOverridesSchema');
const logger = require('../../logger')('blueprints');
const { serializeError } = require('../../utils/logSanitize');

const onTempCleanupFailed = (err) =>
  logger.debug('Could not remove a temporary file.', { err: serializeError(err, { includeStack: false }) });

const router = express.Router();

fs.mkdirSync(dataPath('tmp'), { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dataPath('tmp')),
    filename: (req, file, cb) => cb(null, `bpup-${nanoid(10)}.mcserver.zip`),
  }),
  limits: { fileSize: 8 * 1024 ** 3 },
});

const uploadTokenSchema = z.string().regex(/^bpup-[A-Za-z0-9_-]{10}\.mcserver\.zip$/, 'Invalid upload token');

// Cleared cpus/diskQuotaGb inputs mean "leave the blueprint's value" rather
// than a silent 0 (quota off / unlimited cpu). See src/web/routes/api.js.
const optNum0 = (max) =>
  z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => (typeof v === 'string' ? v.trim() : v))
    .transform((v) => (v === '' || v === null ? undefined : Number(v)))
    .refine(
      (v) => v === undefined || (Number.isFinite(v) && v >= 0 && v <= max),
      `Expected a number between 0 and ${max}`
    )
    .optional();

const overridesSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(4000).optional(),
  icon: z.string().max(64).optional(),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(16).optional(),
  mcVersion: z.string().trim().max(32).optional(),
  heapMb: z.coerce.number().int().min(512).max(262144).optional(),
  containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
  cpus: optNum0(128),
  diskQuotaGb: optNum0(16384),
  ...dockerOverridesSchema,
});

router.get(
  '/',
  asyncHandler((req, res, next) => {
    res.json({ ok: true, blueprints: blueprints.listBlueprintsFor(req.user).map(publicBlueprint) });
  })
);

// A blueprint addressed by id is "not found" when its source server is hidden
// from the caller, the same answer the list and download give.
function requireVisibleBlueprint(req, id) {
  const row = blueprints.getBlueprint(id);
  if (row && !blueprints.blueprintVisibleTo(req.user, row)) {
    throw httpError(404, 'Blueprint not found');
  }
}

// Exporting or cloning reads the whole server tree (server.properties included),
// so it needs the `files` capability on the source; a hidden server reads as missing.
function requireFilesOn(req, serverId) {
  const perms = permissions.effective(req.user, serverId);
  if (!perms.includes('view')) throw httpError(404, 'Server not found');
  if (!perms.includes('files')) throw httpError(403, "You don't have the files permission on this server.");
}

router.post(
  '/export',
  asyncHandler(async (req, res, next) => {
    const input = z
      .object({
        serverId: z.string().trim().min(1).max(40),
        includeConfig: z.coerce.boolean().optional(),
        embedFiles: z.coerce.boolean().optional(),
        includeWorld: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    requireFilesOn(req, input.serverId);
    const row = await blueprints.exportBlueprint(
      input.serverId,
      { includeConfig: input.includeConfig !== false, embedFiles: input.embedFiles, includeWorld: input.includeWorld },
      { actor: req.user.username }
    );
    res.status(201).json({ ok: true, blueprint: publicBlueprint(blueprints.getBlueprint(row.id)) });
  })
);

// Multipart upload (field 'file') OR JSON { blueprintId } to preview a library entry.
router.post(
  '/import-preview',
  upload.single('file'),
  asyncHandler(async (req, res, next) => {
    if (req.file) {
      let preview;
      try {
        preview = await blueprints.importPreview(req.file.path);
      } catch (err) {
        await fsp.rm(req.file.path, { force: true }).catch(onTempCleanupFailed);
        throw err;
      }
      return res.json({ ok: true, preview, uploadToken: req.file.filename });
    }
    const { blueprintId } = z.object({ blueprintId: z.string().trim().min(1).max(40) }).parse(req.body || {});
    requireVisibleBlueprint(req, blueprintId);
    const preview = await blueprints.importPreview(blueprints.getBlueprintPath(blueprintId));
    res.json({ ok: true, preview, blueprintId });
  })
);

router.post(
  '/import',
  asyncHandler(async (req, res, next) => {
    const input = z
      .object({
        blueprintId: z.string().trim().min(1).max(40).optional(),
        uploadToken: uploadTokenSchema.optional(),
        overrides: overridesSchema.optional(),
      })
      .refine((v) => Boolean(v.blueprintId) !== Boolean(v.uploadToken), {
        message: 'Provide exactly one of blueprintId or uploadToken',
      })
      .parse(req.body);

    let zipRef = input.blueprintId;
    if (input.blueprintId) requireVisibleBlueprint(req, input.blueprintId);
    if (input.uploadToken) {
      zipRef = dataPath('tmp', input.uploadToken);
      if (!fs.existsSync(zipRef)) {
        return res.status(404).json({ ok: false, error: 'The uploaded blueprint expired. Upload it again.' });
      }
    }
    if (input.overrides) requireAdminForOverrides(req, input.overrides);
    const { server, report } = await blueprints.importBlueprint(zipRef, input.overrides || {}, {
      actor: req.user.username,
    });
    if (input.uploadToken) await fsp.rm(zipRef, { force: true }).catch(onTempCleanupFailed);
    res.status(201).json({ ok: true, server: publicServer(server), report });
  })
);

router.post(
  '/clone',
  asyncHandler(async (req, res, next) => {
    const input = z
      .object({
        serverId: z.string().trim().min(1).max(40),
        includeWorld: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    requireFilesOn(req, input.serverId);
    const { server, report, blueprint } = await blueprints.cloneServer(input.serverId, {
      includeWorld: input.includeWorld,
      actor: req.user.username,
    });
    res.status(201).json({
      ok: true,
      server: publicServer(server),
      report,
      blueprint: publicBlueprint(blueprints.getBlueprint(blueprint.id)),
    });
  })
);

router.get(
  '/:id/download',
  asyncHandler((req, res, next) => {
    const row = blueprints.getBlueprint(req.params.id);
    if (!row || !blueprints.blueprintVisibleTo(req.user, row)) {
      return res.status(404).json({ ok: false, error: 'Blueprint not found' });
    }
    res.download(dataPath(row.rel_path), row.filename);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res, next) => {
    requireVisibleBlueprint(req, req.params.id);
    res.json({ ok: true, ...(await blueprints.deleteBlueprint(req.params.id, { actor: req.user.username })) });
  })
);

function publicBlueprint(b) {
  if (!b) return null;
  const { manifest_json, manifest, ...rest } = b;
  return rest;
}

function publicServer(s) {
  if (!s) return null;
  return { id: s.id, name: s.display_name, type: s.type, mcVersion: s.mc_version, portGame: s.port_game };
}

// JSON error handler for this subtree (mirrors routes/api.js).
router.use(makeJsonErrorHandler('blueprints', { fileTooLarge: 'That upload is too large.' }));

module.exports = router;
