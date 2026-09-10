'use strict';

// Byte-level upload guards shared by the avatar and server-icon routes:
// magic-number sniffing, header-only dimension reads (decompression-bomb gate),
// and the defence-in-depth SVG scrub.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { matchesImageType, imageDimensions } = require('../src/utils/sniffImage');
const { sanitizeSvg } = require('../src/utils/svgSanitize');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sniff-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function fixture(name, bytes) {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, bytes);
  return p;
}

// 1x1 rasters.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64'
);
const JPEG_1x1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8AH//Z',
  'base64'
);
const WEBP_1x1 = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');

const PNG_HUGE = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d]),
  Buffer.from('IHDR'),
  Buffer.from([0x00, 0x00, 0x9c, 0x40]), // 40000
  Buffer.from([0x00, 0x01, 0x86, 0xa0]), // 100000
  Buffer.from([0x08, 0x06, 0x00, 0x00, 0x00, 0, 0, 0, 0]),
]);

test('matchesImageType accepts each real type and rejects a wrong claim', async () => {
  assert.equal(await matchesImageType(fixture('a.png', PNG_1x1), 'image/png'), true);
  assert.equal(await matchesImageType(fixture('a.jpg', JPEG_1x1), 'image/jpeg'), true);
  assert.equal(await matchesImageType(fixture('a.webp', WEBP_1x1), 'image/webp'), true);
  assert.equal(await matchesImageType(fixture('a.svg', Buffer.from('<svg xmlns="..."></svg>')), 'image/svg+xml'), true);

  assert.equal(await matchesImageType(fixture('b.png', JPEG_1x1), 'image/png'), false);
  assert.equal(await matchesImageType(fixture('b.webp', PNG_1x1), 'image/webp'), false);
  assert.equal(await matchesImageType(fixture('b.txt', Buffer.from('nope')), 'image/png'), false);
});

test('imageDimensions reads a PNG IHDR', async () => {
  assert.deepEqual(await imageDimensions(fixture('h.png', PNG_HUGE), 'image/png'), { width: 40000, height: 100000 });
});

test('imageDimensions reads small JPEG and WebP without a decode', async () => {
  const j = await imageDimensions(fixture('d.jpg', JPEG_1x1), 'image/jpeg');
  assert.deepEqual(j, { width: 1, height: 1 });
  const w = await imageDimensions(fixture('d.webp', WEBP_1x1), 'image/webp');
  assert.deepEqual(w, { width: 1, height: 1 });
});

test('imageDimensions returns null for SVG (vector - no bomb to gate)', async () => {
  assert.equal(
    await imageDimensions(fixture('v.svg', Buffer.from('<svg width="10" height="10"/>')), 'image/svg+xml'),
    null
  );
});

test('sanitizeSvg strips scripting and event handlers but keeps drawing markup', () => {
  const dirty =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
    '<script>alert(1)</script>' +
    '<rect width="10" height="10" fill="#f00" onload="alert(2)"/>' +
    '<a href="javascript:alert(3)"><circle cx="5" cy="5" r="4"/></a>' +
    '</svg>';
  const clean = sanitizeSvg(dirty);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onload/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.match(clean, /<rect/i);
  assert.match(clean, /<circle/i);
});
