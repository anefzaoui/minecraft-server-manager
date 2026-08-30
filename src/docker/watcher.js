'use strict';

// Docker events watcher: turns container die/start/oom events on managed
// containers into history events, updates cached status, and drives crash
// detection with auto-restart backoff.

const path = require('node:path');
const { getDocker } = require('./connect');
const { LABEL, inspectStatus } = require('./containers');
const { fetchLogs } = require('./logs');
const { recordEvent } = require('../events');
const db = require('../db');
const logger = require('../logger')(path.basename(__filename));
const { serializeError } = require('../utils/logSanitize');

const MAX_RAPID_CRASHES = 3;
const CRASH_WINDOW_MINUTES = 10;

let stream = null;
let retryTimer = null;

async function startWatcher() {
  if (stream) return;
  const docker = getDocker();
  const s = await docker.getEvents({
    filters: { type: ['container'], label: ['msm.managed=true'] },
  });
  stream = s;
  let buffer = '';
  s.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        handleEvent(JSON.parse(line)).catch((err) =>
          logger.error('Handling a Docker event failed.', { err: serializeError(err) })
        );
      } catch {
        // intentional: partial JSON frame - wait for the rest of the line
      }
    }
  });
  const onDrop = () => {
    if (stream !== s) return; // stale stream's late event - a newer stream is live
    stream = null;
    retryLater();
  };
  s.on('error', onDrop);
  s.on('end', onDrop);
  logger.info('Connected to the Docker events stream.');
}

/** Schedule a reconnect. Keeps retrying forever; never dies after one failure. */
function retryLater() {
  if (retryTimer) return; // a retry is already scheduled
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startWatcher().catch((err) => {
      logger.warn('Reconnecting to the Docker events stream failed; retrying in 5 seconds.', {
        err: serializeError(err, { includeStack: false }),
      });
      retryLater();
    });
  }, 5000);
  retryTimer.unref();
}

async function handleEvent(evt) {
  const serverId = evt.Actor && evt.Actor.Attributes && evt.Actor.Attributes[LABEL];
  if (!serverId) return;
  const server = db.get('SELECT * FROM servers WHERE id = ?', serverId);
  if (!server) return;

  if (evt.status === 'start') {
    db.run("UPDATE servers SET status = 'starting', last_started_at = datetime('now') WHERE id = ?", serverId);
    return;
  }
  if (evt.status === 'health_status: healthy') {
    db.run("UPDATE servers SET status = 'running' WHERE id = ?", serverId);
    return;
  }
  if (evt.status === 'health_status: unhealthy') {
    // The process is alive but the server stopped answering `mc-health` -
    // a "running but dead" state the die/oom events never cover. Only act on
    // it for a server the panel currently thinks is up (not one mid-stop).
    // A graceful stop of a slow-saving world keeps status 'running' while
    // mc-health probes fail, so skip the flip/alert if a stop/restart/kill was
    // just requested (same window the die handler below uses).
    const stopRequested = db.get(
      "SELECT 1 AS x FROM events WHERE server_id = ? AND type IN ('stop-requested','restart-requested','kill-requested') AND created_at > datetime('now', '-3 minutes')",
      serverId
    );
    if (!stopRequested && ['running', 'starting', 'stalled'].includes(server.status)) {
      db.run("UPDATE servers SET status = 'unhealthy' WHERE id = ?", serverId);
      const already = db.get(
        "SELECT 1 AS x FROM events WHERE server_id = ? AND type = 'unhealthy' AND created_at > datetime('now', '-15 minutes')",
        serverId
      );
      if (!already) {
        const excerpt = await fetchLogs(serverId, { tail: 200 }).catch(() => '');
        const diag = diagnoseFatal(excerpt);
        recordEvent({
          serverId,
          type: 'unhealthy',
          summary: diag
            ? `Server stopped responding: ${diag.summary}`
            : 'Server stopped responding to health checks (process still running). Check the console; a restart may be needed.',
          details: { diagnosis: diag ? diag.key : null },
          logExcerpt: excerpt || null,
        });
      }
    }
    return;
  }
  if (evt.status === 'oom') {
    recordEvent({
      serverId,
      type: 'oom',
      summary: 'Container hit its memory limit (OOM). Raise the container memory limit or lower the Java heap.',
    });
    return;
  }
  if (evt.status !== 'die') return;

  const exitCode = Number(evt.Actor.Attributes.exitCode ?? -1);
  const stopRequested = db.get(
    "SELECT 1 AS x FROM events WHERE server_id = ? AND type IN ('stop-requested','restart-requested','kill-requested') AND created_at > datetime('now', '-3 minutes')",
    serverId
  );
  // Clean exits are judged by the exit code, not just the request window:
  // 0 = normal, 143 = SIGTERM (docker stop), 130 = SIGINT - all intentional.
  const cleanExit = exitCode === 0 || exitCode === 143 || exitCode === 130;
  // 137 = SIGKILL. A graceful `docker stop` escalates SIGTERM→SIGKILL after its
  // grace period, so a slow-saving world that misses the deadline exits 137 during
  // an intended stop. If a stop/restart was requested, treat it as intentional.
  const killedBySignal = exitCode === 137;

  if (cleanExit || (killedBySignal && stopRequested)) {
    db.run("UPDATE servers SET status = 'stopped' WHERE id = ?", serverId);
    if (!stopRequested) {
      recordEvent({ serverId, type: 'stopped', summary: `Server stopped (exit code ${exitCode})` });
    }
    return;
  }

  // Crash path - even inside a stop/restart window a non-zero, non-signal exit
  // is a crash and must be recorded as one.
  db.run("UPDATE servers SET status = 'crashed' WHERE id = ?", serverId);
  const excerpt = await fetchLogs(serverId, { tail: 300 }).catch(() => '');

  // Config errors never fix themselves - diagnose them so the crash event
  // says WHAT to do, and skip auto-restarts that would just burn cycles.
  const diagnosis = diagnoseFatal(excerpt);
  // Only crashes that actually reach the auto-restart path count toward the
  // crash-loop backoff. A config-error crash, a stop-window crash, or a SIGKILL
  // is still recorded as 'crashed' but never armed a restart, so it must not
  // inflate `recentCrashes` (or the exponential backoff) for a later real one.
  const armedRestart = !diagnosis && !stopRequested && !killedBySignal && Boolean(server.auto_restart);
  recordEvent({
    serverId,
    type: 'crashed',
    summary: diagnosis
      ? `Server crashed: ${diagnosis.summary}`
      : `Server crashed (exit code ${exitCode})${stopRequested ? ' while a stop/restart was in progress' : ''}`,
    details: {
      exitCode,
      duringStopWindow: Boolean(stopRequested),
      diagnosis: diagnosis ? diagnosis.key : null,
      armedRestart,
    },
    logExcerpt: excerpt || null,
  });
  if (!armedRestart) return; // config error / stop-window / SIGKILL / no auto_restart

  // Count recent restart-arming crashes from the events table (this crash is
  // already recorded above), not an in-memory map - so a panel restart in the
  // middle of a crash loop doesn't wipe the backoff and let it hammer restarts
  // all over again.
  const recentCrashes = countArmedCrashes(serverId) || 1;
  if (recentCrashes > MAX_RAPID_CRASHES) {
    const suspended = db.get(
      `SELECT 1 AS x FROM events WHERE server_id = ? AND type = 'crash-loop'
         AND created_at > datetime('now', ?)`,
      serverId,
      `-${CRASH_WINDOW_MINUTES} minutes`
    );
    if (!suspended) {
      recordEvent({
        serverId,
        type: 'crash-loop',
        summary: `Auto-restart suspended: ${recentCrashes} crashes within ${CRASH_WINDOW_MINUTES} minutes`,
      });
    }
    return;
  }
  const delayMs = 5000 * 2 ** (recentCrashes - 1); // 5s, 10s, 20s
  setTimeout(async () => {
    try {
      const info = await inspectStatus(serverId);
      if (info.exists && info.status === 'crashed') {
        // Go through the guarded lifecycle (not startContainer directly) so this
        // can't race a user start/recreate/delete and so pending config changes
        // (pending_recreate) are honored rather than starting a stale container.
        await require('../services/servers').startServer(serverId, { actor: 'watcher' });
        recordEvent({
          serverId,
          type: 'auto-restarted',
          summary: `Auto-restart attempt ${recentCrashes}/${MAX_RAPID_CRASHES} after crash`,
        });
      }
    } catch (err) {
      logger.error('An automatic restart after a crash failed.', {
        serverId,
        err: serializeError(err),
      });
    }
  }, delayMs).unref();
}

/** Count restart-arming crashes for `serverId` inside the crash-loop window. */
function countArmedCrashes(serverId) {
  return (
    db.get(
      `SELECT COUNT(*) AS n FROM events
         WHERE server_id = ? AND type = 'crashed'
           AND created_at > datetime('now', ?)
           AND json_extract(details_json, '$.armedRestart') = 1`,
      serverId,
      `-${CRASH_WINDOW_MINUTES} minutes`
    )?.n || 0
  );
}

/**
 * True when a server is currently held back by crash-loop protection - either an
 * explicit 'crash-loop' suspension event, or enough recent restart-arming
 * crashes to have tripped MAX_RAPID_CRASHES. The boot-time crash recovery checks
 * this so a panel restart mid-loop doesn't start the server one more time.
 */
function inCrashLoopBackoff(serverId) {
  const suspended = db.get(
    `SELECT 1 AS x FROM events WHERE server_id = ? AND type = 'crash-loop'
       AND created_at > datetime('now', ?)`,
    serverId,
    `-${CRASH_WINDOW_MINUTES} minutes`
  );
  if (suspended) return true;
  return countArmedCrashes(serverId) > MAX_RAPID_CRASHES;
}

/** Match known unrecoverable startup errors → actionable message. */
function diagnoseFatal(logText) {
  if (!logText) return null;
  const KNOWN = [
    {
      key: 'cf-api-key',
      re: /API key is not set.*CF_API_KEY/is,
      summary:
        'CurseForge API key missing in the container - add your key in Settings → API keys, then Recreate this server.',
    },
    {
      key: 'eula',
      re: /You need to agree to the EULA/i,
      summary: 'The Minecraft EULA was not accepted - recreate the server from the panel (it sets EULA automatically).',
    },
    {
      key: 'java-version',
      re: /UnsupportedClassVersionError/i,
      summary:
        'Wrong Java version for this Minecraft build - set the Java image override in Settings (or clear it to auto) and Recreate.',
    },
    {
      key: 'world-downgrade',
      re: /No key dimensions in MapLike|loading a newer world|created by a newer version/i,
      summary:
        'The world was created on a newer Minecraft version than this server runs - reset or swap the world (Worlds tab), or raise the MC version.',
    },
    {
      key: 'port-bind',
      re: /Failed to bind to port|Address already in use/i,
      summary: 'The game port is already in use on this machine - change the port in Settings and Recreate.',
    },
    {
      key: 'oom',
      re: /OutOfMemoryError/i,
      summary: 'Java ran out of heap - raise RAM in Settings → Resources (packs usually need 4–8 GB) and Recreate.',
    },
  ];
  for (const k of KNOWN) if (k.re.test(logText)) return k;
  return null;
}

module.exports = { startWatcher, diagnoseFatal, inCrashLoopBackoff };
