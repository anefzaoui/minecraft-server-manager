// Purpose-built fallback glyphs for the handful of items that get a bespoke
// treatment instead of their bundled wiki icon. Beds/banners/chests/
// shulker-adjacent blocks are rendered as live 3D models by the game itself,
// and clock/compass are animated overlay items, so these use a hand-drawn
// glyph instead (see scripts/fetch-wiki-icons.js for how the bundled icon
// set is built/refreshed). Bed/banner glyphs still pick up the item's actual
// dye color from its id, which a generic box glyph can't convey.
//
// Paths are lucide-static (ISC), already vetted/bundled in this project - see
// src/web/icons.js for the server-side equivalent of this same icon set.

const DYE_COLORS = {
  white: '#f9fffe',
  orange: '#f9801d',
  magenta: '#c74ebd',
  light_blue: '#3ab3da',
  yellow: '#fed83d',
  lime: '#80c71f',
  pink: '#f38baa',
  gray: '#474f52',
  light_gray: '#9d9d97',
  cyan: '#169c9c',
  purple: '#8932b8',
  blue: '#3c44aa',
  brown: '#835432',
  green: '#5e7c16',
  red: '#b02e26',
  black: '#1d1d21',
};
// Longest-prefix-first so "light_blue_bed" matches "light_blue" before "blue".
const DYE_NAMES = Object.keys(DYE_COLORS).sort((a, b) => b.length - a.length);

function dyeColorOf(name) {
  const hit = DYE_NAMES.find((c) => name.startsWith(`${c}_`));
  return hit ? DYE_COLORS[hit] : null;
}

function svg(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="size-full">${inner}</svg>`;
}

const GENERIC = svg('<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>');

function bedGlyph(color) {
  const wash = color
    ? `<rect x="2" y="9" width="18" height="8" fill="${color}" fill-opacity=".55" stroke="none"/>`
    : '';
  return svg(`${wash}<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>`);
}

function bannerGlyph(color) {
  return svg(
    `<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" ` +
      `fill="${color || 'none'}" fill-opacity="${color ? '.55' : '0'}"/>`
  );
}

const CHEST = svg(
  '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'
);
const SKULL = svg(
  '<path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="12" r="1"/>'
);
const CLOCK = svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>');
const COMPASS = svg(
  '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>'
);
const SHIELD = svg(
  '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
);

/** Inline SVG markup for an item id ("minecraft:red_bed" or "red_bed"). */
export function glyphFor(id) {
  const name = String(id ?? '').replace(/^minecraft:/, '');
  if (name.endsWith('_bed')) return bedGlyph(dyeColorOf(name));
  if (name.endsWith('_banner')) return bannerGlyph(dyeColorOf(name));
  if (name.endsWith('chest')) return CHEST; // chest, ender_chest, trapped_chest, *copper_chest…
  if (name.endsWith('_head') || name.endsWith('_skull')) return SKULL;
  if (name === 'clock') return CLOCK;
  if (name === 'compass' || name === 'recovery_compass') return COMPASS;
  if (name === 'shield') return SHIELD;
  return GENERIC;
}
