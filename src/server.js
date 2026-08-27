'use strict';

// Preflight FIRST - fail clearly on an unsupported Node runtime before anything
// else (config, DB, the runtime error net) can turn it into a cryptic crash.
require('./preflight');

function installRuntimeGuards() {
  // Last-resort safety net: a control panel must stay up. The specific fixes (e.g.
  // WebSocket 'error' handlers) prevent the known crash paths; this backstop keeps
  // a stray uncaught error or rejected promise from taking the whole panel down.
  // Installed only AFTER a successful boot, so startup errors stay fatal and
  // visible instead of being silently swallowed.
  process.on('uncaughtException', (err) => {
    console.error('[fatal] uncaughtException (kept alive):', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[fatal] unhandledRejection (kept alive):', reason);
  });
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
      console.error(
        `\n[boot] SQLite integrity_check did not pass: ${verdict}\n` +
          `  Restore the newest good copy from data/backups/_panel/ and restart.\n`
      );
    }
  } catch (err) {
    console.error('[boot] SQLite integrity_check could not run:', err.message);
  }

  require('./services/apiKeys').importFromEnvOnce();
  require('./blueprints')
    .seedStarters()
    .catch((err) => console.error('[boot] starter blueprints seed failed:', err));

  const { createApp } = require('./web/app');
  const app = createApp();

  const httpServer = app.listen(config.port, config.host, () => {
    const shownHost = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;
    console.log(`[boot] Minecraft Server Manager is listening on http://${shownHost}:${config.port}`);
    console.log(`[boot] Data folder: ${config.dataDir}`);
    if (config.isExposedBind) {
      console.warn(
        `[security] PANEL_HOST=${config.host} exposes the panel beyond this machine. ` +
          `Until the admin account exists, anyone who can reach it can claim it - finish ` +
          `first-run setup now, and only put it on the internet behind a reverse proxy with TLS.`
      );
    }
    if (config.cookieSecure === false && (config.trustProxy !== false || config.isExposedBind)) {
      console.warn(
        `[security] The session cookie (including the 30-day "remember me" cookie) is being sent ` +
          `without the Secure flag while the panel looks proxied/exposed. If you serve it over HTTPS, ` +
          `set COOKIE_SECURE=auto with TRUST_PROXY (or COOKIE_SECURE=true).`
      );
    }
    installRuntimeGuards();
    startBackgroundServices(httpServer);
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[boot] Port ${config.port} is already in use. Stop whatever is using it, or set PANEL_PORT in your .env to a free port.\n`
      );
    } else if (err.code === 'EACCES') {
      console.error(
        `\n[boot] Not allowed to bind ${config.host}:${config.port}. Ports below 1024 need elevated privileges, so pick a higher PANEL_PORT.\n`
      );
    } else {
      console.error('\n[boot] HTTP server error:', err.message, '\n');
    }
    process.exit(1);
  });
} catch (err) {
  console.error('\n[boot] Startup failed:\n  ' + (err && err.message ? err.message : err) + '\n');
  process.exit(1);
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

  // Daily maintenance: prune old analytics timeline rows + closed sessions so the
  // DB doesn't grow without bound over months of uptime. Runs shortly after boot,
  // then every 24h.
  const ANALYTICS_RETENTION_DAYS = 90;
  const PANEL_DB_BACKUPS_KEEP = 14;
  function runMaintenance() {
    try {
      const r = require('./analytics/ingest').pruneOlderThan(ANALYTICS_RETENTION_DAYS);
      if (r.events || r.sessions) {
        console.log(
          `[maintenance] pruned ${r.events} timeline rows, ${r.sessions} sessions older than ${ANALYTICS_RETENTION_DAYS}d`
        );
      }
    } catch (err) {
      console.error('[maintenance] analytics prune failed:', err.message);
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
      require('./db').backupTo(nodePath.join(dir, `panel-${stamp}.db`));
      const snaps = fs
        .readdirSync(dir)
        .filter((f) => /^panel-.*\.db$/.test(f))
        .sort();
      for (const f of snaps.slice(0, Math.max(0, snaps.length - PANEL_DB_BACKUPS_KEEP))) {
        fs.rmSync(nodePath.join(dir, f), { force: true });
      }
    } catch (err) {
      console.error('[maintenance] panel DB backup failed:', err.message);
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
      console.warn(
        `[docker] Docker is not reachable (${status.error}). Server start, stop, and create stay disabled until it comes up.`
      );
      return;
    }
    console.log(`[docker] connected: ${status.os} (Docker ${status.version})`);
    const { startWatcher } = require('./docker/watcher');
    const serversService = require('./services/servers');
    await startWatcher().catch((err) => console.error('[watcher] failed to start:', err.message));
    await serversService.refreshStatuses({ boot: true });
    // Periodic reconcile: without it, cached statuses drift after any missed
    // docker event and healthcheck-less servers stay 'starting' forever.
    const statusTimer = setInterval(
      () => serversService.refreshStatuses().catch((err) => console.error('[status] refresh failed:', err.message)),
      60_000
    );
    statusTimer.unref();
    require('./analytics/ingest')
      .startIngest()
      .catch((err) => console.error('[boot] analytics ingest failed:', err));
    require('./analytics/stats').startStatsIngest({});
    require('./services/liveCache').startLiveCache({});
    // Honor "start on panel boot", and recover servers that crashed while the
    // panel was down: the live docker-events watcher never saw that 'die', so
    // nothing scheduled the auto-restart for them. guardOp de-dupes a server
    // that matches both conditions.
    for (const s of serversService.listServers()) {
      const wantStart =
        (s.auto_start && !['running', 'starting'].includes(s.status)) || (s.auto_restart && s.status === 'crashed');
      if (!wantStart) continue;
      serversService
        .startServer(s.id, { actor: 'system' })
        .catch((err) => console.error(`[boot] auto-start ${s.id} failed:`, err.message));
    }
  })().catch((err) => console.error('[boot] docker background init failed:', err));
}
