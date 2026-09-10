'use strict';

// A gamerule the server's Minecraft version does not have (tntExplodes before
// 1.21.5, allowFireTicksAwayFromPlayer before 1.21.2, ...) answers "No game rule
// called ..." to BOTH spellings. That is not a failed read: it must come back as
// `unsupported` so the rail hides the chip instead of warning forever.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate();
const db = require('../src/db');

const containers = require('../src/docker/containers');
const MISSING = new Set([
  'tntExplodes',
  'tnt_explodes',
  'allowFireTicksAwayFromPlayer',
  'allow_fire_ticks_away_from_player',
]);
let flaky = null; // rule name that answers garbage once
containers.execCapture = async (serverId, cmd) => {
  const [, sub, rule, value] = cmd; // ['rcon-cli', 'gamerule', <rule>, <value?>]
  if (sub === 'time') return 'The time is 6000';
  if (sub === 'difficulty') return 'The difficulty is Easy';
  if (sub !== 'gamerule') return '';
  if (MISSING.has(rule)) return `Unknown or incomplete command, see below for error\n${sub} ${rule}<--[HERE]`;
  if (rule === flaky) {
    flaky = null;
    return 'garbled';
  }
  if (value !== undefined) return `Gamerule ${rule} is now set to: ${value}`;
  return `Gamerule ${rule} is currently set to: true`;
};
const worldControls = require('../src/services/worldControls');

const SID = 'srv_wc_unsup';
db.run(
  `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb, status)
   VALUES (?, 'WC', 'PAPER', 25690, 26690, 'x', 1024, 1536, 'running')`,
  SID
);

test('a rule the version does not have is reported as unsupported, not as a failed read', async () => {
  const s = await worldControls.getState(SID, {
    rules: ['keepInventory', 'tntExplodes', 'allowFireTicksAwayFromPlayer'],
  });
  assert.equal(s.keepInventory, true);
  assert.deepEqual(s.unsupported.sort(), ['allowFireTicksAwayFromPlayer', 'tntExplodes']);
  assert.equal(Object.hasOwn(s, 'tntExplodes'), false);
});

test('a read that merely flaked is retried and is NOT marked unsupported', async () => {
  flaky = 'mobGriefing';
  const s = await worldControls.getState(SID, { rules: ['mobGriefing', 'keepInventory'] });
  assert.equal(s.mobGriefing, true, 'the retry with the other spelling read it');
  assert.equal(s.unsupported, undefined);
});

test('offline: a rule absent from a populated level.dat GameRules compound is unsupported', () => {
  const s = worldControls.offlineStateFromLevelData(
    { GameRules: { keepInventory: 'false', doFireTick: 'true' } },
    { rules: ['keepInventory', 'tntExplodes'] }
  );
  assert.equal(s.keepInventory, false);
  assert.deepEqual(s.unsupported, ['tntExplodes']);
  const empty = worldControls.offlineStateFromLevelData({}, { rules: ['keepInventory'] });
  assert.equal(empty.unsupported, undefined, 'no GameRules at all means nothing can be called unsupported');
});
