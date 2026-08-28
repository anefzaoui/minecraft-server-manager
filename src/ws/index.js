'use strict';

// WebSocket endpoints:
//   /ws/console/<serverId>  - live log stream down, RCON commands up
//   /ws/stats/<serverId>    - normalized stats samples every 2s
// Messages are JSON: {kind: 'log'|'stats'|'cmd'|'cmd-result'|'error', ...}

const { WebSocketServer } = require('ws');
const signature = require('cookie-signature');
const config = require('../config');
const db = require('../db');
const { followLogs } = require('../docker/logs');
const { statsStream } = require('../docker/stats');
const { execCapture, inspectStatus } = require('../docker/containers');
const { getServer } = require('../services/servers');
const { recordEvent } = require('../events');

function attachWebSockets(httpServer) {
  // maxPayload caps inbound frame size so a client can't buffer huge frames in
  // memory before our handlers run (commands are trimmed to 500 chars anyway).
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  wss.on('error', (err) => console.warn('[ws] server error:', err.message));

  httpServer.on('upgrade', (req, socket, head) => {
    const match = /^\/ws\/(console|stats)\/([a-zA-Z0-9_-]+)$/.exec(req.url.split('?')[0]);
    if (!match) {
      socket.destroy();
      return;
    }
    // Cross-site WebSocket hijacking guard (the HTTP side has originGuard; the
    // upgrade path bypasses all Express middleware). A browser always sends
    // Origin on a WS handshake, so a mismatch is a cross-site attempt - reject
    // it. A missing Origin is a non-browser client (scripts, tests), which the
    // signed session cookie still gates below.
    if (!originAllowed(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    const user = sessionUser(req);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const [, kind, serverId] = match;
      if (!getServer(serverId)) {
        ws.close(4404, 'unknown server');
        return;
      }
      if (kind === 'console') handleConsole(ws, serverId, user);
      else handleStats(ws, serverId);
    });
  });

  return wss;
}

async function handleConsole(ws, serverId, user) {
  const send = (obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };
  let unsubscribe = null;
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (unsubscribe) unsubscribe();
  };
  // Attach lifecycle listeners SYNCHRONOUSLY, before the await below. This does two
  // critical things: (1) an 'error' listener means a socket protocol error can never
  // become an unhandled 'error' event that crashes the whole process; (2) a client
  // that disconnects during the subscribe still triggers cleanup once it exists.
  ws.on('error', (err) => {
    console.warn('[ws] console socket error:', err.message);
    cleanup();
  });
  ws.on('close', cleanup);

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }
    if (msg.kind !== 'cmd' || typeof msg.command !== 'string') return;
    // Viewers may watch logs but never execute commands.
    if (!['admin', 'operator'].includes(user.role)) {
      send({ kind: 'cmd-result', command: msg.command, output: '', error: 'Your role (viewer) cannot run commands.' });
      return;
    }
    const command = msg.command.trim().replace(/^\//, '').slice(0, 500);
    if (!command) return;
    try {
      const info = await inspectStatus(serverId);
      if (!info.exists || !['running', 'starting', 'unhealthy'].includes(info.status)) {
        send({ kind: 'cmd-result', command, output: '', error: 'Server is not running.' });
        return;
      }
      const raw = await execCapture(serverId, ['rcon-cli', '--', ...command.split(/\s+/)]);
      const output = require('../utils/ansi').stripAnsi(raw);
      send({ kind: 'cmd-result', command, output: output.trim() });
      // Optional in-game attribution: the vanilla "Rcon" sender can't be renamed,
      // so if this server has a console label we announce the action ourselves.
      announceConsoleAction(serverId, command);
      recordEvent({
        serverId,
        actor: user.username,
        type: 'rcon',
        summary: `RCON: ${redact(command)}`,
        details: { output: output.trim().slice(0, 2000) },
      });
    } catch (err) {
      send({ kind: 'cmd-result', command, output: '', error: err.message });
    }
  });

  unsubscribe = subscribeConsole(serverId, {
    ws,
    onLog: (text) => send({ kind: 'log', text }),
    onEnd: () => send({ kind: 'log-end' }),
    onError: (message) => send({ kind: 'error', message }),
  });
  if (closed) unsubscribe(); // client left before subscribe returned
}

// One upstream `docker logs --follow` + demux pipeline per server, fanned out to
// every connected /ws/console client (same reasoning as the stats broker below):
// N admins/tabs on one server's console used to open N independent follow
// streams. A small rolling buffer replays what's been seen this session to a
// late-joining tab so it isn't blank.
const consoleBrokers = new Map(); // serverId -> { subs, follower, buffer, bufferBytes, stopped }
const CONSOLE_REPLAY_BYTES = 256 * 1024;

function consoleMaxBuffered(broker) {
  let max = 0;
  for (const s of broker.subs) {
    if (s.ws && s.ws.readyState === s.ws.OPEN) max = Math.max(max, s.ws.bufferedAmount);
  }
  return max;
}

// Backpressure across the shared stream: pause the upstream docker log stream
// while ANY subscriber's socket buffer is backed up, resume once they all drain.
// One slow client can add latency for the others, but never unbounded RSS.
function applyConsoleBackpressure(broker) {
  const stream = broker.follower && broker.follower.stream;
  if (!stream || stream.destroyed) return;
  if (consoleMaxBuffered(broker) > 1_000_000 && !stream.isPaused()) {
    stream.pause();
    const tick = setInterval(() => {
      if (broker.stopped || stream.destroyed) {
        clearInterval(tick);
        return;
      }
      if (consoleMaxBuffered(broker) < 200_000) {
        clearInterval(tick);
        if (!stream.isPaused()) return;
        stream.resume();
      }
    }, 100);
    tick.unref?.();
  }
}

function subscribeConsole(serverId, sub) {
  let broker = consoleBrokers.get(serverId);
  if (!broker) {
    broker = { subs: new Set(), follower: null, buffer: [], bufferBytes: 0, stopped: false };
    consoleBrokers.set(serverId, broker);
    followLogs(serverId, { tail: 300 })
      .then((follower) => {
        if (consoleBrokers.get(serverId) !== broker) {
          follower.stop(); // every subscriber left before the stream connected
          return;
        }
        broker.follower = follower;
        follower.stream.on('data', (chunk) => {
          const text = chunk.toString('utf8');
          broker.buffer.push(text);
          broker.bufferBytes += Buffer.byteLength(text);
          while (broker.bufferBytes > CONSOLE_REPLAY_BYTES && broker.buffer.length > 1) {
            broker.bufferBytes -= Buffer.byteLength(broker.buffer.shift());
          }
          for (const s of broker.subs) s.onLog(text);
          applyConsoleBackpressure(broker);
        });
        follower.stream.on('end', () => {
          for (const s of broker.subs) s.onEnd();
        });
        follower.stream.on('error', (err) => {
          for (const s of broker.subs) s.onError(`Log stream error: ${err.message}`);
        });
      })
      .catch((err) => {
        if (consoleBrokers.get(serverId) === broker) consoleBrokers.delete(serverId);
        // A missing container (404) just means the server has never been started -
        // end quietly; the console already shows a "start the server" placeholder.
        if (err.statusCode === 404) {
          for (const s of broker.subs) s.onEnd();
        } else {
          for (const s of broker.subs) s.onError(`Log stream unavailable: ${err.message}`);
        }
      });
  }

  broker.subs.add(sub);
  for (const chunk of broker.buffer) sub.onLog(chunk); // catch a late tab up

  return () => {
    broker.subs.delete(sub);
    if (broker.subs.size === 0 && consoleBrokers.get(serverId) === broker) {
      consoleBrokers.delete(serverId);
      broker.stopped = true;
      if (broker.follower) broker.follower.stop();
    }
  };
}

// One upstream `docker stats --stream` per server, fanned out to every
// connected /ws/stats client, instead of one per connection: several admins
// (or one admin with several tabs) watching the same server's dashboard used
// to each open an independent Docker stats stream and demux pipeline - real,
// avoidable load on the Docker daemon and the panel process that scales with
// concurrent VIEWERS rather than with server count.
const statsBrokers = new Map(); // serverId -> { subscribers, errorSubscribers, stop }

function subscribeStats(serverId, onSample, onError) {
  let broker = statsBrokers.get(serverId);
  if (!broker) {
    broker = { subscribers: new Set(), errorSubscribers: new Set(), stop: null };
    statsBrokers.set(serverId, broker);
    statsStream(serverId, (sample) => {
      for (const fn of broker.subscribers) fn(sample);
    })
      .then((stopFn) => {
        if (statsBrokers.get(serverId) === broker) broker.stop = stopFn;
        else stopFn(); // every subscriber left before the stream finished connecting
      })
      .catch((err) => {
        if (statsBrokers.get(serverId) === broker) statsBrokers.delete(serverId);
        for (const fn of broker.errorSubscribers) fn(err);
      });
  }
  broker.subscribers.add(onSample);
  broker.errorSubscribers.add(onError);
  return () => {
    broker.subscribers.delete(onSample);
    broker.errorSubscribers.delete(onError);
    if (broker.subscribers.size === 0 && statsBrokers.get(serverId) === broker) {
      statsBrokers.delete(serverId);
      if (broker.stop) broker.stop(); // else the .then() above stops it once connected
    }
  };
}

async function handleStats(ws, serverId) {
  let unsubscribe = null;
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (unsubscribe) unsubscribe();
  };
  // Synchronous 'error'/'close' listeners: no unhandled 'error' crash, and a
  // disconnect right after subscribing still unsubscribes.
  ws.on('error', (err) => {
    console.warn('[ws] stats socket error:', err.message);
    cleanup();
  });
  ws.on('close', cleanup);
  unsubscribe = subscribeStats(
    serverId,
    (sample) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ kind: 'stats', ...sample }));
    },
    (err) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ kind: 'error', message: err.message }));
    }
  );
  if (closed) unsubscribe(); // client left synchronously before subscribing even returned
}

/** Same same-origin rule as web/middleware/auth.js#originGuard: reject only when
 *  an Origin (or Referer) is present AND its host differs from the Host header. */
function originAllowed(req) {
  const raw = req.headers.origin || (req.headers.referer ? req.headers.referer : null);
  if (!raw) return true;
  try {
    return new URL(raw).host === req.headers.host;
  } catch {
    return false; // a malformed Origin/Referer on an upgrade is not trustworthy
  }
}

/** Authenticate a WS upgrade from the express-session cookie → {id, username, role} | null. */
function sessionUser(req) {
  try {
    const cookies = Object.fromEntries(
      (req.headers.cookie || '').split(';').map((c) => {
        const idx = c.indexOf('=');
        return [c.slice(0, idx).trim(), decodeURIComponent(c.slice(idx + 1))];
      })
    );
    const raw = cookies['msm.sid'];
    if (!raw || !raw.startsWith('s:')) return null;
    const sid = signature.unsign(raw.slice(2), config.sessionSecret);
    if (!sid) return null;
    const row = db.get('SELECT data_json, expires_at FROM sessions WHERE sid = ?', sid);
    if (!row || Date.parse(row.expires_at) < Date.now()) return null;
    const data = JSON.parse(row.data_json);
    if (!data.userId) return null;
    return require('../services/auth').getUser(data.userId);
  } catch {
    return null;
  }
}

/** Redact sensitive args (op passwords don't exist, but be safe with obvious keys). */
function redact(command) {
  return command.replace(/(password|token|key)\s+\S+/gi, '$1 ●●●');
}

/**
 * If the server has a console label configured, announce the just-run command in
 * game chat as "[label] <command>" via tellraw (JSON-escaped, so nothing the admin
 * types can break out). Fire-and-forget - never blocks the command result.
 */
function announceConsoleAction(serverId, command) {
  const label = (getServer(serverId) || {}).console_label;
  if (!label) return;
  const payload = {
    text: '',
    extra: [
      { text: `[${label}] `, color: 'aqua', bold: true },
      { text: command, color: 'gray' },
    ],
  };
  execCapture(serverId, ['rcon-cli', '--', 'tellraw', '@a', JSON.stringify(payload)]).catch(() => {});
}

module.exports = { attachWebSockets, originAllowed };
