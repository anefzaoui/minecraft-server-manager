// @ts-nocheck - dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
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
const dockerNetworks = require('../../docker/networks');
const dockerSpec = require('../../services/dockerSpec');
const { dockerOverridesSchema, requireAdminForOverrides } = require('./dockerOverridesSchema');
const crypto = require('node:crypto');
const { matchesImageType, imageDimensions } = require('../../utils/sniffImage');
const { sanitizeSvg } = require('../../utils/svgSanitize');
const { removeAvatarFiles } = require('../../services/avatarStore');
const logger = require('../../logger')('api');
const { serializeError } = require('../../utils/logSanitize');

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

/**
 * Optional 0..max numeric for the cpus / diskQuotaGb inputs. Unlike
 * z.coerce.number(), a cleared/empty field maps to "unset" (use the configured
 * default) instead of a silent 0 - which for a disk quota means "off" and for
 * cpus means "unlimited". An explicit "0" still round-trips.
 */
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
    cpus: optNum0(128),
    diskQuotaGb: optNum0(16384),
    updatePolicy: z.enum(['manual', 'notify', 'auto']).optional(),
    autoStart: z.coerce.boolean().optional(),
    start: z.coerce.boolean().optional(),
    ...dockerOverridesSchema,
  })
  .refine((v) => !v.containerMemoryMb || !v.heapMb || v.containerMemoryMb > v.heapMb, {
    message: 'Container memory limit must be higher than the Java heap (or the JVM will be OOM-killed)',
  });

router.post(
  '/servers',
  asyncHandler(async (req, res, next) => {
    const input = createSchema.parse(req.body);
    requireAdminForOverrides(req, input);
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
        cpus: optNum0(128),
        diskQuotaGb: optNum0(16384),
        quotaStrict: z.coerce.boolean().optional(),
        updatePolicy: z.enum(['manual', 'notify', 'auto']).optional(),
        autoStart: z.coerce.boolean().optional(),
        autoRestart: z.coerce.boolean().optional(),
        env: z.record(z.string(), z.string()).optional(),
        ...dockerOverridesSchema,
      })
      .refine((v) => !v.containerMemoryMb || !v.heapMb || v.containerMemoryMb > v.heapMb, {
        message: 'Container memory limit must be higher than the Java heap',
      })
      .parse(req.body);
    requireAdminForOverrides(req, changes);
    if (
      changes.containerName !== undefined ||
      changes.networkName !== undefined ||
      changes.extraPorts !== undefined ||
      changes.extraBinds !== undefined
    ) {
      const before = requireServer(req.params.id);
      await dockerSpec.validateOverrides(
        {
          containerName: changes.containerName || null,
          networkName: changes.networkName || null,
          extraPorts: changes.extraPorts ?? before.extraPorts,
          extraBinds: changes.extraBinds ?? before.extraBinds,
        },
        { previousExtraPorts: before.extraPorts }
      );
    }
    const { server, needsRecreate } = servers.updateServer(req.params.id, changes, { actor: req.user.username });
    res.json({ ok: true, needsRecreate, server: publicServer(server) });
  })
);

// Advanced Docker settings: host network discovery, and the "Preview as YAML"
// round trip shared by the wizard (pre-creation) and the Settings tab (post-creation).

router.get(
  '/docker/networks',
  require('../middleware/auth').requireRole('admin'),
  asyncHandler(async (req, res) => {
    res.json({ ok: true, networks: await dockerNetworks.listNetworks() });
  })
);

const previewSchema = z.object({
  type: z.string().trim().max(32).optional(),
  mcVersion: z.string().trim().max(32).optional(),
  javaTag: z.string().max(16).optional(),
  env: z.record(z.string(), z.string()).optional(),
  heapMb: z.coerce.number().int().min(512).max(262144).optional(),
  containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
  containerSwapMb: z.coerce.number().int().min(0).optional(),
  cpus: optNum0(128),
  portGame: z.coerce.number().int().min(1024).max(65535).optional(),
  portRcon: z.coerce.number().int().min(1024).max(65535).optional(),
  portBedrock: z.coerce.number().int().min(1024).max(65535).optional(),
  withBedrock: z.coerce.boolean().optional(),
  ...dockerOverridesSchema,
});

router.post(
  '/docker/preview',
  require('../middleware/auth').requireRole('admin'),
  asyncHandler((req, res) => {
    const input = previewSchema.parse(req.body);
    res.json({ ok: true, yaml: dockerSpec.toYaml(servers.previewCreateSpec(input)) });
  })
);

router.post(
  '/docker/preview/parse',
  require('../middleware/auth').requireRole('admin'),
  asyncHandler((req, res) => {
    const { yaml: text } = z.object({ yaml: z.string().max(20000) }).parse(req.body);
    res.json({ ok: true, spec: dockerSpec.fromYaml(text) });
  })
);

router.get(
  '/servers/:id/docker-spec',
  require('../middleware/auth').requireRole('admin'),
  asyncHandler((req, res) => {
    requireServer(req.params.id);
    res.json({ ok: true, yaml: dockerSpec.toYaml(servers.previewServerSpec(req.params.id)) });
  })
);

router.delete(
  '/servers/:id',
  asyncHandler(async (req, res, next) => {
    // Deletion is opt-in: files + backups are KEPT by default, and only
    // removed when the caller explicitly asks via deleteFiles/deleteBackups.
    const { freedBytes } = await servers.deleteServer(req.params.id, {
      actor: req.user.username,
      keepWorld: req.query.deleteFiles !== 'true' && req.query.keepFiles !== 'false',
      keepBackups: req.query.deleteBackups !== 'true' && req.query.keepBackups !== 'false',
    });
    res.json({ ok: true, freedBytes });
  })
);

router.get(
  '/servers/:id/logs',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    // fetchLogs buffers the whole tail (Buffer + demuxed string) in memory, so
    // cap it at 2000 lines here - the live WS console covers anything ongoing,
    // and this endpoint is just the "recent output" snapshot.
    const tail = Math.max(1, Math.min(Number(req.query.tail) || 500, 2000));
    res.type('text/plain; charset=utf-8').send(await fetchLogs(req.params.id, { tail }));
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
// Includes the DB status for EVERY server so the dashboard can move the
// status dot when a server crashes or stops - hydration used to update only
// the numbers, leaving a crashed server pulsing green "Running" until reload.
router.get('/servers/live', (req, res) => {
  const liveCache = require('../../services/liveCache');
  const db = require('../../db');
  const all = liveCache.getAll();
  const out = {};
  for (const row of db.all('SELECT id, status FROM servers WHERE deleted_at IS NULL')) {
    const e = all[row.id] || {};
    out[row.id] = {
      status: row.status,
      cpuPct: e.stats ? e.stats.cpuPct : null,
      memUsedMb: e.stats ? Math.round(e.stats.memUsedBytes / 1024 / 1024) : null,
      players: e.players ? { online: e.players.online, max: e.players.max, names: e.players.names } : null,
      startedAt: e.startedAt || null,
      perf: e.perf || null,
      perfSupported: e.perfSupported !== false,
      // Shared with the SSR statusDetail (viewModels.js) so the label the page
      // rendered on load and the one this poll hydrates in can never disagree.
      phase: liveCache.statusDetail(e),
    };
  }
  res.json({ ok: true, servers: out });
});

// One place to answer "is anything wrong right now?" - for the operator and for
// an external monitor to poll. Read-only, cheap (cached status + one events
// query + one statfs), never touches Docker.
router.get(
  '/status/summary',
  asyncHandler(async (req, res, next) => {
    const db = require('../../db');
    // Real status values only: a quota stop is surfaced via the 'quota-exceeded'
    // alert below, and nothing ever writes 'over-quota' to servers.status.
    const PROBLEM_STATUSES = new Set(['crashed', 'stalled', 'unhealthy']);
    // Keep in sync with the alert event types forwarded in integrations/discord.js.
    const ALERT_TYPES = [
      'oom',
      'unhealthy',
      'startup-stalled',
      'stop-failed',
      'schedule-failed',
      'quota-exceeded',
      'crash-loop',
      'crash-report',
      'offline-after-restart',
      'update-failed',
    ];

    const serverRows = db.all(
      'SELECT id, display_name, status FROM servers WHERE deleted_at IS NULL ORDER BY created_at'
    );
    const problems = serverRows
      .filter((s) => PROBLEM_STATUSES.has(s.status))
      .map((s) => ({ serverId: s.id, server: s.display_name, kind: s.status }));

    const ph = ALERT_TYPES.map(() => '?').join(',');
    const recentAlerts = db
      .all(
        `SELECT e.type, e.summary, e.server_id, e.created_at, s.display_name AS server
           FROM events e LEFT JOIN servers s ON s.id = e.server_id
          WHERE e.type IN (${ph}) AND e.created_at > datetime('now', '-1 day')
          ORDER BY e.id DESC LIMIT 50`,
        ...ALERT_TYPES
      )
      .map((r) => ({ type: r.type, summary: r.summary, serverId: r.server_id, server: r.server, at: r.created_at }));

    const disk = await require('../../storage/indexer')
      .diskFree()
      .then(({ free, total }) => ({
        freeBytes: free,
        totalBytes: total,
        freePct: total ? Math.round((free / total) * 100) : null,
      }))
      .catch(() => ({ freeBytes: null, totalBytes: null, freePct: null }));
    if (disk.freePct != null && disk.freePct < 5) {
      problems.push({ serverId: null, server: null, kind: 'disk-low', detail: `Only ${disk.freePct}% disk free` });
    }

    res.json({
      ok: true,
      healthy: problems.length === 0,
      generatedAt: new Date().toISOString(),
      servers: serverRows.map((s) => ({ serverId: s.id, server: s.display_name, status: s.status })),
      problems,
      recentAlerts,
      disk,
    });
  })
);

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

router.get(
  '/docker/status',
  asyncHandler(async (req, res) => {
    res.json({ ok: true, docker: await checkDocker() });
  })
);

// ---- API keys (Settings page) - admin only ----
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
const panelConfig = require('../../config');

// COOKIE_SECURE defaults to false so a plain-HTTP LAN/localhost session still
// works (see config/index.js resolveCookieSecure) - reasonable for a LAN-only
// deployment, but a public host being configured here means this panel is
// expected to be reachable over the internet (e.g. via the invite/port-forward
// feature), where a non-Secure session cookie is sniffable in transit.
function cookieSecureWarning(publicHost) {
  return Boolean(publicHost) && panelConfig.cookieSecure === false;
}

router.get('/settings', (req, res) => {
  const publicHost = settingsService.getPublicHost();
  res.json({
    ok: true,
    publicHost,
    cookieSecureWarning: cookieSecureWarning(publicHost),
    curseforge: { masked: apiKeys.maskedKey('curseforge') },
  });
});

// ---- Panel self-update check ("Update MSM"). Admin-only, on-demand: the
// Settings page never hits GitHub at render - the button triggers this GET.
router.get(
  '/settings/panel-update',
  requireRoleKeys('admin'),
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, update: await panelUpdate.checkLatest({ refresh: req.query.refresh === '1' }) });
  })
);

// ---- Defaults for new servers (admin-configured wizard/blueprint pre-fills) ----
router.get('/settings/defaults', (req, res) => {
  res.json({ ok: true, defaults: settingsService.getDefaults(), base: panelConfig.defaults });
});

router.post(
  '/settings/defaults',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    const num = () =>
      z
        .union([z.string(), z.number()])
        // A cleared input means "leave this field untouched", not "force it to 0".
        .transform((v) => (v === '' || v === null ? undefined : Number(v)))
        .optional();
    const { reset, heapMb, containerMemoryMb, cpus, diskQuotaGb, quotaWarnPct, quotaCriticalPct } = z
      .object({
        reset: z.boolean().optional(),
        heapMb: num(),
        containerMemoryMb: num(),
        cpus: num(),
        diskQuotaGb: num(),
        quotaWarnPct: num(),
        quotaCriticalPct: num(),
      })
      .parse(req.body);
    const defaults = reset
      ? settingsService.resetDefaults()
      : settingsService.setDefaults({
          heapMb,
          containerMemoryMb,
          cpus,
          diskQuotaGb,
          quotaWarnPct,
          quotaCriticalPct,
        });
    res.json({ ok: true, defaults, base: panelConfig.defaults });
  })
);

router.post(
  '/settings',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    const { publicHost } = z.object({ publicHost: z.string().max(255).optional() }).parse(req.body);
    const saved = settingsService.setPublicHost(publicHost || '');
    const warn = cookieSecureWarning(saved);
    if (warn) {
      logger.warn(
        'A public host is configured but COOKIE_SECURE is unset, so the session cookie is sent over plain HTTP if the panel is reached that way. Set COOKIE_SECURE=true behind HTTPS, or COOKIE_SECURE=auto in the environment.',
        { publicHost: saved }
      );
    }
    res.json({ ok: true, publicHost: saved, cookieSecureWarning: warn });
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
    if (timezone !== undefined) {
      settingsService.setTimezone(timezone);
      // Already-armed schedules keep firing on whatever zone they were
      // created with until re-armed - do it now, not just for new ones.
      require('../../services/scheduler').rearmAll();
    }
    if (country !== undefined) settingsService.setCountry(country);
    res.json({ ok: true, localization: settingsService.localization() });
  })
);

// ---- Public read-only API tokens (Settings page) - admin only ----
// These manage credentials for GET /api/v1 (see routes/apiV1.js). The tokens
// themselves are Bearer-only and never touch a session.
const apiTokens = require('../../services/apiTokens');

router.get('/api-tokens', requireRoleKeys('admin'), (req, res) => {
  res.json({ ok: true, enabled: settingsService.isPublicApiEnabled(), tokens: apiTokens.listTokens() });
});

const apiTokenCreateSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    scopeAll: z.coerce.boolean().default(false),
    serverIds: z
      .array(
        z
          .string()
          .trim()
          .regex(/^srv_[A-Za-z0-9_-]{1,40}$/)
      )
      .max(200)
      .optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((v) => v.scopeAll || (v.serverIds && v.serverIds.length > 0), {
    message: 'Choose specific servers or grant access to all servers',
  });

router.post(
  '/api-tokens',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    const input = apiTokenCreateSchema.parse(req.body);
    if (!input.scopeAll) for (const id of input.serverIds) requireServer(id); // 404 on unknown id
    const created = apiTokens.createToken(
      {
        label: input.label,
        scopeAll: input.scopeAll,
        serverIds: input.scopeAll ? [] : input.serverIds,
        expiresAt: input.expiresAt || null,
      },
      { actor: req.user.username }
    );
    // A token that can't be used is a footgun - minting one turns the surface
    // on. Turning it back off stays a deliberate, separate action.
    let enabled = settingsService.isPublicApiEnabled();
    if (!enabled) {
      enabled = settingsService.setPublicApiEnabled(true);
      eventsService.recordEvent({
        actor: req.user.username,
        type: 'config-changed',
        summary: 'Public API enabled (first token created)',
      });
      logger.info('Enabled the public API alongside a new token.', { actor: req.user.username });
    }
    // created.token is the plaintext - returned to the caller exactly once.
    res.status(201).json({ ok: true, token: created, enabled });
  })
);

router.delete(
  '/api-tokens/:id',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    apiTokens.revokeToken(req.params.id, { actor: req.user.username }); // throws 404 if unknown/already revoked
    res.json({ ok: true });
  })
);

router.post(
  '/settings/public-api',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    const { enabled } = z.object({ enabled: z.coerce.boolean() }).parse(req.body);
    const now = settingsService.setPublicApiEnabled(enabled);
    eventsService.recordEvent({
      actor: req.user.username,
      type: 'config-changed',
      summary: `Public API ${now ? 'enabled' : 'disabled'}`,
    });
    logger.info('Toggled the public API.', { enabled: now, actor: req.user.username });
    res.json({ ok: true, enabled: now });
  })
);

// ---- Modpacks: resolve/preview, install (always pinned), upgrade, rollback ----
const packs = require('../../services/packs');
const upgrade = require('../../updates/upgrade');
const checker = require('../../updates/checker');
const backups = require('../../services/backups');
const panelUpdate = require('../../services/panelUpdate');

router.post(
  '/packs/resolve',
  asyncHandler(async (req, res, next) => {
    const { platform, ref, versionId, mcVersion } = z
      .object({
        platform: z.enum(['curseforge', 'modrinth', 'ftb', 'gtnh']),
        ref: z.string().trim().min(1).max(400),
        versionId: z
          .string()
          .trim()
          .regex(/^[\w.-]{1,64}$/)
          .optional(),
        mcVersion: z.string().trim().max(32).optional(),
      })
      .parse(req.body);
    res.json({ ok: true, pack: await packs.resolvePack(platform, ref, { versionId, mcVersion }) });
  })
);

router.post(
  '/servers/:id/pack',
  asyncHandler(async (req, res) => {
    const { platform, ref, versionId, force } = z
      .object({
        platform: z.enum(['curseforge', 'modrinth', 'ftb', 'gtnh']),
        ref: z.string().trim().min(1).max(400),
        versionId: z
          .string()
          .trim()
          .regex(/^[\w.-]{1,64}$/)
          .optional(),
        force: z.coerce.boolean().optional(),
      })
      .parse(req.body);
    try {
      const resolved = await packs.resolvePack(platform, ref, { versionId });
      await packs.applyPack(req.params.id, resolved, { actor: req.user.username, force });
      res.json({ ok: true, pack: resolved, note: 'Applied - recreate/restart to install' });
    } catch (err) {
      if (err.requiresForce) {
        return res.status(409).json({ ok: false, error: err.message, requiresForce: true, warnings: err.warnings });
      }
      throw err;
    }
  })
);

const UPGRADE_STEP_LABELS = {
  resolving: 'Resolving target version',
  'backing-up': 'Creating pre-update backup',
  stopping: 'Stopping server',
  applying: 'Re-pinning pack version',
  recreating: 'Recreating container',
  // No fixed minutes in the label: the window is per-platform (30 min for
  // GTNH, 20 for CurseForge/Modrinth, 10 otherwise - see upgrade.js).
  monitoring: 'Starting & monitoring the new version',
  overlay: 'Re-applying custom overlay mods',
};

// Long operation - returns {ok, taskId}; poll /api/tasks/:id (client: runTask).
// On failure with a rollback path, the task RESOLVES with
// {ok:false, error, rollbackAvailable:true} so the client can offer rollback.
router.post(
  '/servers/:id/pack/upgrade',
  asyncHandler((req, res, next) => {
    const { versionId, skipBackup } = z
      .object({
        // Same shape constraint as the other pack versionId fields: this one
        // reaches the exact same GTNH_PACK_VERSION/CF_FILE_ID/etc. container
        // env path via upgradePack.
        versionId: z
          .string()
          .trim()
          .regex(/^[\w.-]{1,64}$/)
          .optional(),
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

// Long operation - returns {ok, taskId}. Without an explicit backupId the most
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

// ---- Pack browser - search, details, installed pack mods, one-shot create ----
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
// (installed pack - platform/ref come from the server's pin, and the pinned
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
      if (pin.platform === 'gtnh')
        throw Object.assign(new Error('GTNH pack details live on the GTNH site'), { status: 400 });
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
    let description;
    let downloads;
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
    platform: z.enum(['curseforge', 'modrinth', 'ftb', 'gtnh']),
    ref: z.string().trim().min(1).max(400),
    versionId: z
      .string()
      .trim()
      .regex(/^[\w.-]{1,64}$/)
      .optional(),
    heapMb: z.coerce.number().int().min(512).max(262144).optional(),
    containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
    diskQuotaGb: optNum0(16384),
    portGame: z.coerce.number().int().min(1024).max(65535).optional(),
    env: z.record(z.string(), z.string()).optional(),
    ...dockerOverridesSchema,
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
    requireAdminForOverrides(req, input);
    const actor = req.user.username;
    const taskId = tasks.run(`Creating ${input.name} from a ${input.platform} pack`, { actor }, async (t) => {
      t.step('Resolving pack version (pinned - never "latest")');
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
          containerName: input.containerName,
          networkName: input.networkName,
          extraPorts: input.extraPorts,
          extraBinds: input.extraBinds,
        },
        // javaTagHint (not persisted as java_tag - that column means "user override"):
        // at create time there's no server_packs row yet, so resolveImage() would
        // otherwise fall back to java17 for GTNH, pull that image, then immediately
        // re-pull the correct one when the applyPack below flags a recreate.
        { actor, start: false, onProgress: (s) => t.step(s), javaTagHint: resolved.javaTag }
      );
      t.step(`Pinning ${resolved.projectName} @ ${resolved.versionName}`);
      // force: fresh server - there is no world yet to version-guard.
      await packs.applyPack(server.id, resolved, { actor, force: true });
      t.step('Starting server - the pack downloads and installs on first boot');
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

// Long operation - returns {ok, taskId}; the task result is the findings array.
router.post(
  '/updates/check',
  asyncHandler((req, res, next) => {
    const actor = req.user.username;
    const taskId = tasks.run('Checking for updates', { actor }, async (t) => {
      t.step(
        'Querying Modrinth, CurseForge, Hangar, SpigotMC and GitHub for mods/plugins, plus the Minecraft, loader-build and Docker-image registries'
      );
      const findings = await checker.checkAll({ actor });
      return { findings };
    });
    res.status(202).json({ ok: true, taskId });
  })
);

// Ignore / un-ignore the update currently offered for one Updates-page row.
// Content rows route to the per-mod store (server_content.ignored_update_version);
// pack / image / mc_version / loader_build rows to update_checks.ignored_version.
// An ignored row stays visible (greyed) on the Updates page but drops out of the
// sidebar badge and the digest; a genuinely newer build re-surfaces on its own.
router.post(
  '/updates/ignore',
  asyncHandler(async (req, res, next) => {
    const { subjectType, serverId, contentId, ignore } = z
      .object({
        subjectType: z.enum(['content', 'pack', 'image', 'mc_version', 'loader_build']),
        serverId: z.string().trim().max(40).optional(),
        contentId: z.string().trim().max(40).optional(),
        ignore: z.boolean(),
      })
      .parse(req.body);
    const actor = req.user.username;
    if (subjectType === 'content') {
      if (!serverId || !contentId) {
        throw Object.assign(new Error('serverId and contentId are required for content'), { status: 400 });
      }
      const server = requireServer(serverId);
      const out = mods.setIgnoredUpdate(server.id, { contentId }, { ignore, actor });
      return res.json({ ok: true, ...out });
    }
    if (!serverId) throw Object.assign(new Error('serverId is required'), { status: 400 });
    const server = requireServer(serverId);
    const out = checker.setUpdateIgnored(subjectType, server.id, { ignore, actor });
    res.json({ ok: true, ...out });
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
        t.step('Querying Modrinth, CurseForge, Hangar, SpigotMC, GitHub and the Minecraft/loader/image registries');
        const findings = await checker.checkAll({ actor });
        return { findings: findings.filter((f) => f.server === server.display_name) };
      }
    );
    res.status(202).json({ ok: true, taskId });
  })
);

// Docker image update: the check already pulled the newer image under the
// server's current tag, so this is just a normal recreate (stop → remove →
// ensureImage [no-op, already local] → create → restart-if-was-running).
// No pre-update backup: the bind-mounted data dir is untouched by an image swap.
router.post(
  '/servers/:id/image/upgrade',
  asyncHandler((req, res, next) => {
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const taskId = tasks.run(
      `Updating container image on ${server.display_name}`,
      { serverId: server.id, actor },
      async (t) => {
        t.step('Recreating container with the newer image');
        await servers.recreateServer(server.id, { actor });
        return { ok: true };
      }
    );
    res.status(202).json({ ok: true, taskId });
  })
);

// Standalone (non-modpack) Minecraft version / loader-build update. envKey
// comes from the Updates page row (computed server-side by the checker, which
// already knows this server's loader) rather than re-derived here, so this
// route only needs to validate it's one of the itzg build-pin vars it knows
// how to write.
const LOADER_BUILD_ENV_KEYS = [
  'PAPER_BUILD',
  'FORGE_VERSION',
  'NEOFORGE_VERSION',
  'FABRIC_LOADER_VERSION',
  'QUILT_LOADER_VERSION',
];

router.post(
  '/servers/:id/mcversion/upgrade',
  asyncHandler((req, res, next) => {
    const { targetVersion, targetLoaderBuild, envKey } = z
      .object({
        targetVersion: z
          .string()
          .trim()
          .regex(/^[\w.-]{1,32}$/)
          .optional(),
        targetLoaderBuild: z
          .string()
          .trim()
          .regex(/^[\w.-]{1,64}$/)
          .optional(),
        envKey: z.enum(LOADER_BUILD_ENV_KEYS).optional(),
      })
      .refine((v) => Boolean(v.targetVersion) || Boolean(v.targetLoaderBuild && v.envKey), {
        message: 'Provide targetVersion, or targetLoaderBuild with envKey',
      })
      .parse(req.body);
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const taskId = tasks.run(
      `Updating Minecraft version on ${server.display_name}`,
      { serverId: server.id, actor },
      async (t) => {
        const versionChanging = targetVersion && targetVersion !== server.mc_version;
        let backupId = null;
        if (versionChanging) {
          t.step('Creating pre-update backup');
          const backup = await backups.createBackup(server.id, {
            reason: 'pre-update',
            actor,
            note: `Before Minecraft ${server.mc_version} → ${targetVersion}`,
            task: t,
          });
          backupId = backup.id;
        }
        t.step('Applying new version');
        const changes = {};
        if (versionChanging) changes.mcVersion = targetVersion;
        if (targetLoaderBuild && envKey) changes.env = { ...server.env, [envKey]: targetLoaderBuild };
        servers.updateServer(server.id, changes, { actor });
        t.step('Recreating container');
        await servers.recreateServer(server.id, { actor });
        return { ok: true, from: server.mc_version, to: targetVersion || server.mc_version, backupId };
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
    const runs = new Cron(expr, { timezone: settingsService.getTimezone() }).nextRuns(3).map((d) => d.toISOString());
    res.json({ ok: true, cron: expr, runs });
  } catch (err) {
    logger.debug('Rejected an invalid cron expression.', { cron: expr, reason: err.message });
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

// One-click cleanup. dryRun:true previews (nothing deleted) - the Storage
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
// Long operation - returns {ok, taskId}; task result: {id, filename, size}.
router.post(
  '/servers/:id/backups',
  asyncHandler((req, res, next) => {
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const note = String(req.body?.note || '');
    const shrinkAfter = Boolean(req.body?.shrink);
    const taskId = tasks.run(`Backing up ${server.display_name}`, { serverId: server.id, actor }, async (t) => {
      t.step('Snapshotting server directory (save-off → save-all → zip → save-on)');
      const backup = await backups.createBackup(server.id, { reason: 'manual', actor, note, shrinkAfter });
      return { id: backup.id, filename: backup.filename, size: backup.size_bytes };
    });
    res.status(202).json({ ok: true, taskId });
  })
);

// Long operation - returns {ok, taskId}. Stops the server, takes a safety
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

// Download a backup archive. Admin/operator only - the archive contains the
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
  requireRoleKeys('admin', 'operator'),
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, ...(await backups.deleteBackup(req.params.backupId, { actor: req.user.username })) });
  })
);

// Rename a backup archive (display + on-disk filename). Admin/operator only.
router.patch(
  '/backups/:backupId',
  requireRoleKeys('admin', 'operator'),
  asyncHandler(async (req, res, next) => {
    const { filename } = z.object({ filename: z.string().trim().max(120) }).parse(req.body);
    const updated = await backups.renameBackup(req.params.backupId, filename, { actor: req.user.username });
    res.json({
      ok: true,
      backup: {
        id: updated.id,
        filename: updated.filename,
        size_bytes: updated.size_bytes,
        reason: updated.reason,
        created_at: updated.created_at,
      },
    });
  })
);

// ---- Backup retention policy (count caps + age / total-size ceilings) ----
const backupRetention = require('../../services/backupRetention');
const retentionPatchSchema = z
  .object({
    keepScheduled: z.coerce.number().int().min(1).max(500).optional(),
    keepPreUpdate: z.coerce.number().int().min(1).max(500).optional(),
    keepManual: z.coerce.number().int().min(1).max(500).optional(),
    keepPreRestore: z.coerce.number().int().min(1).max(500).optional(),
    maxAgeDays: z.coerce.number().int().min(0).max(3650).optional(),
    maxTotalGb: z.coerce.number().int().min(0).max(100000).optional(),
  })
  .strict();

router.get('/backups/retention', requireRoleKeys('admin'), (req, res) => {
  res.json({ ok: true, defaults: backupRetention.DEFAULTS, global: backupRetention.globalConfig() });
});

router.post(
  '/backups/retention',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    const patch = retentionPatchSchema.parse(req.body || {});
    res.json({ ok: true, global: backupRetention.setGlobal(patch) });
  })
);

router.get('/servers/:id/backups/retention', requireRoleKeys('admin'), (req, res) => {
  requireServer(req.params.id);
  res.json({
    ok: true,
    defaults: backupRetention.DEFAULTS,
    global: backupRetention.globalConfig(),
    effective: backupRetention.effective(req.params.id),
  });
});

router.post(
  '/servers/:id/backups/retention',
  requireRoleKeys('admin'),
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    // { reset: true } clears the per-server override; otherwise merge the patch.
    const body = req.body || {};
    const effective = body.reset
      ? backupRetention.setServer(req.params.id, null)
      : backupRetention.setServer(req.params.id, retentionPatchSchema.parse(body));
    res.json({ ok: true, effective });
  })
);

// ---- Blueprints ----
router.use('/blueprints', require('./blueprints'));

// ---- World quick controls (Overview tab) - version-tolerant service ----
const worldControls = require('../../services/worldControls');

const WORLD_STATE_LIVE_STATUSES = new Set(['running', 'unhealthy', 'stalled']);

router.get(
  '/servers/:id/world/state',
  asyncHandler(async (req, res, next) => {
    const server = requireServer(req.params.id);
    // ?rules=a,b,c limits the gamerule reads to what the page is showing;
    // ?all=1 forces the full set.
    const all = req.query.all === '1' || req.query.all === 'true';
    const rules = all
      ? undefined
      : String(req.query.rules || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    const asked = rules && rules.length ? rules : null;

    // Stopped/crashed: read the last-saved values straight from level.dat so the
    // rail still shows the world clock and gamerule states (read-only - the
    // <fieldset> is disabled offline). starting/updating: the world may be mid
    // (re)generation, so report "not available yet".
    if (!WORLD_STATE_LIVE_STATUSES.has(server.status)) {
      if (server.status === 'starting' || server.status === 'updating') {
        return res.json({ ok: true, running: false, state: {} });
      }
      const state = await worldControls.getStateOffline(req.params.id, { rules });
      const degraded = asked ? asked.some((r) => !Object.hasOwn(state, r)) : false;
      return res.json({ ok: true, running: false, offline: true, degraded, state });
    }

    try {
      const state = await worldControls.getState(req.params.id, { rules });
      // Flag a partial read so the page can say "some settings couldn't be read"
      // rather than showing stale chips as if they were current.
      const degraded = asked ? asked.some((r) => !Object.hasOwn(state, r)) : false;
      res.json({ ok: true, running: true, degraded, state });
    } catch (err) {
      // The status says running but RCON isn't answering (just-booted, wedged).
      // Fall back to the on-disk values rather than showing nothing.
      logger.info('Could not read live world state; falling back to level.dat.', {
        serverId: req.params.id,
        err: serializeError(err, { includeStack: false }),
      });
      const state = await worldControls.getStateOffline(req.params.id, { rules });
      const degraded = asked ? asked.some((r) => !Object.hasOwn(state, r)) : false;
      res.json({ ok: true, running: false, offline: true, degraded, state });
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

// ---- Shrink world (remove rarely-visited chunks) ----
// dryRun:true previews the numbers synchronously (the modal shows them before
// the confirm); a real run is a task (it can touch thousands of region files).
// Server must be stopped - worldShrink.shrinkWorld enforces that with a 409.
const worldShrink = require('../../services/worldShrink');
const SHRINK_LIVE_STATUSES = new Set(['running', 'starting', 'unhealthy', 'stalled', 'updating']);
router.post(
  '/servers/:id/worlds/:world/shrink',
  requireRoleKeys('admin', 'operator'),
  asyncHandler(async (req, res, next) => {
    const server = requireServer(req.params.id);
    const src = { ...req.query, ...req.body };
    const { world, dryRun, minInhabitedTicks, spawnKeepChunks, autoStopStart } = z
      .object({
        world: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9 _.-]{1,64}$/),
        dryRun: z.coerce.boolean().default(false),
        // "rarely visited" threshold in ticks (20 = 1 s), 1 tick .. 1 game-hour.
        minInhabitedTicks: z.coerce
          .number()
          .int()
          .min(1)
          .max(20 * 60 * 60)
          .optional(),
        // keep overworld chunks within N of the origin; 0 disables spawn protection.
        spawnKeepChunks: z.coerce.number().int().min(0).max(256).optional(),
        // when the server is up: stop it, shrink, then start it again.
        autoStopStart: z.coerce.boolean().default(false),
      })
      .parse({ world: req.params.world, ...src });
    const actor = req.user.username;
    const shrinkOpts = { worldName: world, actor, minInhabitedTicks, spawnKeepChunks };

    if (dryRun) {
      const result = await worldShrink.shrinkWorld(server.id, { ...shrinkOpts, dryRun: true });
      return res.json({ ok: true, ...result });
    }

    const isLive = SHRINK_LIVE_STATUSES.has(server.status);
    if (isLive && !autoStopStart) {
      // Same 409 the service would throw, but decided here so the client can
      // offer the stop/start wrapper instead.
      throw Object.assign(
        new Error('Stop the server before shrinking its world, or choose the stop-and-restart option.'),
        { status: 409 }
      );
    }

    const taskId = tasks.run(
      `Shrinking "${world}" on ${server.display_name}`,
      { serverId: server.id, actor },
      async (t) => {
        // Decide from the CONTAINER's current state, not the DB row above (which
        // is only refreshed by the 60s status poll and can be stale right after a
        // start/stop). A stale "stopped" here would corrupt: shrink would run
        // while the JVM is actually writing region files.
        let wasRunning = false;
        if (autoStopStart && (await worldShrink.isLive(server.id))) {
          wasRunning = true;
          t.step('Stopping the server');
          await servers.stopServer(server.id, { actor });
        }
        t.step('Scanning region files for rarely-visited chunks');
        const result = await worldShrink.shrinkWorld(server.id, shrinkOpts);
        if (wasRunning) {
          t.step('Starting the server back up');
          await servers.startServer(server.id, { actor });
        }
        return { ...result, restarted: wasRunning };
      }
    );
    res.status(202).json({ ok: true, taskId });
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

// ---- Conversational chatbot (legacy /wizard API; configuration + transcripts are admin-only) ----
router.use('/servers/:id/wizard', requireRoleKeys('admin'), require('./wizard'));

// ---- Analytics & activity timeline ----
router.use('/servers/:id/analytics', require('./analytics'));

// ---- Inventory forensics ----
router.use('/servers/:id/inventory', require('./inventory'));
router.use('/inventory', require('./inventory').globalSearch);

// ---- Item registry (JEI-style browser, built from the server's own jars) ----
router.use('/servers/:id/items', require('./items'));

// ---- Mods manager ----
const mods = require('../../services/mods');

// Applying a mod update only swaps the jar on disk; the running JVM keeps the
// old classes until the server restarts. Restart only when it's actually up -
// a stopped server picks the new jars up on its next start.
const MOD_RESTART_STATES = new Set(['running', 'starting', 'unhealthy', 'stalled']);
async function restartAfterModUpdate(serverId, actor) {
  const server = servers.getServer(serverId);
  if (!server || !MOD_RESTART_STATES.has(server.status)) return false;
  await servers.restartServer(serverId, { actor });
  return true;
}

router.get(
  '/servers/:id/mods',
  asyncHandler(async (req, res, next) => {
    res.json({ ok: true, mods: await mods.listContent(req.params.id) });
  })
);

router.post(
  '/servers/:id/mods',
  asyncHandler(async (req, res, next) => {
    const { url, kind, ignoreVersion } = z
      .object({
        url: z.string().trim().min(3).max(500),
        kind: z.enum(['mod', 'plugin', 'datapack', 'resourcepack']).optional(),
        // User explicitly accepted the risk of installing a build not listed
        // as compatible with this server's exact MC version and/or loader.
        ignoreVersion: z.boolean().optional(),
      })
      .parse(req.body);
    const result = await mods.installFromUrl(req.params.id, url, {
      actor: req.user.username,
      kind,
      ignoreVersion,
    });
    res.status(201).json({
      ok: true,
      installed: {
        name: result.library.name,
        filename: result.filename,
        version: result.library.version,
        versionOverridden: result.versionOverridden,
        loaderOverridden: result.loaderOverridden,
      },
    });
  })
);

// Update one overlay mod to its latest checked version. Accepts the
// installed filename ({file}) or the server_content row id ({contentId}).
// Re-downloads through the platform (pinned to the checked version id),
// replaces the old file, preserves the enabled/disabled state, then restarts
// the server if it was running so the new jar is actually loaded.
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

    const result = await mods.applyOverlayUpdate(server.id, { file, contentId }, { actor });
    const restarted = await restartAfterModUpdate(server.id, actor);
    res.json({
      ok: true,
      restarted,
      installed: {
        name: result.name,
        filename: result.filename,
        version: result.version,
        enabled: result.wasEnabled,
      },
    });
  })
);

// Ignore / un-ignore the currently-offered update for one overlay mod. An
// ignored build stops showing on the mods tab, the Updates page and the
// sidebar count; a later, genuinely newer build re-surfaces on its own.
router.post(
  '/servers/:id/mods/ignore-update',
  asyncHandler(async (req, res, next) => {
    const { file, contentId, ignore } = z
      .object({
        file: z.string().min(1).max(200).optional(),
        contentId: z.string().trim().max(40).optional(),
        ignore: z.boolean(),
      })
      .refine((v) => Boolean(v.file) || Boolean(v.contentId), { message: 'Provide file or contentId' })
      .parse(req.body);
    const server = requireServer(req.params.id);
    const out = mods.setIgnoredUpdate(server.id, { file, contentId }, { ignore, actor: req.user.username });
    res.json({ ok: true, ...out });
  })
);

// Apply every non-ignored overlay-mod update for this server, then restart it
// once (if it was running). Long operation - returns {ok, taskId}; the task
// result is { updated, failed, restarted }.
router.post(
  '/servers/:id/mods/update-all',
  asyncHandler((req, res, next) => {
    const server = requireServer(req.params.id);
    const actor = req.user.username;
    const taskId = tasks.run(`Updating mods on ${server.display_name}`, { serverId: server.id, actor }, async (t) => {
      const rows = db.all(
        `SELECT sc.id, sc.name
             FROM server_content sc
             JOIN library_files lf ON lf.id = sc.library_id
             JOIN update_checks uc ON uc.subject_type = 'content' AND uc.subject_id = sc.id
            WHERE sc.server_id = ? AND sc.managed_by = 'overlay' AND lf.project_id IS NOT NULL
              AND uc.latest_name IS NOT NULL AND uc.latest_name != sc.version
              AND (sc.ignored_update_version IS NULL OR sc.ignored_update_version != uc.latest_name)`,
        server.id
      );
      const updated = [];
      const failed = [];
      for (const row of rows) {
        t.step(`Updating ${row.name}`);
        try {
          const r = await mods.applyOverlayUpdate(server.id, { contentId: row.id }, { actor });
          updated.push({ name: r.name, version: r.version });
        } catch (err) {
          failed.push({ name: row.name, error: err.message });
        }
      }
      let restarted = false;
      if (updated.length) {
        t.step('Restarting server');
        restarted = await restartAfterModUpdate(server.id, actor);
      }
      return { updated, failed, restarted };
    });
    res.status(202).json({ ok: true, taskId });
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
  requireRoleKeys('admin', 'operator'),
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
      fs.promises.rm(req.file.path, { force: true }).catch((e) => {
        logger.debug('Could not remove a temporary upload file.', {
          err: serializeError(e, { includeStack: false }),
        });
      });
    }
  })
);

// ---- Mod-zip importer ----
// One upload, two shapes, auto-detected: a CurseForge modpack export
// (manifest.json of pinned {projectID, fileID} pairs + overrides/) or a
// hand-assembled zip of jars. Two-phase like blueprints: preview (non-mutating,
// returns an uploadToken) → import (runs as a task with per-mod progress).
const contentZip = require('../../services/contentZip');
const { nanoid: zipNanoid } = require('nanoid');
const zipImportUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, dataPath('tmp')),
    filename: (req, file, cb) => cb(null, `modzip-${zipNanoid(10)}.zip`),
  }),
  limits: { fileSize: 8 * 1024 ** 3, files: 1 },
});
const zipTokenSchema = z.string().regex(/^modzip-[A-Za-z0-9_-]{10}\.zip$/, 'Invalid upload token');
const zipImportBodySchema = z.object({
  uploadToken: zipTokenSchema,
  // pack zips select by fileId (number), jar zips by entry name (string)
  selections: z
    .array(z.union([z.coerce.number(), z.string().max(300)]))
    .max(1500)
    .optional(),
  applyOverrides: z.coerce.boolean().optional(),
});

router.post(
  '/servers/:id/mods/import-zip/preview',
  zipImportUpload.single('file'),
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    if (!req.file) throw Object.assign(new Error('No file uploaded'), { status: 400 });
    let preview;
    try {
      preview = await contentZip.previewForServer(req.params.id, req.file.path);
    } catch (err) {
      await fsp.rm(req.file.path, { force: true }).catch(() => {});
      throw err;
    }
    res.json({ ok: true, preview, uploadToken: req.file.filename });
  })
);

router.post(
  '/servers/:id/mods/import-zip',
  asyncHandler(async (req, res, next) => {
    const server = requireServer(req.params.id);
    const input = zipImportBodySchema.parse(req.body);
    const zipPath = dataPath('tmp', input.uploadToken);
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ ok: false, error: 'Uploaded zip expired, upload it again' });
    }
    const actor = req.user.username;
    const taskId = tasks.run(
      `Importing mod zip into ${server.display_name}`,
      { actor, serverId: server.id },
      async (t) => {
        try {
          return await contentZip.importForServer(server.id, zipPath, {
            selections: input.selections || null,
            applyOverrides: Boolean(input.applyOverrides),
            actor,
            onStep: (s) => t.step(s),
          });
        } finally {
          await fsp.rm(zipPath, { force: true }).catch(() => {});
        }
      }
    );
    res.status(202).json({ ok: true, taskId });
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

// Export builds the whole body in memory and (server-scoped) is a heavier read
// than a plain list - gate it to write-capable roles rather than leaving it open
// to viewers via the method-based requireWrite.
router.get(
  '/events/export',
  requireRoleKeys('admin', 'operator'),
  require('../middleware/auth').rejectCrossSiteGet,
  asyncHandler((req, res, next) => {
    sendEventExport(req, res, String(req.query.server || '') || null);
  })
);

router.get(
  '/servers/:id/events/export',
  requireRoleKeys('admin', 'operator'),
  require('../middleware/auth').rejectCrossSiteGet,
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    sendEventExport(req, res, req.params.id);
  })
);

// Captured log excerpt for one event (text/plain; 404 when none was captured).
router.get(
  '/events/:id/excerpt',
  asyncHandler(async (req, res, next) => {
    const event = eventsService.getEvent(Number(req.params.id));
    if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
    const text = await eventsService.readExcerpt(event);
    if (text == null) throw Object.assign(new Error('No captured log for this event'), { status: 404 });
    res.type('text/plain').send(text);
  })
);

// Prune event history older than N days (excerpts included). The prune is a
// global delete (not server-scoped) so it needs the same admin-only gate as
// the retention config that would normally trigger it.
router.post(
  '/events/prune',
  requireRoleKeys('admin'),
  asyncHandler(async (req, res, next) => {
    const { days } = z.object({ days: z.coerce.number().int().min(1).max(3650) }).parse(req.body);
    const { removed } = await eventsService.pruneEvents(days, { actor: req.user.username });
    res.json({ ok: true, removed });
  })
);

// ---- Archived per-server logs (data/logs/<id>/events) ----

// Archived per-event log excerpts, written only by the panel (events/index.js)
// as `${Date.now()}-${type}-${nanoid(4)}.log`. The regex is defense-in-depth on
// top of safeJoin's containment check - require the .log suffix the panel uses
// and keep the character class tight (word chars, dots, parens/brackets, dashes)
// while excluding whitespace and anything a path separator could hide behind.
const archivedFileSchema = z.string().regex(/^[\w.,()[\]-]+\.log$/, 'Invalid archived log name');

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

// ---- Full game logs (the server's own logs/ dir on the bind mount) ----
// The /logs endpoint above is a small in-memory docker tail (capped 2000 lines);
// these serve the complete files Minecraft itself rotates: logs/latest.log and
// the gzipped history next to it.
const gameLogFileSchema = z.string().regex(/^[\w.-]+\.log(\.gz)?$/, 'Invalid log file name');

async function listGameLogs(serverId) {
  const dir = dataPath('servers', serverId, 'logs');
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  const out = [];
  for (const e of entries) {
    if (!e.isFile() || !/\.log(\.gz)?$/.test(e.name)) continue;
    const st = await fsp.stat(path.join(dir, e.name)).catch(() => null);
    if (st) out.push({ file: e.name, size: st.size, mtimeMs: st.mtimeMs });
  }
  // latest.log first, then newest-rotated first.
  out.sort((a, b) => (a.file === 'latest.log' ? -1 : b.file === 'latest.log' ? 1 : b.mtimeMs - a.mtimeMs));
  return out;
}

router.get(
  '/servers/:id/logs/game',
  asyncHandler(async (req, res, next) => {
    requireServer(req.params.id);
    res.json({ ok: true, files: await listGameLogs(req.params.id) });
  })
);

router.get(
  '/servers/:id/logs/game/:file',
  asyncHandler((req, res, next) => {
    requireServer(req.params.id);
    const file = gameLogFileSchema.parse(req.params.file);
    const abs = dataPath('servers', req.params.id, 'logs', file);
    if (!fs.existsSync(abs)) throw Object.assign(new Error('Log file not found'), { status: 404 });
    res.download(abs, file);
  })
);

// Every log file for the server, zipped on the fly. Bounded so a pathological
// logs/ dir can't stream forever.
const LOG_BUNDLE_MAX_BYTES = 512 * 1024 * 1024;
router.get(
  '/servers/:id/logs/bundle.zip',
  asyncHandler(async (req, res, next) => {
    const server = requireServer(req.params.id);
    const dir = dataPath('servers', req.params.id, 'logs');
    const list = await listGameLogs(req.params.id);
    if (!list.length) throw Object.assign(new Error('This server has no log files yet'), { status: 404 });
    const total = list.reduce((n, f) => n + f.size, 0);
    if (total > LOG_BUNDLE_MAX_BYTES) {
      throw Object.assign(new Error('Log folder is too large to bundle - download individual files instead'), {
        status: 413,
      });
    }
    const archiver = require('archiver');
    const safeName = String(server.display_name || req.params.id).replace(/[^\w.-]+/g, '_');
    res.attachment(`${safeName}-logs.zip`);
    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.on('error', (err) => {
      logger.error('Log bundle stream failed.', { serverId: req.params.id, err: serializeError(err) });
      if (res.headersSent) return res.destroy();
      res.status(500).end();
    });
    zip.pipe(res);
    for (const f of list) zip.file(path.join(dir, f.file), { name: f.file });
    zip.finalize();
  })
);

// ---- Custom server icon upload + serving ----

const ICON_MAX_BYTES = 16 * 1024 * 1024;
const ICON_EXTS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
const MAX_ICON_DIMENSION = 8192;
const iconUpload = multer({ dest: dataPath('tmp'), limits: { fileSize: ICON_MAX_BYTES, files: 1 } });

// multipart field: 'icon'. Stores data/library/icons/custom/<serverId><ext>
// and sets servers.icon = 'custom:<filename>' (render via /api/icons/custom/<file>).
router.post('/servers/:id/icon', iconUpload.single('icon'), async (req, res, next) => {
  let consumed = false;
  try {
    const server = requireServer(req.params.id);
    if (!req.file) throw Object.assign(new Error('Attach an image (field "icon")'), { status: 400 });
    const ext = ICON_EXTS[req.file.mimetype];
    if (!ext) {
      throw Object.assign(new Error('Icons must be PNG, JPEG, WebP or SVG (max 16 MB)'), { status: 400 });
    }
    if (!(await matchesImageType(req.file.path, req.file.mimetype))) {
      throw Object.assign(new Error("File contents don't match the declared image type"), { status: 400 });
    }
    if (req.file.mimetype === 'image/svg+xml') {
      const clean = sanitizeSvg(await fsp.readFile(req.file.path, 'utf8'));
      if (!/<svg[\s>]/i.test(clean)) {
        throw Object.assign(new Error('That SVG could not be processed safely'), { status: 400 });
      }
      await fsp.writeFile(req.file.path, clean, 'utf8');
    } else {
      const dims = await imageDimensions(req.file.path, req.file.mimetype);
      if (dims && (dims.width > MAX_ICON_DIMENSION || dims.height > MAX_ICON_DIMENSION)) {
        throw Object.assign(
          new Error(`Image is too large in pixels (max ${MAX_ICON_DIMENSION}x${MAX_ICON_DIMENSION})`),
          { status: 400 }
        );
      }
    }
    const filename = `${server.id}${ext}`;
    const destDir = dataPath('library', 'icons', 'custom');
    await fsp.mkdir(destDir, { recursive: true });
    // Swap the new file in via a single rename off a sibling temp name (atomic
    // on the destination fs) - never rm-then-rename, which leaves a window where
    // a concurrent GET 404s or reads a half-written file.
    const stagePath = path.join(destDir, `.tmp-${server.id}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    await fsp.rename(req.file.path, stagePath).catch(async () => {
      await fsp.copyFile(req.file.path, stagePath);
      await fsp.rm(req.file.path, { force: true });
    });
    await fsp.rename(stagePath, path.join(destDir, filename)).catch(async (e) => {
      await fsp.rm(stagePath, { force: true }).catch(() => {});
      throw e;
    });
    consumed = true;
    // Retire stale variants with a different extension (new file already in place).
    for (const other of Object.values(ICON_EXTS)) {
      if (other !== ext) {
        await fsp.rm(path.join(destDir, `${server.id}${other}`), { force: true }).catch((e) => {
          logger.debug('Could not remove a stale server icon variant.', {
            serverId: server.id,
            err: serializeError(e, { includeStack: false }),
          });
        });
      }
    }
    db.run('UPDATE servers SET icon = ? WHERE id = ?', `custom:${filename}`, server.id);
    eventsService.recordEvent({
      serverId: server.id,
      actor: req.user.username,
      type: 'config-changed',
      summary: 'Custom server icon uploaded',
    });
    logger.info('Uploaded a custom server icon.', { serverId: server.id, actor: req.user.username });
    res.json({ ok: true, icon: `custom:${filename}`, url: `/api/icons/custom/${filename}` });
  } catch (err) {
    if (req.file && !consumed) {
      await fsp.rm(req.file.path, { force: true }).catch((e) => {
        logger.debug('Could not remove a temporary upload file.', {
          err: serializeError(e, { includeStack: false }),
        });
      });
    }
    next(err);
  }
});

router.get(
  '/icons/custom/:file',
  asyncHandler((req, res, next) => {
    const file = z
      .string()
      .regex(/^srv_[\w-]+\.(png|svg|jpg|webp)$/, 'Invalid icon file')
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

// Uploaded profile pictures (web/routes/account.js handles the upload itself,
// self-service). Not scoped to req.user - any authenticated user may view any
// other user's avatar image, same openness as the server-icon route above.
router.get(
  '/avatars/custom/:file',
  asyncHandler((req, res, next) => {
    const file = z
      .string()
      .regex(/^usr_[\w-]+\.(png|svg|jpg|webp)$/, 'Invalid avatar file')
      .parse(req.params.file);
    const abs = dataPath('library', 'icons', 'users', file);
    if (!fs.existsSync(abs)) throw Object.assign(new Error('Avatar not found'), { status: 404 });
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(abs);
  })
);

// Mod/plugin/datapack platform icons are cached locally by library.cacheIcon()
// under data/library/icons/ and served by the authenticated /library/icons
// static mount in app.js (with the same sandbox CSP this route used to set,
// so a registry-supplied .svg still cannot run script). listContent emits the
// icon URL from icon_rel_path.

// ---- Users (admin only) ----
const authService = require('../../services/auth');
const { requireRole } = require('../middleware/auth');

router.get('/users', requireRole('admin'), (req, res) => {
  res.json({ ok: true, users: authService.listUsers() });
});

// ---- Sign-in lockouts (in-memory; admin visibility + manual unlock) ----
const authMw = require('../middleware/auth');

router.get('/auth/lockouts', requireRole('admin'), (req, res) => {
  res.json({ ok: true, lockouts: authMw.listActiveLockouts() });
});

router.post(
  '/auth/lockouts/clear',
  requireRole('admin'),
  asyncHandler((req, res, next) => {
    const { username, ip, all } = z
      .object({
        username: z.string().trim().min(1).max(64).optional(),
        ip: z.string().trim().max(64).optional(),
        all: z.coerce.boolean().optional(),
      })
      .parse(req.body || {});
    if (!all && !username) throw Object.assign(new Error('Pass a username, or all:true'), { status: 400 });
    const removed = authMw.clearLockouts({ username, ip, all: Boolean(all) });
    eventsService.recordEvent({
      actor: req.user.username,
      type: 'login-unlocked',
      summary: all
        ? `${req.user.username} cleared all sign-in lockouts`
        : `${req.user.username} cleared the sign-in lockout for "${username}"`,
      details: { username: username || null, ip: ip || null, all: Boolean(all), removed },
    });
    res.json({ ok: true, removed, lockouts: authMw.listActiveLockouts() });
  })
);

router.post(
  '/users',
  requireRole('admin'),
  asyncHandler(async (req, res, next) => {
    const { username, password, role } = z
      .object({
        username: z.string().trim().min(2).max(32),
        password: z.string().min(8).max(200),
        role: z.enum(['admin', 'operator', 'viewer']),
      })
      .parse(req.body);
    res.status(201).json({
      ok: true,
      user: await authService.createUser({ username, password, role }, { actor: req.user.username }),
    });
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
  asyncHandler(async (req, res, next) => {
    const { password, currentPassword } = z
      .object({
        password: z.string().min(8).max(200),
        currentPassword: z.string().min(1).max(200),
      })
      .parse(req.body);
    const isSelf = req.params.id === req.user.id;
    // Re-verify the acting admin's own password (shared login lockout), mirroring
    // the account 2FA routes - a hijacked-but-live session can't set any
    // password, including its own, without knowing the real one.
    authMw.checkLoginAllowed(req.user.username, req.ip);
    try {
      // Self password change rotates the ACTING session away too (exceptSid=null):
      // the attacker's preserved session must not survive adopting the new password.
      await authService.changePassword(req.user.id, req.params.id, currentPassword, password, {
        actor: req.user.username,
        exceptSid: isSelf ? null : req.sessionID,
      });
    } catch (err) {
      if (err.status === 401) {
        authMw.recordLoginFailure(req.user.username, req.ip);
        logger.warn('Rejected a password change with a wrong admin password.', { userId: req.user.id, ip: req.ip });
      }
      throw err;
    }
    authMw.clearLoginFailures(req.user.username, req.ip);
    if (isSelf) {
      // Drop the acting session's server-side row + clear its cookie so the
      // client must re-authenticate with the new password.
      req.session.destroy(() => {});
    }
    logger.info('Admin changed a password.', { actor: req.user.username, targetId: req.params.id, isSelf });
    res.json({ ok: true, signedOutAll: isSelf });
  })
);

router.delete(
  '/users/:id',
  requireRole('admin'),
  asyncHandler(async (req, res, next) => {
    authService.deleteUser(req.params.id, { actor: req.user.username });
    // The users.avatar row is gone with the user; drop any uploaded file too so
    // it isn't left orphaned on disk and still fetchable by its stable URL.
    await removeAvatarFiles(req.params.id);
    res.json({ ok: true });
  })
);

// Recovery path when a user loses both their authenticator and their backup
// codes - an admin can force-clear 2FA without knowing their password (same
// trust level as the admin password-reset above). The user re-enrolls fresh.
// Deliberately refuses to target the caller's own account: that would be a
// password-free way to strip your own 2FA that /api/account/totp/disable
// (which does re-check the password) exists specifically to prevent.
router.post(
  '/users/:id/totp/disable',
  requireRole('admin'),
  asyncHandler((req, res, next) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ ok: false, error: "Use your own account's two-factor settings to turn it off." });
    }
    authService.adminDisableTotp(req.params.id, { actor: req.user.username });
    res.json({ ok: true });
  })
);

// ---- Unified mod browser (wizard "From mods" + per-server mods tab) ----
const modBrowser = require('../../services/modBrowser');
const loaderVersions = require('../../services/loaderVersions');

const MOD_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];
// Plugin servers report 'paper' as their loader; the browser strips it for
// plugin searches server-side, but the schema must let it through.
const BROWSER_LOADERS = [...MOD_LOADERS, 'paper'];
const CONTENT_KINDS = ['mod', 'plugin'];

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

// Unified mod/plugin search across Modrinth / CurseForge, filtered to loader + MC.
router.get(
  '/mods/search',
  asyncHandler(async (req, res, next) => {
    const { q, platform, kind, loader, mc } = z
      .object({
        q: z.string().trim().max(120).default(''),
        platform: z.enum(['modrinth', 'curseforge', 'hangar', 'spiget']).default('modrinth'),
        kind: z.enum(CONTENT_KINDS).default('mod'),
        loader: z.enum(BROWSER_LOADERS).optional(),
        mc: z.string().trim().max(32).optional(),
      })
      .parse({
        q: req.query.q || '',
        platform: req.query.platform || undefined,
        kind: req.query.kind || undefined,
        loader: req.query.loader || undefined,
        mc: req.query.mc || undefined,
      });
    res.json({ ok: true, results: await modBrowser.search({ query: q, platform, kind, loader, mc }) });
  })
);

// A mod's builds for the chosen loader + MC, newest first (for its version picker).
router.get(
  '/mods/versions',
  asyncHandler(async (req, res, next) => {
    const { platform, ref, kind, loader, mc } = z
      .object({
        platform: z.enum(['modrinth', 'curseforge', 'hangar', 'spiget']),
        ref: z.string().trim().min(1).max(200),
        kind: z.enum(CONTENT_KINDS).default('mod'),
        loader: z.enum(BROWSER_LOADERS).optional(),
        mc: z.string().trim().max(32).optional(),
      })
      .parse({
        platform: req.query.platform,
        ref: req.query.ref,
        kind: req.query.kind || undefined,
        loader: req.query.loader || undefined,
        mc: req.query.mc || undefined,
      });
    res.json({ ok: true, versions: await modBrowser.versions({ platform, ref, kind, loader, mc }) });
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
              platform: z.enum(['modrinth', 'curseforge', 'hangar', 'spiget']),
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
          platform: z.enum(['modrinth', 'curseforge', 'hangar', 'spiget']),
          ref: z.string().trim().min(1).max(200),
          versionId: z.string().trim().min(1).max(60).optional(),
        })
      )
      .max(100)
      .default([]),
    heapMb: z.coerce.number().int().min(512).max(262144).optional(),
    containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
    diskQuotaGb: optNum0(16384),
    portGame: z.coerce.number().int().min(1024).max(65535).optional(),
    env: z.record(z.string(), z.string()).optional(),
    ...dockerOverridesSchema,
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
    requireAdminForOverrides(req, input);
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
          containerName: input.containerName,
          networkName: input.networkName,
          extraPorts: input.extraPorts,
          extraBinds: input.extraBinds,
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
            : m.platform === 'hangar'
              ? `https://hangar.papermc.io/p/${m.ref}` // owner segment is decorative
              : m.platform === 'spiget'
                ? `https://www.spigotmc.org/resources/${m.ref}`
                : `https://modrinth.com/mod/${m.ref}`;
        const url = m.versionId
          ? m.platform === 'curseforge'
            ? `${base}/files/${m.versionId}`
            : m.platform === 'hangar'
              ? `${base}/versions/${encodeURIComponent(m.versionId)}`
              : m.platform === 'spiget'
                ? `${base}?version=${m.versionId}`
                : `${base}/version/${m.versionId}`
          : base;
        t.step(`Installing mod ${i + 1}/${input.mods.length}: ${m.ref}`);
        try {
          await mods.installFromUrl(server.id, url, { actor });
        } catch (err) {
          failed.push(`${m.ref} (${err.message})`);
          logger.warn('A mod failed to install during create-from-mods.', {
            serverId: server.id,
            mod: m.ref,
            platform: m.platform,
            err: serializeError(err, { includeStack: false }),
          });
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

// Server-less zip preview for the wizard's "create from zip" flow — same
// two-phase token contract as the per-server preview.
router.post(
  '/mods/zip-preview',
  zipImportUpload.single('file'),
  asyncHandler(async (req, res, next) => {
    if (!req.file) throw Object.assign(new Error('No file uploaded'), { status: 400 });
    let preview;
    try {
      preview = await contentZip.previewStandalone(req.file.path);
    } catch (err) {
      await fsp.rm(req.file.path, { force: true }).catch(() => {});
      throw err;
    }
    res.json({ ok: true, preview, uploadToken: req.file.filename });
  })
);

const fromZipSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(4000).optional(),
    icon: z.string().max(64).optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    // 'paper' covers zips of plugins — the digester infers the kind.
    loader: z.enum([...MOD_LOADERS, 'paper']),
    mcVersion: z.string().trim().min(1).max(32),
    loaderVersion: z.string().trim().max(40).optional(),
    // Native-loader mode: the zip already contains a complete, installed
    // loader (a locally-prepared server pack) - the detected loader build is
    // used to pin the container instead of asking the user to type one.
    nativeLoader: z.coerce.boolean().optional(),
    uploadToken: zipTokenSchema,
    selections: z
      .array(z.union([z.coerce.number(), z.string().max(300)]))
      .max(1500)
      .optional(),
    applyOverrides: z.coerce.boolean().optional(),
    heapMb: z.coerce.number().int().min(512).max(262144).optional(),
    containerMemoryMb: z.coerce.number().int().min(1024).max(524288).optional(),
    diskQuotaGb: optNum0(16384),
    portGame: z.coerce.number().int().min(1024).max(65535).optional(),
    env: z.record(z.string(), z.string()).optional(),
    ...dockerOverridesSchema,
  })
  .refine((v) => !v.containerMemoryMb || !v.heapMb || v.containerMemoryMb > v.heapMb, {
    message: 'Container memory limit must be higher than the Java heap (or the JVM will be OOM-killed)',
  });

// One-shot "create server from an uploaded zip": create (no start) → bulk
// install the zip's mods → optional overrides → start, all inside ONE task.
// Same tolerance contract as from-mods: per-mod failures are reported, the
// server still comes up.
router.post(
  '/servers/from-zip',
  asyncHandler(async (req, res, next) => {
    const input = fromZipSchema.parse(req.body);
    requireAdminForOverrides(req, input);
    const zipPath = dataPath('tmp', input.uploadToken);
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ ok: false, error: 'Uploaded zip expired, upload it again' });
    }
    const actor = req.user.username;
    const env = { ...(input.env || {}) };
    // Native-loader mode: reconcile the container to the loader that's already
    // installed inside the zip (detected server-side - the client's numbers are
    // never trusted for this) rather than requiring an explicit loader version.
    // itzg's start script then reuses the installed build instead of laying
    // down a fresh loader over the pack's files.
    let loader = input.loader;
    let mcVersion = input.mcVersion;
    let loaderVersion = input.loaderVersion;
    if (input.nativeLoader) {
      const native = await contentZip.detectNativeLoader(zipPath).catch(() => null);
      if (native) {
        if (native.loader) loader = native.loader;
        if (native.mcVersion) mcVersion = native.mcVersion;
        if (native.loaderVersion) loaderVersion = native.loaderVersion;
      }
    }
    const type = loader.toUpperCase();
    const taskId = tasks.run(`Creating ${input.name} from zip`, { actor }, async (t) => {
      try {
        const envKey = loader !== 'paper' ? loaderVersions.envKeyFor(loader) : null;
        if (loaderVersion && envKey) env[envKey] = loaderVersion;
        t.step('Creating server');
        const server = await servers.createServer(
          {
            name: input.name,
            description: input.description,
            icon: input.icon,
            accent: input.accent,
            type,
            mcVersion,
            env,
            heapMb: input.heapMb,
            containerMemoryMb: input.containerMemoryMb,
            diskQuotaGb: input.diskQuotaGb,
            portGame: input.portGame,
            containerName: input.containerName,
            networkName: input.networkName,
            extraPorts: input.extraPorts,
            extraBinds: input.extraBinds,
          },
          { actor, start: false, onProgress: (s) => t.step(s) }
        );
        // Install BEFORE first boot so the loader server starts with mods present.
        const report = await contentZip.importForServer(server.id, zipPath, {
          selections: input.selections || null,
          applyOverrides: Boolean(input.applyOverrides),
          actor,
          onStep: (s) => t.step(s),
        });
        t.step('Starting server');
        await servers.startServer(server.id, { actor });
        return { serverId: server.id, name: server.display_name, report };
      } finally {
        await fsp.rm(zipPath, { force: true }).catch(() => {});
      }
    });
    res.status(202).json({ ok: true, taskId });
  })
);

function publicServer(s) {
  if (!s) return null;
  const { rcon_password_cipher, env_json, notes, env, ...rest } = s;
  return rest;
}

router.use(makeJsonErrorHandler('api', { fileTooLarge: 'That image is too large (max 16 MB).' }));

module.exports = router;
