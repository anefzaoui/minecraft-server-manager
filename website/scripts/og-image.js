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

// librsvg (what sharp rasterises with) ignores @font-face, so the title uses a
// bold system sans; the pixel face is reserved for the live site.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <style>
      .title { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #f4f5f6; font-size: 40px; font-weight: 800; letter-spacing: -0.5px; }
      .sub { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #d3d7db; font-size: 25px; }
      .pill { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #59c53e; font-size: 19px; font-weight: 700; letter-spacing: 1px; }
      .url { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #87919b; font-size: 22px; }
    </style>
    <pattern id="grass" width="28" height="14" patternUnits="userSpaceOnUse">
      <rect width="7" height="7" fill="#3fa62b"/><rect x="7" width="7" height="7" fill="#2f8520"/>
      <rect x="14" width="7" height="7" fill="#59c53e"/><rect x="21" width="7" height="7" fill="#2f8520"/>
      <rect y="7" width="14" height="7" fill="#7a5230"/><rect x="14" y="7" width="14" height="7" fill="#5b3b21"/>
    </pattern>
    <clipPath id="shotClip"><rect x="0" y="0" width="520" height="330"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#0e1113"/>
  <rect width="1200" height="14" fill="url(#grass)"/>
  <g transform="translate(0,630) scale(1,-1)"><rect width="1200" height="14" fill="url(#grass)"/></g>
  <rect x="64" y="84" width="44" height="44" rx="6" fill="#2f8520"/>
  <text x="124" y="118" class="title">Minecraft Server Manager</text>
  <text x="64" y="196" class="pill">OPEN SOURCE · SELF-HOSTED · NO PAID SERVICES</text>
  <text x="64" y="256" class="sub">Free control panel for Minecraft</text>
  <text x="64" y="292" class="sub">servers on Docker. Modpacks pinned,</text>
  <text x="64" y="328" class="sub">backups, schedules, live map, player</text>
  <text x="64" y="364" class="sub">analytics. Your whole panel is one folder.</text>
  <text x="64" y="470" class="url">minecraft-server-manager.com</text>
  <g transform="translate(640,180)">
    <rect x="-8" y="-8" width="536" height="346" fill="#16191c" stroke="#33383e" stroke-width="2"/>
    <g clip-path="url(#shotClip)"><image href="data:image/png;base64,${shotB64}" width="520"/></g>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
console.log(`og-image: wrote ${out}`);
