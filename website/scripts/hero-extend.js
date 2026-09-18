// Derives the tall hero backgrounds from the generated panoramas: each one is
// extended upward with its own top-edge sky colour, so the hero can be a single
// image (text over plain sky, landscape at the bottom) with no visible seam.
// Runs after gen-images.js; output is committed like the rest of src/assets/gen.
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'gen');
const TALL = 1400;

for (const id of ['hero-day', 'hero-night']) {
  const src = join(dir, `${id}.webp`);
  const { width, height } = await sharp(src).metadata();
  // Average of the top 4 rows = the sky colour to extend with.
  const { data } = await sharp(src)
    .extract({ left: 0, top: 0, width, height: 4 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0,
    g = 0,
    b = 0;
  const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const sky = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  // Blend the top 24 rows of the panorama toward the flat colour so any residual
  // gradient in the model's sky does not show as a line.
  const fade = Buffer.from(
    `<svg width="${width}" height="24"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(${sky.r},${sky.g},${sky.b})" stop-opacity="1"/><stop offset="1" stop-color="rgb(${sky.r},${sky.g},${sky.b})" stop-opacity="0"/></linearGradient></defs><rect width="${width}" height="24" fill="url(#g)"/></svg>`
  );
  await sharp(src)
    .composite([{ input: fade, top: 0, left: 0 }])
    .extend({ top: TALL - height, background: { ...sky, alpha: 1 } })
    .webp({ quality: 86, effort: 6 })
    .toFile(join(dir, `${id}-tall.webp`));
  console.log(`hero-extend: ${id}-tall.webp (${width}x${TALL}), sky rgb(${sky.r},${sky.g},${sky.b})`);
}
