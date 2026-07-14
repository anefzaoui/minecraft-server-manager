'use strict';

// World quick-controls (time/weather/gamerules/difficulty) — version-tolerant:
// MC 26.x renamed gamerules to snake_case (keep_inventory) and moved /time to
// timelines ("time query day"); ≤1.21 uses camelCase + "time query daytime".
// Every op tries the modern form first and falls back to legacy.

const { execCapture } = require('../docker/containers');
const { cleanText } = require('../utils/ansi');
const { recordEvent } = require('../events');

const GAMERULES = {
  keepInventory: 'keep_inventory',
  doDaylightCycle: 'do_daylight_cycle',
  doWeatherCycle: 'do_weather_cycle',
  mobGriefing: 'mob_griefing',
  doMobSpawning: 'do_mob_spawning',
  doFireTick: 'do_fire_tick',
  fallDamage: 'fall_damage',
  naturalRegeneration: 'natural_regeneration',
  doInsomnia: 'do_insomnia',
  doImmediateRespawn: 'do_immediate_respawn',
};

const QUICK_ACTIONS = {
  'time-day': { cmd: ['time', 'set', 'day'], label: 'Time set to day' },
  'time-noon': { cmd: ['time', 'set', 'noon'], label: 'Time set to noon' },
  'time-night': { cmd: ['time', 'set', 'night'], label: 'Time set to night' },
  'time-midnight': { cmd: ['time', 'set', 'midnight'], label: 'Time set to midnight' },
  'weather-clear': { cmd: ['weather', 'clear'], label: 'Weather cleared' },
  'weather-rain': { cmd: ['weather', 'rain'], label: 'Rain started' },
  'weather-thunder': { cmd: ['weather', 'thunder'], label: 'Thunderstorm started' },
  'keepinv-on': { rule: 'keepInventory', value: 'true', label: 'Keep inventory ON' },
  'keepinv-off': { rule: 'keepInventory', value: 'false', label: 'Keep inventory OFF' },
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
  'weathercycle-on': { rule: 'doWeatherCycle', value: 'true', label: 'Weather cycle ON' },
  'weathercycle-off': { rule: 'doWeatherCycle', value: 'false', label: 'Weather cycle FROZEN' },
  'mobgrief-on': { rule: 'mobGriefing', value: 'true', label: 'Mob griefing ON' },
  'mobgrief-off': { rule: 'mobGriefing', value: 'false', label: 'Mob griefing OFF (no creeper holes)' },
  'mobspawn-on': { rule: 'doMobSpawning', value: 'true', label: 'Mob spawning ON' },
  'mobspawn-off': { rule: 'doMobSpawning', value: 'false', label: 'Mob spawning OFF' },
  'firetick-on': { rule: 'doFireTick', value: 'true', label: 'Fire spread ON' },
  'firetick-off': { rule: 'doFireTick', value: 'false', label: 'Fire spread OFF' },
  'falldmg-on': { rule: 'fallDamage', value: 'true', label: 'Fall damage ON' },
  'falldmg-off': { rule: 'fallDamage', value: 'false', label: 'Fall damage OFF' },
  'naturalregen-on': { rule: 'naturalRegeneration', value: 'true', label: 'Natural regen ON' },
  'naturalregen-off': { rule: 'naturalRegeneration', value: 'false', label: 'Natural regen OFF' },
  'phantoms-on': { rule: 'doInsomnia', value: 'true', label: 'Phantoms ON' },
  'phantoms-off': { rule: 'doInsomnia', value: 'false', label: 'Phantoms OFF (no insomnia)' },
  'instantrespawn-on': { rule: 'doImmediateRespawn', value: 'true', label: 'Instant respawn ON' },
  'instantrespawn-off': { rule: 'doImmediateRespawn', value: 'false', label: 'Instant respawn OFF' },
  // PvP has no gamerule — toggled live via a friendly-fire-off team (see below).
  'pvp-on': { pvp: 'on', label: 'PvP enabled' },
  'pvp-off': { pvp: 'off', label: 'PvP disabled for players online now' },
  'difficulty-peaceful': { cmd: ['difficulty', 'peaceful'], label: 'Difficulty: Peaceful' },
  'difficulty-easy': { cmd: ['difficulty', 'easy'], label: 'Difficulty: Easy' },
  'difficulty-normal': { cmd: ['difficulty', 'normal'], label: 'Difficulty: Normal' },
  'difficulty-hard': { cmd: ['difficulty', 'hard'], label: 'Difficulty: Hard' },
  'save-all': { cmd: ['save-all', 'flush'], label: 'World saved' },
};

const looksLikeError = (out) => /Incorrect argument|Unknown command|Can't find element|Expected|<--\[HERE\]/i.test(out);

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

async function queryGamerule(serverId, rule) {
  const out = await tryVariants(serverId, [
    ['gamerule', GAMERULES[rule]], // 26.x snake_case
    ['gamerule', rule], // legacy camelCase
  ]);
  const m = /(?:is currently set to|is):?\s*(true|false)/i.exec(out) || /\b(true|false)\s*$/i.exec(out.trim());
  return m ? m[1].toLowerCase() === 'true' : null;
}

async function setGamerule(serverId, rule, value) {
  return tryVariants(serverId, [
    ['gamerule', GAMERULES[rule], value],
    ['gamerule', rule, value],
  ]);
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

// PvP has no vanilla gamerule. The live, restart-free way to disable it is a
// scoreboard team with friendlyFire off that every online player is joined to —
// teammates can't damage each other. Re-enabling simply disbands the team.
// Caveat: teams only cover players who were online when applied; re-toggle after
// new joins to include them.
const PVP_TEAM = 'msm_nopvp';

async function disablePvp(serverId) {
  await rcon(serverId, ['team', 'add', PVP_TEAM]); // benign "already exists" is just text, not thrown
  await tryVariants(serverId, [
    ['team', 'modify', PVP_TEAM, 'friendlyFire', 'false'],
    ['team', 'modify', PVP_TEAM, 'friendly_fire', 'false'], // option-casing guard for newer builds
  ]);
  return rcon(serverId, ['team', 'join', PVP_TEAM, '@a']);
}

async function enablePvp(serverId) {
  return rcon(serverId, ['team', 'remove', PVP_TEAM]); // benign "unknown team" is just text
}

/** True when our no-PvP team exists — i.e. the panel has PvP disabled right now. */
async function isPvpDisabled(serverId) {
  const out = await rcon(serverId, ['team', 'list', PVP_TEAM]);
  return /has\b.*member/i.test(out); // "has N member(s)" / "has no members" → team exists
}

async function getState(serverId) {
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
  for (const rule of Object.keys(GAMERULES)) {
    const value = await queryGamerule(serverId, rule);
    if (value !== null) state[rule] = value;
  }
  try {
    state.pvp = !(await isPvpDisabled(serverId));
  } catch {
    /* team list unavailable — leave pvp unknown */
  }
  return state;
}

async function runQuick(serverId, action, { actor = 'system' } = {}) {
  const quick = QUICK_ACTIONS[action];
  if (!quick) {
    const err = new Error(`Unknown quick action: ${action}`);
    err.status = 400;
    throw err;
  }
  let out;
  if (quick.pvp === 'off') out = await disablePvp(serverId);
  else if (quick.pvp === 'on') out = await enablePvp(serverId);
  else if (quick.variants) out = await tryVariants(serverId, quick.variants);
  else if (quick.rule) out = await setGamerule(serverId, quick.rule, quick.value);
  else out = await rcon(serverId, quick.cmd);
  // PvP runs a benign multi-command sequence (team add/join) whose intermediate
  // "already exists" text isn't a failure — skip the RCON error gate for it.
  if (!quick.pvp && looksLikeError(out)) {
    const err = new Error(`The server rejected the command: ${out.split('\n')[0]}`);
    err.status = 502;
    throw err;
  }
  recordEvent({
    serverId,
    actor,
    type: 'rcon',
    summary: `Quick action: ${quick.label}`,
    details: { action, output: out.slice(0, 300) },
  });
  return { label: quick.label, output: out.trim() };
}

module.exports = { getState, runQuick, QUICK_ACTIONS };
