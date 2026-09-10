'use strict';

// Geometry + export-format helpers for the client-side profile-picture cropper
// (public/js/lib/imageCrop.js). Kept here, framework-free and pure, so the same
// logic runs under node:test. The browser copy in public/js/lib/cropMath.js has
// an identical function body (only the module syntax differs); test/cropMath
// runs the same cases through both and fails on drift. All coordinates are in
// image-display pixels (the on-screen <img> size), never natural pixels.

const MIN_CROP_PX = 40; // smallest selectable square, in image-display px
const OUTPUT_MAX_PX = 2048; // avatar canvas cap (square edge)
const PNG_KEEP_MAX = 4 * 1024 * 1024; // a PNG export above this falls back to JPEG (server cap is 16 MB)

/**
 * Clamp a square box so it sits fully inside a w x h area, preserving its size
 * where possible (shrinking only when the box is larger than the area itself).
 */
function clampBox(box, w, h) {
  // Never larger than the area; MIN_CROP_PX is a floor only while the area has
  // room for it - a sub-40px display area gets a sub-40px box, not a 40px box
  // hanging off the edge with negative x/y.
  const size = Math.min(Math.max(box.size, MIN_CROP_PX), w, h);
  const x = Math.max(0, Math.min(box.x, w - size));
  const y = Math.max(0, Math.min(box.y, h - size));
  return { x, y, size };
}

/**
 * Resize a box during a corner drag. `handle` is { hx, hy } where 1 means the
 * right / bottom edge is the one being dragged (0 = left / top); the
 * diagonally-opposite corner is the fixed anchor. `pointer` is the cursor
 * position in image-display px. The result stays square, inside the w x h
 * bounds, and never smaller than MIN_CROP_PX.
 *
 * The anchor is a corner of an already in-bounds box whose size is >=
 * MIN_CROP_PX, so the room in the grow direction (maxX / maxY) is always >=
 * MIN_CROP_PX and the final clamp can never push the box outside the image.
 */
function resizeBox(box, handle, pointer, w, h) {
  const anchorX = handle.hx ? box.x : box.x + box.size;
  const anchorY = handle.hy ? box.y : box.y + box.size;
  const px = Math.min(Math.max(pointer.x, 0), w);
  const py = Math.min(Math.max(pointer.y, 0), h);
  const sx = handle.hx ? 1 : -1; // grow direction from anchor towards the dragged handle
  const sy = handle.hy ? 1 : -1;
  let side = Math.max(Math.abs(px - anchorX), Math.abs(py - anchorY)); // follow the farther axis
  const maxX = sx > 0 ? w - anchorX : anchorX; // room before hitting an edge
  const maxY = sy > 0 ? h - anchorY : anchorY;
  // MIN_CROP_PX is a floor, but the room-to-the-edge clamp always wins so x/y
  // below can't go negative when the image is smaller than MIN_CROP_PX.
  side = Math.max(0, Math.min(Math.max(side, MIN_CROP_PX), maxX, maxY));
  const x = sx > 0 ? anchorX : anchorX - side;
  const y = sy > 0 ? anchorY : anchorY - side;
  return { x, y, size: side };
}

/**
 * Decide the export encoding for the cropped square. A small PNG source stays
 * PNG (keeps transparency); a PNG that encodes larger than PNG_KEEP_MAX, and
 * every non-PNG source (JPEG, or an SVG we rasterized), becomes JPEG so the
 * result comfortably clears the server's 512 KB cap.
 */
function pickExport(sourceType, pngByteLength) {
  if (sourceType === 'image/png' && pngByteLength != null && pngByteLength <= PNG_KEEP_MAX) {
    return { type: 'image/png', quality: undefined, filename: 'avatar.png' };
  }
  return { type: 'image/jpeg', quality: 0.9, filename: 'avatar.jpg' };
}

module.exports = { MIN_CROP_PX, OUTPUT_MAX_PX, PNG_KEEP_MAX, clampBox, resizeBox, pickExport };
