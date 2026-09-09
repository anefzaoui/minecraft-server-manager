'use strict';

// World quick-controls (time/weather/gamerules/difficulty) - version-tolerant:
// MC 26.x renamed gamerules to snake_case (keep_inventory) and moved /time to
// timelines ("time query day"); ≤1.21 uses camelCase + "time query daytime".
// Every op tries the modern form first and falls back to legacy.

const fs = require('node:fs');
const nbt = require('prismarine-nbt');
const { execCapture } = require('../docker/containers');
const { cleanText } = require('../utils/ansi');
const { recordEvent } = require('../events');
const { dataPath } = require('../storage/pathGuard');

// camelCase (≤1.21) -> snake_case (26.x). Every op tries the snake_case form
// first and falls back to camelCase, so this map just needs both spellings.
// snake_case = the camelCase key with an underscore before each capital.
const GAMERULES = {
  // World rules
  keepInventory: 'keep_inventory',
  doDaylightCycle: 'do_daylight_cycle',
  doWeatherCycle: 'do_weather_cycle',
  doImmediateRespawn: 'do_immediate_respawn',
  doLimitedCrafting: 'do_limited_crafting',
  doTileDrops: 'do_tile_drops',
  doEntityDrops: 'do_entity_drops',
  doFireTick: 'do_fire_tick',
  allowFireTicksAwayFromPlayer: 'allow_fire_ticks_away_from_player',
  doVinesSpread: 'do_vines_spread',
  waterSourceConversion: 'water_source_conversion',
  lavaSourceConversion: 'lava_source_conversion',
  tntExplodes: 'tnt_explodes',
  projectilesCanBreakBlocks: 'projectiles_can_break_blocks',
  blockExplosionDropDecay: 'block_explosion_drop_decay',
  mobExplosionDropDecay: 'mob_explosion_drop_decay',
  tntExplosionDropDecay: 'tnt_explosion_drop_decay',
  enderPearlsVanishOnDeath: 'ender_pearls_vanish_on_death',
  globalSoundEvents: 'global_sound_events',
  spectatorsGenerateChunks: 'spectators_generate_chunks',
  reducedDebugInfo: 'reduced_debug_info',
  disableElytraMovementCheck: 'disable_elytra_movement_check',
  // Mobs & damage
  doMobSpawning: 'do_mob_spawning',
  mobGriefing: 'mob_griefing',
  doInsomnia: 'do_insomnia',
  doMobLoot: 'do_mob_loot',
  doPatrolSpawning: 'do_patrol_spawning',
  doTraderSpawning: 'do_trader_spawning',
  doWardenSpawning: 'do_warden_spawning',
  disableRaids: 'disable_raids',
  forgiveDeadPlayers: 'forgive_dead_players',
  universalAnger: 'universal_anger',
  naturalRegeneration: 'natural_regeneration',
  fallDamage: 'fall_damage',
  fireDamage: 'fire_damage',
  drowningDamage: 'drowning_damage',
  freezeDamage: 'freeze_damage',
  // Chat & messages
  showDeathMessages: 'show_death_messages',
  announceAdvancements: 'announce_advancements',
  sendCommandFeedback: 'send_command_feedback',
  commandBlockOutput: 'command_block_output',
  logAdminCommands: 'log_admin_commands',
};

// gamerule toggle -> { slug for the -on/-off QUICK_ACTIONS, on/off toast text }.
// The chip in world-controls.hbs carries data-wc-toggle="<slug>" data-rule="<key>".
const RULE_TOGGLES = {
  keepInventory: ['keepinv', 'Keep inventory'],
  doDaylightCycle: ['daycycle', 'Day/night cycle'], // also handled via /time resume|pause below
  doWeatherCycle: ['weathercycle', 'Weather cycle'],
  doImmediateRespawn: ['instantrespawn', 'Instant respawn'],
  doLimitedCrafting: ['limitedcraft', 'Limited crafting'],
  doTileDrops: ['tiledrops', 'Block drops'],
  doEntityDrops: ['entitydrops', 'Entity drops'],
  doFireTick: ['firetick', 'Fire spread'],
  allowFireTicksAwayFromPlayer: ['firetickaway', 'Fire ticks away from players'],
  doVinesSpread: ['vinesspread', 'Vines spread'],
  waterSourceConversion: ['waterconv', 'Water source conversion'],
  lavaSourceConversion: ['lavaconv', 'Lava source conversion'],
  tntExplodes: ['tntexplodes', 'TNT explosions'],
  projectilesCanBreakBlocks: ['projbreak', 'Projectiles break blocks'],
  blockExplosionDropDecay: ['blockdropdecay', 'Block-explosion drop decay'],
  mobExplosionDropDecay: ['mobdropdecay', 'Mob-explosion drop decay'],
  tntExplosionDropDecay: ['tntdropdecay', 'TNT-explosion drop decay'],
  enderPearlsVanishOnDeath: ['pearlvanish', 'Ender pearls vanish on death'],
  globalSoundEvents: ['globalsound', 'Global sound events'],
  spectatorsGenerateChunks: ['specchunks', 'Spectators generate chunks'],
  reducedDebugInfo: ['reduceddebug', 'Reduced debug info'],
  disableElytraMovementCheck: ['noelytracheck', 'Elytra movement check'],
  doMobSpawning: ['mobspawn', 'Mob spawning'],
  mobGriefing: ['mobgrief', 'Mob griefing'],
  doInsomnia: ['phantoms', 'Phantoms'],
  doMobLoot: ['mobloot', 'Mob loot'],
  doPatrolSpawning: ['patrols', 'Pillager patrols'],
  doTraderSpawning: ['traders', 'Wandering traders'],
  doWardenSpawning: ['wardens', 'Warden spawning'],
  disableRaids: ['noraids', 'Raids'],
  forgiveDeadPlayers: ['forgivedead', 'Forgive dead players'],
  universalAnger: ['universalanger', 'Universal anger'],
  naturalRegeneration: ['naturalregen', 'Natural regeneration'],
  fallDamage: ['falldmg', 'Fall damage'],
  fireDamage: ['firedmg', 'Fire damage'],
  drowningDamage: ['drowndmg', 'Drowning damage'],
  freezeDamage: ['freezedmg', 'Freeze damage'],
  showDeathMessages: ['deathmsg', 'Death messages'],
  announceAdvancements: ['advancements', 'Advancement announcements'],
  sendCommandFeedback: ['cmdfeedback', 'Command feedback'],
  commandBlockOutput: ['cmdblockout', 'Command block output'],
  logAdminCommands: ['logadmin', 'Admin command logging'],
};

// A few rules read as a negation ("disable…"): the chip is labelled by the
// negation (data-rule value maps straight through), so ON = rule true = the
// thing is off. Word the toast for the effect, not the flag.
const INVERTED_RULES = new Set(['disableRaids', 'disableElytraMovementCheck']);

/** Build the '<slug>-on' / '<slug>-off' gamerule entries for QUICK_ACTIONS. */
function ruleToggleActions() {
  const out = {};
  for (const [rule, [slug, name]] of Object.entries(RULE_TOGGLES)) {
    if (INVERTED_RULES.has(rule)) {
      out[`${slug}-on`] = { rule, value: 'true', label: `${name} disabled` };
      out[`${slug}-off`] = { rule, value: 'false', label: `${name} enabled` };
    } else {
      out[`${slug}-on`] = { rule, value: 'true', label: `${name} ON` };
      out[`${slug}-off`] = { rule, value: 'false', label: `${name} OFF` };
    }
  }
  return out;
}

const QUICK_ACTIONS = {
  'time-day': { cmd: ['time', 'set', 'day'], label: 'Time set to day' },
  'time-noon': { cmd: ['time', 'set', 'noon'], label: 'Time set to noon' },
  'time-night': { cmd: ['time', 'set', 'night'], label: 'Time set to night' },
  'time-midnight': { cmd: ['time', 'set', 'midnight'], label: 'Time set to midnight' },
  'weather-clear': { cmd: ['weather', 'clear'], label: 'Weather cleared' },
  'weather-rain': { cmd: ['weather', 'rain'], label: 'Rain started' },
  'weather-thunder': { cmd: ['weather', 'thunder'], label: 'Thunderstorm started' },
  // Every boolean gamerule from RULE_TOGGLES as a '<slug>-on' / '<slug>-off' pair.
  ...ruleToggleActions(),
  // Overrides for the toggles that need a friendlier or non-gamerule form. These
  // must come after the spread so they win.
  // 26.x moved the day/night cycle out of gamerules into /time resume|pause.
  'daycycle-on': {
    variants: [
      ['time', 'resume'],
      ['gamerule', 'doDaylightCycle', 'true'],
    ],
    label: 'Day/night cycle ON',
  },
  'daycycle-off': {
    variants: [
      ['time', 'pause'],
      ['gamerule', 'doDaylightCycle', 'false'],
    ],
    label: 'Day/night cycle FROZEN',
  },
  'weathercycle-off': { rule: 'doWeatherCycle', value: 'false', label: 'Weather cycle FROZEN' },
  'mobgrief-off': { rule: 'mobGriefing', value: 'false', label: 'Mob griefing OFF (no creeper holes)' },
  'phantoms-off': { rule: 'doInsomnia', value: 'false', label: 'Phantoms OFF (no insomnia)' },
  // PvP has no gamerule - it's the server.properties `pvp` value (see below).
  'pvp-on': { prop: 'pvp', value: true, label: 'PvP enabled. Applies on the next restart.' },
  'pvp-off': { prop: 'pvp', value: false, label: 'PvP disabled. Applies on the next restart.' },
  'difficulty-peaceful': { cmd: ['difficulty', 'peaceful'], label: 'Difficulty: Peaceful' },
  'difficulty-easy': { cmd: ['difficulty', 'easy'], label: 'Difficulty: Easy' },
  'difficulty-normal': { cmd: ['difficulty', 'normal'], label: 'Difficulty: Normal' },
  'difficulty-hard': { cmd: ['difficulty', 'hard'], label: 'Difficulty: Hard' },
  'save-all': { cmd: ['save-all', 'flush'], label: 'World saved' },
};

const looksLikeError = (out) =>
  /Incorrect argument|Unknown command|Can't find element|Expected|<--\[HERE\]|No game ?rule called|No such game ?rule/i.test(
    out
  );

async function rcon(serverId, args) {
  return cleanText(await execCapture(serverId, ['rcon-cli', ...args]));
}

/** Run modern args; fall back to legacy args when the syntax is rejected. */
async function tryVariants(serverId, variants) {
  let out = '';
  for (const args of variants) {
    out = await rcon(serverId, args);
    if (!looksLikeError(out)) return out;
  }
  return out;
}

function parseGameruleBool(out) {
  const m = /(?:is currently set to|is):?\s*(true|false)/i.exec(out) || /\b(true|false)\s*$/i.exec(out.trim());
  return m ? m[1].toLowerCase() === 'true' : null;
}

// spelling: 'snake' | 'camel' to force one form (getState, once it knows the
// server's era), or undefined to try snake_case then camelCase.
async function queryGamerule(serverId, rule, spelling) {
  const snake = ['gamerule', GAMERULES[rule]];
  const camel = ['gamerule', rule];
  if (spelling) return parseGameruleBool(await rcon(serverId, spelling === 'snake' ? snake : camel));
  return parseGameruleBool(await tryVariants(serverId, [snake, camel]));
}

/** Run fn over items at most `limit` at a time; resolves to the results array. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function setGamerule(serverId, rule, value) {
  return tryVariants(serverId, [
    ['gamerule', GAMERULES[rule], value],
    ['gamerule', rule, value],
  ]);
}

// Decide whether a gamerule write took, from the value read back afterwards
// (`readBack`), the value we intended (`want`), and the set command's own reply
// (`setOutput`). The read-back is authoritative and locale-independent - a
// gamerule value is never translated. null = couldn't read it back; accept only
// if the set itself didn't visibly error.
function resolveRuleWrite(readBack, want, setOutput) {
  if (readBack === want) return { ok: true };
  if (readBack === null) return { ok: !looksLikeError(setOutput || '') };
  return { ok: false };
}

/** 0–23999 daytime ticks → "1:04 PM" (0 ticks = 6:00 AM in Minecraft). */
function clockFromTicks(ticks) {
  const h24 = Math.floor(ticks / 1000 + 6) % 24;
  const minutes = Math.floor(((ticks % 1000) / 1000) * 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

async function queryTime(serverId) {
  const out = await tryVariants(serverId, [
    ['time', 'query', 'daytime'], // ≤1.21: "The time is N"
    ['time', 'query', 'day'], // 26.x: "Timeline minecraft:day is at N tick(s)"
  ]);
  const m = /The time is (\d+)/i.exec(out) || /is at (\d+) tick/i.exec(out);
  if (!m) return null;
  const ticks = Number(m[1]) % 24000;
  const label =
    ticks < 6000
      ? 'Morning'
      : ticks < 12000
        ? 'Afternoon'
        : ticks < 13800
          ? 'Sunset'
          : ticks < 22200
            ? 'Night'
            : 'Sunrise';
  return { ticks, label, clock: clockFromTicks(ticks) };
}

/** World day counter from total game time (works on ≤1.21 and 26.x). */
async function queryDay(serverId) {
  const out = await rcon(serverId, ['time', 'query', 'gametime']);
  // ≤1.21: "The time is N" · 26.x: "The game time is N tick(s)"
  const m = /(?:game time is|The time is)\s*(\d+)/i.exec(out) || /is at (\d+) tick/i.exec(out);
  return m ? Math.floor(Number(m[1]) / 24000) + 1 : null;
}

// PvP isn't a gamerule - it's the server.properties `pvp` value, applied at
// (re)start and then in force for everyone, including players who join later.
// We edit the file directly (like the whitelist toggle); the itzg image leaves a
// property alone when its matching env var isn't set, so the edit persists.
// Vanilla default is on (pvp=true). There is no vanilla live+permanent global
// switch - that needs a server mod/plugin (e.g. Essential) with engine access.
function readPvp(serverId) {
  try {
    const text = fs.readFileSync(dataPath('servers', serverId, 'server.properties'), 'utf8');
    const m = /^pvp=(.*)$/m.exec(text);
    return m ? m[1].trim() !== 'false' : true;
  } catch {
    return true; // fresh server - vanilla default
  }
}

function writePvp(serverId, on) {
  const file = dataPath('servers', serverId, 'server.properties');
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    /* fresh server - create the file */
  }
  if (/^pvp=.*$/m.test(text)) text = text.replace(/^pvp=.*$/m, `pvp=${on}`);
  else text += `${text && !text.endsWith('\n') ? '\n' : ''}pvp=${on}\n`;
  const tmp = dataPath('servers', serverId, 'server.properties.tmp');
  fs.mkdirSync(dataPath('servers', serverId), { recursive: true });
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// A running getState() is ~1 + N sequential `docker exec rcon-cli` round trips
// (N = number of gamerules asked for); opening "Show all world rules" makes that
// ~40. Several browser tabs, plus the immediate post-action refresh, would each
// pay that in full. Memoise the live read briefly so concurrent/rapid polls
// share one sweep. runQuick() busts the entry for its server so a toggle is
// never shown stale.
const STATE_TTL_MS = 8000;
const liveStateCache = new Map(); // serverId -> { at, key, state }

function cacheKey(rules) {
  return Array.isArray(rules) && rules.length ? [...rules].sort().join(',') : '*';
}

function invalidateState(serverId) {
  liveStateCache.delete(serverId);
}

// opts.rules: restrict the gamerule reads to this subset (the World Controls
// page only asks for the rules whose chips are on screen). Omit for the lot.
async function getState(serverId, opts = {}) {
  const key = cacheKey(opts.rules);
  const hit = liveStateCache.get(serverId);
  if (hit && hit.key === key && Date.now() - hit.at < STATE_TTL_MS) {
    return { ...hit.state };
  }
  const state = await readStateLive(serverId, opts);
  liveStateCache.set(serverId, { at: Date.now(), key, state: { ...state } });
  return state;
}

async function readStateLive(serverId, opts = {}) {
  const state = {};
  const time = await queryTime(serverId);
  if (time) {
    state.timeTicks = time.ticks;
    state.timeLabel = time.label;
    state.clock = time.clock;
    try {
      state.day = await queryDay(serverId);
    } catch {
      /* clock still works without a day count */
    }
  }
  // ~40 gamerules would be ~80 sequential RCON round trips per poll if every one
  // tried both spellings. Probe the first rule with both, learn the server's era,
  // then fan the rest out concurrently (small pool - don't flood the daemon).
  const wanted =
    Array.isArray(opts.rules) && opts.rules.length ? opts.rules.filter((r) => Object.hasOwn(GAMERULES, r)) : null;
  const rules = wanted && wanted.length ? wanted : Object.keys(GAMERULES);
  const first = rules[0];
  const firstSnake = await rcon(serverId, ['gamerule', GAMERULES[first]]);
  const spelling = looksLikeError(firstSnake) ? 'camel' : 'snake';
  const firstVal = spelling === 'snake' ? parseGameruleBool(firstSnake) : await queryGamerule(serverId, first, 'camel');
  if (firstVal !== null) state[first] = firstVal;
  const rest = rules.slice(1);
  const values = await mapLimit(rest, 6, (rule) => queryGamerule(serverId, rule, spelling));
  rest.forEach((rule, i) => {
    if (values[i] !== null) state[rule] = values[i];
  });
  state.pvp = readPvp(serverId); // from server.properties - the pending/effective value
  return state;
}

/** prismarine-nbt simplify() returns a Long as [high, low] (two int32) or a number. */
function longToNum(v) {
  if (v == null) return null;
  if (Array.isArray(v)) return (v[0] >>> 0) * 4294967296 + (v[1] >>> 0);
  return Number(v);
}

/** The `Data` compound of the active world's level.dat, or null. */
async function readActiveLevelData(serverId) {
  const server = require('./servers').getServer(serverId);
  if (!server) return null;
  const level = require('./worlds').activeLevelName(server);
  const file = dataPath('servers', serverId, level, 'level.dat');
  try {
    const { parsed } = await nbt.parse(await fs.promises.readFile(file));
    const s = nbt.simplify(parsed);
    return s.Data || s;
  } catch {
    return null; // no world generated yet, or unreadable
  }
}

// Pure: derive the getState() shape from a simplified level.dat `Data` compound.
// Kept separate from the file IO so it is unit-testable without a DB/data dir.
function offlineStateFromLevelData(data, opts = {}) {
  const state = { offline: true };
  if (!data || typeof data !== 'object') return state;

  const dayTime = longToNum(data.DayTime);
  if (Number.isFinite(dayTime)) {
    const ticks = ((dayTime % 24000) + 24000) % 24000;
    state.timeTicks = ticks;
    state.timeLabel =
      ticks < 6000
        ? 'Morning'
        : ticks < 12000
          ? 'Afternoon'
          : ticks < 13800
            ? 'Sunset'
            : ticks < 22200
              ? 'Night'
              : 'Sunrise';
    state.clock = clockFromTicks(ticks);
  }
  const gameTime = longToNum(data.Time);
  if (Number.isFinite(gameTime)) state.day = Math.floor(gameTime / 24000) + 1;

  // level.dat GameRules keys are camelCase on <=1.21 and snake_case on 26.x -
  // GAMERULES maps one to the other, so try both spellings per rule.
  const gr = data.GameRules || {};
  const asBool = (raw) => (raw === 'true' ? true : raw === 'false' ? false : null);
  const wanted =
    Array.isArray(opts.rules) && opts.rules.length
      ? opts.rules.filter((r) => Object.hasOwn(GAMERULES, r))
      : Object.keys(GAMERULES);
  for (const rule of wanted) {
    const v = asBool(gr[rule]) ?? asBool(gr[GAMERULES[rule]]);
    if (v !== null) state[rule] = v;
  }
  return state;
}

// Same shape as getState(), read from level.dat instead of RCON, for a stopped
// server. The clock is whatever was last saved; gamerule chips reflect the
// on-disk values. The World Controls rail stays a read-only display offline
// (the <fieldset> is disabled), so this never writes.
async function getStateOffline(serverId, opts = {}) {
  const data = await readActiveLevelData(serverId);
  return { ...offlineStateFromLevelData(data, opts), pvp: readPvp(serverId) };
}

async function runQuick(serverId, action, { actor = 'system' } = {}) {
  const quick = QUICK_ACTIONS[action];
  if (!quick) {
    const err = new Error(`Unknown quick action: ${action}`);
    err.status = 400;
    throw err;
  }

  const ok = (out) => {
    recordEvent({
      serverId,
      actor,
      type: 'rcon',
      summary: `Quick action: ${quick.label}`,
      details: { action, output: (out || '').slice(0, 300) },
    });
    invalidateState(serverId); // the next /world/state read must see this change
    return { label: quick.label, output: (out || '').trim() };
  };
  const fail = (detail) => {
    // Record the failure too - the History tab is where an operator looks, and
    // "check the logs" was never useful (the log viewer shows the game's own
    // output, not the panel's).
    recordEvent({
      serverId,
      actor,
      type: 'rcon',
      summary: `Quick action failed: ${quick.label}`,
      details: { action, reply: String(detail || '').slice(0, 300) },
    });
    // 4xx, not 5xx: the JSON error handler passes a sub-500 err.message straight
    // through to the browser, so the user sees this sentence instead of the
    // generic "unexpected server error - check the panel logs".
    const err = new Error(
      "Minecraft didn't accept that change. Your server's version may not have this option, or it may need a plugin."
    );
    err.status = 422;
    throw err;
  };

  // server.properties edit - not an RCON command, nothing to verify.
  if (quick.prop === 'pvp') {
    writePvp(serverId, quick.value);
    return ok('');
  }

  // Gamerule toggles (the bulk of the actions): don't trust the console reply.
  // rcon-cli exits 0 even when Minecraft rejects a command, and the human-
  // readable reply looksLikeError() inspects is translated on a non-English
  // server - so a successful set there was misread as a rejection, and a real
  // rejection there could slip through. Set it, then read it back: the value
  // the server reports is the ground truth, regardless of locale.
  if (quick.rule) {
    const out = await setGamerule(serverId, quick.rule, quick.value);
    const want = quick.value === 'true';
    const readBack = await queryGamerule(serverId, quick.rule);
    if (resolveRuleWrite(readBack, want, out).ok) return ok(out);
    return fail(readBack === null ? out.split('\n')[0] : `read back ${readBack}, expected ${want}`);
  }

  // Remaining actions (time / weather / difficulty / save / daycycle variants)
  // are vanilla commands present on every version; there is no single clean
  // read-back, so fall back to the reply heuristic.
  const out = quick.variants ? await tryVariants(serverId, quick.variants) : await rcon(serverId, quick.cmd);
  if (looksLikeError(out)) return fail(out.split('\n')[0]);
  return ok(out);
}

module.exports = {
  getState,
  getStateOffline,
  offlineStateFromLevelData,
  runQuick,
  resolveRuleWrite,
  invalidateState,
  QUICK_ACTIONS,
  looksLikeError,
};
