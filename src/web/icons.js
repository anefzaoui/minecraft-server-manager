'use strict';

// Inline SVG icons served from lucide-static (ISC license, self-hosted).
// Loaded from disk once per icon name and cached; the `icon` Handlebars helper
// renders them inline so they inherit currentColor and scale crisply.

const fs = require('node:fs');
const path = require('node:path');

const ICON_DIR = path.join(__dirname, '..', '..', 'node_modules', 'lucide-static', 'icons');
const cache = new Map();

const FALLBACK = 'circle-help';

function load(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(ICON_DIR, `${name}.svg`);
  let svg = null;
  try {
    svg = fs.readFileSync(file, 'utf8');
  } catch {
    if (name !== FALLBACK) {
      console.warn(`[icons] unknown icon "${name}" — using fallback`);
      svg = load(FALLBACK);
    } else {
      svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
    }
  }
  cache.set(name, svg);
  return svg;
}

/**
 * Render an icon with CSS classes applied to the root <svg>.
 * Usage in views: {{{icon 'play' 'size-4'}}}
 */
function icon(name, classes) {
  const cls = typeof classes === 'string' ? classes : 'size-4';
  return load(name).replace('<svg', `<svg class="icon shrink-0 ${cls}" aria-hidden="true" focusable="false"`);
}

module.exports = { icon };
