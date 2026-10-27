// Renders the site's pixel textures (16x16 tiles plus a heart sprite) into
// public/textures/. Original art generated from the panel's palette with a
// seeded noise so a re-run is byte-identical; nothing is taken from the game.
// Tiles are 1x and scaled up in CSS with image-rendering: pixelated.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'textures');
mkdirSync(out, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/** Fill a w×h RGBA buffer from a per-pixel color function. */
function raster(w, h, fn) {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x, y);
      buf.set([r, g, b, a], (y * w + x) * 4);
    }
  return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png();
}

const noiseTile = (palette, seed) => {
  const rand = rng(seed);
  const cols = palette.map(hex);
  const cells = Array.from({ length: 256 }, () => cols[Math.floor(rand() * cols.length)]);
  return (x, y) => cells[y * 16 + x];
};

const GRASS = ['#5dbb3a', '#59c53e', '#4fae32', '#66c944', '#57b83b'];
const DIRT = ['#7a5230', '#6d4828', '#8a5e38', '#5b3b21', '#7a5230'];
const STONE = ['#7d858c', '#737a80', '#8a9198', '#6b7278', '#7d858c'];
const DARK_DIRT = ['#3f2a18', '#372414', '#47301c', '#2f1e10', '#3f2a18'];
const DEEP_STONE = ['#3a3f45', '#33383d', '#40464c', '#2d3136', '#3a3f45'];

const grassTop = noiseTile(GRASS, 1);
const dirt = noiseTile(DIRT, 2);
const stone = noiseTile(STONE, 3);
const darkDirt = noiseTile(DARK_DIRT, 4);
const deepStone = noiseTile(DEEP_STONE, 5);
const grassSide = (x, y) => {
  const edge = [3, 4, 3, 5, 4, 3, 4, 5, 3, 4, 4, 3, 5, 3, 4, 3][x];
  return y < edge ? grassTop(x, y) : dirt(x, y);
};
const planks = (x, y) => {
  const band = Math.floor(y / 4);
  const seam = y % 4 === 3 || (band % 2 === 0 ? x === 7 : x === 15);
  if (seam) return hex('#6f5232');
  return hex(band % 2 ? '#b08a56' : '#bd955f');
};
// Dark planks: the header bar. Low-contrast grain so white text stays readable.
const darkPlanks = (x, y) => {
  const band = Math.floor(y / 4);
  const seam = y % 4 === 3 || (band % 2 === 0 ? x === 7 : x === 15);
  if (seam) return hex('#22150a');
  return hex(band % 2 ? '#3d2a16' : '#432e19');
};

// Heart: 9×8 pixel heart for list bullets.
const HEART = ['.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'];
const heart = (x, y) =>
  HEART[y][x] === 'x' ? [...hex(y < 2 && (x === 1 || x === 6) ? '#ff8080' : '#e5484d'), 255] : [0, 0, 0, 0];

const jobs = [
  ['grass-top.png', 16, 16, grassTop],
  ['grass-side.png', 16, 16, grassSide],
  ['dirt.png', 16, 16, dirt],
  ['stone.png', 16, 16, stone],
  ['dark-dirt.png', 16, 16, darkDirt],
  ['deep-stone.png', 16, 16, deepStone],
  ['planks.png', 16, 16, planks],
  ['dark-planks.png', 16, 16, darkPlanks],
  ['heart.png', 9, 8, heart],
];
for (const [name, w, h, fn] of jobs) await raster(w, h, fn).toFile(join(out, name));
console.log(`textures: ${jobs.length} files written to public/textures/`);
