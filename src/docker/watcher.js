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

// Docker streams one event per line and lines are complete frames, but a whole
// line must still be buffered before it can be parsed. Defense-in-depth cap: a
// stream that never delivers a newline (e.g. a daemon wedged mid-write) must
// not grow the buffer without bound - drop the oldest bytes once past the cap.
const MAX_EVENT_BUFFER_BYTES = 64 * 1024;

let stream = null;
let retryTimer = null;
let retryDelayMs = 5000;

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
    if (buffer.length > MAX_EVENT_BUFFER_BYTES) buffer = buffer.slice(buffer.length - MAX_EVENT_BUFFER_BYTES);
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
        // intentional: a full line that isn't JSON (e.g. a status line from the
        // daemon) - there's no partial frame to wait for, so drop it.
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

/** Schedule a reconnect. Keeps retrying forever; never dies after one failure.
 *  Backs off exponentially so a long daemon outage doesn't hammer the socket. */
function retryLater() {
  if (retryTimer) return; // a retry is already scheduled
  // grow the delay on each successive failure, capped at 60s
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startWatcher()
      .then(() => {
        retryDelayMs = 5000; // connected again - reset the backoff
      })
      .catch((err) => {
        logger.warn('Reconnecting to the Docker events stream failed; retrying.', {
          err: serializeError(err, { includeStack: false }),
          retryInSeconds: retryDelayMs / 1000,
        });
        const next = retryDelayMs * 2;
        retryDelayMs = Math.min(next || retryDelayMs, 60_000);
        retryLater();
      });
  }, retryDelayMs);
  retryTimer.unref();
}

async function handleEvent(evt) {
  const serverId = evt.Actor && evt.Actor.Attributes && evt.Actor.Attributes[LABEL];
  if (!serverId) return;
  const server = db.get('SELECT * FROM servers WHERE id = ?', serverId);
  if (!server) return;

  // Docker emits the event kind as both `status` and `Action` (daemons have
  // historically sent `status`, newer releases also/only `Action`). Reading
  // only `status` means a crash reported as Action:"die" - exactly what a
  // SIGSEGV'd Java process produces - is ignored entirely: the server is never
  // marked crashed, let alone auto-restarted.
  const eventStatus = evt.status || evt.Action || evt.action || '';

  if (eventStatus === 'start') {
    db.run("UPDATE servers SET status = 'starting', last_started_at = datetime('now') WHERE id = ?", serverId);
    return;
  }
  if (eventStatus === 'health_status: healthy') {
    db.run("UPDATE servers SET status = 'running' WHERE id = ?", serverId);
    return;
  }
  if (eventStatus === 'health_status: unhealthy') {
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
  if (eventStatus === 'oom') {
    recordEvent({
      serverId,
      type: 'oom',
      summary:
        'The server was stopped for running out of memory. Raise the container memory limit or lower the Java heap.',
    });
    return;
  }
  if (eventStatus !== 'die') return;

  const exitCode = Number(evt.Actor.Attributes.exitCode ?? -1);
  const stopRequested = db.get(
    "SELECT 1 AS x FROM events WHERE server_id = ? AND type IN ('stop-requested','restart-requested','kill-requested') AND created_at > datetime('now', '-3 minutes')",
    serverId
  );
  // 143 = SIGTERM (docker stop), 130 = SIGINT, 0 = normal. These are only
  // "intentional" when the panel itself asked for the stop. Without a recent
  // stop-requested event, a clean exit - especially 143/SIGTERM - is the classic
  // signature of something stopping the container from OUTSIDE the panel (host
  // reboot, an external `docker stop`, the itzg image's own auto-stop, an OOM
  // delivered as a signal). The panel is the sole restart authority (containers
  // run with RestartPolicy 'no'), so an unrequested clean exit on an auto_restart
  // server must come back up instead of silently staying down.
  const cleanExit = exitCode === 0 || exitCode === 143 || exitCode === 130;
  // 137 = SIGKILL. A graceful `docker stop` escalates SIGTERM→SIGKILL after its
  // grace period, so a slow-saving world that misses the deadline exits 137 during
  // an intended stop. If a stop/restart was requested, treat it as intentional.
  const killedBySignal = exitCode === 137;
  // A genuinely-intentioned stop is one the panel requested (any exit code), or
  // an externally-SIGKILLed container (137) - neither should auto-restart.
  const intentionalStop = Boolean(stopRequested) || killedBySignal;

  if (intentionalStop) {
    db.run("UPDATE servers SET status = 'stopped' WHERE id = ?", serverId);
    if (!stopRequested) {
      recordEvent({ serverId, type: 'stopped', summary: `Server stopped (exit code ${exitCode})` });
    }
    return;
  }

  // An exit that wasn't requested is unexpected whether its code looks "clean"
  // or not - surface the real state but treat both as something to recover from.
  const dbStatus = cleanExit ? 'stopped' : 'crashed';
  db.run('UPDATE servers SET status = ? WHERE id = ?', dbStatus, serverId);
  const excerpt = await fetchLogs(serverId, { tail: 300 }).catch(() => '');

  // Config errors never fix themselves - diagnose them so the event says WHAT
  // to do, and skip auto-restarts that would just burn cycles.
  const diagnosis = diagnoseFatal(excerpt);
  // Only unexpected exits that actually reach the auto-restart path count toward
  // the crash-loop backoff. A stop-window exit or an external SIGKILL is still
  // recorded but never armed a restart, so it must not inflate the count for a
  // later real one.
  const armedRestart = !diagnosis && !intentionalStop && Boolean(server.auto_restart);
  const kind = cleanExit ? 'unexpected-stop' : 'crashed';
  recordEvent({
    serverId,
    type: kind,
    summary: cleanExit
      ? `Server stopped unexpectedly (exit code ${exitCode}). Not requested by the panel.${server.auto_restart ? ' Restarting.' : ''}`
      : diagnosis
        ? `Server crashed: ${diagnosis.summary}`
        : `Server crashed (exit code ${exitCode})`,
    details: {
      exitCode,
      duringStopWindow: Boolean(stopRequested),
      diagnosis: diagnosis ? diagnosis.key : null,
      armedRestart,
    },
    logExcerpt: excerpt || null,
  });
  if (!armedRestart) return; // config error / stop window / SIGKILL / no auto_restart

  armRestart(serverId, { kind });
}

/** Count restart-arming unexpected exits (crash OR unrequested stop) for
 *  `serverId` inside the crash-loop window. Both kinds arm the same guarded
 *  auto-restart, so they must share the same backoff counter - otherwise an
 *  `unexpected-stop` loop (e.g. something on the host SIGTERMing the container
 *  over and over) could hammer restarts without ever tripping the backoff. */
function countArmedCrashes(serverId) {
  return (
    db.get(
      `SELECT COUNT(*) AS n FROM events
         WHERE server_id = ? AND type IN ('crashed','unexpected-stop')
           AND created_at > datetime('now', ?)
           AND json_extract(details_json, '$.armedRestart') = 1`,
      serverId,
      `-${CRASH_WINDOW_MINUTES} minutes`
    )?.n || 0
  );
}

/**
 * Arm the guarded auto-restart after an unexpected exit, with exponential
 * backoff shared across crashes and unrequested stops (persisted to the events
 * table so a panel restart mid-loop doesn't reset it, and the previous event
 * is already recorded before this is called).
 */
function armRestart(serverId, { kind }) {
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
        summary: `Auto-restart suspended: ${recentCrashes} unexpected exits within ${CRASH_WINDOW_MINUTES} minutes`,
      });
    }
    return;
  }
  const delayMs = 5000 * 2 ** (recentCrashes - 1); // 5s, 10s, 20s
  setTimeout(async () => {
    try {
      const info = await inspectStatus(serverId);
      // Re-check it's still down (stopped or crashed) before restarting so this
      // can't race a user start/stop/recreate/delete that happened in the delay.
      if (info.exists && ['stopped', 'crashed'].includes(info.status)) {
        // Go through the guarded lifecycle (not startContainer directly) so this
        // can't race a user start/recreate/delete and so pending config changes
        // (pending_recreate) are honored rather than starting a stale container.
        await require('../services/servers').startServer(serverId, { actor: 'watcher' });
        recordEvent({
          serverId,
          type: 'auto-restarted',
          summary: `Auto-restart attempt ${recentCrashes}/${MAX_RAPID_CRASHES} after ${kind === 'unexpected-stop' ? 'an unexpected stop' : 'a crash'}`,
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
const DIAG_MAX_CHARS = 128 * 1024; // fatal errors are in the recent log; never regex a huge blob
function diagnoseFatal(logText) {
  if (!logText) return null;
  // Bound the scanned text to the newest tail - these are startup-fatal errors,
  // so scanning the whole (potentially large) excerpt up to 6 times is wasted
  // work that only grows with uptime.
  const scan = logText.length > DIAG_MAX_CHARS ? logText.slice(-DIAG_MAX_CHARS) : logText;
  const KNOWN = [
    {
      key: 'cf-api-key',
      re: /API key is not set.*CF_API_KEY/is,
      summary: 'The CurseForge API key is missing. Add your key in Settings → API keys, then rebuild this server.',
    },
    {
      key: 'eula',
      re: /You need to agree to the EULA/i,
      summary:
        'The Minecraft EULA was not accepted. Rebuild the server from the panel and it will accept the EULA automatically.',
    },
    {
      key: 'java-version',
      re: /UnsupportedClassVersionError/i,
      summary:
        'Wrong Java version for this Minecraft build. Set the Java image override in Settings (or clear it to auto), then rebuild the server.',
    },
    {
      key: 'world-downgrade',
      re: /No key dimensions in MapLike|loading a newer world|created by a newer version/i,
      summary:
        'The world was created on a newer Minecraft version than this server runs. Reset or swap the world on the Worlds tab, or raise the Minecraft version.',
    },
    {
      key: 'port-bind',
      re: /Failed to bind to port|Address already in use/i,
      summary: 'The game port is already in use on this machine. Change the port in Settings, then rebuild the server.',
    },
    {
      key: 'oom',
      re: /OutOfMemoryError/i,
      summary:
        'Java ran out of memory. Raise RAM in Settings → Resources (packs usually need 4 to 8 GB), then rebuild the server.',
    },
  ];
  for (const k of KNOWN) if (k.re.test(scan)) return k;
  return null;
}

module.exports = { startWatcher, handleEvent, diagnoseFatal, inCrashLoopBackoff };
