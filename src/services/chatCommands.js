'use strict';

// Custom chat commands: the owner registers triggers like `rtp2` per server;
// when a player types `!rtp2` in game chat the log ingester calls handleChat()
// and the bound action (panel RTP / structure tp / biome tp / raw console
// commands) runs AS that player, with per-command permissions and cooldowns.
// Zero mods — detection is log-based, execution is RCON-based.

const httpError = require('../utils/httpError');
const { nanoid } = require('nanoid');
const db = require('../db');
const players = require('./players');
const { recordEvent } = require('../events');
const { execCapture } = require('../docker/containers');
const { cleanText } = require('../utils/ansi');

const TRIGGER_RE = /^[a-z0-9_-]{1,24}$/i;
// 1-2 chars from a safe set. '/' is deliberately absent — real commands never
// reach the chat log, so a '/' prefix could never fire.
const PREFIX_RE = /^[!.#+?$%&*~^=-]{1,2}$/;
const PLAYER_RE = /^[A-Za-z0-9_]{1,16}$/;
// Chat args substituted into console commands: strict shape or dropped.
const ARG_RE = /^[A-Za-z0-9_:\-.]{0,32}$/;
const ACTIONS = new Set(['rtp', 'structure', 'biome', 'console']);
const PERMISSIONS = new Set(['everyone', 'whitelist', 'ops']);
// Console commands that can wreck a server — ops-only triggers may use them.
const DANGEROUS_RE = /^\s*\/?\s*(stop\b|op\s|deop\b|ban\b|ban-ip\b|pardon\b|pardon-ip\b|whitelist\b)/i;
const WHISPER_MAX = 120;
const CACHE_MS = 60_000;

// ---------------------------------------------------------------------------
// Validation (routes zod-validate shapes; this is the single source of truth
// for semantics so direct service callers get the same guarantees)

function validateSpec({
  trigger,
  description,
  action,
  params,
  permission,
  cooldownSec,
  msgPending,
  msgSuccess,
  msgFailure,
}) {
  trigger = String(trigger || '')
    .trim()
    .toLowerCase();
  if (!TRIGGER_RE.test(trigger)) {
    throw httpError(400, 'Triggers are 1-24 letters, digits, - or _ (no spaces, no prefix)');
  }
  if (!ACTIONS.has(action)) throw httpError(400, 'Unknown action');
  if (!PERMISSIONS.has(permission)) throw httpError(400, 'Unknown permission level');
  const cooldown = Math.floor(Number(cooldownSec));
  if (!Number.isFinite(cooldown) || cooldown < 0 || cooldown > 86400) {
    throw httpError(400, 'Cooldown must be 0-86400 seconds');
  }

  const p = params && typeof params === 'object' ? params : {};
  let clean;
  if (action === 'rtp') {
    const minDistance = Math.max(0, Math.floor(Number(p.minDistance ?? 500) || 0));
    const maxDistance = Math.max(16, Math.floor(Number(p.maxDistance ?? 5000) || 5000));
    if (maxDistance <= minDistance) throw httpError(400, 'Max distance must be greater than min distance');
    if (maxDistance > 1_000_000) throw httpError(400, 'Max distance is capped at 1,000,000');
    clean = { minDistance, maxDistance, center: p.center === 'origin' ? 'origin' : 'player' };
  } else if (action === 'structure') {
    if (!/^#?[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(String(p.structure || ''))) {
      throw httpError(400, 'Pick a valid structure');
    }
    const maxDistance = Math.min(1_000_000, Math.max(16, Math.floor(Number(p.maxDistance ?? 5000) || 5000)));
    clean = { structure: String(p.structure), random: p.random !== false, maxDistance };
  } else if (action === 'biome') {
    if (!/^[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(String(p.biome || ''))) {
      throw httpError(400, 'Pick a valid biome');
    }
    clean = { biome: String(p.biome) };
  } else {
    const commands = Array.isArray(p.commands)
      ? p.commands
          .map((c) =>
            String(c)
              .replace(/[\r\x00-\x1f\x7f]/g, ' ')
              .trim()
          )
          .filter(Boolean)
      : [];
    if (!commands.length) throw httpError(400, 'Add at least one console command');
    if (commands.length > 10) throw httpError(400, 'Max 10 console commands per trigger');
    for (const cmd of commands) {
      if (cmd.length > 200) throw httpError(400, 'Console commands are capped at 200 characters each');
      if (permission !== 'ops' && DANGEROUS_RE.test(cmd)) {
        throw httpError(400, `"${cmd.split(/\s+/)[0]}" commands are only allowed when permission is set to Ops`);
      }
    }
    clean = { commands: commands.map((c) => c.replace(/^\//, '')) };
  }

  return {
    trigger,
    description: String(description || '')
      .trim()
      .slice(0, 200),
    action,
    params: clean,
    permission,
    cooldownSec: cooldown,
    msgPending: cleanMessage(msgPending),
    msgSuccess: cleanMessage(msgSuccess),
    msgFailure: cleanMessage(msgFailure),
  };
}

// Feedback templates: strip control chars, cap length, empty -> null (use default).
function cleanMessage(v) {
  const s = String(v ?? '')
    .replace(/[\r\n\x00-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, 200);
  return s || null;
}

/** Fill {placeholder} tokens from a values map; unknown tokens are left as-is. */
function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, key) => (key in vars && vars[key] != null ? String(vars[key]) : m));
}

const DIM_LABEL = {
  'minecraft:overworld': 'the Overworld',
  'minecraft:the_nether': 'the Nether',
  'minecraft:the_end': 'the End',
};
const prettyDim = (d) => DIM_LABEL[d] || (d ? pretty(d) : '');

/** Placeholder values available to a command's success message, from its result. */
function resultVars(result = {}) {
  const v = {};
  for (const k of ['x', 'y', 'z', 'distance']) if (result[k] != null) v[k] = result[k];
  if (result.dimension) v.dimension = prettyDim(result.dimension);
  if (result.structure) v.structure = pretty(result.structure);
  if (result.biome) v.biome = pretty(result.biome);
  return v;
}

// ---------------------------------------------------------------------------
// CRUD + prefix

function hydrate(row) {
  if (!row) return null;
  let params = {};
  try {
    params = JSON.parse(row.params || '{}');
  } catch {
    /* corrupt row — empty params */
  }
  return { ...row, params, enabled: Boolean(row.enabled) };
}

function listCommands(serverId) {
  return db.all('SELECT * FROM chat_commands WHERE server_id = ? ORDER BY "trigger"', serverId).map(hydrate);
}

function getCommand(serverId, cmdId) {
  return hydrate(db.get('SELECT * FROM chat_commands WHERE id = ? AND server_id = ?', cmdId, serverId));
}

function getPrefix(serverId) {
  const row = db.get('SELECT prefix FROM chat_command_settings WHERE server_id = ?', serverId);
  return row ? row.prefix : '!';
}

function setPrefix(serverId, prefix, { actor = 'system' } = {}) {
  prefix = String(prefix || '').trim();
  if (!PREFIX_RE.test(prefix)) {
    throw httpError(400, 'Prefix must be 1-2 characters from ! . # + ? $ % & * ~ ^ = - (never /)');
  }
  db.run(
    `INSERT INTO chat_command_settings (server_id, prefix) VALUES (?, ?)
     ON CONFLICT(server_id) DO UPDATE SET prefix = excluded.prefix`,
    serverId,
    prefix
  );
  cache.delete(serverId);
  recordEvent({
    serverId,
    actor,
    type: 'chat-command-config',
    summary: `Chat command prefix set to "${prefix}"`,
    details: { prefix },
  });
  return { prefix };
}

function createCommand(serverId, input, { actor = 'system' } = {}) {
  const spec = validateSpec(input);
  const enabled = input.enabled === false ? 0 : 1;
  const id = `ccmd_${nanoid(8)}`;
  try {
    db.run(
      `INSERT INTO chat_commands (id, server_id, "trigger", description, action, params, permission, cooldown_sec, enabled, msg_pending, msg_success, msg_failure)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      serverId,
      spec.trigger,
      spec.description,
      spec.action,
      JSON.stringify(spec.params),
      spec.permission,
      spec.cooldownSec,
      enabled,
      spec.msgPending,
      spec.msgSuccess,
      spec.msgFailure
    );
  } catch (err) {
    if (/UNIQUE/i.test(err.message)) {
      throw httpError(409, `A command named "${spec.trigger}" already exists on this server`);
    }
    throw err;
  }
  cache.delete(serverId);
  recordEvent({
    serverId,
    actor,
    type: 'chat-command-config',
    summary: `Chat command ${getPrefix(serverId)}${spec.trigger} created (${actionSummary(spec)})`,
    details: { id, ...spec },
  });
  return getCommand(serverId, id);
}

function updateCommand(serverId, cmdId, changes, { actor = 'system' } = {}) {
  const existing = getCommand(serverId, cmdId);
  if (!existing) throw httpError(404, 'Chat command not found');

  // Enabled-only toggles skip full re-validation (fast path for the UI toggle).
  const keys = Object.keys(changes).filter((k) => changes[k] !== undefined);
  if (keys.length === 1 && keys[0] === 'enabled') {
    db.run('UPDATE chat_commands SET enabled = ? WHERE id = ?', changes.enabled ? 1 : 0, cmdId);
    cache.delete(serverId);
    recordEvent({
      serverId,
      actor,
      type: 'chat-command-config',
      summary: `Chat command ${getPrefix(serverId)}${existing.trigger} ${changes.enabled ? 'enabled' : 'disabled'}`,
      details: { id: cmdId, enabled: Boolean(changes.enabled) },
    });
    return getCommand(serverId, cmdId);
  }

  const spec = validateSpec({
    trigger: changes.trigger ?? existing.trigger,
    description: changes.description ?? existing.description,
    action: changes.action ?? existing.action,
    params: changes.params ?? existing.params,
    permission: changes.permission ?? existing.permission,
    cooldownSec: changes.cooldownSec ?? existing.cooldown_sec,
    msgPending: changes.msgPending ?? existing.msg_pending,
    msgSuccess: changes.msgSuccess ?? existing.msg_success,
    msgFailure: changes.msgFailure ?? existing.msg_failure,
  });
  const enabled = (changes.enabled ?? existing.enabled) ? 1 : 0;
  try {
    db.run(
      `UPDATE chat_commands SET "trigger" = ?, description = ?, action = ?, params = ?, permission = ?, cooldown_sec = ?, enabled = ?,
        msg_pending = ?, msg_success = ?, msg_failure = ?
       WHERE id = ?`,
      spec.trigger,
      spec.description,
      spec.action,
      JSON.stringify(spec.params),
      spec.permission,
      spec.cooldownSec,
      enabled,
      spec.msgPending,
      spec.msgSuccess,
      spec.msgFailure,
      cmdId
    );
  } catch (err) {
    if (/UNIQUE/i.test(err.message)) {
      throw httpError(409, `A command named "${spec.trigger}" already exists on this server`);
    }
    throw err;
  }
  cache.delete(serverId);
  recordEvent({
    serverId,
    actor,
    type: 'chat-command-config',
    summary: `Chat command ${getPrefix(serverId)}${spec.trigger} updated (${actionSummary(spec)})`,
    details: { id: cmdId, ...spec, enabled: Boolean(enabled) },
  });
  return getCommand(serverId, cmdId);
}

function deleteCommand(serverId, cmdId, { actor = 'system' } = {}) {
  const existing = getCommand(serverId, cmdId);
  if (!existing) throw httpError(404, 'Chat command not found');
  db.run('DELETE FROM chat_commands WHERE id = ?', cmdId);
  cache.delete(serverId);
  recordEvent({
    serverId,
    actor,
    type: 'chat-command-config',
    summary: `Chat command ${getPrefix(serverId)}${existing.trigger} deleted`,
    details: { id: cmdId, trigger: existing.trigger },
  });
  return { deleted: true };
}

/** "rtp 500-5000" / "structure #minecraft:village" / "console ×2" — for events + UI. */
function actionSummary(cmd) {
  const p = cmd.params || {};
  if (cmd.action === 'rtp')
    return `rtp ${p.minDistance ?? 500}-${p.maxDistance ?? 5000}${p.center === 'origin' ? ' around 0,0' : ''}`;
  if (cmd.action === 'structure')
    return `structure ${String(p.structure || '').replace(/^#/, '')}${p.random === false ? ' (nearest)' : ''}`;
  if (cmd.action === 'biome') return `biome ${p.biome || ''}`;
  return `console ×${Array.isArray(p.commands) ? p.commands.length : 0}`;
}

// ---------------------------------------------------------------------------
// Runtime: cache, cooldowns, concurrency

const cache = new Map(); // serverId -> { at, prefix, byTrigger }

function getRuntime(serverId) {
  const hit = cache.get(serverId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const byTrigger = new Map();
  for (const cmd of listCommands(serverId)) byTrigger.set(cmd.trigger, cmd);
  const entry = { at: Date.now(), prefix: getPrefix(serverId), byTrigger };
  cache.set(serverId, entry);
  return entry;
}

const cooldowns = new Map(); // `${serverId}:${trigger}:${playerLower}` -> last run ts
const inflight = new Set(); // `${serverId}:${playerLower}` — one execution per player
const triggerThrottle = new Map(); // `${serverId}:${playerLower}` -> last-processed ts (spam guard)
const THROTTLE_MS = 400;

function pruneCooldowns() {
  if (cooldowns.size >= 2000) {
    const cutoff = Date.now() - 86_400_000;
    for (const [k, ts] of cooldowns) if (ts < cutoff) cooldowns.delete(k);
  }
  if (triggerThrottle.size >= 2000) {
    const cutoff = Date.now() - 60_000;
    for (const [k, ts] of triggerThrottle) if (ts < cutoff) triggerThrottle.delete(k);
  }
}

/** Whisper to a player via RCON `tell`; never throws (fire-and-forget feedback). */
async function whisper(serverId, player, message) {
  const text = String(message || '')
    .replace(/[\r\n\x00-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, WHISPER_MAX);
  if (!text || !PLAYER_RE.test(player)) return;
  try {
    await execCapture(serverId, ['rcon-cli', '--', 'tell', player, text]);
  } catch {
    /* server just stopped / rcon busy — nothing to do */
  }
}

function isOp(serverId, player) {
  const lower = player.toLowerCase();
  return players.readJson(serverId, 'ops.json').some((e) => (e.name || '').toLowerCase() === lower);
}

function isWhitelisted(serverId, player) {
  const lower = player.toLowerCase();
  return (
    players.readJson(serverId, 'whitelist.json').some((e) => (e.name || '').toLowerCase() === lower) ||
    isOp(serverId, player)
  );
}

function hasPermission(serverId, player, permission) {
  if (permission === 'ops') return isOp(serverId, player);
  if (permission === 'whitelist') return isWhitelisted(serverId, player);
  return true;
}

// ---------------------------------------------------------------------------
// Execution

/**
 * Run one command's action as `player`. Returns the whisper/feedback message.
 * Teleport actions run inside the server-wide teleport slot; console commands
 * run sequentially over rcon with sanitized placeholder substitution.
 */
async function executeAction(serverId, cmd, player, args, ctx) {
  const p = cmd.params || {};
  if (cmd.action === 'rtp') {
    const result = await players.withTeleportSlot(serverId, () =>
      players.rtpPlayer(
        serverId,
        player,
        { minDistance: p.minDistance, maxDistance: p.maxDistance, center: p.center },
        ctx
      )
    );
    return {
      message: `Whoosh! You landed ${result.distance} blocks away at ${result.x}, ${result.z} in ${prettyDim(result.dimension)}.`,
      result,
    };
  }
  if (cmd.action === 'structure') {
    const result = await players.withTeleportSlot(serverId, () =>
      players.tpToStructure(
        serverId,
        player,
        p.structure,
        { random: p.random !== false, maxDistance: p.maxDistance },
        ctx
      )
    );
    return {
      message: `Teleported to a ${pretty(result.structure)} in ${prettyDim(result.dimension)} at ${result.x}, ${result.z}.`,
      result,
    };
  }
  if (cmd.action === 'biome') {
    const result = await players.withTeleportSlot(serverId, () => players.tpToBiome(serverId, player, p.biome, ctx));
    return {
      message: `Teleported to ${pretty(result.biome)} in ${prettyDim(result.dimension)} at ${result.x}, ${result.z}.`,
      result,
    };
  }

  // console: placeholders substituted with sanitized values, run sequentially.
  const values = {
    player,
    arg1: sanitizeArg(args[0]),
    arg2: sanitizeArg(args[1]),
    arg3: sanitizeArg(args[2]),
  };
  let lastOut = '';
  for (const template of p.commands || []) {
    const line = template.replace(/\{(player|arg1|arg2|arg3)\}/g, (_, key) => values[key]).trim();
    if (!line) continue;
    const out = cleanText(await execCapture(serverId, ['rcon-cli', '--', ...line.split(/\s+/)]));
    if (out.trim()) lastOut = out.trim();
  }
  return { message: lastOut || 'Done!', result: { commands: (p.commands || []).length, output: lastOut } };
}

function sanitizeArg(value) {
  const v = String(value ?? '').trim();
  return ARG_RE.test(v) ? v : '';
}

function pretty(id) {
  const base = String(id || '')
    .replace(/^#/, '')
    .split(':')
    .pop()
    .split('/')
    .pop()
    .replace(/_/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function bumpUsage(serverId, cmd) {
  db.run("UPDATE chat_commands SET uses = uses + 1, last_used_at = datetime('now') WHERE id = ?", cmd.id);
  cache.delete(serverId);
}

/**
 * Entry point for the log ingester. Fire-and-forget: every failure is handled
 * here (whisper + event) — nothing propagates back into log ingestion.
 */
async function handleChat(serverId, player, message) {
  const text = String(message || '').trim();
  if (!text || !PLAYER_RE.test(String(player))) return;

  const runtime = getRuntime(serverId);
  if (!runtime.byTrigger.size || !text.startsWith(runtime.prefix)) return;

  const parts = text.slice(runtime.prefix.length).trim().split(/\s+/);
  const trigger = (parts[0] || '').toLowerCase();
  if (!TRIGGER_RE.test(trigger)) return; // "!!!" and friends — normal chat
  const cmd = runtime.byTrigger.get(trigger);
  if (!cmd || !cmd.enabled) return; // unknown trigger — players chat with ! all the time
  const args = parts.slice(1, 4);
  const label = `${runtime.prefix}${trigger}`;

  // Cheap per-player spam guard BEFORE the permission lookup (which reads
  // ops.json/whitelist.json from disk): bounds how often a player can force those
  // sync reads by hammering a known trigger, protecting the event loop.
  const throttleKey = `${serverId}:${player.toLowerCase()}`;
  const lastSeen = triggerThrottle.get(throttleKey) || 0;
  if (Date.now() - lastSeen < THROTTLE_MS) return;
  triggerThrottle.set(throttleKey, Date.now());
  pruneCooldowns();

  // Permission
  if (!hasPermission(serverId, player, cmd.permission)) {
    whisper(serverId, player, "You don't have permission to use that.");
    recordEvent({
      serverId,
      actor: `chat:${player}`,
      type: 'chat-command',
      summary: `${player} tried ${label} — denied (needs ${cmd.permission})`,
      details: { trigger, action: cmd.action, player, success: false, reason: 'permission' },
    });
    return;
  }

  // Cooldown (per server + trigger + player)
  const cdKey = `${serverId}:${trigger}:${player.toLowerCase()}`;
  if (cmd.cooldown_sec > 0) {
    const last = cooldowns.get(cdKey) || 0;
    const remainingMs = cmd.cooldown_sec * 1000 - (Date.now() - last);
    if (remainingMs > 0) {
      whisper(serverId, player, `Wait ${Math.ceil(remainingMs / 1000)}s before using ${label} again.`);
      return;
    }
  }

  // One execution per player at a time (locate searches take seconds).
  const flightKey = `${serverId}:${player.toLowerCase()}`;
  if (inflight.has(flightKey)) {
    whisper(serverId, player, 'Your previous command is still running — give it a second.');
    return;
  }
  inflight.add(flightKey);
  // Cooldown starts when the execution starts: retry-spamming an expensive
  // /locate search is exactly what cooldowns exist to prevent.
  cooldowns.set(cdKey, Date.now());
  pruneCooldowns();

  const ctx = { running: true, actor: `chat:${player}` };
  const baseVars = {
    player,
    trigger,
    arg1: sanitizeArg(args[0]),
    arg2: sanitizeArg(args[1]),
    arg3: sanitizeArg(args[2]),
  };
  // State 1 — pending: acknowledge immediately, before the (possibly slow) action.
  if (cmd.msg_pending) whisper(serverId, player, renderTemplate(cmd.msg_pending, baseVars));
  try {
    const { message: defaultMsg, result } = await executeAction(serverId, cmd, player, args, ctx);
    bumpUsage(serverId, cmd);
    // State 2 — success: custom template (with result placeholders) or the built-in message.
    const successMsg = cmd.msg_success
      ? renderTemplate(cmd.msg_success, { ...baseVars, ...resultVars(result) })
      : defaultMsg;
    whisper(serverId, player, successMsg);
    recordEvent({
      serverId,
      actor: `chat:${player}`,
      type: 'chat-command',
      summary: `${player} ran ${label} (${actionSummary(cmd)})`,
      details: { trigger, action: cmd.action, params: cmd.params, player, args, success: true },
    });
  } catch (err) {
    const friendly =
      err.status === 429
        ? 'The server is busy with another teleport — try again in a few seconds.'
        : err.message || 'That command failed — tell the server owner.';
    // State 3 — failure: custom template (with {error}) or the built-in message.
    const failMsg = cmd.msg_failure
      ? renderTemplate(cmd.msg_failure, { ...baseVars, error: err.message || 'error' })
      : friendly;
    whisper(serverId, player, failMsg);
    recordEvent({
      serverId,
      actor: `chat:${player}`,
      type: 'chat-command',
      summary: `${player} ran ${label} — failed: ${String(err.message || err).slice(0, 140)}`,
      details: { trigger, action: cmd.action, player, args, success: false, reason: err.message },
    });
  } finally {
    inflight.delete(flightKey);
  }
}

/**
 * Panel "Test" button: run a command NOW as a named player — same execution
 * path minus permission and cooldown checks. Throws on failure (the route
 * turns it into a friendly JSON error); records an event either way.
 */
async function testCommand(serverId, cmdId, player, { actor = 'system' } = {}) {
  const cmd = getCommand(serverId, cmdId);
  if (!cmd) throw httpError(404, 'Chat command not found');
  if (!PLAYER_RE.test(String(player))) throw httpError(400, 'Invalid player name');

  const flightKey = `${serverId}:${String(player).toLowerCase()}`;
  if (inflight.has(flightKey)) throw httpError(429, 'That player already has a command running — wait a moment.');
  inflight.add(flightKey);
  const ctx = { running: true, actor };
  const baseVars = { player, trigger: cmd.trigger, arg1: '', arg2: '', arg3: '' };
  if (cmd.msg_pending) whisper(serverId, player, renderTemplate(cmd.msg_pending, baseVars));
  try {
    const { message: defaultMsg, result } = await executeAction(serverId, cmd, player, [], ctx);
    bumpUsage(serverId, cmd);
    const message = cmd.msg_success
      ? renderTemplate(cmd.msg_success, { ...baseVars, ...resultVars(result) })
      : defaultMsg;
    whisper(serverId, player, message);
    recordEvent({
      serverId,
      actor,
      type: 'chat-command',
      summary: `${player} ran ${getPrefix(serverId)}${cmd.trigger} (${actionSummary(cmd)}) — panel test`,
      details: { trigger: cmd.trigger, action: cmd.action, params: cmd.params, player, success: true, via: 'test' },
    });
    return { message, result };
  } catch (err) {
    if (cmd.msg_failure)
      whisper(serverId, player, renderTemplate(cmd.msg_failure, { ...baseVars, error: err.message || 'error' }));
    recordEvent({
      serverId,
      actor,
      type: 'chat-command',
      summary: `Panel test of ${getPrefix(serverId)}${cmd.trigger} as ${player} failed: ${String(err.message || err).slice(0, 140)}`,
      details: { trigger: cmd.trigger, action: cmd.action, player, success: false, reason: err.message, via: 'test' },
    });
    throw err;
  } finally {
    inflight.delete(flightKey);
  }
}

module.exports = {
  listCommands,
  getCommand,
  createCommand,
  updateCommand,
  deleteCommand,
  getPrefix,
  setPrefix,
  handleChat,
  testCommand,
  actionSummary,
  TRIGGER_RE,
  PREFIX_RE,
};
