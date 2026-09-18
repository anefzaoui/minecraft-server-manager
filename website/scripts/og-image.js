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
      .title { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #1b1f23; font-size: 40px; font-weight: 800; letter-spacing: -0.5px; }
      .sub { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #464d55; font-size: 25px; }
      .pill { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #27661d; font-size: 18px; font-weight: 700; }
      .url { font-family: 'Helvetica Neue', Arial, sans-serif; fill: #6a747f; font-size: 22px; }
    </style>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c2e6ff"/><stop offset="0.6" stop-color="#eaf7ea"/><stop offset="1" stop-color="#f6f8f3"/>
    </linearGradient>
    <clipPath id="shotClip"><rect x="0" y="0" width="520" height="330" rx="10"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <rect x="64" y="84" width="44" height="44" rx="10" fill="#2f8520"/>
  <text x="124" y="118" class="title">Minecraft Server Manager</text>
  <rect x="64" y="166" width="392" height="38" rx="19" fill="#d5f5c9"/>
  <text x="84" y="192" class="pill">FREE · OPEN SOURCE · SELF-HOSTED</text>
  <text x="64" y="256" class="sub">Run your Minecraft servers from</text>
  <text x="64" y="292" class="sub">one friendly panel. Modpacks pinned,</text>
  <text x="64" y="328" class="sub">backups, schedules, live map, player</text>
  <text x="64" y="364" class="sub">stats. Your whole panel is one folder.</text>
  <text x="64" y="470" class="url">minecraft-server-manager.com</text>
  <g transform="translate(640,180)">
    <rect x="-10" y="-40" width="540" height="380" rx="14" fill="#ffffff" stroke="#e1e6da" stroke-width="2"/>
    <circle cx="8" cy="-22" r="5" fill="#f87171"/><circle cx="24" cy="-22" r="5" fill="#f0b42f"/><circle cx="40" cy="-22" r="5" fill="#59c53e"/>
    <g clip-path="url(#shotClip)"><image href="data:image/png;base64,${shotB64}" width="520"/></g>
  </g>
  <g transform="translate(560,470)">
    <path d="M40,0 L80,20 L40,40 L0,20 Z" fill="#59c53e"/><path d="M0,20 L40,40 L40,80 L0,60 Z" fill="#7a5230"/><path d="M80,20 L40,40 L40,80 L80,60 Z" fill="#5b3b21"/>
    <path d="M0,20 L40,40 L40,48 L0,28 Z" fill="#3fa62b"/><path d="M80,20 L40,40 L40,48 L80,28 Z" fill="#2f8520"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
console.log(`og-image: wrote ${out}`);
