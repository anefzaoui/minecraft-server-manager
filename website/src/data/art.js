// Generated illustrations (scripts/gen-images.js) keyed by id, resolved through
// Astro's image pipeline. `art('card-wand')` returns the image metadata or
// undefined, so a page can render without a picture that has not been generated.
const files = /** @type {Record<string, ImageMetadata>} */ (
  import.meta.glob('../assets/gen/*.webp', { eager: true, import: 'default' })
);

/**
 * @param {string} id
 * @returns {ImageMetadata | undefined}
 */
export function art(id) {
  const entry = Object.entries(files).find(([p]) => p.endsWith(`/${id}.webp`));
  return entry ? entry[1] : undefined;
}

/**
 * Card illustration for a feature by its icon key.
 * @param {string} icon
 * @returns {ImageMetadata | undefined}
 */
export function cardFor(icon) {
  return art(`card-${icon}`);
}
