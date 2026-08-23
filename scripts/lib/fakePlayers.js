'use strict';

// Shared fake-roster data/logic for scripts/seed-players.js. Split out so it
// doesn't bloat seed-fake-servers.js, which only ever creates server rows.

const crypto = require('node:crypto');
const players = require('../../src/services/players');
const playerNotes = require('../../src/services/playerNotes');

const PLAYER_NAMES = [
  'Steve_the_Bold',
  'AlexCraftsAlot',
  'DiamondMiner99',
  'EnderQueen',
  'RedstoneWizard',
  'CreeperHunter',
  'PixelPioneer',
  'BlockBuilder42',
  'NetherKnight',
  'SkyWanderer',
  'CraftMaster_',
  'OreSeeker',
  'VillageHero',
  'ShadowMob',
  'PickaxePete',
  'TorchBearer',
  'ObsidianOwl',
  'GriefStopper',
  'LapisLegend',
  'CobwebComber',
  'TNT_Timmy',
  'FarmerFiona',
  'ZombieZapper',
  'WitherWhisperer',
  'BeaconBuilder',
];

const BAN_REASONS = [
  'Griefing spawn build',
  'Duping items via chest exploit',
  'X-ray texture pack detected',
  'Repeated chat spam warnings ignored',
  'Team-killing on PvP night',
];

const NOTE_TEMPLATES = [
  'Reported for griefing 3x by other players - watch closely.',
  'Great builder, promoted to helper informally.',
  'Frequently AFK-farms near spawn; not against rules, just noting.',
  'Asked about a whitelist slot for a friend - pending decision.',
  'Resolved a dispute with another player over a claimed base.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

/**
 * Seed a fake roster onto a server: usercache identities first (so the later
 * whitelist/op/ban calls resolve LOCALLY instead of hitting the real Mojang
 * API for names that don't exist), then whitelist/op/ban/notes through the
 * same service functions the players UI calls - { running: false } so
 * everything takes the file-edit path instead of trying RCON against a
 * container that doesn't exist.
 */
async function seedPlayersForServer(serverId, count) {
  const names = pickSome(PLAYER_NAMES, Math.min(count, PLAYER_NAMES.length));
  const identities = names.map((name) => ({
    name,
    uuid: crypto.randomUUID(),
    expiresOn: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  }));
  players.writeJson(serverId, 'usercache.json', identities);

  const actor = 'seed-script';
  const opts = { running: false, actor };

  for (const name of pickSome(names, Math.ceil(names.length / 2))) {
    await players.setWhitelisted(serverId, name, true, opts);
  }

  const [opName, banName] = [...names].sort(() => Math.random() - 0.5);
  if (opName) await players.setOp(serverId, opName, true, pick([1, 2, 3, 4]), opts);
  if (banName) {
    // Mix permanent and temporary bans so both paths (and the auto-expiry
    // sweep) have something real to look at.
    const durationMs = Math.random() < 0.5 ? [3600000, 86400000, 604800000][Math.floor(Math.random() * 3)] : undefined;
    await players.banPlayer(serverId, banName, pick(BAN_REASONS), { ...opts, durationMs });
    await players.banIp(serverId, `203.0.113.${1 + Math.floor(Math.random() * 254)}`, 'Same IP as banned player', {
      ...opts,
      player: banName,
    });
  }

  for (const identity of pickSome(identities, Math.min(2, identities.length))) {
    await playerNotes.addNote(serverId, identity, pick(NOTE_TEMPLATES), { actor });
  }

  return { total: names.length, opped: opName || null, banned: banName || null };
}

module.exports = { seedPlayersForServer };
