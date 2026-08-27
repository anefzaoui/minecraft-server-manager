'use strict';

// Geometry + export-format helpers behind the profile-picture cropper
// (public/js/lib/imageCrop.js). The browser copy at public/js/lib/cropMath.js
// mirrors this module byte-for-byte; only this CommonJS one is run here.

const test = require('node:test');
const assert = require('node:assert/strict');
const { MIN_CROP_PX, clampBox, resizeBox, pickExport } = require('../src/utils/cropMath');

test('clampBox leaves an already in-bounds box alone', () => {
  assert.deepEqual(clampBox({ x: 10, y: 20, size: 50 }, 200, 200), { x: 10, y: 20, size: 50 });
});

test('clampBox pulls a box back inside when it runs past the right/bottom edge', () => {
  assert.deepEqual(clampBox({ x: 180, y: 190, size: 50 }, 200, 200), { x: 150, y: 150, size: 50 });
});

test('clampBox pushes a box back inside when x/y go negative', () => {
  assert.deepEqual(clampBox({ x: -20, y: -5, size: 50 }, 200, 200), { x: 0, y: 0, size: 50 });
});

test('clampBox shrinks an oversized box to the smaller image dimension', () => {
  assert.deepEqual(clampBox({ x: 0, y: 0, size: 500 }, 200, 300), { x: 0, y: 0, size: 200 });
});

test('clampBox raises a sub-minimum size to MIN_CROP_PX', () => {
  assert.deepEqual(clampBox({ x: 5, y: 5, size: 10 }, 200, 200), { x: 5, y: 5, size: MIN_CROP_PX });
});

test('resizeBox keeps the opposite corner fixed for every handle', () => {
  const box = { x: 100, y: 100, size: 100 }; // corners at (100,100)-(200,200)
  const w = 400;
  const h = 400;

  const br = resizeBox(box, { hx: 1, hy: 1 }, { x: 250, y: 240 }, w, h); // anchor = top-left
  assert.deepEqual({ x: br.x, y: br.y }, { x: 100, y: 100 });

  const tl = resizeBox(box, { hx: 0, hy: 0 }, { x: 60, y: 80 }, w, h); // anchor = bottom-right
  assert.deepEqual({ x: tl.x + tl.size, y: tl.y + tl.size }, { x: 200, y: 200 });

  const tr = resizeBox(box, { hx: 1, hy: 0 }, { x: 260, y: 40 }, w, h); // anchor = bottom-left
  assert.deepEqual({ x: tr.x, y: tr.y + tr.size }, { x: 100, y: 200 });

  const bl = resizeBox(box, { hx: 0, hy: 1 }, { x: 40, y: 250 }, w, h); // anchor = top-right
  assert.deepEqual({ x: bl.x + bl.size, y: bl.y }, { x: 200, y: 100 });
});

test('resizeBox follows the farther pointer axis and stays square', () => {
  const out = resizeBox({ x: 100, y: 100, size: 100 }, { hx: 1, hy: 1 }, { x: 130, y: 190 }, 400, 400);
  assert.equal(out.size, 90); // max(|130-100|, |190-100|)
});

test('resizeBox clamps size inside the image when dragged past an edge', () => {
  const out = resizeBox({ x: 100, y: 100, size: 100 }, { hx: 1, hy: 1 }, { x: 500, y: 500 }, 200, 200);
  assert.deepEqual(out, { x: 100, y: 100, size: 100 }); // anchor (100,100) -> at most 100px of room
});

test('resizeBox clamps to MIN_CROP_PX when dragged inward past it', () => {
  const out = resizeBox({ x: 100, y: 100, size: 100 }, { hx: 1, hy: 1 }, { x: 110, y: 105 }, 400, 400);
  assert.deepEqual(out, { x: 100, y: 100, size: MIN_CROP_PX });
});

test('pickExport keeps a small PNG as PNG', () => {
  assert.deepEqual(pickExport('image/png', 100 * 1024), {
    type: 'image/png',
    quality: undefined,
    filename: 'avatar.png',
  });
});

test('pickExport falls back to JPEG for an oversized PNG', () => {
  assert.deepEqual(pickExport('image/png', 600 * 1024), { type: 'image/jpeg', quality: 0.9, filename: 'avatar.jpg' });
});

test('pickExport always uses JPEG for a JPEG (or rasterized-SVG) source', () => {
  assert.deepEqual(pickExport('image/jpeg', null), { type: 'image/jpeg', quality: 0.9, filename: 'avatar.jpg' });
});

test('pickExport defaults to JPEG when the PNG size is unknown', () => {
  assert.equal(pickExport('image/png', null).type, 'image/jpeg');
});
