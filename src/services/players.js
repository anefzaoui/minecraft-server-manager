// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Player god-mode service: whitelist / ops / bans / kicks / teleports.
// Every action works both while the server is running (RCON — instant) and,
// where the file format allows, while it is stopped (direct JSON edits under
// the server's data dir, applied on next start).

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const { dataPath } = require('../storage/pathGuard');
const { recordEvent } = require('../events');
const { execCapture } = require('../docker/containers');
const mojangProfiles = require('./mojangProfiles');

// Only these fixed filenames are ever touched — no user input reaches a path.
const FILES = new Set(['usercache.json', 'whitelist.json', 'ops.json', 'banned-players.json', 'banned-ips.json']);

const NAME_RE = /^[A-Za-z0-9_]{1,16}$/;
const IP_RE = /^[0-9a-fA-F.:]{3,45}$/;
const DIMENSIONS = new Set(['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end']);

function assertName(name) {
  if (!NAME_RE.test(String(name)))
    throw httpError(400, 'Invalid player name (letters, digits and _ only, max 16 chars)');
  return String(name);
}

function assertIp(ip) {
  if (!IP_RE.test(String(ip))) throw httpError(400, 'Invalid IP address');
  return String(ip);
}

/** Reasons/messages travel through RCON — strip control chars so they can't smuggle commands. */
function cleanText(text, fallback) {
  const t = String(text || '')
    .replace(/[\r\n\x00-\x1f\x7f]/g, ' ')
    .trim();
  return t || fallback;
}

const DIMENSION_NAMES = {
  'minecraft:overworld': 'the Overworld',
  'minecraft:the_nether': 'the Nether',
  'minecraft:the_end': 'the End',
};
/** "minecraft:the_nether" -> "the Nether" (friendly label for messages). */
function prettyDimension(dim) {
  return (
    DIMENSION_NAMES[dim] ||
    String(dim || '')
      .split(':')
      .pop()
      .replace(/_/g, ' ') ||
    'this dimension'
  );
}

// ---------------------------------------------------------------------------
// JSON file helpers (atomic writes: tmp file + rename)

function readJson(serverId, file) {
  if (!FILES.has(file)) throw httpError(400, `Unsupported player file: ${file}`);
  try {
    const raw = fs.readFileSync(dataPath('servers', serverId, file), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw httpError(500, `Could not read ${file}: ${err.message}`);
  }
}

function writeJson(serverId, file, data) {
  if (!FILES.has(file)) throw httpError(400, `Unsupported player file: ${file}`);
  const target = dataPath('servers', serverId, file);
  const tmp = dataPath('servers', serverId, `${file}.tmp`);
  fs.mkdirSync(dataPath('servers', serverId), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, target);
}

// ---------------------------------------------------------------------------
// RCON

async function rcon(serverId, ...args) {
  // '--' terminates flag parsing: args like '-5' (coords) or names starting
  // with '-' would otherwise be eaten by rcon-cli as flags.
  const out = await execCapture(serverId, ['rcon-cli', '--', ...args.map(String)]);
  return String(out || '').trim();
}

// Same, but strip the ANSI/§ colour codes rcon-cli injects — REQUIRED before
// regex-parsing any rcon output (e.g. "\x1b[0m" otherwise becomes a stray "[0m").
async function rconClean(serverId, ...args) {
  return require('../utils/ansi').cleanText(await rcon(serverId, ...args));
}

// ANSI-clean rcon with an explicit timeout — /locate and spreadplayers can be slow
// on big modpacks; the default 15s would abandon them (and the user would retry,
// stacking searches that freeze the server). Give teleport commands more room.
async function rconT(serverId, timeoutMs, ...args) {
  const out = await execCapture(serverId, ['rcon-cli', '--', ...args.map(String)], { timeoutMs });
  return require('../utils/ansi').cleanText(String(out || '').trim());
}
const TP_TIMEOUT_MS = 45000;

function assertRunning(running, what) {
  if (!running) throw httpError(409, `Server must be running to ${what}`);
}

/**
 * Parse `rcon-cli list` → array of online names. Returns [] when nobody is online.
 * By default also returns [] on an RCON error; pass { throwOnError: true } when the
 * caller must distinguish "confirmed nobody online" from "couldn't ask" (e.g. before
 * an offline .dat edit, where guessing wrong risks corrupting a live player's save).
 */
async function listOnlineNames(serverId, { throwOnError = false } = {}) {
  try {
    // rcon-cli colorizes output — strip ANSI/§ codes before parsing, and only
    // accept strict Minecraft name shapes so escapes never become "players".
    const out = require('../utils/ansi').cleanText(await rcon(serverId, 'list'));
    const m = /There are \d+ of a max of \d+ players online:?\s*(.*)/i.exec(out);
    if (!m) return [];
    return m[1]
      ? m[1]
          .split(',')
          .map((n) => n.trim())
          .filter((n) => /^[A-Za-z0-9_]{2,16}$/.test(n))
      : [];
  } catch (err) {
    if (throwOnError) throw err;
    return [];
  }
}

// ---------------------------------------------------------------------------
// Identity resolution

/** 'yyyy-MM-dd HH:mm:ss +0000' — the vanilla ban-file timestamp format. */
function banTimestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())} ` +
    `${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())} +0000`
  );
}

/** Find {uuid, name} in the server's own files (usercache + role files). */
function localIdentity(serverId, name) {
  const lower = name.toLowerCase();
  for (const file of ['usercache.json', 'whitelist.json', 'ops.json', 'banned-players.json']) {
    const hit = readJson(serverId, file).find((e) => e.name && e.name.toLowerCase() === lower && e.uuid);
    if (hit) return { uuid: hit.uuid, name: hit.name };
  }
  return null;
}

/** Resolve a name to {uuid, name}: server files first, Mojang API second. */
async function resolveIdentity(serverId, name) {
  assertName(name);
  const local = localIdentity(serverId, name);
  if (local) return local;
  let profile = null;
  try {
    profile = await mojangProfiles.resolveProfile(name);
  } catch {
    throw httpError(
      502,
      `Could not resolve "${name}" — the player has never joined this server and the Mojang API is unreachable. Try again when online.`
    );
  }
  if (!profile || !profile.uuid) throw httpError(404, `No Minecraft account named "${name}" exists`);
  return profile;
}

// ---------------------------------------------------------------------------
// Read model

/**
 * Merge every player the server has ever seen into one list.
 * @param {string} serverId
 * @param {string[]} onlineNames  live names from `list` (caller-provided)
 */
function listPlayers(serverId, onlineNames = []) {
  const entries = [];
  const byUuid = new Map();
  const byName = new Map(); // lowercase name — dedupes uuid-less `list` names

  const upsert = (name, uuid, patch) => {
    if (!name && !uuid) return;
    let entry = (uuid && byUuid.get(uuid)) || (name && byName.get(name.toLowerCase())) || null;
    if (!entry) {
      entry = {
        name: name || '(unknown)',
        uuid: null,
        online: false,
        whitelisted: false,
        op: false,
        opLevel: null,
        bypassesPlayerLimit: false,
        banned: false,
        banReason: null,
        banDate: null,
        banSource: null,
        lastSeen: null,
      };
      entries.push(entry);
    }
    if (uuid && !entry.uuid) {
      entry.uuid = uuid;
      byUuid.set(uuid, entry);
    }
    if (name) {
      entry.name = name;
      byName.set(name.toLowerCase(), entry);
    } // canonical casing from files
    Object.assign(entry, patch);
  };

  for (const e of readJson(serverId, 'usercache.json')) {
    upsert(e.name, e.uuid, { lastSeen: e.expiresOn || null });
  }
  for (const e of readJson(serverId, 'whitelist.json')) {
    upsert(e.name, e.uuid, { whitelisted: true });
  }
  for (const e of readJson(serverId, 'ops.json')) {
    upsert(e.name, e.uuid, { op: true, opLevel: e.level ?? 4, bypassesPlayerLimit: Boolean(e.bypassesPlayerLimit) });
  }
  for (const e of readJson(serverId, 'banned-players.json')) {
    upsert(e.name, e.uuid, {
      banned: true,
      banReason: e.reason || null,
      banDate: e.created || null,
      banSource: e.source || null,
    });
  }
  for (const name of onlineNames) {
    upsert(name, null, { online: true });
  }

  return entries.sort(
    (a, b) => b.online - a.online || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );
}

function listBannedIps(serverId) {
  return readJson(serverId, 'banned-ips.json').map((e) => ({
    ip: e.ip,
    reason: e.reason || null,
    created: e.created || null,
    source: e.source || null,
    expires: e.expires || 'forever',
  }));
}

// ---------------------------------------------------------------------------
// Whitelist

async function setWhitelisted(serverId, name, on, { running = false, actor = 'system' } = {}) {
  const who = await resolveIdentity(serverId, name);
  if (running) {
    await rcon(serverId, 'whitelist', on ? 'add' : 'remove', who.name);
  } else {
    const list = readJson(serverId, 'whitelist.json').filter((e) => e.uuid !== who.uuid);
    if (on) list.push({ uuid: who.uuid, name: who.name });
    writeJson(serverId, 'whitelist.json', list);
  }
  recordEvent({
    serverId,
    actor,
    type: 'player-whitelist',
    summary: `${who.name} ${on ? 'added to' : 'removed from'} the whitelist${running ? '' : ' (file edit — applies on start)'}`,
    details: { name: who.name, uuid: who.uuid, on, via: running ? 'rcon' : 'file' },
  });
  return { name: who.name, uuid: who.uuid, whitelisted: Boolean(on) };
}

/** Toggle whitelist enforcement: RCON when running, server.properties otherwise. */
async function setWhitelistEnforced(serverId, on, { running = false, actor = 'system' } = {}) {
  if (running) {
    await rcon(serverId, 'whitelist', on ? 'on' : 'off');
  } else {
    const file = dataPath('servers', serverId, 'server.properties');
    let text = '';
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      /* fresh server — create the file */
    }
    if (/^white-list=/m.test(text)) {
      text = text.replace(/^white-list=.*$/m, `white-list=${on}`);
    } else {
      text += `${text && !text.endsWith('\n') ? '\n' : ''}white-list=${on}\n`;
    }
    const tmp = dataPath('servers', serverId, 'server.properties.tmp');
    fs.mkdirSync(dataPath('servers', serverId), { recursive: true });
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  }
  recordEvent({
    serverId,
    actor,
    type: 'player-whitelist-enforce',
    summary: `Whitelist enforcement turned ${on ? 'on' : 'off'}${running ? '' : ' (file edit — applies on start)'}`,
    details: { on, via: running ? 'rcon' : 'file' },
  });
  return { whitelistEnforced: Boolean(on) };
}

/** Parse server.properties for white-list= (defaults false when absent). */
function getWhitelistEnforced(serverId) {
  try {
    const text = fs.readFileSync(dataPath('servers', serverId, 'server.properties'), 'utf8');
    const m = /^white-list=(.*)$/m.exec(text);
    return m ? m[1].trim() === 'true' : false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Ops

async function setOp(serverId, name, on, level = 4, { running = false, actor = 'system' } = {}) {
  const who = await resolveIdentity(serverId, name);
  level = Math.min(4, Math.max(1, Number(level) || 4));
  let note = null;

  const patchOpsFile = () => {
    const list = readJson(serverId, 'ops.json').filter((e) => e.uuid !== who.uuid);
    if (on) list.push({ uuid: who.uuid, name: who.name, level, bypassesPlayerLimit: false });
    writeJson(serverId, 'ops.json', list);
  };

  if (running) {
    await rcon(serverId, on ? 'op' : 'deop', who.name);
    if (on && level !== 4) {
      // RCON `op` always grants level 4 — persist the requested level for next boot.
      patchOpsFile();
      note = `RCON op grants level 4 for this session; level ${level} is saved to ops.json and takes effect after a restart.`;
    }
  } else {
    patchOpsFile();
  }

  recordEvent({
    serverId,
    actor,
    type: on ? 'player-op' : 'player-deop',
    summary: on
      ? `${who.name} opped (level ${level})${running ? '' : ' (file edit — applies on start)'}`
      : `${who.name} de-opped${running ? '' : ' (file edit — applies on start)'}`,
    details: { name: who.name, uuid: who.uuid, on, level: on ? level : null, via: running ? 'rcon' : 'file' },
  });
  return { name: who.name, uuid: who.uuid, op: Boolean(on), opLevel: on ? level : null, note };
}

// ---------------------------------------------------------------------------
// Bans

async function banPlayer(serverId, name, reason, { running = false, actor = 'system' } = {}) {
  const who = await resolveIdentity(serverId, name);
  reason = cleanText(reason, 'Banned by an operator.');
  if (running) {
    await rcon(serverId, 'ban', who.name, reason);
  } else {
    const list = readJson(serverId, 'banned-players.json').filter((e) => e.uuid !== who.uuid);
    list.push({
      uuid: who.uuid,
      name: who.name,
      created: banTimestamp(),
      source: 'Minecraft Server Manager',
      expires: 'forever',
      reason,
    });
    writeJson(serverId, 'banned-players.json', list);
  }
  recordEvent({
    serverId,
    actor,
    type: 'player-ban',
    summary: `${who.name} banned: ${reason}${running ? '' : ' (file edit — applies on start)'}`,
    details: { name: who.name, uuid: who.uuid, reason, via: running ? 'rcon' : 'file' },
  });
  return { name: who.name, uuid: who.uuid, banned: true, banReason: reason };
}

async function pardonPlayer(serverId, name, { running = false, actor = 'system' } = {}) {
  const who = await resolveIdentity(serverId, name);
  if (running) {
    await rcon(serverId, 'pardon', who.name);
  } else {
    const list = readJson(serverId, 'banned-players.json').filter(
      (e) => e.uuid !== who.uuid && (e.name || '').toLowerCase() !== who.name.toLowerCase()
    );
    writeJson(serverId, 'banned-players.json', list);
  }
  recordEvent({
    serverId,
    actor,
    type: 'player-pardon',
    summary: `${who.name} pardoned${running ? '' : ' (file edit — applies on start)'}`,
    details: { name: who.name, uuid: who.uuid, via: running ? 'rcon' : 'file' },
  });
  return { name: who.name, uuid: who.uuid, banned: false };
}

async function banIp(serverId, ip, reason, { running = false, actor = 'system' } = {}) {
  assertIp(ip);
  reason = cleanText(reason, 'Banned by an operator.');
  if (running) {
    await rcon(serverId, 'ban-ip', ip, reason);
  } else {
    const list = readJson(serverId, 'banned-ips.json').filter((e) => e.ip !== ip);
    list.push({ ip, created: banTimestamp(), source: 'Minecraft Server Manager', expires: 'forever', reason });
    writeJson(serverId, 'banned-ips.json', list);
  }
  recordEvent({
    serverId,
    actor,
    type: 'player-ban-ip',
    summary: `IP ${ip} banned: ${reason}${running ? '' : ' (file edit — applies on start)'}`,
    details: { ip, reason, via: running ? 'rcon' : 'file' },
  });
  return { ip, banned: true };
}

async function pardonIp(serverId, ip, { running = false, actor = 'system' } = {}) {
  assertIp(ip);
  if (running) {
    await rcon(serverId, 'pardon-ip', ip);
  } else {
    writeJson(
      serverId,
      'banned-ips.json',
      readJson(serverId, 'banned-ips.json').filter((e) => e.ip !== ip)
    );
  }
  recordEvent({
    serverId,
    actor,
    type: 'player-pardon-ip',
    summary: `IP ${ip} pardoned${running ? '' : ' (file edit — applies on start)'}`,
    details: { ip, via: running ? 'rcon' : 'file' },
  });
  return { ip, banned: false };
}

// ---------------------------------------------------------------------------
// Kick (online-only by nature)

async function kickPlayer(serverId, name, message, { running = false, actor = 'system' } = {}) {
  assertName(name);
  assertRunning(running, 'kick a player');
  message = cleanText(message, 'Kicked by an operator.');
  const out = await rcon(serverId, 'kick', name, message);
  if (/No player was found/i.test(out)) throw httpError(404, `${name} is not online`);
  recordEvent({
    serverId,
    actor,
    type: 'player-kick',
    summary: `${name} kicked: ${message}`,
    details: { name, message },
  });
  return { name, kicked: true };
}

// ---------------------------------------------------------------------------
// Teleports (RCON only — there is no safe offline equivalent)

// /locate runs on the server's main thread and can stall it for seconds —
// firing several concurrently freezes the tick loop long enough to TIME OUT
// every online player. One teleport at a time per server; extras get a 429.
const teleportBusy = new Set();
async function withTeleportSlot(serverId, fn) {
  if (teleportBusy.has(serverId)) {
    throw httpError(429, 'A teleport is already searching on this server — give it a second and try again.');
  }
  teleportBusy.add(serverId);
  try {
    return await fn();
  } finally {
    teleportBusy.delete(serverId);
  }
}

function assertTpOutput(out, player) {
  if (/No entity was found|No player was found/i.test(out)) {
    throw httpError(404, `${player} is not online — teleport needs a live player`);
  }
  if (/Unknown or incomplete command|Incorrect argument/i.test(out)) {
    throw httpError(400, `Teleport command rejected by the server: ${out}`);
  }
}

/**
 * Land a player safely on the SURFACE at x/z: spreadplayers places its target
 * on the highest solid block, so nobody materializes mid-air. Optionally run
 * inside another dimension.
 */
const POS_RE = /\[\s*(-?\d+(?:\.\d+)?)[dfb]?\s*,\s*(-?\d+(?:\.\d+)?)[dfb]?\s*,\s*(-?\d+(?:\.\d+)?)[dfb]?\s*\]/;
const ALL_DIMENSIONS = ['minecraft:overworld', 'minecraft:the_nether', 'minecraft:the_end'];

/**
 * Player's live position + dimension. Can't use `data get entity <player>` — on
 * modded servers a broken player-NBT writer makes it throw ("An unexpected error
 * occurred") for every player. Instead we summon an invisible marker AT the player
 * (a marker's NBT always serializes), read the marker's Pos, and detect the
 * dimension via the dimension-scoped `kill` (which also cleans the marker up).
 */
async function getPlayerPosition(serverId, player) {
  assertName(player);
  const tag = `cd_pos_${Math.random().toString(36).slice(2, 10)}`;
  try {
    const summon = await rconClean(
      serverId,
      'execute',
      'at',
      player,
      'run',
      'summon',
      'minecraft:marker',
      '~',
      '~',
      '~',
      `{Tags:["${tag}"]}`
    );
    // No "Summoned …" line means `execute at <player>` matched nothing → offline
    // (an offline player also produces empty output, so check positively).
    if (!/Summoned/i.test(summon)) {
      throw httpError(404, 'That player is not online right now.');
    }
    const posOut = await rconClean(
      serverId,
      'data',
      'get',
      'entity',
      `@e[type=minecraft:marker,tag=${tag},limit=1]`,
      'Pos'
    );
    const pm = POS_RE.exec(posOut);
    if (!pm) {
      console.warn(`[players] couldn't read position for ${player} on ${serverId}: ${posOut.slice(0, 160)}`);
      throw httpError(502, "Couldn't read the player's position from the server.");
    }
    // Whichever dimension reports "Killed" is where the player is — and this
    // removes the marker at the same time. Run all three so nothing is left behind.
    let dimension = null;
    for (const dim of ALL_DIMENSIONS) {
      const k = await rconClean(
        serverId,
        'execute',
        'in',
        dim,
        'run',
        'kill',
        `@e[type=minecraft:marker,tag=${tag}]`
      ).catch(() => '');
      if (!dimension && /Killed/i.test(k)) dimension = dim;
    }
    return {
      x: Math.round(Number(pm[1])),
      y: Math.round(Number(pm[2])),
      z: Math.round(Number(pm[3])),
      dimension: dimension || 'minecraft:overworld',
    };
  } catch (err) {
    // Best-effort cleanup if we bailed before the kill loop.
    for (const dim of ALL_DIMENSIONS) {
      rcon(serverId, 'execute', 'in', dim, 'run', 'kill', `@e[type=minecraft:marker,tag=${tag}]`).catch(() => {});
    }
    throw err;
  }
}

/**
 * Player's last-SAVED position + dimension, read straight from their .dat on disk.
 * A filesystem read — ZERO load on the Minecraft server thread — so it's the safe
 * way to seed a teleport search. (A marker / `data get` round-trip freezes heavy
 * modded servers and times players out.) Slightly stale (last autosave), which is
 * fine for a search centre. Returns null when there's no saved data.
 */
async function getPlayerSavedPos(serverId, player) {
  const id = localIdentity(serverId, player);
  if (!id || !id.uuid) return null;
  try {
    const data = await require('./inventory').readPlayerData(serverId, id.uuid);
    if (!data.pos) return null;
    return {
      x: Math.round(data.pos.x),
      z: Math.round(data.pos.z),
      dimension: data.pos.dimension || 'minecraft:overworld',
    };
  } catch {
    return null;
  }
}

/** Run a /locate (with a generous timeout) and 404 cleanly if the id isn't registered here. */
async function runLocate(serverId, prefix, type, id) {
  const located = await rconT(serverId, TP_TIMEOUT_MS, ...prefix, 'run', 'locate', type, id);
  if (/there is no \w+ with type|isn'?t a valid|unknown \w+ type/i.test(located)) {
    throw httpError(
      404,
      `"${String(id).replace(/^#/, '')}" isn't available on this server — a mod may have renamed or removed it.`
    );
  }
  return located;
}

async function surfaceTeleport(serverId, player, x, z, dimension) {
  // An explicit dimension runs the landing THERE (cross-dimension teleports carry
  // the player across); null runs it AT the player, i.e. their current dimension —
  // no position/dimension read needed (a `data get`/marker round-trip freezes heavy
  // modded servers). spreadplayers lands on the highest solid block; widen the
  // search square 1 → 96 → 512 to skip water/void columns.
  const prefix = dimension ? ['execute', 'in', dimension, 'run'] : ['execute', 'at', player, 'run'];
  let out = '';
  for (const range of [1, 96, 512]) {
    // In the Nether, cap the landing height below the bedrock roof.
    const cap = dimension === 'minecraft:the_nether' ? ['under', '120'] : [];
    out = await rconT(
      serverId,
      TP_TIMEOUT_MS,
      ...prefix,
      'spreadplayers',
      String(x),
      String(z),
      '0',
      String(range),
      ...cap,
      'false',
      player
    );
    if (/No entity was found|No player was found/i.test(out)) {
      throw httpError(404, 'That player is not online right now.');
    }
    if (!/Could not spread|error/i.test(out)) return out;
  }
  const err = httpError(
    409,
    `No safe ground within 512 blocks of ${x}, ${z}${dimension ? ` in ${prettyDimension(dimension)}` : ''} (open water or void) — try different coordinates or give an explicit Y.`
  );
  err.output = out;
  throw err;
}

// Bundled vanilla structures + wildcard tags (usable as #tag in /locate).
const VANILLA_STRUCTURES = [
  '#minecraft:village',
  'minecraft:village_plains',
  'minecraft:village_desert',
  'minecraft:village_savanna',
  'minecraft:village_snowy',
  'minecraft:village_taiga',
  'minecraft:ancient_city',
  'minecraft:stronghold',
  'minecraft:mineshaft',
  'minecraft:trial_chambers',
  'minecraft:trail_ruins',
  'minecraft:pillager_outpost',
  'minecraft:woodland_mansion',
  'minecraft:jungle_pyramid',
  'minecraft:desert_pyramid',
  'minecraft:igloo',
  'minecraft:swamp_hut',
  'minecraft:shipwreck',
  'minecraft:ocean_monument',
  'minecraft:buried_treasure',
  '#minecraft:ruined_portal',
  'minecraft:fortress',
  'minecraft:bastion_remnant',
  'minecraft:end_city',
];

// Home dimension per structure — `locate` must run IN it and the teleport
// carries the player across (a Village is Overworld even if you ask from the End).
const STRUCTURE_DIMENSION = new Map([
  ['minecraft:fortress', 'minecraft:the_nether'],
  ['minecraft:nether_fortress', 'minecraft:the_nether'],
  ['minecraft:bastion_remnant', 'minecraft:the_nether'],
  ['minecraft:nether_fossil', 'minecraft:the_nether'],
  ['minecraft:end_city', 'minecraft:the_end'],
]);
/** Best-effort home dimension for a structure id/#tag (defaults to Overworld). */
function structureDim(ref) {
  const id = String(ref || '').replace(/^#/, '');
  if (STRUCTURE_DIMENSION.has(id)) return STRUCTURE_DIMENSION.get(id);
  const short = id.split(':').pop() || '';
  if (/(^|_)(nether|bastion|fortress|fossil)($|_)/.test(short)) return 'minecraft:the_nether';
  if (/(^|_)end($|_)|end_city/.test(short)) return 'minecraft:the_end';
  return 'minecraft:overworld';
}

const structureCache = new Map(); // serverId -> {at, structures: [{id, dimension}]}
const registryInflight = new Map(); // "biomes:<id>" / "structures:<id>" -> Promise

/** Structure options: server registry tags (usable as #tag) + bundled vanilla list. */
async function getServerStructures(serverId, { running = false } = {}) {
  const cached = structureCache.get(serverId);
  if (cached && Date.now() - cached.at < BIOME_CACHE_MS) return cached.structures;
  // Single-flight: the tag scan is dozens of RCON round-trips — concurrent
  // callers (rapid modal opens) share one scan instead of stacking storms.
  const key = `structures:${serverId}`;
  if (registryInflight.has(key)) return registryInflight.get(key);
  const promise = scanServerStructures(serverId, running).finally(() => registryInflight.delete(key));
  registryInflight.set(key, promise);
  return promise;
}

async function scanServerStructures(serverId, running) {
  let structures = [...VANILLA_STRUCTURES];
  if (running) {
    for (const prefix of ['neoforge', 'forge']) {
      try {
        const tags = [];
        let page = 1;
        let totalPages = 1;
        do {
          const out = require('../utils/ansi').cleanText(
            await execCapture(serverId, ['rcon-cli', prefix, 'tags', 'worldgen/structure', 'list', String(page)])
          );
          const pm = /<page (\d+) \/ (\d+)>/.exec(out);
          totalPages = pm ? Number(pm[2]) : 1;
          for (const m of out.matchAll(/^\s*-\s*([a-z0-9_.-]+:[a-z0-9_/.-]+)\s*$/gim)) tags.push(`#${m[1]}`);
          page += 1;
        } while (page <= totalPages && page <= 20);
        if (tags.length) {
          // Registries are full of internal plumbing tags (blacklists,
          // placement filters…) that aren't destinations — drop them, and
          // list the familiar vanilla names before the modded tags.
          const useful = tags.filter(
            (t) => !/(blacklist|whitelist|filter|avoid|exclusion|cannot|_on_|has_structure)/.test(t)
          );
          structures = [...new Set([...VANILLA_STRUCTURES, ...useful.sort()])];
          break;
        }
      } catch {
        /* command unavailable */
      }
    }
  }
  const annotated = structures.map((id) => ({ id, dimension: structureDim(id) }));
  structureCache.set(serverId, { at: Date.now(), structures: annotated });
  return annotated;
}

/**
 * Structure teleport: locate the nearest <structure> — from the player, or
 * from a RANDOM ring point for "surprise me" exploration — then land on the
 * surface beside it.
 */
async function tpToStructure(
  serverId,
  player,
  structureRef,
  { random = false, maxDistance = 5000 } = {},
  { running = false, actor = 'system' } = {}
) {
  assertName(player);
  assertRunning(running, 'teleport a player');
  if (!/^#?[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(String(structureRef))) throw httpError(400, 'Invalid structure id');

  // Search in the structure's HOME dimension — a Village is Overworld even if you
  // ask from the End. Search near the player when they're already there, else from
  // that dimension's origin; the teleport then carries them across.
  const searchDim = structureDim(structureRef);
  // Seed the search from the player's last-saved spot when they're in the home
  // dimension (disk read — no server load), else that dimension's origin.
  const saved = await getPlayerSavedPos(serverId, player);
  const sameDim = saved && saved.dimension === searchDim;
  let fromX = sameDim ? saved.x : 0;
  let fromZ = sameDim ? saved.z : 0;
  if (random) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 500 + Math.random() * Math.max(16, maxDistance - 500);
    fromX = Math.round(fromX + Math.cos(angle) * dist);
    fromZ = Math.round(fromZ + Math.sin(angle) * dist);
  }

  const located = await runLocate(
    serverId,
    ['execute', 'in', searchDim, 'positioned', String(fromX), '80', String(fromZ)],
    'structure',
    structureRef
  );
  if (/Could not find/i.test(located) || !located.trim()) {
    throw httpError(
      404,
      `No ${structureRef.replace(/^#/, '')} found in ${prettyDimension(searchDim)}${random ? ' — try again (each try searches a new random point)' : ''}.`
    );
  }
  const m = /is at \[(-?\d+),\s*(~|-?\d+),\s*(-?\d+)\]/.exec(located);
  if (!m) throw httpError(502, `Could not parse the locate result: ${located}`);
  const x = Number(m[1]);
  const z = Number(m[3]);

  const out = await surfaceTeleport(serverId, player, x, z, searchDim);
  recordEvent({
    serverId,
    actor,
    type: 'player-teleport',
    summary: `${player} sent to ${random ? 'a random' : 'the nearest'} ${structureRef.replace(/^#/, '')} in ${prettyDimension(searchDim)} at ${x}, ${z} (surface)`,
    details: { player, mode: 'structure', structure: structureRef, x, z, random, dimension: searchDim },
  });
  return { player, structure: structureRef, x, z, dimension: searchDim, output: out };
}

/**
 * Custom RTP — no mod dependency: pick a random point in the ring
 * [minDistance, maxDistance] around the player (or world origin) and land on
 * the surface via spreadplayers; ocean/void picks retry with a fresh point.
 */
async function rtpPlayer(
  serverId,
  player,
  { minDistance = 500, maxDistance = 5000, center = 'player' } = {},
  { running = false, actor = 'system' } = {}
) {
  assertName(player);
  assertRunning(running, 'randomly teleport a player');
  minDistance = Math.max(0, Math.floor(minDistance));
  maxDistance = Math.max(minDistance + 16, Math.floor(maxDistance));

  // Centre on the player's last-saved spot (disk read — no server load) or origin.
  const saved = center === 'origin' ? null : await getPlayerSavedPos(serverId, player);
  const cx = saved ? saved.x : 0;
  const cz = saved ? saved.z : 0;
  const dim = saved ? saved.dimension : null; // explicit → nether-roof cap; null → at-player

  const ATTEMPTS = 6;
  let lastErr = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDistance + Math.random() * (maxDistance - minDistance);
    const x = Math.round(cx + Math.cos(angle) * dist);
    const z = Math.round(cz + Math.sin(angle) * dist);
    try {
      const out = await surfaceTeleport(serverId, player, x, z, dim);
      recordEvent({
        serverId,
        actor,
        type: 'player-teleport',
        summary: `${player} randomly teleported to ${x}, ${z} (surface, ${Math.round(dist)} blocks out, attempt ${attempt}/${ATTEMPTS})`,
        details: { player, mode: 'rtp', x, z, dimension: dim, distance: Math.round(dist), attempt },
      });
      return { player, x, z, dimension: dim, distance: Math.round(dist), attempts: attempt, output: out };
    } catch (err) {
      if (err.status === 404) throw err; // player left — stop immediately
      lastErr = err; // no safe ground here — roll a new point
    }
  }
  throw httpError(
    409,
    `Couldn't find safe ground in ${ATTEMPTS} tries (lots of ocean around?) — try a bigger max distance. ${lastErr ? '' : ''}`.trim()
  );
}

// Server-derived biome registry (mods add biomes the bundled list can't know).
// NeoForge/Forge expose the registry via `/neoforge tags worldgen/biome get
// <dim tag>` — extracted per dimension and cached; falls back to the bundled
// vanilla list on servers without that command.
const biomeCache = new Map(); // serverId -> {at, biomes: [{id, dimension}], byId: Map}
const BIOME_CACHE_MS = 60 * 60 * 1000;
const DIM_TAGS = [
  ['minecraft:is_overworld', 'minecraft:overworld'],
  ['minecraft:is_nether', 'minecraft:the_nether'],
  ['minecraft:is_end', 'minecraft:the_end'],
];

async function fetchTagElements(serverId, prefix, tag) {
  const ids = [];
  let page = 1;
  let totalPages = 1;
  do {
    const out = require('../utils/ansi').cleanText(
      await execCapture(serverId, ['rcon-cli', prefix, 'tags', 'worldgen/biome', 'get', tag, String(page)])
    );
    const pm = /<page (\d+) \/ (\d+)>/.exec(out);
    totalPages = pm ? Number(pm[2]) : 1;
    for (const m of out.matchAll(/^\s*-\s*([a-z0-9_.-]+:[a-z0-9_/.-]+)\s*$/gim)) ids.push(m[1]);
    page += 1;
  } while (page <= totalPages && page <= 40);
  return ids;
}

async function getServerBiomes(serverId, { running = false } = {}) {
  const cached = biomeCache.get(serverId);
  if (cached && Date.now() - cached.at < BIOME_CACHE_MS) return cached;
  const key = `biomes:${serverId}`;
  if (registryInflight.has(key)) return registryInflight.get(key);
  const promise = scanServerBiomes(serverId, running).finally(() => registryInflight.delete(key));
  registryInflight.set(key, promise);
  return promise;
}

async function scanServerBiomes(serverId, running) {
  let biomes = null;
  if (running) {
    for (const prefix of ['neoforge', 'forge']) {
      try {
        const collected = [];
        for (const [tag, dimension] of DIM_TAGS) {
          const ids = await fetchTagElements(serverId, prefix, tag);
          for (const id of ids) collected.push({ id, dimension });
        }
        if (collected.length > 10) {
          biomes = collected;
          break;
        }
      } catch {
        /* command unavailable on this loader */
      }
    }
  }
  if (!biomes) {
    // Fallback: bundled vanilla registry.
    biomes = require('../config/biomes').map((id) => ({
      id,
      dimension: BIOME_DIMENSION.get(id) || 'minecraft:overworld',
    }));
  }
  // A biome can belong to several dimension tags — keep them all so the
  // teleport can prefer the dimension the player is already standing in.
  const byId = new Map();
  for (const b of biomes) {
    const dims = byId.get(b.id) || [];
    if (b.dimension && !dims.includes(b.dimension)) dims.push(b.dimension);
    byId.set(b.id, dims);
  }
  const entry = { at: Date.now(), biomes, byId };
  biomeCache.set(serverId, entry);
  return entry;
}

/** Dimensions a biome generates in: server registry first, static vanilla fallback. */
function biomeDims(serverId, biomeId) {
  const cached = biomeCache.get(serverId);
  const dims = cached && cached.byId.get(biomeId);
  if (dims && dims.length) return dims;
  const single = BIOME_DIMENSION.get(biomeId);
  return single ? [single] : [];
}

// Biomes that only exist outside the Overworld — locate must run IN their
// home dimension, and the teleport carries the player across.
const BIOME_DIMENSION = new Map([
  ['minecraft:the_end', 'minecraft:the_end'],
  ['minecraft:end_highlands', 'minecraft:the_end'],
  ['minecraft:end_midlands', 'minecraft:the_end'],
  ['minecraft:end_barrens', 'minecraft:the_end'],
  ['minecraft:small_end_islands', 'minecraft:the_end'],
  ['minecraft:nether_wastes', 'minecraft:the_nether'],
  ['minecraft:crimson_forest', 'minecraft:the_nether'],
  ['minecraft:warped_forest', 'minecraft:the_nether'],
  ['minecraft:soul_sand_valley', 'minecraft:the_nether'],
  ['minecraft:basalt_deltas', 'minecraft:the_nether'],
]);

async function tpToCoords(
  serverId,
  player,
  { x, y, z, dimension, safe = true },
  { running = false, actor = 'system' } = {}
) {
  assertName(player);
  assertRunning(running, 'teleport a player');
  const hasY = y !== undefined && y !== null && String(y).trim() !== '';
  for (const v of hasY ? [x, y, z] : [x, z]) {
    if (!Number.isFinite(Number(v))) throw httpError(400, 'Coordinates must be numbers');
  }
  if (dimension && !DIMENSIONS.has(dimension)) throw httpError(400, 'Unknown dimension');

  let out;
  let landedY = hasY ? Number(y) : 'surface';
  if (!hasY) {
    // No Y given → snap to the surface instead of guessing an altitude.
    out = await surfaceTeleport(serverId, player, x, z, dimension);
  } else {
    if (safe) {
      // Fatal-fall insurance for explicit altitudes: 15s of slow falling.
      await rcon(serverId, 'effect', 'give', player, 'minecraft:slow_falling', '15', '0', 'true').catch(() => {});
    }
    const args = dimension ? ['execute', 'in', dimension, 'run', 'tp', player, x, y, z] : ['tp', player, x, y, z];
    out = await rcon(serverId, ...args);
    assertTpOutput(out, player);
  }

  const where = `${x} ${landedY} ${z}${dimension ? ` in ${dimension}` : ''}`;
  recordEvent({
    serverId,
    actor,
    type: 'player-teleport',
    summary: `${player} teleported to ${where}${!hasY ? ' (surface)' : safe ? ' (soft landing)' : ''}`,
    details: {
      player,
      mode: 'coords',
      x: Number(x),
      y: hasY ? Number(y) : null,
      z: Number(z),
      dimension: dimension || null,
      surface: !hasY,
      safe,
    },
  });
  return { player, x: Number(x), y: landedY, z: Number(z), dimension: dimension || null, output: out };
}

async function tpToPlayer(serverId, player, target, { running = false, actor = 'system' } = {}) {
  assertName(player);
  assertName(target);
  assertRunning(running, 'teleport a player');
  const out = await rcon(serverId, 'tp', player, target);
  assertTpOutput(out, player);
  recordEvent({
    serverId,
    actor,
    type: 'player-teleport',
    summary: `${player} teleported to ${target}`,
    details: { player, mode: 'player', target },
  });
  return { player, target, output: out };
}

async function tpToBiome(serverId, player, biomeId, { running = false, actor = 'system' } = {}) {
  assertName(player);
  assertRunning(running, 'teleport a player');
  if (!/^[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(String(biomeId))) throw httpError(400, 'Invalid biome id');

  // Cross-dimension biomes must be located IN their home dimension — running
  // `locate biome minecraft:the_end` from the Overworld fails (sometimes with
  // completely empty output on modded servers). Warm the server registry
  // first: biomeDimension only READS the cache, and after a panel restart it
  // would otherwise fall back to a tiny static list and lose most home dims.
  await getServerBiomes(serverId, { running: true }).catch(() => {});
  const dims = biomeDims(serverId, String(biomeId));
  // Player's last-saved spot (disk read — no server load, no player time-out).
  const saved = await getPlayerSavedPos(serverId, player);
  const playerDim = saved ? saved.dimension : null;
  // Search in a dimension the biome generates in — preferring the one the player
  // is in. "Nearest" is seeded from the player's saved spot in the same dimension,
  // otherwise from the target dimension's origin.
  const searchDim = playerDim && dims.includes(playerDim) ? playerDim : dims[0] || playerDim || 'minecraft:overworld';
  const sameDim = saved && searchDim === playerDim;
  const fromX = sameDim ? String(saved.x) : '0';
  const fromZ = sameDim ? String(saved.z) : '0';
  // CRITICAL: never `execute as <player>` — it makes the player the command
  // sender, so the locate result goes to their chat and RCON receives NOTHING.
  const located = await runLocate(
    serverId,
    ['execute', 'in', searchDim, 'positioned', fromX, '80', fromZ],
    'biome',
    biomeId
  );
  if (/Could not find/i.test(located)) {
    throw httpError(
      404,
      `No ${biomeId} was found in ${prettyDimension(searchDim)}${sameDim ? ` near ${player}` : ''} — try from a different spot`
    );
  }
  // "The nearest minecraft:desert is at [123, ~, -456] (789 blocks away)"
  const m = /is at \[(-?\d+),\s*(~|-?\d+),\s*(-?\d+)\]/.exec(located);
  if (!m) {
    throw httpError(
      502,
      located
        ? `Could not parse the locate result: ${located}`
        : `The server returned nothing for ${biomeId} in ${searchDim} — it may not generate in this world (modded packs sometimes replace vanilla biomes).`
    );
  }
  const x = Number(m[1]);
  const z = Number(m[3]);

  // locate reports "~" for Y — never guess an altitude (a blind y=100 drop is
  // frequently a fatal fall). spreadplayers lands on the highest solid block,
  // in the dimension the biome was found in.
  const out = await surfaceTeleport(serverId, player, x, z, searchDim);
  recordEvent({
    serverId,
    actor,
    type: 'player-teleport',
    summary: `${player} teleported to nearest ${biomeId} (${x}, ${z}, surface${searchDim ? `, ${searchDim}` : ''})`,
    details: { player, mode: 'biome', biome: biomeId, x, z, surface: true, dimension: searchDim },
  });
  return { player, biome: biomeId, x, z, dimension: searchDim, output: out };
}

module.exports = {
  readJson,
  writeJson,
  listPlayers,
  listBannedIps,
  listOnlineNames,
  setWhitelisted,
  setWhitelistEnforced,
  getWhitelistEnforced,
  setOp,
  banPlayer,
  pardonPlayer,
  banIp,
  pardonIp,
  kickPlayer,
  tpToCoords,
  tpToPlayer,
  tpToBiome,
  rtpPlayer,
  tpToStructure,
  getPlayerPosition,
  withTeleportSlot,
  getServerBiomes,
  getServerStructures,
  resolveIdentity,
};
