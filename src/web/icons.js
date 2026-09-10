'use strict';

// Inline SVG icons served from lucide-static (ISC license, self-hosted).
// Loaded from disk once per icon name and cached; the `icon` Handlebars helper
// renders them inline so they inherit currentColor and scale crisply.

const fs = require('node:fs');
const path = require('node:path');
const logger = require('../logger')(path.basename(__filename));

const ICON_DIR = path.join(__dirname, '..', '..', 'node_modules', 'lucide-static', 'icons');
// Bounded LRU: icon names come from view templates (a small static set), but
// guard the cache against unbounded growth if a future caller ever passes a
// dynamic name. Sync readFileSync stays (the Handlebars helper is sync), but
// the cap keeps both the map and the per-name file reads bounded.
const cache = new Map();
const ICON_CACHE_MAX = 256;

const FALLBACK = 'circle-help';
// lucide filenames are lowercase kebab-case; reject anything path-like or
// otherwise unsafe so an odd name can't read outside the icons dir or grow it.
function safeName(name) {
  return typeof name === 'string' && /^[a-z0-9-]+$/.test(name);
}

function load(name) {
  if (!safeName(name)) return load(FALLBACK);
  if (cache.has(name)) {
    const v = cache.get(name);
    cache.delete(name); // move to most-recently-used
    cache.set(name, v);
    return v;
  }
  const file = path.join(ICON_DIR, `${name}.svg`);
  let svg;
  try {
    svg = fs.readFileSync(file, 'utf8');
  } catch {
    if (name !== FALLBACK) {
      logger.warn('Rendered a fallback for an unknown icon.', { name });
      svg = load(FALLBACK);
    } else {
      logger.error('The fallback icon is missing from lucide-static.', { fallback: FALLBACK });
      svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
    }
  }
  cache.set(name, svg);
  if (cache.size > ICON_CACHE_MAX) cache.delete(cache.keys().next().value);
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
