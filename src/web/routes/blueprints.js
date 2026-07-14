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
const { dataPath } = require('../../storage/pathGuard');

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
  cpus: z.coerce.number().min(0).max(128).optional(),
  diskQuotaGb: z.coerce.number().min(0).max(16384).optional(),
});

router.get(
  '/',
  asyncHandler((req, res, next) => {
    res.json({ ok: true, blueprints: blueprints.listBlueprints().map(publicBlueprint) });
  })
);

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
        await fsp.rm(req.file.path, { force: true }).catch(() => {});
        throw err;
      }
      return res.json({ ok: true, preview, uploadToken: req.file.filename });
    }
    const { blueprintId } = z.object({ blueprintId: z.string().trim().min(1).max(40) }).parse(req.body || {});
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
    if (input.uploadToken) {
      zipRef = dataPath('tmp', input.uploadToken);
      if (!fs.existsSync(zipRef)) {
        return res.status(404).json({ ok: false, error: 'Uploaded blueprint expired — upload it again' });
      }
    }
    const { server, report } = await blueprints.importBlueprint(zipRef, input.overrides || {}, {
      actor: req.user.username,
    });
    if (input.uploadToken) await fsp.rm(zipRef, { force: true }).catch(() => {});
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
    if (!row) return res.status(404).json({ ok: false, error: 'Blueprint not found' });
    res.download(dataPath(row.rel_path), row.filename);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res, next) => {
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
router.use(makeJsonErrorHandler('blueprints', { fileTooLarge: 'Upload is too large' }));

module.exports = router;
