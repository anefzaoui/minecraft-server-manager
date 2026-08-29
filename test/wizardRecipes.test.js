'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const recipes = require('../src/services/wizardRecipes');

test('fishing-pole questions use the versioned vanilla recipe and a visual 3x3 grid', () => {
  assert.equal(
    recipes.recipeReply('how do I craft myself a fishing pole using a crafting table?', '1.20.1'),
    ['Fishing Rod ×1 — 3×3', '[ ][ ][1]', '[ ][1][2]', '[1][ ][2]', '1 Stick ×3 · 2 String ×2'].join('\n')
  );
});

test('2x2 and shapeless recipes are rendered into bounded square grids', () => {
  const table = recipes.recipeReply('what is the crafting recipe for a crafting table?', '1.20.1');
  assert.match(table, /^Crafting Table ×1 — 2×2\n(?:\[1\]){2}\n(?:\[1\]){2}\n1 Oak Planks ×4$/);
  const data = recipes.dataForVersion('1.20.1');
  const item = { name: 'example', displayName: 'Example' };
  assert.equal(
    recipes.renderRecipe(item, { ingredients: [807, 810], result: { count: 1 } }, data),
    ['Example ×1 — 2×2 shapeless', '[1][2]', '[ ][ ]', '1 Stick ×1 · 2 String ×1'].join('\n')
  );
});

test('unknown or modded recipes are not invented and non-crafting questions pass through', () => {
  assert.match(recipes.recipeReply('how do I craft an allthemodium furnace?', '1.20.1'), /cannot verify/i);
  assert.match(recipes.recipeReply('how do I craft a netherite pickaxe?', '1.20.1'), /no 2×2 or 3×3.*smithing table/i);
  assert.equal(recipes.recipeReply('how do I make it rain?', '1.20.1'), null);
  assert.equal(recipes.recipeReply('tell me a story about a fish', '1.20.1'), null);
});

test('common spoken aliases and verified processing hints remain deterministic', () => {
  const expected = 'Smelt Sand or Red Sand in a furnace to make Glass.';
  assert.match(recipes.recipeReply('what is the recipe for glass?', '1.20.1'), new RegExp(`^${expected}`));
  assert.match(recipes.recipeReply('how do I make a glass block?', '1.20.1'), new RegExp(`^${expected}`));
});

test('generic item families ask the player to choose a specific craftable item', () => {
  assert.equal(
    recipes.recipeReply('how do I craft a pickaxe?', '1.20.1'),
    'Which kind? Try Wooden Pickaxe, Stone Pickaxe, Golden Pickaxe, Iron Pickaxe, or Diamond Pickaxe.'
  );
  assert.match(recipes.recipeReply('how do I craft an iron pickaxe?', '1.20.1'), /^Iron Pickaxe ×1 — 3×3/);
});

test('unsupported pinned versions do not silently substitute a different recipe version', () => {
  assert.equal(recipes.dataForVersion('1.25.1'), null);
  assert.match(recipes.recipeReply('how do I craft an iron pickaxe?', '1.25.1'), /cannot verify.*1\.25\.1/i);
});
