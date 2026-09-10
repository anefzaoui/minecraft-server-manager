'use strict';

const fsp = require('node:fs/promises');

// Enough to see past a BOM/XML prolog/leading comments before an <svg> root, and
// to cover a PNG/WEBP header. JPEG needs a wider window (see readHead below) - its
// size marker can sit well past the file start.
const SNIFF_BYTES = 512;
const DIMENSION_SCAN_BYTES = 128 * 1024;

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF_SIG = Buffer.from('RIFF', 'ascii');
const WEBP_SIG = Buffer.from('WEBP', 'ascii');

async function readHead(filePath, byteCount) {
  const fh = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(byteCount);
    const { bytesRead } = await fh.read(buf, 0, byteCount, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

function isWebp(head) {
  return head.length >= 12 && head.subarray(0, 4).equals(RIFF_SIG) && head.subarray(8, 12).equals(WEBP_SIG);
}

/**
 * Confirms an uploaded file's actual bytes match its claimed image mimetype,
 * instead of trusting multer's client-supplied Content-Type verbatim (icon
 * and avatar uploads pick their stored extension from that header). Returns
 * false for any read error or unrecognized mimetype - never throws.
 */
async function matchesImageType(filePath, mimetype) {
  let head;
  try {
    head = await readHead(filePath, SNIFF_BYTES);
  } catch {
    return false;
  }

  if (mimetype === 'image/png') return head.subarray(0, PNG_SIG.length).equals(PNG_SIG);
  if (mimetype === 'image/jpeg') return head.subarray(0, JPEG_SIG.length).equals(JPEG_SIG);
  if (mimetype === 'image/webp') return isWebp(head);
  if (mimetype === 'image/svg+xml') return /<svg[\s>]/i.test(head.toString('utf8'));
  return false;
}

function pngDimensions(buf) {
  // 8-byte signature, then the IHDR chunk: 4-byte length, "IHDR", width, height.
  if (buf.length < 24) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegDimensions(buf) {
  // Walk the marker segments looking for a Start-Of-Frame (SOF0-3/5-7/9-11).
  let off = 2; // past FF D8
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) {
      off++;
      continue;
    }
    let marker = buf[off + 1];
    // Skip fill bytes (a run of 0xFF).
    while (marker === 0xff && off + 1 < buf.length) {
      off++;
      marker = buf[off + 1];
    }
    off += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue; // no length
    if (off + 2 > buf.length) return null;
    const segLen = buf.readUInt16BE(off);
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      if (off + 7 > buf.length) return null;
      return { height: buf.readUInt16BE(off + 3), width: buf.readUInt16BE(off + 5) };
    }
    off += segLen;
  }
  return null;
}

function webpDimensions(buf) {
  if (!isWebp(buf) || buf.length < 30) return null;
  const fourcc = buf.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    // 24-bit little-endian (value + 1) for each axis.
    const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
    const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
    return { width, height };
  }
  if (fourcc === 'VP8 ') {
    // Lossy: 3-byte frame tag, then the 0x9d 0x01 0x2a start code, then 14-bit LE dims.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  if (fourcc === 'VP8L') {
    // Lossless: 0x2f signature byte, then 14-bit (value - 1) fields packed LE.
    if (buf[20] !== 0x2f) return null;
    const b = buf;
    const width = 1 + (((b[22] & 0x3f) << 8) | b[21]);
    const height = 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6));
    return { width, height };
  }
  return null;
}

/**
 * Best-effort pixel dimensions of a raster upload, read from the file header
 * only (no decode - so a decompression bomb can be rejected before anything
 * tries to render it). Returns { width, height } or null when unknown; SVG is
 * vector and always returns null (callers skip the dimension gate for it).
 */
async function imageDimensions(filePath, mimetype) {
  if (mimetype === 'image/svg+xml') return null;
  let buf;
  try {
    buf = await readHead(filePath, DIMENSION_SCAN_BYTES);
  } catch {
    return null;
  }
  if (mimetype === 'image/png') return pngDimensions(buf);
  if (mimetype === 'image/jpeg') return jpegDimensions(buf);
  if (mimetype === 'image/webp') return webpDimensions(buf);
  return null;
}

module.exports = { matchesImageType, imageDimensions };
