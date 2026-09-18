// Renders public/og.png (1200x630), the Open Graph / Twitter card image, from an
// SVG composed here: the panel's dashboard screenshot on the stone canvas with
// the grass band and the site title. Run once and commit the PNG; re-run when
// the screenshot or the tagline changes.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const out = join(here, '..', 'public', 'og.png');

const shot = await sharp(join(repoRoot, 'docs', 'screenshots', '01-dashboard.png'))
  .resize({ width: 520 })
  .png()
  .toBuffer();
const shotB64 = shot.toString('base64');
const pano = await sharp(join(here, '..', 'src', 'assets', 'gen', 'hero-day.webp'))
  .resize({ width: 1200, height: 630, fit: 'cover', position: 'bottom' })
  .png()
  .toBuffer();
const panoB64 = pano.toString('base64');

// librsvg ignores @font-face, so the title uses a bold system sans here; the
// pixel typeface is for the live site only.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      .title { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; font-size: 44px; font-weight: 800; letter-spacing: -0.5px; }
      .sub { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; font-size: 26px; font-weight: 600; }
      .pill { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; font-size: 18px; font-weight: 700; }
      .url { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #ffffff; font-size: 22px; font-weight: 600; }
    </style>
    <filter id="sh"><feDropShadow dx="3" dy="3" stdDeviation="0" flood-color="#1f1f1f"/></filter>
  </defs>
  <image href="data:image/png;base64,${panoB64}" width="1200" height="630"/>
  <rect x="0" y="0" width="1200" height="630" fill="#10233a" opacity="0.18"/>
  <rect x="56" y="64" width="560" height="360" fill="#1b1f23" opacity="0.72"/>
  <rect x="56" y="64" width="560" height="360" fill="none" stroke="#1f1f1f" stroke-width="4"/>
  <rect x="76" y="84" width="44" height="44" fill="#2f8520" stroke="#1e461b" stroke-width="3"/>
  <text x="136" y="118" class="title" filter="url(#sh)">Minecraft Server Manager</text>
  <rect x="76" y="150" width="380" height="36" fill="#27661d" stroke="#1e461b" stroke-width="3"/>
  <text x="92" y="175" class="pill">FREE · OPEN SOURCE · SELF-HOSTED</text>
  <text x="76" y="236" class="sub">Run your Minecraft servers from</text>
  <text x="76" y="272" class="sub">one friendly panel. Modpacks pinned,</text>
  <text x="76" y="308" class="sub">backups, schedules, live map, player</text>
  <text x="76" y="344" class="sub">stats. Your whole panel is one folder.</text>
  <text x="76" y="400" class="url" fill-opacity="0.85">minecraft-server-manager.com</text>
  <g transform="translate(650,110)">
    <rect x="-10" y="-10" width="540" height="350" fill="#d4d4d4" stroke="#1f1f1f" stroke-width="4"/>
    <rect x="0" y="0" width="520" height="330" fill="#8b8b8b"/>
    <clipPath id="c"><rect x="0" y="0" width="520" height="330"/></clipPath>
    <g clip-path="url(#c)"><image href="data:image/png;base64,${shotB64}" width="520"/></g>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
console.log(`og-image: wrote ${out}`);
