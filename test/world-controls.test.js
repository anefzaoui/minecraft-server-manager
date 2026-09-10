'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  looksLikeError,
  QUICK_ACTIONS,
  offlineStateFromLevelData,
  resolveRuleWrite,
} = require('../src/services/worldControls');

test('looksLikeError catches an unknown gamerule reply (so it is not a silent success)', () => {
  assert.equal(looksLikeError('No game rule called keep_inventory is available'), true);
  assert.equal(looksLikeError('No gamerule called doFireTick is available'), true);
  assert.equal(looksLikeError('No such gamerule: foo'), true);
});

test('looksLikeError still catches the classic syntax rejections', () => {
  assert.equal(looksLikeError('Incorrect argument for command'), true);
  assert.equal(looksLikeError('Unknown command or insufficient permissions'), true);
  assert.equal(looksLikeError('gamerule doFireTick <--[HERE]'), true);
});

test('looksLikeError passes a normal success line through', () => {
  assert.equal(looksLikeError('Gamerule doFireTick is currently set to: true'), false);
  assert.equal(looksLikeError('Set the time to 1000'), false);
});

test('every curated World Controls chip maps to a real quick action', () => {
  // Slugs the curated (always-visible) section of world-controls.hbs shows.
  const curatedToggles = [
    'keepinv',
    'instantrespawn',
    'daycycle',
    'weathercycle',
    'mobspawn',
    'mobgrief',
    'phantoms',
    'naturalregen',
    'falldmg',
    'firetick',
    'tntexplodes',
    'deathmsg',
    'advancements',
    'cmdfeedback',
    'pvp',
  ];
  for (const slug of curatedToggles) {
    assert.ok(QUICK_ACTIONS[`${slug}-on`], `${slug}-on missing`);
    assert.ok(QUICK_ACTIONS[`${slug}-off`], `${slug}-off missing`);
  }
  for (const key of [
    'time-day',
    'time-noon',
    'time-night',
    'time-midnight',
    'weather-clear',
    'weather-rain',
    'weather-thunder',
    'save-all',
    'difficulty-normal',
  ]) {
    assert.ok(QUICK_ACTIONS[key], `${key} missing`);
  }
});

test('offlineStateFromLevelData maps the clock and day from level.dat time fields', () => {
  // 6:00 AM == 0 daytime ticks; DayTime often exceeds 24000, so it must wrap.
  const s = offlineStateFromLevelData({ DayTime: 24000 + 6000, Time: 24000 * 4 + 500 });
  assert.equal(s.timeTicks, 6000);
  assert.equal(s.clock, '12:00 PM');
  assert.equal(s.timeLabel, 'Afternoon');
  assert.equal(s.day, 5); // floor(Time / 24000) + 1
  assert.equal(s.offline, true);
});

test('offlineStateFromLevelData decodes a Long stored as [high, low]', () => {
  // prismarine-nbt simplify() yields Longs as [high, low] (two int32); DayTime = 13000.
  const s = offlineStateFromLevelData({ DayTime: [0, 13000] });
  assert.equal(s.timeTicks, 13000);
  assert.equal(s.timeLabel, 'Sunset');
});

test('offlineStateFromLevelData maps the Difficulty byte to a name', () => {
  assert.equal(offlineStateFromLevelData({ Difficulty: 0 }).difficulty, 'peaceful');
  assert.equal(offlineStateFromLevelData({ Difficulty: 2 }).difficulty, 'normal');
  assert.equal(offlineStateFromLevelData({ Difficulty: 3 }).difficulty, 'hard');
  assert.ok(!('difficulty' in offlineStateFromLevelData({})), 'absent when the field is missing');
  assert.ok(!('difficulty' in offlineStateFromLevelData({ Difficulty: 7 })), 'absent for an out-of-range byte');
});

test('offlineStateFromLevelData reads gamerules in either casing', () => {
  const s = offlineStateFromLevelData({
    GameRules: { keepInventory: 'true', do_mob_spawning: 'false', doDaylightCycle: 'true' },
  });
  assert.equal(s.keepInventory, true); // camelCase (<=1.21)
  assert.equal(s.doMobSpawning, false); // snake_case (26.x) mapped back
  assert.equal(s.doDaylightCycle, true);
});

test('offlineStateFromLevelData honours the rules filter and ignores unknown keys', () => {
  const s = offlineStateFromLevelData(
    { GameRules: { keepInventory: 'true', mobGriefing: 'false' } },
    { rules: ['keepInventory', 'bogusRule'] }
  );
  assert.equal(s.keepInventory, true);
  assert.ok(!('mobGriefing' in s), 'a rule not asked for is not returned');
  assert.ok(!('bogusRule' in s));
});

test('offlineStateFromLevelData tolerates a missing / empty Data compound', () => {
  assert.deepEqual(offlineStateFromLevelData(null), { offline: true });
  assert.deepEqual(offlineStateFromLevelData({}), { offline: true });
});

test('resolveRuleWrite trusts the read-back value regardless of the reply text', () => {
  // Success is "the value read back equals what we asked for" - the set command's
  // own reply (translated on a non-English server) is not consulted.
  assert.deepEqual(resolveRuleWrite(true, true, 'irgendein lokalisierter Text'), { ok: true });
  assert.deepEqual(resolveRuleWrite(false, false, ''), { ok: true });
  // Read-back disagrees -> the write did not take.
  assert.deepEqual(resolveRuleWrite(false, true, 'Gamerule set to true'), { ok: false });
});

test('resolveRuleWrite falls back to the reply only when the rule cannot be read back', () => {
  assert.deepEqual(resolveRuleWrite(null, true, 'Gamerule keepInventory is now true'), { ok: true });
  assert.deepEqual(resolveRuleWrite(null, true, 'No game rule called keepInventory is available'), { ok: false });
});
