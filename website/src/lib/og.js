// Open Graph / Twitter card images (1200x630 PNG), one per page, drawn in the
// site's game-UI language: sky, a bevelled stone panel with the page title in
// Jersey 15, the page's sprite or a screenshot on the end side, and the grass
// strip along the bottom. Satori lays the card out and turns text into paths
// (so the build needs no system fonts); sharp rasterises it.
//
// Paths are resolved from the website package root, which is the working
// directory of every build and dev run.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

const root = process.cwd();
const W = 1200;
const H = 630;
const GROUND = 96;

const font = (file) => readFileSync(resolve(root, 'src/assets/og-fonts', file));
let fonts;
function loadFonts() {
  fonts ||= [
    { name: 'Jersey 15', data: font('Jersey15-Regular.ttf'), weight: 400, style: 'normal' },
    { name: 'IBM Plex Sans', data: font('IBMPlexSans-SemiBold.ttf'), weight: 600, style: 'normal' },
  ];
  return fonts;
}

const cache = new Map();
/** A file as a PNG data URI, optionally resized with nearest-neighbour (pixel art). */
async function dataUri(path, { width, pixel = false } = {}) {
  const key = `${path}|${width}|${pixel}`;
  if (!cache.has(key)) {
    let img = sharp(resolve(root, path));
    if (width) img = img.resize({ width, kernel: pixel ? 'nearest' : 'lanczos3' });
    cache.set(key, `data:image/png;base64,${(await img.png().toBuffer()).toString('base64')}`);
  }
  return cache.get(key);
}

/** Minimal element helper for satori's React-like tree. */
const h = (type, style, ...children) => ({ type, props: { style, children: children.flat().filter(Boolean) } });
const img = (src, style) => ({ type: 'img', props: { src, style } });

function titleSize(title) {
  if (title.length <= 28) return 84;
  if (title.length <= 48) return 70;
  if (title.length <= 70) return 58;
  return 50;
}

/**
 * @param {{ title: string, eyebrow?: string, subtitle?: string, sprite?: string, screenshot?: string }} card
 *   `sprite` and `screenshot` are paths relative to the website package.
 * @returns {Promise<Buffer>} PNG bytes.
 */
export async function renderCard({ title, eyebrow, subtitle, sprite, screenshot }) {
  const [grass, dirt, logo] = await Promise.all([
    dataUri('public/textures/grass-side.png', { width: 48, pixel: true }),
    dataUri('public/textures/dirt.png', { width: 48, pixel: true }),
    dataUri('public/favicon.svg', { width: 96 }),
  ]);
  const side = screenshot
    ? h(
        'div',
        { display: 'flex', padding: 10, background: '#d4d4d4', border: '4px solid #1f1f1f', marginTop: 8 },
        img(await dataUri(screenshot, { width: 520 }), {
          width: 400,
          height: 300,
          objectFit: 'cover',
          objectPosition: 'top left',
        })
      )
    : sprite
      ? img(await dataUri(sprite, { width: 280, pixel: true }), { width: 280, height: 280, objectFit: 'contain' })
      : null;

  const panel = h(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      width: side ? 700 : 1040,
      padding: '28px 36px 32px',
      background: '#d4d4d4',
      borderTop: '6px solid #ffffff',
      borderLeft: '6px solid #ffffff',
      borderRight: '6px solid #6b6b6b',
      borderBottom: '6px solid #6b6b6b',
      boxShadow: '0 0 0 4px #1f1f1f',
    },
    h(
      'div',
      { display: 'flex', alignItems: 'center', gap: 14 },
      img(logo, { width: 44, height: 44 }),
      h('div', { fontFamily: 'Jersey 15', fontSize: 38, color: '#1b1f23' }, 'Minecraft Server Manager')
    ),
    eyebrow &&
      h(
        'div',
        { display: 'flex', marginTop: 22 },
        h(
          'div',
          {
            fontFamily: 'Jersey 15',
            fontSize: 30,
            color: '#3b2a14',
            background: '#e6d3a3',
            border: '3px solid #7a5230',
            padding: '4px 12px 2px',
          },
          eyebrow
        )
      ),
    h(
      'div',
      { fontFamily: 'Jersey 15', fontSize: titleSize(title), lineHeight: 1, color: '#1b1f23', marginTop: 18 },
      title
    ),
    subtitle &&
      h(
        'div',
        {
          fontFamily: 'IBM Plex Sans',
          fontWeight: 600,
          fontSize: 25,
          lineHeight: 1.4,
          color: '#3e444b',
          marginTop: 18,
          maxHeight: 106,
          overflow: 'hidden',
        },
        subtitle
      )
  );

  const tree = h(
    'div',
    { display: 'flex', flexDirection: 'column', width: W, height: H, background: '#82d2fe' },
    h(
      'div',
      { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: '0 64px' },
      panel,
      side
    ),
    h(
      'div',
      {
        display: 'flex',
        height: GROUND,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: '0 64px 14px',
        backgroundImage: `url(${grass}), url(${dirt})`,
        backgroundRepeat: 'repeat-x, repeat',
        backgroundSize: '48px 48px, 48px 48px',
        backgroundPosition: '0 0, 0 48px',
        borderTop: '4px solid #1f1f1f',
      },
      h(
        'div',
        { fontFamily: 'Jersey 15', fontSize: 34, color: '#ffffff', textShadow: '3px 3px 0 #1f1f1f' },
        'minecraft-server-manager.com'
      )
    )
  );

  const svg = await satori(tree, { width: W, height: H, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
}
