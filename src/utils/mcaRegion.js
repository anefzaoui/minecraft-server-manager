'use strict';

// Minimal Anvil region (.mca) reader/repacker - just enough to find chunks that
// almost nobody has visited (low InhabitedTime) and rewrite the file without
// them. The format has been stable since 2012:
//
//   bytes 0..4095      1024 location entries, 4 bytes each:
//                      3-byte big-endian sector offset + 1-byte sector count.
//                      offset 0 (and count 0) => chunk not present.
//   bytes 4096..8191   1024 timestamp entries, 4 bytes each.
//   from byte 8192     4 KiB sectors. A chunk payload is:
//                      4-byte big-endian length, 1-byte compression type,
//                      then (length - 1) bytes of compressed chunk NBT.
//                      type 1 = gzip, 2 = zlib, 3 = none; the 0x80 bit means
//                      the payload lives in an external .mcc file.
//
// NBT decoding uses prismarine-nbt (already a dependency). InhabitedTime is a
// top-level Long on 1.18+ worlds and Level.InhabitedTime on older ones.

const zlib = require('node:zlib');
const { promisify } = require('node:util');
const nbt = require('prismarine-nbt');

const SECTOR = 4096;
const ENTRIES = 1024;

// Cap the decompressed size of a single chunk. A real Minecraft chunk NBT never
// approaches this (a max-height full chunk serializes to well under a few MB),
// but a crafted region file could declare a tiny payload that inflates to a huge
// buffer (a decompression bomb) and exhaust memory while shrinking a world. This
// is the node:zlib output ceiling, honored by gunzip/inflate before allocating.
const MAX_CHUNK_OUTPUT_BYTES = 64 * 1024 * 1024;

// Async zlib (callback API runs on the libuv threadpool) so decompressing one
// chunk never stalls the event loop; world-shrink walks many regions in a row,
// and chunkInhabitedTime already awaits nbt.parse.
const inflateAsync = promisify(zlib.inflate);
const gunzipAsync = promisify(zlib.gunzip);

async function inflateChunk(payload, compressionType) {
  const type = compressionType & 0x7f;
  if (type === 1) return gunzipAsync(payload, { maxOutputLength: MAX_CHUNK_OUTPUT_BYTES });
  if (type === 2) return inflateAsync(payload, { maxOutputLength: MAX_CHUNK_OUTPUT_BYTES });
  if (type === 3) return payload;
  throw new Error(`unknown chunk compression type ${compressionType}`);
}

function readInhabitedTime(simplified) {
  if (!simplified || typeof simplified !== 'object') return null;
  const direct = simplified.InhabitedTime;
  const nested = simplified.Level && simplified.Level.InhabitedTime;
  const v = direct != null ? direct : nested;
  if (v == null) return null;
  // prismarine-nbt simplify() returns a Long as [high, low] (two int32 words),
  // or a plain number. NOT [low, high] - a real InhabitedTime of 5000 comes back
  // as [0, 5000], so the old [low, high] read reported 5000 * 2^32 and no
  // visited chunk ever fell under the threshold.
  if (Array.isArray(v)) {
    const [high, low] = v;
    return (high >>> 0) * 4294967296 + (low >>> 0);
  }
  return Number(v);
}

/**
 * Parse the 8 KiB header. Returns one entry per present chunk:
 *   { index, x, z, sectorOffset, sectorCount, timestamp, external }
 * `index` is the 0..1023 header slot; x/z are chunk coords within the region.
 */
function parseHeader(buf) {
  if (buf.length < SECTOR * 2) return [];
  const out = [];
  for (let i = 0; i < ENTRIES; i++) {
    const loc = buf.readUInt32BE(i * 4);
    const sectorOffset = loc >>> 8;
    const sectorCount = loc & 0xff;
    if (sectorOffset === 0 || sectorCount === 0) continue;
    const payloadStart = sectorOffset * SECTOR;
    let external = false;
    if (payloadStart + 5 <= buf.length) {
      const compType = buf.readUInt8(payloadStart + 4);
      external = Boolean(compType & 0x80);
    }
    out.push({
      index: i,
      x: i % 32,
      z: Math.floor(i / 32),
      sectorOffset,
      sectorCount,
      timestamp: buf.readUInt32BE(SECTOR + i * 4),
      external,
    });
  }
  return out;
}

/** Decompress + NBT-decode one chunk's payload; returns its InhabitedTime in
 *  ticks, or null when it can't be read (treat those as "keep"). */
async function chunkInhabitedTime(buf, entry) {
  if (entry.external) return null; // .mcc sidecar - out of scope, never drop
  const start = entry.sectorOffset * SECTOR;
  if (start + 5 > buf.length) return null;
  const length = buf.readUInt32BE(start);
  if (length <= 1 || start + 4 + length > buf.length) return null;
  const compType = buf.readUInt8(start + 4);
  const payload = buf.subarray(start + 5, start + 4 + length);
  try {
    const raw = await inflateChunk(payload, compType);
    const { parsed } = await nbt.parse(raw);
    return readInhabitedTime(nbt.simplify(parsed));
  } catch {
    return null;
  }
}

/**
 * Rebuild a region buffer keeping only the header slots for which
 * keep(index) is true, repacking their sectors contiguously so the file
 * actually shrinks. Returns { buffer, kept, dropped } or null when nothing
 * would be dropped.
 */
function repack(buf, keep) {
  const entries = parseHeader(buf);
  const keptEntries = entries.filter((e) => keep(e.index));
  if (keptEntries.length === entries.length) return null;

  const header = Buffer.alloc(SECTOR * 2);
  const sectors = [];
  let nextSector = 2; // sectors 0 and 1 are the header

  for (const e of keptEntries) {
    const src = buf.subarray(e.sectorOffset * SECTOR, (e.sectorOffset + e.sectorCount) * SECTOR);
    const padded = Buffer.alloc(e.sectorCount * SECTOR);
    src.copy(padded);
    sectors.push(padded);
    const loc = (nextSector << 8) | (e.sectorCount & 0xff);
    header.writeUInt32BE(loc >>> 0, e.index * 4);
    header.writeUInt32BE(e.timestamp >>> 0, SECTOR + e.index * 4);
    nextSector += e.sectorCount;
  }

  return {
    buffer: Buffer.concat([header, ...sectors]),
    kept: keptEntries.length,
    dropped: entries.length - keptEntries.length,
  };
}

module.exports = { parseHeader, chunkInhabitedTime, repack, SECTOR };
