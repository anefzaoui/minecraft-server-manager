'use strict';

// Docker events watcher: turns container die/start/oom events on managed
// containers into history events, updates cached status, and drives crash
// detection with auto-restart backoff.

const { getDocker } = require('./connect');
const { LABEL, inspectStatus } = require('./containers');
const { fetchLogs } = require('./logs');
const { recordEvent } = require('../events');
const db = require('../db');

// serverId → recent crash timestamps (for backoff)
const crashWindows = new Map();
const MAX_RAPID_CRASHES = 3;
const CRASH_WINDOW_MS = 10 * 60 * 1000;

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
        handleEvent(JSON.parse(line)).catch((err) => console.error('[watcher]', err.message));
      } catch {
        /* partial frame */
      }
    }
  });
  const onDrop = () => {
    if (stream !== s) return; // stale stream's late event — a newer stream is live
    stream = null;
    retryLater();
  };
  s.on('error', onDrop);
  s.on('end', onDrop);
  console.log('[watcher] docker events stream connected');
}

/** Schedule a reconnect. Keeps retrying forever; never dies after one failure. */
function retryLater() {
  if (retryTimer) return; // a retry is already scheduled
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startWatcher().catch((err) => {
      console.error('[watcher] reconnect failed, retrying in 5s:', err.message);
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
  // 0 = normal, 143 = SIGTERM (docker stop), 130 = SIGINT — all intentional.
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

  // Crash path — even inside a stop/restart window a non-zero, non-signal exit
  // is a crash and must be recorded as one.
  db.run("UPDATE servers SET status = 'crashed' WHERE id = ?", serverId);
  const excerpt = await fetchLogs(serverId, { tail: 300 }).catch(() => '');

  // Config errors never fix themselves — diagnose them so the crash event
  // says WHAT to do, and skip auto-restarts that would just burn cycles.
  const diagnosis = diagnoseFatal(excerpt);
  recordEvent({
    serverId,
    type: 'crashed',
    summary: diagnosis
      ? `Server crashed: ${diagnosis.summary}`
      : `Server crashed (exit code ${exitCode})${stopRequested ? ' while a stop/restart was in progress' : ''}`,
    details: { exitCode, duringStopWindow: Boolean(stopRequested), diagnosis: diagnosis ? diagnosis.key : null },
    logExcerpt: excerpt || null,
  });
  if (diagnosis) return; // auto-restart cannot help a config error

  // A crash during a requested stop/restart must not fight the panel's own
  // lifecycle handling with an auto-restart.
  if (stopRequested) return;
  // SIGKILL with no stop request is typically an external kill / OOM-adjacent
  // event — recorded above, but don't fight it with an auto-restart loop.
  if (killedBySignal) return;
  if (!server.auto_restart) return;
  const now = Date.now();
  const window = (crashWindows.get(serverId) || []).filter((t) => now - t < CRASH_WINDOW_MS);
  window.push(now);
  crashWindows.set(serverId, window);
  if (window.length > MAX_RAPID_CRASHES) {
    recordEvent({
      serverId,
      type: 'crash-loop',
      summary: `Auto-restart suspended: ${window.length} crashes within 10 minutes`,
    });
    return;
  }
  const delayMs = 5000 * 2 ** (window.length - 1); // 5s, 10s, 20s
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
          summary: `Auto-restart attempt ${window.length}/${MAX_RAPID_CRASHES} after crash`,
        });
      }
    } catch (err) {
      console.error('[watcher] auto-restart failed:', err.message);
    }
  }, delayMs).unref();
}

/** Match known unrecoverable startup errors → actionable message. */
function diagnoseFatal(logText) {
  if (!logText) return null;
  const KNOWN = [
    {
      key: 'cf-api-key',
      re: /API key is not set.*CF_API_KEY/is,
      summary:
        'CurseForge API key missing in the container — add your key in Settings → API keys, then Recreate this server.',
    },
    {
      key: 'eula',
      re: /You need to agree to the EULA/i,
      summary: 'The Minecraft EULA was not accepted — recreate the server from the panel (it sets EULA automatically).',
    },
    {
      key: 'java-version',
      re: /UnsupportedClassVersionError/i,
      summary:
        'Wrong Java version for this Minecraft build — set the Java image override in Settings (or clear it to auto) and Recreate.',
    },
    {
      key: 'world-downgrade',
      re: /No key dimensions in MapLike|loading a newer world|created by a newer version/i,
      summary:
        'The world was created on a newer Minecraft version than this server runs — reset or swap the world (Worlds tab), or raise the MC version.',
    },
    {
      key: 'port-bind',
      re: /Failed to bind to port|Address already in use/i,
      summary: 'The game port is already in use on this machine — change the port in Settings and Recreate.',
    },
    {
      key: 'oom',
      re: /OutOfMemoryError/i,
      summary: 'Java ran out of heap — raise RAM in Settings → Resources (packs usually need 4–8 GB) and Recreate.',
    },
  ];
  for (const k of KNOWN) if (k.re.test(logText)) return k;
  return null;
}

module.exports = { startWatcher };
