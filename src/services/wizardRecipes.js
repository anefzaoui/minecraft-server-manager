// @ts-nocheck -- minecraft-data recipe ingredients have version-dependent shapes.
'use strict';

const minecraftData = require('minecraft-data');

const RECIPE_WORDS_RE = /\b(?:craft(?:ing)?|recipe)\b/i;
const HOW_TO_MAKE_RE = /\bhow\b.{0,40}\bmake\b/i;
const NON_RECIPE_MAKE_RE = /\b(?:rain|weather|day|daytime|night|midnight|thunder|storm)\b/i;
const ALIASES = Object.freeze({
  'fishing pole': 'fishing rod',
  fishingpole: 'fishing rod',
  'glass block': 'glass',
  workbench: 'crafting table',
});
const PROCESSING_HINTS = Object.freeze({
  glass: 'Smelt Sand or Red Sand in a furnace to make Glass.',
});

function normalizeWords(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dataForVersion(version) {
  const wanted = String(version || '').trim();
  if (wanted && wanted.toUpperCase() !== 'LATEST') {
    try {
      const exact = minecraftData(wanted);
      if (exact?.recipes) return exact;
    } catch {
      // Fall through to the nearest supported release in the same version line.
    }
    const line = /^(\d+\.\d+)/.exec(wanted)?.[1];
    if (line) {
      const nearby = minecraftData.versions.pc.find(
        (entry) => entry.releaseType === 'release' && entry.minecraftVersion.startsWith(`${line}.`)
      );
      if (nearby) {
        const data = minecraftData(nearby.minecraftVersion);
        if (data?.recipes) return data;
      }
    }
    return null;
  }
  const latest = minecraftData.versions.pc.find((entry) => {
    if (entry.releaseType !== 'release') return false;
    try {
      return Boolean(minecraftData(entry.minecraftVersion)?.recipes);
    } catch {
      return false;
    }
  });
  return latest ? minecraftData(latest.minecraftVersion) : null;
}

function phrasePosition(text, phrase) {
  const match = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}s?\\b`, 'i').exec(text);
  return match ? match.index : -1;
}

function requestedPhrase(text) {
  const patterns = [/\brecipe\s+(?:for|of)\s+(.+)$/, /\b(?:craft|make)\s+(?:myself\s+)?(?:an?|some)?\s*(.+)$/];
  const raw = patterns.map((pattern) => pattern.exec(text)?.[1]).find(Boolean);
  if (!raw) return '';
  return raw
    .split(/\b(?:using|with|on|at|in (?:a )?crafting table|in minecraft)\b/)[0]
    .replace(/^(?:an?|some)\s+/, '')
    .replace(/\bplease\b/g, '')
    .trim();
}

function requestedItem(prompt, data) {
  let text = normalizeWords(prompt);
  for (const [alias, canonical] of Object.entries(ALIASES)) text = text.replaceAll(alias, canonical);
  const target = requestedPhrase(text);
  const matches = [];
  for (const item of data?.itemsArray || []) {
    const names = new Set([normalizeWords(item.name), normalizeWords(item.displayName)]);
    for (const name of names) {
      if (!name) continue;
      if (target && target !== name && target !== `${name}s`) continue;
      const index = phrasePosition(text, name);
      if (index >= 0) matches.push({ item, index, length: name.length });
    }
  }
  matches.sort((a, b) => a.index - b.index || b.length - a.length);
  return matches[0]?.item || null;
}

function familyChoices(prompt, data) {
  let text = normalizeWords(prompt);
  for (const [alias, canonical] of Object.entries(ALIASES)) text = text.replaceAll(alias, canonical);
  const target = requestedPhrase(text);
  if (!target) return [];
  const suffix = ` ${target}`;
  return (data?.itemsArray || [])
    .filter((item) => {
      const name = normalizeWords(item.displayName || item.name);
      const recipes = data.recipes?.[item.id];
      return name.endsWith(suffix) && Array.isArray(recipes) && recipes.length > 0;
    })
    .map((item) => item.displayName || item.name)
    .slice(0, 8);
}

function recipeItem(raw, data) {
  if (raw === null || raw === undefined) return null;
  let id = raw;
  let count = 1;
  if (Array.isArray(raw)) id = raw[0];
  else if (typeof raw === 'object') {
    id = raw.id;
    count = Math.max(1, Number(raw.count) || 1);
  }
  const item = data.items?.[Number(id)] || data.blocks?.[Number(id)];
  return item ? { id: item.id, name: item.displayName || item.name, count } : null;
}

function renderRecipe(item, recipe, data) {
  const shaped = Array.isArray(recipe.inShape);
  const source = shaped ? recipe.inShape : [recipe.ingredients || []];
  const height = shaped ? source.length : Math.ceil(source[0].length / (source[0].length <= 4 ? 2 : 3));
  const width = shaped ? Math.max(...source.map((row) => row.length)) : source[0].length <= 4 ? 2 : 3;
  const size = Math.max(width, height) <= 2 ? 2 : 3;
  const flattened = shaped ? null : source[0];
  const cells = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) =>
      recipeItem(shaped ? source[row]?.[col] : flattened[row * size + col], data)
    )
  );
  const symbols = new Map();
  const totals = new Map();
  for (const cell of cells.flat()) {
    if (!cell) continue;
    const key = String(cell.id);
    if (!symbols.has(key)) symbols.set(key, symbols.size + 1);
    const total = totals.get(key) || { name: cell.name, count: 0 };
    total.count += cell.count;
    totals.set(key, total);
  }
  const resultCount = Math.max(1, Number(recipe.result?.count) || 1);
  const title = `${item.displayName || item.name} ×${resultCount} — ${size}×${size}${shaped ? '' : ' shapeless'}`;
  const rows = cells.map((row) => row.map((cell) => `[${cell ? symbols.get(String(cell.id)) : ' '}]`).join(''));
  const legend = [...symbols.entries()]
    .map(([key, symbol]) => {
      const ingredient = totals.get(key);
      return `${symbol} ${ingredient.name} ×${ingredient.count}`;
    })
    .join(' · ');
  return [title, ...rows, legend].join('\n');
}

function recipeReply(prompt, version) {
  const text = String(prompt || '');
  const explicit = RECIPE_WORDS_RE.test(text);
  const howToMake = HOW_TO_MAKE_RE.test(text) && !NON_RECIPE_MAKE_RE.test(text);
  if (!explicit && !howToMake) return null;
  const data = dataForVersion(version);
  const item = data && requestedItem(text, data);
  const recipes = item && data.recipes?.[item.id];
  const recipe = Array.isArray(recipes)
    ? recipes.find((entry) => Array.isArray(entry.inShape)) || recipes.find((entry) => Array.isArray(entry.ingredients))
    : null;
  if (!item) {
    const choices = data ? familyChoices(text, data) : [];
    if (choices.length) {
      const last = choices.pop();
      const list = choices.length ? `${choices.join(', ')}, or ${last}` : last;
      return `Which kind? Try ${list}.`;
    }
    const shownVersion = data?.version?.minecraftVersion || version || 'this Minecraft version';
    return `I cannot verify that crafting recipe for ${shownVersion}. For modded items, check JEI/REI; for vanilla items, use the recipe book.`;
  }
  if (!recipe) {
    const shownVersion = data.version?.minecraftVersion || version || 'this Minecraft version';
    const hint = PROCESSING_HINTS[item.name];
    if (hint) return `${hint} It has no 2×2 or 3×3 crafting-grid recipe in ${shownVersion}.`;
    return `${item.displayName || item.name} has no 2×2 or 3×3 crafting-grid recipe in ${shownVersion}. It may use a furnace or another workstation, such as a smithing table.`;
  }
  return renderRecipe(item, recipe, data);
}

module.exports = { recipeReply, dataForVersion, requestedItem, familyChoices, renderRecipe };
