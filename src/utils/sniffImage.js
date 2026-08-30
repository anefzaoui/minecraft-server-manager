'use strict';

const fsp = require('node:fs/promises');

// Enough to see past a BOM/XML prolog/leading comments before an <svg> root.
const SNIFF_BYTES = 512;

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Confirms an uploaded file's actual bytes match its claimed image mimetype,
 * instead of trusting multer's client-supplied Content-Type verbatim (icon
 * and avatar uploads pick their stored extension from that header). Returns
 * false for any read error or unrecognized mimetype - never throws.
 */
async function matchesImageType(filePath, mimetype) {
  let head;
  try {
    const fh = await fsp.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(SNIFF_BYTES);
      const { bytesRead } = await fh.read(buf, 0, SNIFF_BYTES, 0);
      head = buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }

  if (mimetype === 'image/png') return head.subarray(0, PNG_SIG.length).equals(PNG_SIG);
  if (mimetype === 'image/jpeg') return head.subarray(0, JPEG_SIG.length).equals(JPEG_SIG);
  if (mimetype === 'image/svg+xml') return /<svg[\s>]/i.test(head.toString('utf8'));
  return false;
}

module.exports = { matchesImageType };
