// @ts-nocheck -- OpenAI-compatible tool-call payloads vary between providers.
'use strict';

const fsp = require('node:fs/promises');
const nbt = require('prismarine-nbt');
const httpError = require('../utils/httpError');
const { PLAYER_NAME_RE } = require('../utils/playerName');
const { dataPath } = require('../storage/pathGuard');
const { execCapture, inspectStatus } = require('../docker/containers');
const { cleanText } = require('../utils/ansi');
const { recordEvent, listEvents } = require('../events');
const servers = require('./servers');
const worlds = require('./worlds');
const players = require('./players');
const inventory = require('./inventory');
const worldControls = require('./worldControls');

const POWER_KEYS = ['heal', 'feed', 'spawn', 'time', 'weather', 'gift'];
const DEFAULT_FLAGS = Object.freeze(Object.fromEntries(POWER_KEYS.map((key) => [key, true])));
const DEFAULT_GIFTS = Object.freeze(['minecraft:bread', 'minecraft:torch', 'minecraft:arrow']);
const ITEM_RE = /^[a-z0-9_.-]+:[a-z0-9_/.-]+$/;
const cooldowns = new Map();

function uniqueStrings(value) {
  const seen = new Set();
  const result = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const item = String(raw || '').trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function normalizeTesters(value) {
  const names = uniqueStrings(value);
  if (names.length > 50) throw httpError(400, 'At most 50 Basic users may be configured');
  if (names.some((name) => !PLAYER_NAME_RE.test(name))) {
    throw httpError(400, 'Basic users must be valid Minecraft player names');
  }
  return names;
}

function normalizeControllers(value) {
  const names = uniqueStrings(value);
  if (names.length > 50) throw httpError(400, 'At most 50 chatbot power controllers may be configured');
  if (names.some((name) => !PLAYER_NAME_RE.test(name))) {
    throw httpError(400, 'Power controllers must be valid Minecraft player names');
  }
  return names;
}

function normalizeGiftItems(value) {
  const items = uniqueStrings(value).map((item) => item.toLowerCase());
  if (items.length > 100) throw httpError(400, 'At most 100 gift items may be configured');
  if (items.some((item) => !ITEM_RE.test(item))) {
    throw httpError(400, 'Gift items must be namespaced Minecraft item IDs, such as minecraft:bread');
  }
  return items;
}

function normalizeFlags(value = {}) {
  return Object.fromEntries(POWER_KEYS.map((key) => [key, value[key] !== false]));
}

function isTester(cfg, player) {
  const wanted = String(player || '').toLowerCase();
  return cfg.powerTesters.some((name) => name.toLowerCase() === wanted);
}

function isController(cfg, player) {
  const wanted = String(player || '').toLowerCase();
  return (cfg.powerControllers || []).some((name) => name.toLowerCase() === wanted);
}

function normalizePowerTarget(value) {
  let target = String(value || '').trim();
  if (/^@[aeprs]$/i.test(target)) throw httpError(400, 'Minecraft selectors are not valid chatbot targets');
  if (target.startsWith('@')) target = target.slice(1);
  if (!PLAYER_NAME_RE.test(target)) throw httpError(400, 'The chatbot requested an invalid target player');
  return target;
}

function matchOnlineTarget(value, onlineNames) {
  const target = normalizePowerTarget(value);
  const exact = (Array.isArray(onlineNames) ? onlineNames : []).find(
    (name) => String(name).toLowerCase() === target.toLowerCase()
  );
  if (!exact) throw httpError(404, `${target} is not online`);
  return exact;
}

const INFORMATION_RE =
  /\b(?:how (?:do|can|should|would)|recipe|craft(?:ing)?|instructions?|what (?:do|should|can)|where (?:do|can)|explain|teach me|show me how)\b/i;

function powerIntent(prompt) {
  if (prompt === null || prompt === undefined) return { ...DEFAULT_FLAGS };
  const text = String(prompt).trim();
  if (!text || INFORMATION_RE.test(text)) return Object.fromEntries(POWER_KEYS.map((key) => [key, false]));
  return {
    heal: /\b(?:heal|cure|revive)\s+me\b|\brestore\s+(?:my\s+)?health\b|\bi(?:'m| am)\s+(?:hurt|dying|low on health)\b/i.test(
      text
    ),
    feed: /\b(?:feed|saturate)\s+me\b|\brestore\s+(?:my\s+)?(?:hunger|food)\b|\bi(?:'m| am)\s+(?:hungry|starving)\b/i.test(
      text
    ),
    spawn: /\b(?:teleport|send|take|return|get)\s+me\s+(?:back\s+)?(?:to\s+)?(?:world\s+)?(?:spawn|home)\b/i.test(text),
    time: /\b(?:set|change|turn|make)\s+(?:the\s+)?(?:world\s+)?(?:time|it)\s+(?:to\s+)?(?:day|daytime|noon|night|midnight)\b/i.test(
      text
    ),
    weather:
      /\b(?:make|let)\s+it\s+(?:rain|snow|thunder)\b|\b(?:set|change)\s+(?:the\s+)?weather(?:\s+to)?\s+(?:clear|rain|rainy|thunder|stormy)\b|\b(?:clear|start|stop)\s+(?:the\s+)?(?:rain|weather|storm)\b/i.test(
        text
      ),
    gift: /\b(?:give|grant|hand|bring|spawn|summon)\s+(?:me|us)\b|\b(?:can|could|may|would)\s+(?:you\s+)?(?:give|grant|hand|bring|spawn)\s+me\b|\b(?:can|could|may)\s+i\s+(?:have|get|receive)\b|\bi\s+(?:want|need|would like)\s+(?:an?|some|one|two|three|\d+)\b/i.test(
      text
    ),
  };
}

const PLAYER_TOKEN = '@?[.*]?[A-Za-z0-9_]{1,16}';

function crossPowerIntent(prompt) {
  if (prompt === null || prompt === undefined) {
    return { heal: true, feed: true, teleportToSelf: true, teleportSelfToPlayer: true, gift: true };
  }
  const text = String(prompt).trim();
  if (!text || INFORMATION_RE.test(text)) {
    return { heal: false, feed: false, teleportToSelf: false, teleportSelfToPlayer: false, gift: false };
  }
  return {
    heal: new RegExp(`\\b(?:heal|cure|revive)\\s+(?!me\\b)${PLAYER_TOKEN}(?:\\b|$)`, 'i').test(text),
    feed: new RegExp(`\\b(?:feed|saturate)\\s+(?!me\\b)${PLAYER_TOKEN}(?:\\b|$)`, 'i').test(text),
    teleportToSelf: new RegExp(
      `\\b(?:teleport|tp|bring|send)\\s+(?!me\\b)${PLAYER_TOKEN}\\s+(?:to\\s+me|here)\\b`,
      'i'
    ).test(text),
    teleportSelfToPlayer: new RegExp(
      `\\b(?:teleport|tp|send|take)\\s+me\\s+to\\s+(?!(?:spawn|home)\\b)${PLAYER_TOKEN}(?:\\b|$)`,
      'i'
    ).test(text),
    gift: new RegExp(`\\b(?:give|grant|hand)\\s+(?!me\\b|us\\b)${PLAYER_TOKEN}(?:\\b|$)`, 'i').test(text),
  };
}

function toolsFor(cfg, player, prompt = null) {
  const selfAllowed = isTester(cfg, player);
  const crossAllowed = isController(cfg, player);
  if (!cfg.powersEnabled || (!selfAllowed && !crossAllowed)) return [];
  const intent = powerIntent(prompt);
  const crossIntent = crossPowerIntent(prompt);
  const tools = [];
  const add = (name, description, properties = {}, required = []) =>
    tools.push({
      type: 'function',
      function: {
        name,
        description,
        parameters: { type: 'object', properties, required, additionalProperties: false },
      },
    });
  if (selfAllowed && cfg.powerFlags.heal && intent.heal)
    add('heal_self', 'Restore the requesting player to full health.');
  if (selfAllowed && cfg.powerFlags.feed && intent.feed)
    add('feed_self', 'Restore the requesting player to full hunger and saturation.');
  if (selfAllowed && cfg.powerFlags.spawn && intent.spawn)
    add('teleport_self_to_spawn', 'Safely teleport the requesting player to world spawn.');
  if (selfAllowed && cfg.powerFlags.time && intent.time)
    add(
      'set_time',
      'Set this server world time.',
      { value: { type: 'string', enum: ['day', 'noon', 'night', 'midnight'] } },
      ['value']
    );
  if (selfAllowed && cfg.powerFlags.weather && intent.weather)
    add('set_weather', 'Set this server weather.', { value: { type: 'string', enum: ['clear', 'rain', 'thunder'] } }, [
      'value',
    ]);
  if (selfAllowed && cfg.powerFlags.gift && intent.gift && cfg.giftItems.length)
    add(
      'give_self',
      'Give an allowlisted item to the requesting player.',
      {
        item: { type: 'string', enum: cfg.giftItems },
        count: { type: 'integer', minimum: 1, maximum: cfg.giftMaxCount },
      },
      ['item', 'count']
    );
  const target = {
    type: 'string',
    pattern: '^[.*]?[A-Za-z0-9_]{1,16}$',
    description: 'Exact online Minecraft player name without an @ prefix or selector.',
  };
  if (crossAllowed && cfg.powerFlags.heal && crossIntent.heal)
    add('heal_player', 'Restore another exact online player to full health.', { target }, ['target']);
  if (crossAllowed && cfg.powerFlags.feed && crossIntent.feed)
    add('feed_player', 'Restore another exact online player to full hunger and saturation.', { target }, ['target']);
  if (crossAllowed && cfg.powerFlags.spawn && crossIntent.teleportToSelf)
    add('teleport_player_to_self', 'Teleport another exact online player to the requesting player.', { target }, [
      'target',
    ]);
  if (crossAllowed && cfg.powerFlags.spawn && crossIntent.teleportSelfToPlayer)
    add('teleport_self_to_player', 'Teleport the requesting player to another exact online player.', { target }, [
      'target',
    ]);
  if (crossAllowed && cfg.powerFlags.gift && crossIntent.gift)
    add(
      'give_player',
      'Give any valid namespaced Minecraft item to another exact online player. Use a vanilla minecraft: ID or the exact mod namespace and item ID.',
      {
        target,
        item: {
          type: 'string',
          pattern: ITEM_RE.source,
          description: 'Exact namespaced item ID, such as minecraft:red_bed or a_mod:item_name.',
        },
        count: { type: 'integer', minimum: 1, maximum: cfg.giftMaxCount },
      },
      ['target', 'item', 'count']
    );
  return tools;
}

function parseToolCall(message, cfg, player, prompt = null) {
  const calls = message && Array.isArray(message.tool_calls) ? message.tool_calls : [];
  if (!calls.length) return null;
  if (calls.length > 1) {
    const parsed = calls.map((call) => parseToolCall({ tool_calls: [call] }, cfg, player, prompt));
    const signatures = new Set(parsed.map((request) => JSON.stringify([request.name, request.args])));
    if (signatures.size === 1) return parsed[0];
    throw httpError(400, 'The chatbot requested more than one different power at once');
  }
  const call = calls[0];
  const name = String(call?.function?.name || '');
  const allowed = new Set(toolsFor(cfg, player, prompt).map((tool) => tool.function.name));
  if (!allowed.has(name)) throw httpError(403, 'The chatbot requested a disabled or unavailable power');
  let args;
  try {
    args =
      typeof call.function.arguments === 'string'
        ? JSON.parse(call.function.arguments || '{}')
        : call.function.arguments || {};
  } catch {
    throw httpError(400, 'The chatbot returned invalid power arguments');
  }
  if (!args || Array.isArray(args) || typeof args !== 'object')
    throw httpError(400, 'The chatbot returned invalid power arguments');
  const keys = Object.keys(args);
  if (['heal_self', 'feed_self', 'teleport_self_to_spawn'].includes(name)) {
    if (keys.length) throw httpError(400, 'This power does not accept arguments');
  } else if (name === 'set_time') {
    if (keys.length !== 1 || !['day', 'noon', 'night', 'midnight'].includes(args.value)) {
      throw httpError(400, 'The chatbot requested an invalid time');
    }
  } else if (name === 'set_weather') {
    if (keys.length !== 1 || !['clear', 'rain', 'thunder'].includes(args.value)) {
      throw httpError(400, 'The chatbot requested invalid weather');
    }
  } else if (name === 'give_self') {
    const item = String(args.item || '').toLowerCase();
    const count = Number(args.count);
    if (
      keys.some((key) => !['item', 'count'].includes(key)) ||
      keys.length !== 2 ||
      !cfg.giftItems.includes(item) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > cfg.giftMaxCount
    ) {
      throw httpError(400, 'The chatbot requested an item or quantity outside the allowlist');
    }
    args = { item, count };
  } else if (['heal_player', 'feed_player', 'teleport_player_to_self', 'teleport_self_to_player'].includes(name)) {
    const target = normalizePowerTarget(args.target);
    if (keys.length !== 1 || keys[0] !== 'target' || target.toLowerCase() === String(player).toLowerCase()) {
      throw httpError(400, 'A cross-player power requires exactly one other player target');
    }
    args = { target };
  } else if (name === 'give_player') {
    const target = normalizePowerTarget(args.target);
    const item = String(args.item || '').toLowerCase();
    const count = Number(args.count);
    if (
      keys.some((key) => !['target', 'item', 'count'].includes(key)) ||
      keys.length !== 3 ||
      target.toLowerCase() === String(player).toLowerCase() ||
      !ITEM_RE.test(item) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > cfg.giftMaxCount
    ) {
      throw httpError(400, 'The chatbot requested an invalid target, item ID, or quantity');
    }
    args = { target, item, count };
  }
  return { id: String(call.id || ''), name, args };
}

function describe(request, caller = 'the caller') {
  if (request.name === 'heal_self') return 'restore full health';
  if (request.name === 'feed_self') return 'restore full hunger';
  if (request.name === 'teleport_self_to_spawn') return 'teleport to world spawn';
  if (request.name === 'set_time') return `set the time to ${request.args.value}`;
  if (request.name === 'set_weather') return `set the weather to ${request.args.value}`;
  if (request.name === 'give_self') return `give ${request.args.count} × ${request.args.item}`;
  if (request.name === 'heal_player') return `restore ${request.args.target}'s full health`;
  if (request.name === 'feed_player') return `restore ${request.args.target}'s full hunger`;
  if (request.name === 'teleport_player_to_self') return `teleport ${request.args.target} to ${caller}`;
  if (request.name === 'teleport_self_to_player') return `teleport ${caller} to ${request.args.target}`;
  return `give ${request.args.target} ${request.args.count} × ${request.args.item}`;
}

function recordRejection(serverId, player, reason, request = null) {
  recordEvent({
    serverId,
    actor: `wizard:${player}`,
    type: 'wizard-power',
    summary: `${player}: Chatbot power rejected`,
    details: {
      player,
      caller: player,
      target: request?.args?.target || null,
      power: request?.name || null,
      arguments: request?.args || null,
      succeeded: false,
      rejected: true,
      reason: String(reason || 'Rejected').slice(0, 300),
    },
  });
}

async function assertRunning(serverId) {
  const info = await inspectStatus(serverId).catch(() => null);
  if (!info || !['running', 'unhealthy'].includes(info.status))
    throw httpError(409, 'The Minecraft server is not running');
}

async function fixedRcon(serverId, args, player) {
  await assertRunning(serverId);
  const out = cleanText(await execCapture(serverId, ['rcon-cli', ...args])).trim();
  if (/No player was found|No entity was found/i.test(out)) throw httpError(404, `${player} is not online`);
  if (/Unknown or incomplete command|Incorrect argument|Expected |<--\[HERE\]/i.test(out)) {
    throw httpError(502, `The server rejected the power: ${out.slice(0, 200)}`);
  }
  return out;
}

async function worldSpawn(serverId) {
  const server = servers.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  const file = dataPath('servers', serverId, worlds.activeLevelName(server), 'level.dat');
  try {
    const { parsed } = await nbt.parse(await fsp.readFile(file));
    const data = nbt.simplify(parsed).Data || nbt.simplify(parsed);
    const x = Number(data.SpawnX);
    const z = Number(data.SpawnZ);
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('spawn coordinates are missing');
    return { x, z };
  } catch (err) {
    throw httpError(422, `Could not read world spawn: ${err.message}`);
  }
}

async function execute(serverId, player, request, cfg) {
  if (!cfg.powersEnabled || (!isTester(cfg, player) && !isController(cfg, player)))
    throw httpError(403, 'This player is not allowed to use chatbot powers');
  if (!PLAYER_NAME_RE.test(String(player))) throw httpError(400, 'Invalid Minecraft player name');
  try {
    request = parseToolCall(
      { tool_calls: [{ function: { name: request?.name, arguments: request?.args || {} } }] },
      cfg,
      player
    );
  } catch (err) {
    recordRejection(serverId, player, err.message, request);
    throw err;
  }
  const key = `${serverId}:${String(player).toLowerCase()}`;
  const remaining = cfg.powerCooldownSec * 1000 - (Date.now() - (cooldowns.get(key) || 0));
  if (remaining > 0) {
    const err = httpError(429, `Chatbot powers are recharging for ${Math.ceil(remaining / 1000)} more seconds`);
    recordRejection(serverId, player, err.message, request);
    throw err;
  }

  let action = describe(request, player);
  let details = {
    player,
    caller: player,
    target: request.args.target || player,
    power: request.name,
    arguments: request.args,
    dryRun: cfg.powersDryRun,
  };
  if (cfg.powersDryRun) {
    recordEvent({
      serverId,
      actor: `wizard:${player}`,
      type: 'wizard-power',
      summary: `Dry run: ${player} would ${action}`,
      details,
    });
    return { dryRun: true, message: `Dry run only: I would ${action}.` };
  }

  try {
    const actor = `wizard:${player}`;
    if (request.args.target) {
      request.args.target = matchOnlineTarget(
        request.args.target,
        await players.listOnlineNames(serverId, { throwOnError: true })
      );
      action = describe(request, player);
      details = { ...details, target: request.args.target, arguments: request.args };
    }
    if (request.name === 'heal_self') {
      await fixedRcon(serverId, ['effect', 'give', player, 'minecraft:instant_health', '1', '10', 'true'], player);
    } else if (request.name === 'feed_self')
      await fixedRcon(serverId, ['effect', 'give', player, 'minecraft:saturation', '1', '10', 'true'], player);
    else if (request.name === 'teleport_self_to_spawn') {
      const spawn = await worldSpawn(serverId);
      await players.withTeleportSlot(serverId, () =>
        players.tpToCoords(serverId, player, { ...spawn, dimension: 'minecraft:overworld' }, { running: true, actor })
      );
    } else if (request.name === 'set_time')
      await worldControls.runQuick(serverId, `time-${request.args.value}`, { actor });
    else if (request.name === 'set_weather')
      await worldControls.runQuick(serverId, `weather-${request.args.value}`, { actor });
    else if (request.name === 'give_self')
      await inventory.giveItem(serverId, player, request.args.item, request.args.count, { actor });
    else if (request.name === 'heal_player')
      await fixedRcon(
        serverId,
        ['effect', 'give', request.args.target, 'minecraft:instant_health', '1', '10', 'true'],
        request.args.target
      );
    else if (request.name === 'feed_player')
      await fixedRcon(
        serverId,
        ['effect', 'give', request.args.target, 'minecraft:saturation', '1', '10', 'true'],
        request.args.target
      );
    else if (request.name === 'teleport_player_to_self')
      await players.tpToPlayer(serverId, request.args.target, player, { running: true, actor });
    else if (request.name === 'teleport_self_to_player')
      await players.tpToPlayer(serverId, player, request.args.target, { running: true, actor });
    else if (request.name === 'give_player')
      await inventory.giveItem(serverId, request.args.target, request.args.item, request.args.count, { actor });
    cooldowns.set(key, Date.now());
    recordEvent({
      serverId,
      actor,
      type: 'wizard-power',
      summary: `${player}: ${action}`,
      details: { ...details, succeeded: true },
    });
    return { dryRun: false, message: `It is done: I ${action}.` };
  } catch (err) {
    recordEvent({
      serverId,
      actor: `wizard:${player}`,
      type: 'wizard-power',
      summary: `${player}: ${action} failed`,
      details: { ...details, succeeded: false, error: String(err.message || err).slice(0, 300) },
    });
    throw err;
  }
}

function listAudit(serverId, limit = 100) {
  return listEvents({ serverId, type: 'wizard-power', limit: Math.max(1, Math.min(500, Number(limit) || 100)) });
}

module.exports = {
  POWER_KEYS,
  DEFAULT_FLAGS,
  DEFAULT_GIFTS,
  normalizeTesters,
  normalizeControllers,
  normalizeGiftItems,
  normalizeFlags,
  isTester,
  isController,
  normalizePowerTarget,
  matchOnlineTarget,
  powerIntent,
  crossPowerIntent,
  toolsFor,
  parseToolCall,
  describe,
  recordRejection,
  execute,
  listAudit,
};
