'use strict';

require('./helpers/env');

const assert = require('node:assert/strict');
const { test } = require('node:test');
const consoleCommands = require('../src/services/consoleCommands');

test('suggests versioned vanilla commands and syntax', () => {
  const result = consoleCommands.suggest('1.21.4', 'ti');

  assert.equal(result.catalogVersion, '1.21.4');
  const time = result.suggestions.find((item) => item.value === 'time');
  assert.ok(time);
  assert.equal(time.help.description, 'View or change the world time.');
  assert.ok(time.help.usages.includes('/time set day'));
});

test('suggests online player names and selectors for entity arguments', () => {
  const result = consoleCommands.suggest('1.21.11', 'tp Ka', ['KaramTNC', 'Alex']);

  assert.deepEqual(
    result.suggestions.map((item) => item.value),
    ['KaramTNC']
  );
  assert.equal(result.suggestions[0].kind, 'argument');
  assert.equal(result.suggestions[0].help.command, 'tp');
  assert.ok(result.expected.some((item) => item.name === 'destination'));
});

test('describes each target selector by its selection behavior', () => {
  const result = consoleCommands.suggest('1.21.4', 'tp ');
  const descriptions = Object.fromEntries(result.suggestions.map(({ value, description }) => [value, description]));

  assert.equal(descriptions['@a'], 'all players');
  assert.equal(descriptions['@e'], 'all entities');
  assert.equal(descriptions['@p'], 'nearest player');
  assert.equal(descriptions['@r'], 'a random player');
  assert.equal(descriptions['@s'], 'the executing entity');
});

test('uses descriptive help for every command in the supported catalog', () => {
  const minecraftData = require('minecraft-data');
  const commands = minecraftData('1.21.4').commands.root.children.filter((node) => node.type === 'literal');

  for (const command of commands) {
    const suggestion = consoleCommands
      .suggest('1.21.4', command.name)
      .suggestions.find((item) => item.value === command.name);
    assert.ok(suggestion, `missing suggestion for ${command.name}`);
    assert.notEqual(suggestion.description, `Use the ${command.name} command.`);
  }
});

test('explains common coordinate, component, and NBT arguments', () => {
  assert.equal(consoleCommands.suggest('1.21.4', 'setblock ').expected[0].description, 'x, y, and z block coordinates');
  assert.equal(
    consoleCommands.suggest('1.21.4', 'tellraw @a ').expected[0].description,
    'a text component, usually JSON text'
  );
  assert.equal(consoleCommands.suggest('1.21.4', 'data get entity @s ').expected[0].description, 'an NBT path');
  assert.equal(consoleCommands.suggest('1.21.4', 'execute anchored ').expected[0].description, 'eyes or feet');
});

test('suggests enum values, child literals, and item IDs', () => {
  const gamemode = consoleCommands.suggest('1.21.4', 'gamemode s');
  assert.deepEqual(
    gamemode.suggestions.map((item) => item.value),
    ['spectator', 'survival']
  );

  const weather = consoleCommands.suggest('1.21.4', 'weather ');
  assert.deepEqual(
    weather.suggestions.map((item) => item.value),
    ['clear', 'rain', 'thunder']
  );

  const items = consoleCommands.suggest('1.21.4', 'give Alex minecraft:dia');
  assert.ok(items.suggestions.some((item) => item.value === 'minecraft:diamond'));
});

test('preserves the completion offset after slash and whitespace', () => {
  assert.equal(consoleCommands.suggest('1.21.4', '/time se').replaceFrom, 5);
  assert.equal(consoleCommands.suggest('1.21.4', 'time set ').replaceFrom, 9);
});

test('falls back to a supported vanilla catalog for unknown version pins', () => {
  const result = consoleCommands.suggest('not-a-version', 'time ');

  assert.ok(result.catalogVersion);
  assert.ok(result.suggestions.some((item) => item.value === 'set'));
});
