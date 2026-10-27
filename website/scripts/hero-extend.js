// Derives the tall hero backgrounds from the generated panoramas: each one is
// extended upward with its sky colour, so the hero is a single image (text over
// sky, landscape at the bottom). The colour is the most common pixel colour of
// the sky band (the flat blue behind the painted clouds), not the average: the
// clouds lighten an average, and that mismatch showed as a seam behind the hero
// text. The site's --color-sky tokens (styles/site.css) use the printed values,
// so every sky on the site is the same blue.
// Runs after gen-images.js; output is committed like the rest of src/assets/gen.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'gen');
const TALL = 1400;
// Rows at the top of each panorama that are only sky and clouds.
const HEROES = [
  { id: 'hero-day', band: 190 },
  { id: 'hero-night', band: 140 },
];

/** Most common colour in the band, bucketed by 4 to absorb WebP noise. */
async function skyColour(src, width, band) {
  const { data, info } = await sharp(src)
    .extract({ left: 0, top: 0, width, height: band })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    const key = ((data[i] >> 2) << 16) | ((data[i + 1] >> 2) << 8) | (data[i + 2] >> 2);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const [key] = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { r: ((key >> 16) & 63) * 4 + 2, g: ((key >> 8) & 63) * 4 + 2, b: (key & 63) * 4 + 2 };
}

const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

for (const { id, band } of HEROES) {
  const src = join(dir, `${id}.webp`);
  const { width, height } = await sharp(src).metadata();
  const sky = await skyColour(src, width, band);
  await sharp(src)
    .extend({ top: TALL - height, background: { ...sky, alpha: 1 } })
    .webp({ quality: 86, effort: 6 })
    .toFile(join(dir, `${id}-tall.webp`));
  console.log(`hero-extend: ${id}-tall.webp (${width}x${TALL}), sky ${hex(sky)}`);
}
