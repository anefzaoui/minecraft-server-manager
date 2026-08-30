'use strict';

// Error-reporting seam FIRST - before anything else loads - so a future Sentry
// wiring in instrument.js patches the runtime ahead of the rest of the app.
require('./instrument');

// Preflight SECOND - fail clearly on an unsupported Node runtime before config,
// the DB, or the runtime error net can turn it into a cryptic crash.
require('./preflight');

const logger = require('./logger')('boot');
const { captureError, closeSentry } = require('./instrument');
const { serializeError } = require('./utils/logSanitize');
const { makeFailureThrottle } = require('./logger');

function bailOut(code = 1) {
  closeSentry().finally(() => process.exit(code));
}

function installRuntimeGuards() {
  // Last-resort safety net: a control panel must stay up. The specific fixes (e.g.
  // WebSocket 'error' handlers) prevent the known crash paths; this backstop keeps
  // a stray uncaught error or rejected promise from taking the whole panel down.
  // Installed only AFTER a successful boot, so startup errors stay fatal and
  // visible instead of being silently swallowed.
  //
  // Operators running under a supervisor (systemd, Docker restart:) that WANT a
  // hard restart on an unexpected fault can set MSM_EXIT_ON_FATAL=1.
  const exitOnFatal = /^(1|true|yes)$/i.test(process.env.MSM_EXIT_ON_FATAL || '');

  const report = (kind, err) => {
    const info = serializeError(err);
    // Structured line for log aggregators, plus a panel event so it surfaces in
    // Activity (and Discord Alerts, if wired) rather than only in stdout.
    logger.error('Caught a fatal runtime fault and kept the panel alive.', { kind, err: info });
    captureError(err, { scope: 'runtime-guard', kind });
    try {
      require('./events').recordEvent({
        type: 'panel-error',
        actor: 'system',
        summary: `Uncaught ${kind}: ${info.errorMessage}`.slice(0, 300),
        details: info,
      });
    } catch {
      /* the DB may be exactly what broke - never let reporting throw */
    }
    if (exitOnFatal) process.exit(1);
  };

  process.on('uncaughtException', (err) => report('exception', err));
  process.on('unhandledRejection', (reason) => report('rejection', reason));
}

try {
  const config = require('./config');
  const { ensureDataRoot } = require('./storage/dataRoot');
  const { migrate } = require('./db/migrate');

  // Boot order matters: data root first (the DB lives inside it), then schema.
  ensureDataRoot();
  migrate();

  // Fast, read-only sanity check on the one file that holds all panel state.
  // A corrupt DB won't fix itself; say so loudly so the operator reaches for a
  // panel-DB snapshot (data/backups/_panel/) before more writes pile on.
  try {
    const row = require('./db').get('PRAGMA integrity_check');
    const verdict = row ? row.integrity_check || Object.values(row)[0] : 'unknown';
    if (verdict !== 'ok') {
      logger.error('The SQLite integrity check did not pass.', { verdict });
      logger.error('Restore the newest good copy from data/backups/_panel and restart.');
    }
  } catch (err) {
    logger.error('The SQLite integrity check could not run.', { err: serializeError(err) });
  }

  // Rewrite any credential still encrypted under the legacy SESSION_SECRET-derived
  // key so a later SESSION_SECRET rotation can't strand it. No-op once done.
  try {
    require('./services/secretsMigration').migrateLegacySecrets();
  } catch (err) {
    logger.error('Migrating legacy-encrypted secrets failed.', { err: serializeError(err) });
  }

  require('./services/apiKeys').importFromEnvOnce();
  require('./blueprints')
    .seedStarters()
    .catch((err) => logger.error('Seeding starter blueprints failed.', { err: serializeError(err) }));

  const { createApp } = require('./web/app');
  const app = createApp();

  const httpServer = app.listen(config.port, config.host, () => {
    const shownHost = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
    logger.info('The panel is listening.', {
      url: `http://${shownHost}:${config.port}`,
      dataDir: config.dataDir,
    });
    if (config.isExposedBind) {
      logger.warn(
        'The panel is bound to an address reachable beyond this machine. Only expose it behind a reverse proxy with TLS.',
        {
          host: config.host,
        }
      );
      const pin = require('./services/setupGate').ensurePin();
      if (pin) {
        logger.warn(
          'First-run setup on this exposed panel is PIN-gated. Enter this PIN on the /setup page to create the admin account. It is shown only here and disappears once the admin account exists.',
          {
            pin,
          }
        );
      }
    }
    if (config.cookieSecure === false && (config.trustProxy !== false || config.isExposedBind)) {
      logger.warn(
        'The session cookie (including the 30-day "remember me" cookie) is being sent without the Secure flag while the panel looks proxied or exposed. If you serve it over HTTPS, set COOKIE_SECURE=auto with TRUST_PROXY, or COOKIE_SECURE=true.'
      );
    }
    installRuntimeGuards();
    startBackgroundServices(httpServer);
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.fatal(
        'The configured port is already in use. Stop whatever is using it, or set PANEL_PORT in your .env to a free port.',
        {
          host: config.host,
          port: config.port,
        }
      );
    } else if (err.code === 'EACCES') {
      logger.fatal(
        'The panel is not allowed to bind that address. Ports below 1024 need elevated privileges, so pick a higher PANEL_PORT.',
        {
          host: config.host,
          port: config.port,
        }
      );
    } else {
      logger.fatal('The HTTP server hit an error.', { err: serializeError(err) });
    }
    captureError(err, { scope: 'boot' });
    bailOut(1);
  });
} catch (err) {
  logger.fatal('Startup failed.', { err: serializeError(err) });
  captureError(err, { scope: 'boot' });
  bailOut(1);
}

// Everything that runs once the panel is listening. Split out so a throw here is
// clearly a post-boot background failure, not a startup failure.
function startBackgroundServices(httpServer) {
  require('./ws').attachWebSockets(httpServer);
  require('./storage/indexer').startIndexer();
  require('./crashes').startCrashWatcher({});
  require('./services/scheduler').startScheduler();
  require('./integrations/discord').startEventBridge();
  require('./services/inventory').startSnapshotWatcher();
  require('./services/wizard').startOutreachWatcher();

  // Daily maintenance: prune old analytics timeline rows + closed sessions so the
  // DB doesn't grow without bound over months of uptime. Runs shortly after boot,
  // then every 24h.
  const ANALYTICS_RETENTION_DAYS = 90;
  const PANEL_DB_BACKUPS_KEEP = 14;
  function runMaintenance() {
    try {
      const r = require('./analytics/ingest').pruneOlderThan(ANALYTICS_RETENTION_DAYS);
      const wizard = require('./services/wizard');
      wizard.pruneTranscripts();
      wizard.pruneOutreach(ANALYTICS_RETENTION_DAYS);
      if (r.events || r.sessions) {
        logger.info('Pruned old analytics rows.', {
          events: r.events,
          sessions: r.sessions,
          olderThanDays: ANALYTICS_RETENTION_DAYS,
        });
      }
    } catch (err) {
      logger.error('Pruning old analytics rows failed.', { err: serializeError(err) });
    }
    // Snapshot the panel DB itself - the server backups only cover per-server
    // world dirs, so without this the users/schedules/pins/history/2FA store has
    // no backup at all. VACUUM INTO is a safe hot copy; keep the newest N.
    try {
      const fs = require('node:fs');
      const nodePath = require('node:path');
      const { dataPath } = require('./storage/pathGuard');
      const dir = dataPath('backups', '_panel');
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      // VACUUM INTO is synchronous and blocks the event loop while it runs - log
      // the pause so a long one is visible rather than mysterious.
      const blockedMs = require('./db').backupTo(nodePath.join(dir, `panel-${stamp}.db`));
      logger.info('Snapshotted the panel database.', { blockedMs, dir: 'data/backups/_panel' });
      const snaps = fs
        .readdirSync(dir)
        .filter((f) => /^panel-.*\.db$/.test(f))
        .sort();
      for (const f of snaps.slice(0, Math.max(0, snaps.length - PANEL_DB_BACKUPS_KEEP))) {
        fs.rmSync(nodePath.join(dir, f), { force: true });
      }
    } catch (err) {
      logger.error('The panel database backup failed.', { err: serializeError(err) });
    }
  }
  setTimeout(runMaintenance, 60_000).unref();
  setInterval(runMaintenance, 24 * 3600 * 1000).unref();

  // Docker integration comes up in the background - the panel must stay usable
  // when the daemon is down (setup wizard handles that state).
  (async () => {
    const { checkDocker } = require('./docker/connect');
    const status = await checkDocker();
    if (!status.available) {
      logger.warn('Docker is not reachable. Server start, stop, and create stay disabled until it comes up.', {
        reason: status.error,
      });
      return;
    }
    logger.info('Connected to Docker.', { os: status.os, version: status.version });
    const { startWatcher } = require('./docker/watcher');
    const serversService = require('./services/servers');
    await startWatcher().catch((err) =>
      logger.error('The Docker events watcher failed to start.', { err: serializeError(err) })
    );
    await serversService.refreshStatuses({ boot: true });
    // Periodic reconcile: without it, cached statuses drift after any missed
    // docker event and healthcheck-less servers stay 'starting' forever.
    const statusThrottle = makeFailureThrottle();
    const statusTimer = setInterval(() => {
      serversService
        .refreshStatuses()
        .then(() => statusThrottle.ok(logger.info, 'The server status reconcile recovered.'))
        .catch((err) =>
          statusThrottle.fail(logger.warn, 'Reconciling server statuses failed.', { err: serializeError(err) })
        );
    }, 60_000);
    statusTimer.unref();
    require('./analytics/ingest')
      .startIngest()
      .catch((err) => logger.error('Starting analytics ingest failed.', { err: serializeError(err) }));
    require('./analytics/stats').startStatsIngest({});
    require('./services/liveCache').startLiveCache({});
    // Honor "start on panel boot", and recover servers that crashed while the
    // panel was down: the live docker-events watcher never saw that 'die', so
    // nothing scheduled the auto-restart for them. guardOp de-dupes a server
    // that matches both conditions.
    const { inCrashLoopBackoff } = require('./docker/watcher');
    for (const s of serversService.listServers()) {
      const autoStart = s.auto_start && !['running', 'starting'].includes(s.status);
      const crashRecover = s.auto_restart && s.status === 'crashed';
      if (!autoStart && !crashRecover) continue;
      // Crash recovery must respect the same crash-loop backoff the live watcher
      // enforces - otherwise every panel restart gives a crash-looping server
      // one more free attempt.
      if (crashRecover && !autoStart && inCrashLoopBackoff(s.id)) {
        logger.warn('Did not auto-restart a server on boot: it is in crash-loop backoff.', { serverId: s.id });
        continue;
      }
      serversService
        .startServer(s.id, { actor: 'system' })
        .catch((err) =>
          logger.error('Auto-starting a server on boot failed.', { serverId: s.id, err: serializeError(err) })
        );
    }
  })().catch((err) => logger.error('Background Docker initialisation failed.', { err: serializeError(err) }));
}
