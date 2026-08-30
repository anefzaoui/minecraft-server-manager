'use strict';

// CurseForge file fingerprints: MurmurHash2 (32-bit, seed 1) over the file's
// bytes with whitespace (0x09 0x0a 0x0d 0x20) removed — the exact variant the
// CurseForge /v1/fingerprints endpoint matches against. Deterministic local
// code on purpose: no external service for mechanical hashing.

const M = 0x5bd1e995;

function mix(k) {
  k = Math.imul(k, M) >>> 0;
  k ^= k >>> 24;
  return Math.imul(k, M) >>> 0;
}

/** MurmurHash2 32-bit over a Buffer. */
function murmur2(buf, seed = 1) {
  const len = buf.length;
  let h = (seed ^ len) >>> 0;
  let i = 0;
  for (; i + 4 <= len; i += 4) {
    const k = buf.readUInt32LE(i);
    h = (Math.imul(h, M) >>> 0) ^ mix(k);
  }
  const rest = len - i;
  if (rest >= 3) h ^= buf[i + 2] << 16;
  if (rest >= 2) h ^= buf[i + 1] << 8;
  if (rest >= 1) {
    h ^= buf[i];
    h = Math.imul(h, M) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, M) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** CurseForge fingerprint of a file's contents. */
function curseforgeFingerprint(buf) {
  // Strip whitespace bytes first (CF normalizes before hashing).
  const filtered = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (const b of buf) {
    if (b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x20) filtered[n++] = b;
  }
  return murmur2(filtered.subarray(0, n), 1);
}

module.exports = { murmur2, curseforgeFingerprint };
