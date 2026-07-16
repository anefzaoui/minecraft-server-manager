// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// JSON API consumed by the panel's own frontend.

const asyncHandler = require('../middleware/asyncHandler');
const { makeJsonErrorHandler } = require('../middleware/jsonErrorHandler');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const servers = require('../../services/servers');
const ports = require('../../services/ports');
const mojang = require('../../services/mojang');
const tasks = require('../../services/tasks');
const db = require('../../db');
const eventsService = require('../../events');
const { dataPath } = require('../../storage/pathGuard');
const { checkDocker } = require('../../docker/connect');
const { fetchLogs } = require('../../docker/logs');
const { statsOnce } = require('../../docker/stats');

const router = express.Router();

// Valid server TYPE values, derived from the field catalog so this stays in sync
// with the wizard. An unknown type would create a container that only fails later
// at start with no useful feedback.
const SERVER_TYPES = require('../../config/field-catalog/general')
  .find((f) => f.key === 'TYPE')
  .options.map((o) => o.value);

/** Load a server row or throw a JSON-friendly 404. */
function requireServer(id) {
  const server = servers.getServer(id);
  if (!server) {
    const err = new Error('Server not found');
    err.status = 404;
    throw err;
  }
  return server;
}

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(4000).optional(),
    icon: z.string().max(64).optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(16).optional(),
    type: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .refine((v) => SERVER_TYPES.includes(v), { message: 'Unknown server type' }),
    mcVersion: z.string().trim().max(32).optional(),
    javaTag: z.string().max(16).optional(),
    env: z.record(z.string(), z.string()).optional(),
    portGame: z.coerce.number().int().min(1024).max(65535).optional(),
    portRcon: z.coerce.number().int().min(1024).max(65535).optional(),
    portBedrock: z.coerce.number().int().min(1024).max(65535).optional(),
    withBedrock: z.coerce.boolean().optional(),
    heapMb: z.coerce.number().int().min(512).max(262144).optional(),
    containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
    cpus: z.coerce.number().min(0).max(128).optional(),
    diskQuotaGb: z.coerce.number().min(0).max(16384).optional(),
    updatePolicy: z.enum(['manual', 'notify', 'auto']).optional(),
    autoStart: z.coerce.boolean().optional(),
    start: z.coerce.boolean().optional(),
  })
  .refine((v) => !v.containerMemoryMb || !v.heapMb || v.containerMemoryMb > v.heapMb, {
    message: 'Container memory limit must be higher than the Java heap (or the JVM will be OOM-killed)',
  });

router.post(
  '/servers',
  asyncHandler(async (req, res, next) => {
    const input = createSchema.parse(req.body);
    const server = await servers.createServer(input, { actor: req.user.username, start: input.start !== false });
    res.status(201).json({ ok: true, server: publicServer(server) });
  })
);

for (const action of ['start', 'stop', 'restart', 'kill', 'recreate']) {
  router.post(
    `/servers/:id/${action}`,
    asyncHandler(async (req, res, next) => {
      await servers[`${action}Server`](req.params.id, { actor: req.user.username });
      res.json({ ok: true, server: publicServer(servers.getServer(req.params.id)) });
    })
  );
}

router.patch(
  '/servers/:id',
  asyncHandler(async (req, res, next) => {
    const changes = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        description: z.string().max(4000).optional(),
        icon: z.string().max(64).optional(),
        accent: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        tags: z.array(z.string().trim().min(1).max(24)).max(16).optional(),
        notes: z.string().max(8000).optional(),
        mcVersion: z.string().trim().max(32).optional(),
        javaTag: z.string().max(16).optional(),
        heapMb: z.coerce.number().int().min(512).max(262144).optional(),
        containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
        cpus: z.coerce.number().min(0).max(128).optional(),
        diskQuotaGb: z.coerce.number().min(0).max(16384).optional(),
        quotaStrict: z.coerce.boolean().optional(),
        updatePolicy: z.enum(['manual', 'notify', 'auto']).optional(),
        autoStart: z.coerce.boolean().optional(),
        autoRestart: z.coerce.boolean().optional(),
        env: z.record(z.string(), z.string()).optional(),
      })
      .refine((v) => !v.containerMemoryMb || !v.heapMb || v.containerMemoryMb > v.heapMb, {
        message: 'Container memory limit must be higher than the Java heap',
      })
      .parse(req.body);
    const { server, needsRecreate } = servers.updateServer(req.params.id, changes, { actor: req.user.username });
    res.json({ ok: true, needsRecreate, server: publicServer(server) });
  })
);

router.delete(
  '/servers/:id',
  asyncHandler(async (req, res, next) => {
    const { freedBytes } = await servers.deleteServer(req.params.id, {
      actor: req.user.username,
      keepWorld: req.query.keepWorld === 'true',
    });
    res.json({ ok: true, freedBytes });
  })
);

router.get(
  '/servers/:id/logs',
  asyncHandler(async (req, res, next) => {
    const tail = Math.max(1, Math.min(Number(req.query.tail) || 500, 5000));
    res.type('text/plain').send(await fetchLogs(req.params.id, { tail }));
  })
);

// Per-server label for panel-run console actions (announced in-game). Empty clears it.
router.put(
  '/servers/:id/console-label',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    const { label } = z.object({ label: z.string().max(48).optional() }).parse(req.body);
    res.json({ ok: true, label: servers.setConsoleLabel(req.params.id, label) });
  })
);

router.get(
  '/servers/:id/stats',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, stats: await statsOnce(req.params.id) });
  })
);

// Batched live data for client-side hydration (dashboard cards, headers).
router.get('/servers/live', (req, res) => {
  const liveCache = require('../../services/liveCache');
  const all = liveCache.getAll();
  const out = {};
  for (const [id, e] of Object.entries(all)) {
    out[id] = {
      cpuPct: e.stats ? e.stats.cpuPct : null,
      memUsedMb: e.stats ? Math.round(e.stats.memUsedBytes / 1024 / 1024) : null,
      players: e.players ? { online: e.players.online, max: e.players.max, names: e.players.names } : null,
      startedAt: e.startedAt,
      phase: e.phase ? e.phase.label : null,
    };
  }
  res.json({ ok: true, servers: out });
});

router.get(
  '/ports/check',
  asyncHandler(async (req, res, next) => {
    const port = Number(req.query.port);
    if (!Number.isInteger(port)) return res.status(400).json({ ok: false, error: 'port required' });
    res.json({ ok: true, port, free: await ports.isPortFree(port) });
  })
);

router.get(
  '/ports/suggest',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, ports: await ports.suggestPorts({ withBedrock: req.query.bedrock === 'true' }) });
  })
);

router.get(
  '/versions',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, versions: await mojang.listVersions({ includeSnapshots: req.query.snapshots === 'true' }) });
  })
);

router.get('/docker/status', async (req, res, next) => {
  try {
    res.json({ ok: true, docker: await checkDocker() });
  } catch (err) {
    next(err); // a rejected checkDocker() must not hang the request (Express 4)
  }
});

// ---- API keys (Settings page) — admin only ----
const apiKeys = require('../../services/apiKeys');
const { requireRole: requireRoleKeys } = require('../middleware/auth');

router.get('/keys', (req, res) => {
  res.json({ ok: true, curseforge: { masked: apiKeys.maskedKey('curseforge') } });
});

router.post(
  '/keys/curseforge',
  requireRoleKeys('admin'),
  asyncHandler(async (req, res, next) => {
    const { key } = z.object({ key: z.string().trim().min(10).max(200) }).parse(req.body);
    const test = await apiKeys.testCurseForgeKey(key);
    if (!test.ok) return res.status(400).json({ ok: false, error: test.error });
    apiKeys.setKey('curseforge', key, { actor: req.user.username });
    res.json({ ok: true });
  })
);

router.post(
  '/keys/curseforge/test',
  requireRoleKeys('admin'),
  asyncHandler(async (req, res, next) => {
    res.json(await apiKeys.testCurseForgeKey());
  })
);

// ---- Panel settings (public domain, shown instead of the LAN IP) ----
const settingsService = require('../../services/settings');

router.get('/settings', (req, res) => {
  res.json({
    ok: true,
    publicHost: settingsService.getPublicHost(),
    curseforge: { masked: apiKeys.maskedKey('curseforge') },
  });
});

router.post(
  '/settings',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    const { publicHost } = z.object({ publicHost: z.string().max(255).optional() }).parse(req.body);
    const saved = settingsService.setPublicHost(publicHost || '');
    res.json({ ok: true, publicHost: saved });
  })
);

// ---- Localization: timezone + country (auto-detected from the host by default) ----
router.get('/settings/localization', (req, res) => {
  res.json({ ok: true, localization: settingsService.localization() });
});

router.post(
  '/settings/localization',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    const { timezone, country } = z
      .object({
        timezone: z.string().max(64).optional(),
        country: z.string().max(8).optional(),
      })
      .parse(req.body);
    if (timezone !== undefined) settingsService.setTimezone(timezone);
    if (country !== undefined) settingsService.setCountry(country);
    res.json({ ok: true, localization: settingsService.localization() });
  })
);

// ---- Modpacks: resolve/preview, install (always pinned), upgrade, rollback ----
const packs = require('../../services/packs');
const upgrade = require('../../updates/upgrade');
const checker = require('../../updates/checker');
const backups = require('../../services/backups');

router.post(
  '/packs/resolve',
  asyncHandler(async (req, res, next) => {
    const { platform, ref, versionId, mcVersion } = z
      .object({
        platform: z.enum(['curseforge', 'modrinth', 'ftb']),
        ref: z.string().trim().min(1).max(400),
        versionId: z.string().trim().max(60).optional(),
        mcVersion: z.string().trim().max(32).optional(),
      })
      .parse(req.body);
    res.json({ ok: true, pack: await packs.resolvePack(platform, ref, { versionId, mcVersion }) });
  })
);

router.post('/servers/:id/pack', async (req, res, next) => {
  try {
    const { platform, ref, versionId, force } = z
      .object({
        platform: z.enum(['curseforge', 'modrinth', 'ftb']),
        ref: z.string().trim().min(1).max(400),
        versionId: z.string().trim().max(60).optional(),
        force: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    const resolved = await packs.resolvePack(platform, ref, { versionId });
    await packs.applyPack(req.params.id, resolved, { actor: req.user.username, force });
    res.json({ ok: true, pack: resolved, note: 'Applied — recreate/restart to install' });
  } catch (err) {
    if (err.requiresForce) {
      return res.status(409).json({ ok: false, error: err.message, requiresForce: true, warnings: err.warnings });
    }
    next(err);
  }
});

const UPGRADE_STEP_LABELS = {
  resolving: 'Resolving target version',
  'backing-up': 'Creating pre-update backup',
  stopping: 'Stopping server',
  applying: 'Re-pinning pack version',
  recreating: 'Recreating container',
  monitoring: 'Starting & monitoring (up to 10 min)',
  overlay: 'Re-applying custom overlay mods',
};

// Long operation — returns {ok, taskId}; poll /api/tasks/:id (client: runTask).
// On failure with a rollback path, the task RESOLVES with
// {ok:false, error, rollbackAvailable:true} so the client can offer rollback.
router.post(
  '/servers/:id/pack/upgrade',
  asyncHandler((req, res, next) => {
    const { versionId, skipBackup } = z
      .object({
        versionId: z.string().trim().max(60).optional(),
        skipBackup: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const taskId = tasks.run(`Upgrading pack on ${server.display_name}`, { serverId: server.id, actor }, async (t) => {
      t.step(UPGRADE_STEP_LABELS.resolving);
      try {
        return await upgrade.upgradePack(server.id, {
          versionId,
          skipBackup,
          actor,
          onStep: (s) => t.step(UPGRADE_STEP_LABELS[s] || s),
        });
      } catch (err) {
        if (err.rollbackAvailable) {
          return { ok: false, error: err.message, rollbackAvailable: true };
        }
        throw err;
      }
    });
    res.status(202).json({ ok: true, taskId });
  })
);

// Long operation — returns {ok, taskId}. Without an explicit backupId the most
// recent pre-update backup for this server is restored alongside the re-pin.
router.post(
  '/servers/:id/pack/rollback',
  asyncHandler((req, res, next) => {
    const body = z.object({ backupId: z.string().trim().max(40).optional() }).parse(req.body);
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const backupId =
      body.backupId ||
      db.get(
        "SELECT id FROM backups WHERE server_id = ? AND reason = 'pre-update' ORDER BY created_at DESC LIMIT 1",
        server.id
      )?.id ||
      null;
    const taskId = tasks.run(
      `Rolling back pack on ${server.display_name}`,
      { serverId: server.id, actor },
      async (t) => {
        t.step(backupId ? 'Restoring pre-update backup & re-pinning' : 'Re-pinning previous version');
        return upgrade.rollbackPack(server.id, { backupId: backupId || undefined, actor });
      }
    );
    res.status(202).json({ ok: true, taskId });
  })
);

// ---- Pack browser — search, details, installed pack mods, one-shot create ----
const curseforgeApi = require('../../services/curseforgeApi');
const modrinthApi = require('../../services/modrinthApi');
const sanitizeHtml = require('sanitize-html');
const { marked } = require('marked');

/** Sanitize platform-provided pack descriptions (Modrinth markdown→HTML, CF raw HTML). */
function sanitizePackHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: [
      'p',
      'b',
      'strong',
      'i',
      'em',
      'u',
      's',
      'del',
      'code',
      'pre',
      'a',
      'ul',
      'ol',
      'li',
      'br',
      'hr',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'img',
      'span',
      'div',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'details',
      'summary',
      'center',
      'figure',
      'figcaption',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height'],
    },
    allowedSchemes: ['http', 'https'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener', target: '_blank' }) },
  });
}

// Search modpacks on Modrinth (no key) or CurseForge (needs the stored key).
router.get(
  '/packs/search',
  asyncHandler(async (req, res, next) => {
    const { q, platform } = z
      .object({
        q: z.string().trim().min(1).max(120),
        platform: z.enum(['modrinth', 'curseforge']).default('modrinth'),
      })
      .parse({ q: req.query.q, platform: req.query.platform || undefined });
    let results;
    if (platform === 'modrinth') {
      results = (await modrinthApi.search({ query: q, kind: 'modpack' })).map((h) => ({
        platform,
        ref: h.slug,
        name: h.title,
        iconUrl: h.iconUrl,
        downloads: h.downloads,
        description: h.description,
      }));
    } else {
      results = (await curseforgeApi.search({ query: q, kind: 'modpack' })).map((m) => ({
        platform,
        ref: m.slug,
        name: m.name,
        iconUrl: m.iconUrl,
        downloads: m.downloads,
        description: m.summary,
      }));
    }
    res.json({ ok: true, results });
  })
);

// Pack details for the shared details modal. Accepts platform+ref OR serverId
// (installed pack — platform/ref come from the server's pin, and the pinned
// version is echoed back so the UI can mark it).
router.get(
  '/packs/details',
  asyncHandler(async (req, res, next) => {
    const query = z
      .object({
        platform: z.enum(['curseforge', 'modrinth']).optional(),
        ref: z.string().trim().min(1).max(400).optional(),
        serverId: z.string().trim().max(40).optional(),
      })
      .refine((v) => Boolean(v.serverId) || (v.platform && v.ref), {
        message: 'Provide platform+ref or serverId',
      })
      .parse({
        platform: req.query.platform || undefined,
        ref: req.query.ref || undefined,
        serverId: req.query.serverId || undefined,
      });

    let { platform, ref } = query;
    let installed = null;
    if (query.serverId) {
      const server = requireServer(query.serverId);
      const pin = packs.getPack(server.id);
      if (!pin) throw Object.assign(new Error('This server has no managed modpack'), { status: 404 });
      if (pin.platform === 'ftb')
        throw Object.assign(new Error('FTB pack details are not supported yet'), { status: 400 });
      platform = pin.platform;
      ref = pin.project_ref;
      installed = {
        serverId: server.id,
        serverName: server.display_name,
        versionId: pin.pinned_version_id,
        versionName: pin.pinned_version_name,
      };
    }

    const resolved = await packs.resolvePack(platform, ref, {});
    let description = '';
    let downloads = null;
    let author = null;
    if (platform === 'modrinth') {
      const project = await modrinthApi.getProject(resolved.projectRef);
      downloads = project.downloads ?? null;
      description = sanitizePackHtml(marked.parse(String(project.body || ''), { async: false }));
    } else {
      const project = await curseforgeApi.getMod(Number(resolved.projectId));
      downloads = project.downloads ?? null;
      description = sanitizePackHtml(await curseforgeApi.getDescription(project.modId));
    }
    res.json({
      ok: true,
      pack: {
        platform,
        ref: resolved.projectRef,
        projectId: resolved.projectId,
        name: resolved.projectName,
        iconUrl: resolved.iconUrl || null,
        author,
        downloads,
        description,
        mcVersion: resolved.mcVersion || null,
        loaders: resolved.loaders || null,
        defaultVersionId: resolved.versionId,
        versions: resolved.allVersions || [],
        installed,
      },
    });
  })
);

// Pack-managed content of an installed pack (server_content rows managed_by
// 'pack' + on-disk scan), for the details modal's mod list.
router.get(
  '/servers/:id/pack/mods',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    const pin = packs.getPack(req.params.id);
    if (!pin) throw Object.assign(new Error('This server has no managed modpack'), { status: 404 });
    const all = await require('../../services/mods').listContent(req.params.id);
    const rows = all
      .filter((m) => m.source === 'pack')
      .map((m) => ({ name: m.name, file: m.file, kind: m.kind, version: m.version, size: m.size, enabled: m.enabled }));
    res.json({ ok: true, pack: { name: pin.project_name, version: pin.pinned_version_name }, mods: rows });
  })
);

const fromPackSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(4000).optional(),
    icon: z.string().max(64).optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    platform: z.enum(['curseforge', 'modrinth', 'ftb']),
    ref: z.string().trim().min(1).max(400),
    versionId: z.string().trim().max(60).optional(),
    heapMb: z.coerce.number().int().min(512).max(262144).optional(),
    containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
    diskQuotaGb: z.coerce.number().min(0).max(16384).optional(),
    portGame: z.coerce.number().int().min(1024).max(65535).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .refine((v) => !v.containerMemoryMb || !v.heapMb || v.containerMemoryMb > v.heapMb, {
    message: 'Container memory limit must be higher than the Java heap (or the JVM will be OOM-killed)',
  });

// One-shot "create server from modpack": resolve (pin) → create (image pull
// progress included) → apply pack → start, all inside ONE task so the wizard
// shows real progress end to end. Returns {ok, taskId}; task result {serverId}.
router.post(
  '/servers/from-pack',
  asyncHandler((req, res, next) => {
    const input = fromPackSchema.parse(req.body);
    const actor = req.user.username;
    const taskId = tasks.run(`Creating ${input.name} from a ${input.platform} pack`, { actor }, async (t) => {
      t.step('Resolving pack version (pinned — never "latest")');
      const resolved = await packs.resolvePack(input.platform, input.ref, { versionId: input.versionId });
      const type = packs.packEnv(resolved).TYPE;
      t.step('Creating server');
      const server = await servers.createServer(
        {
          name: input.name,
          description: input.description,
          icon: input.icon,
          accent: input.accent,
          type,
          mcVersion: resolved.mcVersion || 'LATEST',
          env: input.env || {},
          heapMb: input.heapMb,
          containerMemoryMb: input.containerMemoryMb,
          diskQuotaGb: input.diskQuotaGb,
          portGame: input.portGame,
        },
        { actor, start: false, onProgress: (s) => t.step(s) }
      );
      t.step(`Pinning ${resolved.projectName} @ ${resolved.versionName}`);
      // force: fresh server — there is no world yet to version-guard.
      await packs.applyPack(server.id, resolved, { actor, force: true });
      t.step('Starting server — the pack downloads and installs on first boot');
      await servers.startServer(server.id, { actor });
      return {
        serverId: server.id,
        name: server.display_name,
        pack: { name: resolved.projectName, version: resolved.versionName, mcVersion: resolved.mcVersion },
      };
    });
    res.status(202).json({ ok: true, taskId });
  })
);

// Long operation — returns {ok, taskId}; the task result is the findings array.
router.post(
  '/updates/check',
  asyncHandler((req, res, next) => {
    const actor = req.user.username;
    const taskId = tasks.run('Checking for updates', { actor }, async (t) => {
      t.step('Querying CurseForge, Modrinth and the registry');
      const findings = await checker.checkAll({ actor });
      return { findings };
    });
    res.status(202).json({ ok: true, taskId });
  })
);

// Per-server update-check trigger. The checker runs globally (checkAll);
// the task result is scoped to this server's findings.
router.post(
  '/servers/:id/updates/check',
  asyncHandler((req, res, next) => {
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const taskId = tasks.run(
      `Checking updates for ${server.display_name}`,
      { serverId: server.id, actor },
      async (t) => {
        t.step('Querying update sources');
        const findings = await checker.checkAll({ actor });
        return { findings: findings.filter((f) => f.server === server.display_name) };
      }
    );
    res.status(202).json({ ok: true, taskId });
  })
);

// ---- Schedules ----
const scheduler = require('../../services/scheduler');

// Validate a cron expression and preview the next 3 runs.
router.get('/schedules/preview', (req, res) => {
  const expr = String(req.query.cron || '').trim();
  try {
    if (!expr) throw new Error('Empty expression');
    const { Cron } = require('croner');
    const runs = new Cron(expr).nextRuns(3).map((d) => d.toISOString());
    res.json({ ok: true, cron: expr, runs });
  } catch (err) {
    res.status(400).json({ ok: false, error: `Invalid cron expression: ${err.message}` });
  }
});

router.post(
  '/schedules',
  asyncHandler((req, res, next) => {
    const input = z
      .object({
        serverId: z.string().trim().max(40).nullable().optional(),
        taskType: z.string().trim().min(2).max(30),
        cron: z.string().trim().min(5).max(60),
        payload: z.record(z.string(), z.any()).optional(),
        enabled: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    res.status(201).json({
      ok: true,
      schedule: scheduler.createSchedule(
        {
          serverId: input.serverId || null,
          taskType: input.taskType,
          cron: input.cron,
          payload: input.payload,
          enabled: input.enabled !== false,
        },
        { actor: req.user.username }
      ),
    });
  })
);

router.post(
  '/schedules/:id/toggle',
  asyncHandler((req, res, next) => {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    scheduler.setEnabled(req.params.id, enabled, { actor: req.user.username });
    res.json({ ok: true });
  })
);

router.delete(
  '/schedules/:id',
  asyncHandler((req, res, next) => {
    scheduler.deleteSchedule(req.params.id, { actor: req.user.username });
    res.json({ ok: true });
  })
);

// ---- Storage ----
const indexer = require('../../storage/indexer');
const storageCleanup = require('./storageCleanup');

router.post(
  '/storage/scan',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, ...(await indexer.scan()) });
  })
);

// One-click cleanup. dryRun:true previews (nothing deleted) — the Storage
// page uses it to show real numbers before the confirm dialog.
router.post(
  '/storage/cleanup',
  requireRoleKeys('admin'),
  asyncHandler(async (req, res, next) => {
    const { action, olderThanDays, dryRun } = z
      .object({
        action: z.enum(['tmp', 'orphans', 'old-logs', 'old-crashes']),
        olderThanDays: z.coerce.number().int().min(1).max(3650).optional(),
        dryRun: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    const result = await storageCleanup.runCleanup(action, {
      olderThanDays,
      dryRun: Boolean(dryRun),
      actor: req.user.username,
    });
    res.json({ ok: true, dryRun: Boolean(dryRun), ...result });
  })
);

// ---- Backups ----
// Long operation — returns {ok, taskId}; task result: {id, filename, size}.
router.post(
  '/servers/:id/backups',
  asyncHandler((req, res, next) => {
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const note = String(req.body?.note || '');
    const taskId = tasks.run(`Backing up ${server.display_name}`, { serverId: server.id, actor }, async (t) => {
      t.step('Snapshotting server directory (save-off → save-all → zip → save-on)');
      const backup = await backups.createBackup(server.id, { reason: 'manual', actor, note });
      return { id: backup.id, filename: backup.filename, size: backup.size_bytes };
    });
    res.status(202).json({ ok: true, taskId });
  })
);

// Long operation — returns {ok, taskId}. Stops the server, takes a safety
// backup, wipes the dir and extracts the archive.
router.post(
  '/servers/:id/backups/:backupId/restore',
  asyncHandler((req, res, next) => {
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const backupId = req.params.backupId;
    const taskId = tasks.run(
      `Restoring backup on ${server.display_name}`,
      { serverId: server.id, actor },
      async (t) => {
        t.step('Stopping server & taking a safety backup');
        await backups.restoreBackup(server.id, backupId, { actor });
        return { ok: true };
      }
    );
    res.status(202).json({ ok: true, taskId });
  })
);

// Download a backup archive. Admin/operator only — the archive contains the
// whole server dir, including server.properties (plaintext rcon.password), so a
// read-only viewer must never be able to pull it.
router.get(
  '/backups/:backupId/download',
  requireRoleKeys('admin', 'operator'),
  asyncHandler((req, res, next) => {
    const backup = db.get('SELECT * FROM backups WHERE id = ?', req.params.backupId);
    if (!backup) throw Object.assign(new Error('Backup not found'), { status: 404 });
    const abs = dataPath(backup.rel_path);
    if (!fs.existsSync(abs)) throw Object.assign(new Error('Backup archive is missing on disk'), { status: 404 });
    res.download(abs, backup.filename);
  })
);

router.delete(
  '/backups/:backupId',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, ...(await backups.deleteBackup(req.params.backupId, { actor: req.user.username })) });
  })
);

// ---- Blueprints ----
router.use('/blueprints', require('./blueprints'));

// ---- World quick controls (Overview tab) — version-tolerant service ----
const worldControls = require('../../services/worldControls');

router.get(
  '/servers/:id/world/state',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    try {
      res.json({ ok: true, running: true, state: await worldControls.getState(req.params.id) });
    } catch {
      res.json({ ok: true, running: false, state: {} });
    }
  })
);

router.post(
  '/servers/:id/world/quick',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    const { action } = z.object({ action: z.enum(Object.keys(worldControls.QUICK_ACTIONS)) }).parse(req.body);
    const result = await worldControls.runQuick(req.params.id, action, { actor: req.user.username });
    res.json({ ok: true, ...result });
  })
);

// ---- Admin chat (tellraw / say over RCON) ----
const chat = require('../../services/chat');

router.post(
  '/servers/:id/chat',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    const body = z
      .object({
        mode: z.enum(['tellraw', 'say']).default('tellraw'),
        target: z.string().trim().max(32).default('@a'),
        text: z.string().min(1).max(512),
        color: z.string().trim().max(20).optional(),
        bold: z.coerce.boolean().optional(),
        italic: z.coerce.boolean().optional(),
        underlined: z.coerce.boolean().optional(),
        strikethrough: z.coerce.boolean().optional(),
        obfuscated: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    const result = await chat.sendChat(req.params.id, { ...body, actor: req.user.username });
    res.status(201).json({ ok: true, ...result });
  })
);

// ---- Live map (BlueMap) ----
const mapService = require('../../services/map');

router.post(
  '/servers/:id/map/enable',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, ...(await mapService.enableMap(req.params.id, { actor: req.user.username })) });
  })
);

router.post(
  '/servers/:id/map/disable',
  asyncHandler(async (req, res, next) => {
    await mapService.disableMap(req.params.id, { actor: req.user.username });
    res.json({ ok: true });
  })
);

// ---- Worlds & files ----
router.use('/worlds', require('./worlds'));
router.use('/servers/:id/worlds', require('./worlds').serverWorlds);
// Admin/operator only: read/download expose raw server files (server.properties
// carries the plaintext rcon.password), so viewers are kept out of the whole tree
// rather than relying on requireWrite, which only blocks their non-GET requests.
router.use('/servers/:id/files', requireRoleKeys('admin', 'operator'), require('./files').serverFiles);
router.use('/files', require('../middleware/auth').requireRole('admin'), require('./files').globalFiles);

// ---- Crash reports ----
router.use('/servers/:id/crashes', require('./crashes'));

// ---- Player god-mode ----
router.use('/servers/:id/players', require('./players'));

// ---- Custom chat commands (!rtp2 …) ----
router.use('/servers/:id/chat-commands', require('./chatCommands'));

// ---- Integrations (Discord, invites, status page) ----
router.use('/servers/:id/integrations', require('./integrations'));

// ---- Analytics & activity timeline ----
router.use('/servers/:id/analytics', require('./analytics'));

// ---- Inventory forensics ----
router.use('/servers/:id/inventory', require('./inventory'));
router.use('/inventory', require('./inventory').globalSearch);

// ---- Item registry (JEI-style browser, built from the server's own jars) ----
router.use('/servers/:id/items', require('./items'));

// ---- Mods manager ----
const mods = require('../../services/mods');

router.get(
  '/servers/:id/mods',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, mods: await mods.listContent(req.params.id) });
  })
);

router.post(
  '/servers/:id/mods',
  asyncHandler(async (req, res, next) => {
    const { url, kind } = z
      .object({
        url: z.string().trim().min(3).max(500),
        kind: z.enum(['mod', 'plugin', 'datapack', 'resourcepack']).optional(),
      })
      .parse(req.body);
    const result = await mods.installFromUrl(req.params.id, url, { actor: req.user.username, kind });
    res.status(201).json({
      ok: true,
      installed: { name: result.library.name, filename: result.filename, version: result.library.version },
    });
  })
);

// Update one overlay mod to its latest checked version. Accepts the
// installed filename ({file}) or the server_content row id ({contentId}).
// Re-downloads through the platform (pinned to the checked version id),
// replaces the old file and preserves the enabled/disabled state.
router.post(
  '/servers/:id/mods/update',
  asyncHandler(async (req, res, next) => {
    const { file, contentId } = z
      .object({
        file: z.string().min(1).max(200).optional(),
        contentId: z.string().trim().max(40).optional(),
      })
      .refine((v) => Boolean(v.file) || Boolean(v.contentId), { message: 'Provide file or contentId' })
      .parse(req.body);
    const server = requireServer(req.params.id);
    const actor = req.user.username;

    const row = contentId
      ? db.get('SELECT * FROM server_content WHERE id = ? AND server_id = ?', contentId, server.id)
      : db.get('SELECT * FROM server_content WHERE server_id = ? AND filename = ?', server.id, file);
    if (!row)
      throw Object.assign(new Error('This file is not panel-managed — reinstall it from a URL instead'), {
        status: 404,
      });
    if (row.managed_by === 'pack') {
      throw Object.assign(new Error('Pack-managed content updates with the pack — upgrade the modpack instead'), {
        status: 409,
      });
    }
    const lib = row.library_id ? db.get('SELECT * FROM library_files WHERE id = ?', row.library_id) : null;
    if (!lib || !lib.project_id) {
      throw Object.assign(new Error('No update source is known for this mod (installed from a direct URL or upload)'), {
        status: 409,
      });
    }
    const check = db.get("SELECT * FROM update_checks WHERE subject_type = 'content' AND subject_id = ?", row.id);
    if (!check || !check.latest_version) {
      throw Object.assign(new Error('No newer version is known — run an update check first'), { status: 409 });
    }

    let ref;
    if (lib.platform === 'modrinth') {
      ref = `https://modrinth.com/mod/${lib.project_id}/version/${check.latest_version}`;
    } else if (lib.platform === 'curseforge') {
      ref = `https://www.curseforge.com/minecraft/mc-mods/${lib.project_id}/files/${check.latest_version}`;
    } else {
      throw Object.assign(new Error(`Cannot auto-update content from platform "${lib.platform}"`), { status: 409 });
    }

    const wasEnabled = Boolean(row.enabled);
    await mods.removeContent(server.id, row.filename, { actor });
    const result = await mods.installFromUrl(server.id, ref, { actor, kind: row.kind });
    if (!wasEnabled) await mods.setEnabled(server.id, result.filename, false, { actor });
    res.json({
      ok: true,
      installed: {
        name: result.library.name,
        filename: result.filename,
        version: result.library.version,
        enabled: wasEnabled,
      },
    });
  })
);

router.post(
  '/servers/:id/mods/toggle',
  asyncHandler(async (req, res, next) => {
    const { file, enabled } = z.object({ file: z.string().min(1).max(200), enabled: z.boolean() }).parse(req.body);
    res.json({ ok: true, ...(await mods.setEnabled(req.params.id, file, enabled, { actor: req.user.username })) });
  })
);

router.delete(
  '/servers/:id/mods/:file',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, ...(await mods.removeContent(req.params.id, req.params.file, { actor: req.user.username })) });
  })
);

// ---- Modpack manual-download resolver ----
// A CurseForge pack can pin mods that can't be auto-downloaded; itzg writes
// MODS_NEED_DOWNLOAD.txt and the install fails. These endpoints turn that into
// one-click Exclude / Modrinth-install / manual-jar upload.
const modUpload = multer({ dest: dataPath('tmp'), limits: { fileSize: 250 * 1024 * 1024, files: 1 } });

router.get(
  '/servers/:id/pending-downloads',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    res.json({ ok: true, mods: mods.pendingDownloads(req.params.id) });
  })
);

router.post(
  '/servers/:id/pending-downloads/exclude',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    const { filename } = z.object({ filename: z.string().min(1).max(300) }).parse(req.body);
    const token = mods.pendingExcludeToken(req.params.id, filename);
    mods.excludePackMod(req.params.id, token, { actor: req.user.username });
    mods.clearPendingLine(req.params.id, filename);
    res.json({ ok: true, excluded: token, mods: mods.pendingDownloads(req.params.id) });
  })
);

router.post(
  '/servers/:id/mods/upload',
  modUpload.single('file'),
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    if (!req.file) throw Object.assign(new Error('No file uploaded'), { status: 400 });
    const excludeFilename = (req.body && req.body.excludeFilename) || null;
    const excludeToken = excludeFilename ? mods.pendingExcludeToken(req.params.id, excludeFilename) : null;
    try {
      const result = await mods.importUploadedMod(req.params.id, req.file.path, req.file.originalname, {
        excludeToken,
        actor: req.user.username,
      });
      if (excludeFilename) mods.clearPendingLine(req.params.id, excludeFilename);
      res.status(201).json({ ok: true, ...result, mods: mods.pendingDownloads(req.params.id) });
    } finally {
      fs.promises.rm(req.file.path, { force: true }).catch(() => {});
    }
  })
);

// ---- Events: export, excerpts, retention ----

function sendEventExport(req, res, serverId) {
  const { filename, contentType, body } = eventsService.exportEvents(serverId, {
    format: req.query.format,
    q: String(req.query.q || '').trim(),
    type: String(req.query.type || '').trim(),
  });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.type(contentType).send(body);
}

router.get(
  '/events/export',
  asyncHandler((req, res, next) => {
    sendEventExport(req, res, String(req.query.server || '') || null);
  })
);

router.get(
  '/servers/:id/events/export',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    sendEventExport(req, res, req.params.id);
  })
);

// Captured log excerpt for one event (text/plain; 404 when none was captured).
router.get(
  '/events/:id/excerpt',
  asyncHandler((req, res, next) => {
    const event = eventsService.getEvent(Number(req.params.id));
    if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
    const text = eventsService.readExcerpt(event);
    if (text == null) throw Object.assign(new Error('No captured log for this event'), { status: 404 });
    res.type('text/plain').send(text);
  })
);

// Prune event history older than N days (excerpts included).
router.post(
  '/events/prune',
  asyncHandler((req, res, next) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(3650) }).parse(req.body);
    const { removed } = eventsService.pruneEvents(days, { actor: req.user.username });
    res.json({ ok: true, removed });
  })
);

// ---- Archived per-server logs (data/logs/<id>/events) ----

const archivedFileSchema = z.string().regex(/^[\w.,()[\] -]+$/, 'Invalid file name');

router.get(
  '/servers/:id/logs/archived',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    const dir = dataPath('logs', req.params.id, 'events');
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const st = await fsp.stat(path.join(dir, e.name)).catch(() => null);
      if (!st) continue;
      files.push({ file: e.name, size: st.size, mtimeMs: st.mtimeMs });
    }
    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    res.json({ ok: true, files });
  })
);

router.get(
  '/servers/:id/logs/archived/:file',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    const file = archivedFileSchema.parse(req.params.file);
    const abs = dataPath('logs', req.params.id, 'events', file);
    if (!fs.existsSync(abs)) throw Object.assign(new Error('Archived log not found'), { status: 404 });
    res.download(abs, file);
  })
);

// ---- Custom server icon upload + serving ----

const ICON_MAX_BYTES = 512 * 1024;
const ICON_EXTS = { 'image/png': '.png', 'image/svg+xml': '.svg', 'image/jpeg': '.jpg' };
const iconUpload = multer({ dest: dataPath('tmp'), limits: { fileSize: ICON_MAX_BYTES, files: 1 } });

// multipart field: 'icon'. Stores data/library/icons/custom/<serverId><ext>
// and sets servers.icon = 'custom:<filename>' (render via /api/icons/custom/<file>).
router.post('/servers/:id/icon', iconUpload.single('icon'), async (req, res, next) => {
  try {
    const server = requireServer(req.params.id);
    if (!req.file) throw Object.assign(new Error('Attach an image (field "icon")'), { status: 400 });
    const ext = ICON_EXTS[req.file.mimetype];
    if (!ext) {
      throw Object.assign(new Error('Icons must be PNG, SVG or JPEG (max 512 KB)'), { status: 400 });
    }
    const filename = `${server.id}${ext}`;
    const destDir = dataPath('library', 'icons', 'custom');
    await fsp.mkdir(destDir, { recursive: true });
    // Drop stale variants with a different extension.
    for (const other of Object.values(ICON_EXTS)) {
      if (other !== ext) await fsp.rm(path.join(destDir, `${server.id}${other}`), { force: true }).catch(() => {});
    }
    await fsp.rm(path.join(destDir, filename), { force: true }).catch(() => {});
    await fsp.rename(req.file.path, path.join(destDir, filename)).catch(async () => {
      await fsp.copyFile(req.file.path, path.join(destDir, filename));
      await fsp.rm(req.file.path, { force: true });
    });
    db.run('UPDATE servers SET icon = ? WHERE id = ?', `custom:${filename}`, server.id);
    eventsService.recordEvent({
      serverId: server.id,
      actor: req.user.username,
      type: 'config-changed',
      summary: 'Custom server icon uploaded',
    });
    res.json({ ok: true, icon: `custom:${filename}`, url: `/api/icons/custom/${filename}` });
  } catch (err) {
    if (req.file) await fsp.rm(req.file.path, { force: true }).catch(() => {});
    next(err);
  }
});

router.get(
  '/icons/custom/:file',
  asyncHandler((req, res, next) => {
    const file = z
      .string()
      .regex(/^srv_[\w-]+\.(png|svg|jpg)$/, 'Invalid icon file')
      .parse(req.params.file);
    const abs = dataPath('library', 'icons', 'custom', file);
    if (!fs.existsSync(abs)) throw Object.assign(new Error('Icon not found'), { status: 404 });
    // Custom icons may be user-uploaded SVGs (not sanitized). Serve them under a
    // locked-down, sandboxed CSP so a <script> embedded in the SVG can't execute
    // if the file is opened directly, and block content-type sniffing.
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(abs);
  })
);

// ---- Users (admin only) ----
const authService = require('../../services/auth');
const { requireRole } = require('../middleware/auth');

router.get('/users', requireRole('admin'), (req, res) => {
  res.json({ ok: true, users: authService.listUsers() });
});

router.post(
  '/users',
  requireRole('admin'),
  asyncHandler((req, res, next) => {
    const { username, password, role } = z
      .object({
        username: z.string().trim().min(2).max(32),
        password: z.string().min(8).max(200),
        role: z.enum(['admin', 'operator', 'viewer']),
      })
      .parse(req.body);
    res
      .status(201)
      .json({ ok: true, user: authService.createUser({ username, password, role }, { actor: req.user.username }) });
  })
);

router.post(
  '/users/:id/role',
  requireRole('admin'),
  asyncHandler((req, res, next) => {
    const { role } = z.object({ role: z.enum(['admin', 'operator', 'viewer']) }).parse(req.body);
    authService.setRole(req.params.id, role, { actor: req.user.username });
    res.json({ ok: true });
  })
);

router.post(
  '/users/:id/password',
  requireRole('admin'),
  asyncHandler((req, res, next) => {
    const { password } = z.object({ password: z.string().min(8).max(200) }).parse(req.body);
    authService.setPassword(req.params.id, password, { actor: req.user.username });
    res.json({ ok: true });
  })
);

router.delete(
  '/users/:id',
  requireRole('admin'),
  asyncHandler((req, res, next) => {
    authService.deleteUser(req.params.id, { actor: req.user.username });
    res.json({ ok: true });
  })
);

// ---- Modrinth search (mods manager) ----
const modrinth = require('../../services/modrinthApi');

router.get(
  '/modrinth/search',
  asyncHandler(async (req, res, next) => {
    const results = await modrinth.search({
      query: String(req.query.q || ''),
      kind: String(req.query.kind || 'mod'),
      loader: req.query.loader ? String(req.query.loader) : undefined,
      mcVersion: req.query.mc ? String(req.query.mc) : undefined,
    });
    res.json({ ok: true, results });
  })
);

// ---- "From mods" wizard browser (loader-first) ----
const modBrowser = require('../../services/modBrowser');
const loaderVersions = require('../../services/loaderVersions');

const MOD_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];

// Loader build versions to pin (fabric/quilt are MC-independent; neoforge/forge need mc).
router.get(
  '/loaders/versions',
  asyncHandler(async (req, res, next) => {
    const { loader, mc } = z
      .object({ loader: z.enum(MOD_LOADERS), mc: z.string().trim().max(32).optional() })
      .parse({ loader: req.query.loader, mc: req.query.mc || undefined });
    res.json({ ok: true, ...(await loaderVersions.getBuilds(loader, mc)) });
  })
);

// Unified mod search across Modrinth / CurseForge, filtered to loader + MC.
router.get(
  '/mods/search',
  asyncHandler(async (req, res, next) => {
    const { q, platform, loader, mc } = z
      .object({
        q: z.string().trim().max(120).default(''),
        platform: z.enum(['modrinth', 'curseforge']).default('modrinth'),
        loader: z.enum(MOD_LOADERS).optional(),
        mc: z.string().trim().max(32).optional(),
      })
      .parse({
        q: req.query.q || '',
        platform: req.query.platform || undefined,
        loader: req.query.loader || undefined,
        mc: req.query.mc || undefined,
      });
    res.json({ ok: true, results: await modBrowser.search({ query: q, platform, loader, mc }) });
  })
);

// A mod's builds for the chosen loader + MC, newest first (for its version picker).
router.get(
  '/mods/versions',
  asyncHandler(async (req, res, next) => {
    const { platform, ref, loader, mc } = z
      .object({
        platform: z.enum(['modrinth', 'curseforge']),
        ref: z.string().trim().min(1).max(200),
        loader: z.enum(MOD_LOADERS).optional(),
        mc: z.string().trim().max(32).optional(),
      })
      .parse({
        platform: req.query.platform,
        ref: req.query.ref,
        loader: req.query.loader || undefined,
        mc: req.query.mc || undefined,
      });
    res.json({ ok: true, versions: await modBrowser.versions({ platform, ref, loader, mc }) });
  })
);

// Required-dependency closure of the current selection ("added as dependency" rows).
router.post(
  '/mods/deps',
  asyncHandler(async (req, res, next) => {
    const { loader, mc, selection } = z
      .object({
        loader: z.enum(MOD_LOADERS),
        mc: z.string().trim().max(32).optional(),
        selection: z
          .array(
            z.object({
              platform: z.enum(['modrinth', 'curseforge']),
              ref: z.string().trim().min(1).max(200),
              versionId: z.string().trim().min(1).max(60),
            })
          )
          .max(50),
      })
      .parse(req.body);
    res.json({ ok: true, ...(await modBrowser.resolveDependencies({ loader, mc, selection })) });
  })
);

const fromModsSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(4000).optional(),
    icon: z.string().max(64).optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    // 'paper' is accepted for the Auto-detect (solver) path, which can pick a
    // plugin loader; the browse UI only offers the four mod loaders.
    loader: z.enum([...MOD_LOADERS, 'paper']),
    mcVersion: z.string().trim().min(1).max(32),
    loaderVersion: z.string().trim().max(40).optional(),
    mods: z
      .array(
        z.object({
          platform: z.enum(['modrinth', 'curseforge']),
          ref: z.string().trim().min(1).max(200),
          versionId: z.string().trim().min(1).max(60).optional(),
        })
      )
      .max(100)
      .default([]),
    heapMb: z.coerce.number().int().min(512).max(262144).optional(),
    containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
    diskQuotaGb: z.coerce.number().min(0).max(16384).optional(),
    portGame: z.coerce.number().int().min(1024).max(65535).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .refine((v) => !v.containerMemoryMb || !v.heapMb || v.containerMemoryMb > v.heapMb, {
    message: 'Container memory limit must be higher than the Java heap (or the JVM will be OOM-killed)',
  });

// One-shot "create server from mods": create (no start) → install each mod
// pinned to its chosen build → start, all inside ONE task with real progress.
// Individual mod failures are tolerated and reported; the server still comes up.
router.post(
  '/servers/from-mods',
  asyncHandler((req, res, next) => {
    const input = fromModsSchema.parse(req.body);
    const actor = req.user.username;
    const type = input.loader.toUpperCase(); // fabric → FABRIC, etc. (all valid TYPEs)
    const taskId = tasks.run(`Creating ${input.name} (${input.loader})`, { actor }, async (t) => {
      const env = { ...(input.env || {}) };
      const envKey = loaderVersions.envKeyFor(input.loader);
      if (input.loaderVersion && envKey) env[envKey] = input.loaderVersion;
      t.step('Creating server');
      const server = await servers.createServer(
        {
          name: input.name,
          description: input.description,
          icon: input.icon,
          accent: input.accent,
          type,
          mcVersion: input.mcVersion,
          env,
          heapMb: input.heapMb,
          containerMemoryMb: input.containerMemoryMb,
          diskQuotaGb: input.diskQuotaGb,
          portGame: input.portGame,
        },
        { actor, start: false, onProgress: (s) => t.step(s) }
      );
      // Install mods BEFORE first boot so a loader server starts with them present.
      const failed = [];
      for (let i = 0; i < input.mods.length; i += 1) {
        const m = input.mods[i];
        // With a versionId the build is pinned; without one (the solver path)
        // installFromUrl picks the newest build matching this server's loader+MC.
        const base =
          m.platform === 'curseforge'
            ? `https://www.curseforge.com/minecraft/mc-mods/${m.ref}`
            : `https://modrinth.com/mod/${m.ref}`;
        const url = m.versionId
          ? m.platform === 'curseforge'
            ? `${base}/files/${m.versionId}`
            : `${base}/version/${m.versionId}`
          : base;
        t.step(`Installing mod ${i + 1}/${input.mods.length}: ${m.ref}`);
        try {
          await mods.installFromUrl(server.id, url, { actor });
        } catch (err) {
          failed.push(`${m.ref} (${err.message})`);
        }
      }
      t.step('Starting server');
      await servers.startServer(server.id, { actor });
      return {
        serverId: server.id,
        name: server.display_name,
        installed: input.mods.length - failed.length,
        total: input.mods.length,
        failed,
      };
    });
    res.status(202).json({ ok: true, taskId });
  })
);

function publicServer(s) {
  if (!s) return null;
  const { rcon_password_cipher, env_json, notes, ...rest } = s;
  return rest;
}

router.use(makeJsonErrorHandler('api', { fileTooLarge: 'File too large (512 KB icon limit)' }));

module.exports = router;
