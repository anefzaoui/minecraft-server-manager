// Generates the site's illustrations through OpenRouter (image-output models)
// into src/assets/gen/ as WebP: sprites lossless (transparency, small), scenes at
// quality 86 (the model's output is shaded, not true pixel art, so lossless would
// be 10x larger for no visible gain). Astro resizes and re-encodes per page.
// Idempotent: manifest.json stores the prompt hash each
// file was made from, so a re-run only regenerates entries whose prompt changed
// (or files that are missing). Sprites are requested on a flat magenta
// background and chroma-keyed to transparency here, which works with any model.
//
//   node scripts/gen-images.js            # generate what is missing/changed
//   node scripts/gen-images.js --force    # regenerate everything
//   node scripts/gen-images.js --only=hero-day
//
// Key: OPENROUTER_API_KEY in website/.env (gitignored). Every run prints the
// cost OpenRouter reports per image.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const site = join(here, '..');
try {
  process.loadEnvFile(join(site, '.env'));
} catch {
  /* no .env: the key may come from the environment */
}
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('gen-images: OPENROUTER_API_KEY is not set (website/.env).');
  process.exit(1);
}

const outDir = join(site, 'src', 'assets', 'gen');
mkdirSync(outDir, { recursive: true });
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

const args = new Map(process.argv.slice(2).map((a) => (a.includes('=') ? a.split(/=(.*)/s).slice(0, 2) : [a, true])));
const force = args.has('--force');
const only = typeof args.get('--only') === 'string' ? args.get('--only').split(',') : null;

// Cheapest image model that produces clean pixel art. Sprites use the same
// model plus chroma keying rather than a pricier transparency-capable one.
const MODEL = 'google/gemini-3.1-flash-image';

const STYLE =
  'Original 16-bit pixel art, crisp hard-edged pixels, no anti-aliasing, blocky voxel world in a friendly bright style. Palette: grass greens #5dbb3a #2f8520, dirt browns #7a5230 #5b3b21, stone greys #7d858c, sky blue #8fd0ff, warm wood #b08a56. Not a screenshot of any existing game, no logos, no text, no watermarks, no characters.';
const SPRITE =
  'Single object centered, isometric three-quarter view, on a completely flat solid magenta background (#FF00FF) with no shadow, no floor, no gradient, nothing else in frame.';
// Original blocky characters only: never a likeness of any existing game character.
const PEOPLE =
  'The characters are original blocky voxel people with simple square heads and colourful hoodies, no faces from any existing game.';
const CARD =
  'Composition fills the frame, subject in the middle third, plain flat sky or wall behind it, no text, no UI.';
const BANNER = 'Very wide panoramic strip, subjects small and spread along the bottom, lots of flat sky above.';

const IMAGES = [
  {
    id: 'hero-day',
    aspect: '21:9',
    prompt: `${STYLE} A wide daytime landscape: rolling grass hills made of blocks, a few blocky oak-like trees, one small cottage of wood and stone with a glowing window, distant blocky mountains, a river, flat pastel blue sky with blocky white clouds. Calm, cosy, lots of open sky in the top half.`,
  },
  {
    id: 'hero-night',
    aspect: '21:9',
    prompt: `${STYLE} The same kind of wide landscape at night: deep blue sky with square pixel stars and a blocky moon, hills and trees as dark silhouettes, a cottage with warm lit windows, torches along a path. Calm, lots of open sky in the top half.`,
  },
  {
    id: 'sprite-server',
    aspect: '1:1',
    sprite: true,
    prompt: `${STYLE} ${SPRITE} A small server rack built from stone and iron blocks with green and blue glowing indicator lights, one cable coming out.`,
  },
  {
    id: 'sprite-chest',
    aspect: '1:1',
    sprite: true,
    prompt: `${STYLE} ${SPRITE} An open wooden treasure chest overflowing with colourful gems, gears and tiny glowing cubes.`,
  },
  {
    id: 'sprite-map',
    aspect: '1:1',
    sprite: true,
    prompt: `${STYLE} ${SPRITE} A paper map on a wooden table with a compass and a small pin, seen from above at an angle.`,
  },
  {
    id: 'sprite-shield',
    aspect: '1:1',
    sprite: true,
    prompt: `${STYLE} ${SPRITE} An iron shield with a green padlock in the centre.`,
  },
  {
    id: 'sprite-clock',
    aspect: '1:1',
    sprite: true,
    prompt: `${STYLE} ${SPRITE} A blocky golden clock with a green hour hand, next to a small stack of three grass blocks.`,
  },
  {
    id: 'scene-404',
    aspect: '16:9',
    prompt: `${STYLE} The edge of a blocky world where the land abruptly ends over a void, a lone wooden signpost with an empty sign, one tree, a curious blocky sheep-like animal looking over the edge, daytime.`,
  },

  // Pillar cards (home).
  {
    id: 'card-folder',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} One character happily carrying a single large wooden chest on their back, walking along a path from an old house towards a new house, everything they own in that one chest.`,
  },
  {
    id: 'card-container',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} A neat row of four identical small stone huts, each with a glowing green server block visible through its door, a character closing the door of one with a key.`,
  },
  {
    id: 'card-pinned',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} A character hammering a wooden peg to pin a treasure chest of colourful gems firmly to the ground, a small padlock on the chest, calm and safe.`,
  },

  // Feature highlight cards (home).
  {
    id: 'card-wand',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} A character in a wizard hat waving a glowing wand over a crafting table, a small stone server block assembling itself from floating cubes.`,
  },
  {
    id: 'card-search',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} A character browsing tall wooden library shelves full of colourful glowing jars and books, picking one out, a ladder against the shelf.`,
  },
  {
    id: 'card-shield',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} A character inspecting a glowing blue gem through a magnifying glass at a stone workbench, a green checkmark shaped stamp beside it, an iron shield leaning on the bench.`,
  },
  {
    id: 'card-archive',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} A character stacking wooden chests neatly inside a stone vault with an iron door, each chest with a small coloured tag.`,
  },
  {
    id: 'card-map',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} Two characters leaning over a huge map spread on a wooden table, tiny block villages drawn on it, a compass and a torch.`,
  },
  {
    id: 'card-flame',
    aspect: '16:9',
    prompt: `${STYLE} ${PEOPLE} ${CARD} A character calmly pouring a bucket of water over a small fire on top of a stone server block, smoke rising, a clipboard on the ground.`,
  },

  // Feature group banners (features page).
  {
    id: 'group-servers',
    aspect: '21:9',
    prompt: `${STYLE} ${PEOPLE} ${BANNER} A village of small server huts with glowing windows along a path, characters walking between them carrying tools.`,
  },
  {
    id: 'group-mods',
    aspect: '21:9',
    prompt: `${STYLE} ${PEOPLE} ${BANNER} An open-air market with wooden stalls selling glowing jars, gems and scrolls, characters trading.`,
  },
  {
    id: 'group-protection',
    aspect: '21:9',
    prompt: `${STYLE} ${PEOPLE} ${BANNER} A stone castle wall with a vault door, torches, a character on the wall with a bell, chests stacked inside.`,
  },
  {
    id: 'group-insight',
    aspect: '21:9',
    prompt: `${STYLE} ${PEOPLE} ${BANNER} A tall wooden watchtower with a big map hanging from it, a bell, characters looking out with spyglasses over the hills.`,
  },

  // Section banners (home) and the footer strip.
  {
    id: 'banner-tutorial',
    aspect: '21:9',
    prompt: `${STYLE} ${PEOPLE} ${BANNER} Three characters building a small house from a blueprint scroll, one placing a block, one reading, one carrying planks.`,
  },
  {
    id: 'banner-screenshots',
    aspect: '21:9',
    prompt: `${STYLE} ${PEOPLE} ${BANNER} Characters hanging framed pictures on a long wooden wall in a gallery, lanterns along the wall.`,
  },
  {
    id: 'banner-community',
    aspect: '21:9',
    prompt: `${STYLE} ${PEOPLE} ${BANNER} A group of characters sitting around a campfire at dusk, tents, a blocky dog, warm light, hills behind.`,
  },
  {
    id: 'banner-footer',
    aspect: '21:9',
    prompt: `${STYLE} ${BANNER} A sunset village silhouette with torches and glowing windows, a river, purple and orange flat sky bands, no characters.`,
  },

  // Item icons for badges of things that have no CC0 logo. Small, single, readable at 32px.
  ...Object.entries({
    hangar: 'a small wooden aircraft hangar with a white paper plane in front of it',
    paper: 'a single sheet of white paper with a folded corner and three grey lines of text',
    purpur: 'a single purple-and-magenta patterned stone block',
    fabric: 'a folded square of blue cloth with a needle and thread',
    forge: 'an iron anvil with a hammer resting on it',
    neoforge: 'a glowing orange anvil with a single spark above it',
    quilt: 'a square patchwork quilt in four pastel colours',
    dockge: 'three stacked shipping containers, blue, green and orange',
    bluemap: 'a blue folded map with a red location pin',
    geyser: 'a small geyser of water erupting from a stone ring',
    ftb: 'a wooden supply crate with a lightning bolt painted on it',
    windows: 'a wooden window frame with four glass panes and blue sky behind',
    vanilla: 'a single grass block, green top and dirt sides',
    gtnh: 'a large bronze gear with a small blue planet in the middle',
  }).map(([id, what]) => ({
    id: `icon-${id}`,
    aspect: '1:1',
    sprite: true,
    prompt: `${STYLE} ${SPRITE} A single item icon: ${what}. Chunky, bold silhouette, readable when tiny.`,
  })),
];

const webpOptions = (img) => (img.sprite ? { lossless: true } : { quality: 86, effort: 6 });

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

async function generate(img) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://minecraft-server-manager.com',
      'X-Title': 'MSM website images',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: img.prompt }],
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: img.aspect },
      usage: { include: true },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  const image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!image) throw new Error(`no image in response: ${JSON.stringify(data).slice(0, 300)}`);
  const b64 = image.replace(/^data:image\/\w+;base64,/, '');
  return { buffer: Buffer.from(b64, 'base64'), cost: data.usage?.cost };
}

/** Turn the magenta backdrop transparent, then trim to the object. */
async function chromaKey(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Magenta-ish at any brightness: red and blue dominate, green is weak. The
    // model sometimes darkens the requested #FF00FF, so key on hue, not value.
    const hi = Math.max(r, b);
    const lo = Math.min(r, b);
    const magenta = hi > 90 && lo > hi * 0.55 && g < lo * 0.45;
    const soft = hi > 90 && lo > hi * 0.5 && g < lo * 0.62;
    if (magenta) data[i + 3] = 0;
    else if (soft) data[i + 3] = 128;
  }
  return sharp(data, { raw: info }).png().trim().toBuffer();
}

let total = 0;
for (const img of IMAGES) {
  if (only && !only.includes(img.id)) continue;
  const file = join(outDir, `${img.id}.webp`);
  const legacy = join(outDir, `${img.id}.png`);
  if (existsSync(legacy) && !existsSync(file)) {
    await sharp(legacy).webp(webpOptions(img)).toFile(file);
    unlinkSync(legacy);
  }
  const h = hash(`${MODEL}|${img.aspect}|${img.prompt}`);
  if (!force && manifest[img.id] === h && existsSync(file)) {
    console.log(`gen-images: ${img.id} up to date.`);
    continue;
  }
  process.stdout.write(`gen-images: ${img.id} … `);
  try {
    const { buffer, cost } = await generate(img);
    const png = img.sprite ? await chromaKey(buffer) : await sharp(buffer).png().toBuffer();
    await sharp(png).webp(webpOptions(img)).toFile(file);
    manifest[img.id] = h;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    total += cost || 0;
    const meta = await sharp(file).metadata();
    console.log(`ok (${meta.width}x${meta.height}, $${(cost || 0).toFixed(4)})`);
  } catch (err) {
    console.log(`failed: ${err.message}`);
    process.exitCode = 1;
  }
}
console.log(`gen-images: done, reported cost $${total.toFixed(4)}.`);
