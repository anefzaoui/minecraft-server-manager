'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { PNG } = require('pngjs');

const TARGET_SIZE = 32;

const MCDATA_BASE = 'https://cdn.jsdelivr.net/gh/PrismarineJS/minecraft-data@master/data/pc';
const WIKI_API = 'https://minecraft.wiki/api.php';
const VERSION = process.argv[2] || '1.21.11';
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons', 'mc-items');
// The wiki's rate limiter starts returning 429s once more than ~1 request is
// in flight at a time (verified empirically - concurrency 2 already drops
// ~6% of requests), so this has to stay sequential.
const CONCURRENCY = 1;

// Ids whose wiki page title doesn't match a plain title-cased version of the
// id - found by diffing a full run's misses against the wiki by hand.
const TITLE_OVERRIDES = {
  // Ore/material storage blocks use "Block of X" naming, not "X Block".
  diamond_block: 'Block of Diamond',
  iron_block: 'Block of Iron',
  gold_block: 'Block of Gold',
  emerald_block: 'Block of Emerald',
  redstone_block: 'Block of Redstone',
  coal_block: 'Block of Coal',
  lapis_block: 'Block of Lapis Lazuli',
  lapis_ore: 'Lapis Lazuli Ore',
  deepslate_lapis_ore: 'Deepslate Lapis Lazuli Ore',
  copper_block: 'Block of Copper',
  waxed_copper_block: 'Waxed Block of Copper',
  netherite_block: 'Block of Netherite',
  quartz_block: 'Block of Quartz',
  amethyst_block: 'Block of Amethyst',
  raw_iron_block: 'Block of Raw Iron',
  raw_gold_block: 'Block of Raw Gold',
  raw_copper_block: 'Block of Raw Copper',
  resin_block: 'Block of Resin',
  bamboo_block: 'Block of Bamboo',
  stripped_bamboo_block: 'Block of Stripped Bamboo',
  hay_block: 'Hay Bale',

  // Minecart variants: "Minecart with X", not "X Minecart".
  chest_minecart: 'Minecart with Chest',
  furnace_minecart: 'Minecart with Furnace',
  tnt_minecart: 'Minecart with TNT',
  hopper_minecart: 'Minecart with Hopper',
  command_block_minecart: 'Minecart with Command Block',

  // Bucket-of-mob variants: "Bucket of X", not "X Bucket".
  cod_bucket: 'Bucket of Cod',
  salmon_bucket: 'Bucket of Salmon',
  pufferfish_bucket: 'Bucket of Pufferfish',
  tropical_fish_bucket: 'Bucket of Tropical Fish',
  axolotl_bucket: 'Bucket of Axolotl',
  tadpole_bucket: 'Bucket of Tadpole',

  // Raw meat items disambiguate from the mob's own wiki page with "Raw X".
  beef: 'Raw Beef',
  chicken: 'Raw Chicken',
  cod: 'Raw Cod',
  mutton: 'Raw Mutton',
  porkchop: 'Raw Porkchop',
  rabbit: 'Raw Rabbit',
  salmon: 'Raw Salmon',

  // Chest boats/rafts: "X Boat/Raft with Chest", not "X Chest Boat/Raft".
  acacia_chest_boat: 'Acacia Boat with Chest',
  bamboo_chest_raft: 'Bamboo Raft with Chest',
  birch_chest_boat: 'Birch Boat with Chest',
  cherry_chest_boat: 'Cherry Boat with Chest',
  dark_oak_chest_boat: 'Dark Oak Boat with Chest',
  jungle_chest_boat: 'Jungle Boat with Chest',
  mangrove_chest_boat: 'Mangrove Boat with Chest',
  oak_chest_boat: 'Oak Boat with Chest',
  pale_oak_chest_boat: 'Pale Oak Boat with Chest',
  spruce_chest_boat: 'Spruce Boat with Chest',

  // Misc one-offs whose wiki title doesn't follow plain title-casing.
  quartz: 'Nether Quartz',
  ender_eye: 'Eye of Ender',
  experience_bottle: "Bottle o' Enchanting",
  jack_o_lantern: "Jack o'Lantern",
  spawner: 'Monster Spawner',
  comparator: 'Redstone Comparator',
  repeater: 'Redstone Repeater',
  writable_book: 'Book and Quill',
  slime_ball: 'Slimeball',
  dragon_breath: "Dragon's Breath",
  turtle_helmet: 'Turtle Shell',
  rabbit_foot: "Rabbit's Foot",
  leather_helmet: 'Leather Cap',
  leather_chestplate: 'Leather Tunic',
  leather_leggings: 'Leather Pants',
  vine: 'Vines',
  lily_of_the_valley: 'Lily of the Valley',
  carrot_on_a_stick: 'Carrot on a Stick',
  warped_fungus_on_a_stick: 'Warped Fungus on a Stick',
  totem_of_undying: 'Totem of Undying',
  heart_of_the_sea: 'Heart of the Sea',
  flint_and_steel: 'Flint and Steel',
  creeper_banner_pattern: 'Creeper Charge Banner Pattern',
  flower_banner_pattern: 'Flower Charge Banner Pattern',
  mojang_banner_pattern: 'Thing Banner Pattern',
  piglin_banner_pattern: 'Snout Banner Pattern',
  skull_banner_pattern: 'Skull Charge Banner Pattern',
  music_disc_creator_music_box: 'Music Disc Creator (Music Box)',
};

function titleCase(name) {
  if (TITLE_OVERRIDES[name]) return TITLE_OVERRIDES[name];
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch with retry/backoff on 429 - the wiki hands these out liberally under any load. */
async function fetchWithRetry(url, { retries = 5 } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.status !== 429 || attempt >= retries) return res;
    const retryAfter = Number(res.headers.get('retry-after')) || 1;
    await sleep(retryAfter * 1000 + Math.random() * 250);
  }
}

async function fetchJson(url) {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// The wiki's "Invicon" files are the actual rendered inventory icon for
// anything holdable - items and blocks alike - so it's the one source that
// doesn't need per-shape/per-texture guessing the way raw asset textures do.
async function wikiIconUrl(title) {
  const params = new URLSearchParams({
    action: 'query',
    titles: `File:Invicon ${title}.png`,
    prop: 'imageinfo',
    iiprop: 'url',
    format: 'json',
  });
  const data = await fetchJson(`${WIKI_API}?${params}`);
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.url || null;
}

async function tryFetch(name) {
  try {
    const url = await wikiIconUrl(titleCase(name));
    if (!url) return null;
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return normalizePng(buf);
  } catch {
    return null;
  }
}

/**
 * Resize a PNG buffer to TARGET_SIZE x TARGET_SIZE using nearest-neighbour
 * sampling so pixel-art stays sharp.  Icons that are already the target size
 * are returned as-is.  Returns the original buffer on parse failure so the
 * file is left untouched rather than lost.
 */
function normalizePng(buf) {
  let src;
  try {
    src = PNG.sync.read(buf);
  } catch {
    return buf; // non-standard PNG (APNG, trailing data) — leave as-is
  }
  if (src.width === TARGET_SIZE && src.height === TARGET_SIZE) return buf;
  const dst = new PNG({ width: TARGET_SIZE, height: TARGET_SIZE });
  const scaleX = src.width / TARGET_SIZE;
  const scaleY = src.height / TARGET_SIZE;
  for (let y = 0; y < TARGET_SIZE; y++) {
    const srcY = Math.min(Math.floor(y * scaleY), src.height - 1);
    for (let x = 0; x < TARGET_SIZE; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), src.width - 1);
      const si = (srcY * src.width + srcX) << 2;
      const di = (y * TARGET_SIZE + x) << 2;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return PNG.sync.write(dst);
}

async function main() {
  const normalizeOnly = process.argv.includes('--normalize');

  if (normalizeOnly) {
    await normalizeExistingIcons();
    return;
  }

  console.log(`Fetching item list for ${VERSION}...`);
  const items = await fetchJson(`${MCDATA_BASE}/${VERSION}/items.json`);
  const names = [...new Set(items.map((it) => it.name).filter(Boolean))].filter((n) => n !== 'air').sort();

  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`Fetching ${names.length} icon(s) from the wiki...`);

  let done = 0;
  let hits = 0;
  const misses = [];
  const queue = [...names];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const name = queue.shift();
        const buf = await tryFetch(name);
        done += 1;
        if (buf) {
          await fs.writeFile(path.join(OUT_DIR, `${name}.png`), buf);
          hits += 1;
        } else {
          misses.push(name);
        }
        if (done % 200 === 0) console.log(`  ${done}/${names.length}...`);
      }
    })
  );

  console.log(`\nDone: ${hits}/${names.length} icons saved to ${path.relative(process.cwd(), OUT_DIR)}`);
  if (misses.length) {
    console.log(`${misses.length} item(s) have no wiki icon (falls back to a category/generic glyph client-side):`);
    console.log(misses.join(', '));
  }
}

/** Resize every existing icon in OUT_DIR to TARGET_SIZE without re-fetching. */
async function normalizeExistingIcons() {
  const files = (await fs.readdir(OUT_DIR)).filter((f) => f.endsWith('.png'));
  console.log(`Normalizing ${files.length} existing icons to ${TARGET_SIZE}x${TARGET_SIZE}...`);
  let resized = 0;
  let skipped = 0;
  for (const file of files) {
    const buf = await fs.readFile(path.join(OUT_DIR, file));
    const normalized = normalizePng(buf);
    if (normalized !== buf) {
      await fs.writeFile(path.join(OUT_DIR, file), normalized);
      resized += 1;
    } else {
      skipped += 1;
    }
    if ((resized + skipped) % 200 === 0) console.log(`  ${resized + skipped}/${files.length}...`);
  }
  console.log(`Done: ${resized} resized, ${skipped} already ${TARGET_SIZE}x${TARGET_SIZE}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
