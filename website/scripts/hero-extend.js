// Derives the tall hero backgrounds from the generated panoramas: each one is
// extended upward so the hero is a single image (text over sky, landscape at
// the bottom) that reads as one sky from top to bottom.
//
// - The new sky is the most common pixel colour of the panorama's sky band
//   (the flat blue behind its painted clouds), not the average, which the
//   clouds lighten and which showed as a seam.
// - The painted clouds are cut out of that band (every connected group of
//   non-sky pixels that is not cut off by the band's edges) and scattered over
//   the new sky at the band's own cloud density, so the upper sky has the same
//   clouds as the lower one. Placement is seeded: a re-run is byte-identical.
//
// The site's --color-sky tokens (styles/site.css) use the printed colours, so
// the page headers match the hero. Runs after gen-images.js; output is
// committed like the rest of src/assets/gen.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'gen');
const TALL = 1400;
// Rows at the top of each panorama that hold only sky and clouds.
// `minSize`: the smallest group of pixels that counts (clouds by day, stars at night).
const HEROES = [
  { id: 'hero-day', band: 190, seed: 7, minSize: 300 },
  // Mirrored so the moon sits under the screenshot, not beside the hero buttons.
  { id: 'hero-night', band: 140, seed: 11, minSize: 2, flop: true },
];
// A pixel further than this from the sky colour (RGB distance) is cloud.
const CLOUD_DISTANCE = 22;

const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Mulberry32: tiny seeded PRNG so the scatter is the same on every run. */
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Most common colour in the band, bucketed by 4 to absorb WebP noise. */
function skyColour(px, width, band) {
  const counts = new Map();
  for (let i = 0; i < width * band * 3; i += 3) {
    const key = ((px[i] >> 2) << 16) | ((px[i + 1] >> 2) << 8) | (px[i + 2] >> 2);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const [key] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { r: ((key >> 16) & 63) * 4 + 2, g: ((key >> 8) & 63) * 4 + 2, b: (key & 63) * 4 + 2 };
}

/**
 * Every cloud (or star) in the band as an RGBA sprite { width, height, data,
 * area, edge }. `edge` is 'left' or 'right' for one cut off by that side of the
 * picture: it is only ever placed flush against the same side, so the cut never
 * shows.
 */
function cutClouds(px, width, band, sky, minSize) {
  const isCloud = new Uint8Array(width * band);
  for (let p = 0; p < width * band; p++) {
    const i = p * 3;
    const d = Math.hypot(px[i] - sky.r, px[i + 1] - sky.g, px[i + 2] - sky.b);
    isCloud[p] = d > CLOUD_DISTANCE ? 1 : 0;
  }
  const seen = new Uint8Array(width * band);
  const clouds = [];
  for (let start = 0; start < width * band; start++) {
    if (!isCloud[start] || seen[start]) continue;
    const members = [];
    const stack = [start];
    seen[start] = 1;
    let x0 = width,
      x1 = 0,
      y0 = band,
      y1 = 0;
    while (stack.length) {
      const p = stack.pop();
      members.push(p);
      const x = p % width;
      const y = (p - x) / width;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= band) continue;
          const q = ny * width + nx;
          if (isCloud[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
    }
    // Skip noise, clouds cut by the band's top or bottom, and anything spanning both sides.
    if (members.length < minSize || y0 === 0 || y1 === band - 1 || (x0 === 0 && x1 === width - 1)) continue;
    const edge = x0 === 0 ? 'left' : x1 === width - 1 ? 'right' : null;
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const data = Buffer.alloc(w * h * 4);
    for (const p of members) {
      const x = p % width;
      const y = (p - x) / width;
      const o = ((y - y0) * w + (x - x0)) * 4;
      data[o] = px[p * 3];
      data[o + 1] = px[p * 3 + 1];
      data[o + 2] = px[p * 3 + 2];
      data[o + 3] = 255;
    }
    clouds.push({ width: w, height: h, data, area: members.length, edge });
  }
  return clouds;
}

/** The same sprite flipped left to right. */
function mirror(c) {
  const data = Buffer.alloc(c.data.length);
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      c.data.copy(data, (y * c.width + (c.width - 1 - x)) * 4, (y * c.width + x) * 4, (y * c.width + x) * 4 + 4);
  return { ...c, data };
}

/** Seeded, non-overlapping placement over `height` rows at the band's cloud density. */
function scatter(clouds, width, height, density, random) {
  const placed = [];
  const target = density * width * height;
  let covered = 0;
  const uses = new Map();
  for (let tries = 0; tries < 4000 && covered < target; tries++) {
    let c = clouds[Math.floor(random() * clouds.length)];
    // An edge cloud may appear twice and any other cloud four times (half of
    // them mirrored), so no shape visibly repeats down the sky.
    const used = uses.get(c) || 0;
    if (used >= (c.edge ? 2 : 4)) continue;
    uses.set(c, used + 1);
    if (!c.edge && used % 2 === 1) c = mirror(c);
    const left =
      c.edge === 'left' ? 0 : c.edge === 'right' ? width - c.width : Math.floor(random() * (width - c.width));
    const top = Math.floor(random() * (height - c.height));
    const pad = c.area < 40 ? 6 : 24;
    const hit = placed.some(
      (p) =>
        left < p.left + p.width + pad &&
        p.left < left + c.width + pad &&
        top < p.top + p.height + pad &&
        p.top < top + c.height + pad
    );
    if (hit) continue;
    placed.push({ ...c, left, top });
    covered += c.area;
  }
  return placed;
}

for (const { id, band, seed, minSize, flop = false } of HEROES) {
  const src = await sharp(join(dir, `${id}.webp`))
    .flop(flop)
    .png()
    .toBuffer();
  const { data: px, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const sky = skyColour(px, width, band);
  const clouds = cutClouds(px, width, band, sky, minSize);
  const bandCloud = clouds.reduce((n, c) => n + c.area, 0) / (width * band);
  const extra = TALL - height;
  const placed = clouds.length ? scatter(clouds, width, extra, bandCloud, rng(seed)) : [];
  const layers = placed.map((c) => ({
    input: c.data,
    raw: { width: c.width, height: c.height, channels: 4 },
    left: c.left,
    top: c.top,
  }));
  layers.push({ input: await sharp(src).png().toBuffer(), left: 0, top: extra });
  await sharp({ create: { width, height: TALL, channels: 3, background: sky } })
    .composite(layers)
    .webp({ quality: 86, effort: 6 })
    .toFile(join(dir, `${id}-tall.webp`));
  console.log(
    `hero-extend: ${id}-tall.webp (${width}x${TALL}), sky ${hex(sky)}, ${clouds.length} clouds cut, ${placed.length} placed`
  );
}
