'use strict';

// "Shrink world": delete region chunks that almost nobody has visited
// (InhabitedTime below a threshold - 600 ticks / 30 s by default) and repack
// each region file so it actually gets smaller on disk. Minecraft regenerates a
// removed chunk from the seed the next time someone goes there.
//
// Safety rails:
//   - the server MUST be stopped (we edit region files directly); a dry run
//     only reads, so it is allowed while the server is up;
//   - overworld chunks within 8 chunks of the world spawn (read from level.dat,
//     falling back to the origin) are always kept;
//   - a chunk whose InhabitedTime can't be read (unsupported compression such as
//     LZ4, a truncated payload, an external .mcc sidecar) is always kept and
//     counted so the result can say so;
//   - the matching slots in the dimension's entities/ and poi/ region files are
//     dropped together with the chunk, so a regenerated chunk does not inherit
//     stale mobs, item frames, or villager point-of-interest records;
//   - every dimension of the world is covered: Bukkit-style sibling dirs
//     (world_nether, world_the_end) AND the vanilla/Forge/Fabric layout
//     (world/DIM-1, world/DIM1, world/dimensions/<ns>/<name>);
//   - the Worlds UI tells the user to back up first and the backup integration
//     only shrinks after the archive is written - that backup is the undo.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');
const { inspectStatus } = require('../docker/containers');
const { withSaveLock } = require('./serverLocks');
const { guardOp } = require('./opLock');
const { serverWorldDims, activeLevelName, isDimName, readLevelSpawn } = require('./worlds');
const { parseHeader, chunkInhabitedTime, repack } = require('../utils/mcaRegion');
const db = require('../db');

const REGION_RE = /^r\.(-?\d+)\.(-?\d+)\.mca$/;
const SPAWN_KEEP_CHUNKS = 8; // default: overworld chunks within this many of the spawn chunk are kept
// Sibling per-chunk stores that share the region grid (same r.x.z / slot layout).
const COMPANION_DIRS = ['entities', 'poi'];
const DEFAULT_MIN_INHABITED_TICKS = 600; // 30 s at 20 tps

function humanBytes(n) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

function mustServer(serverId) {
  const row = db.get('SELECT id, display_name, env_json FROM servers WHERE id = ? AND deleted_at IS NULL', serverId);
  if (!row) throw httpError(404, 'Server not found');
  let env = {};
  try {
    env = JSON.parse(row.env_json || '{}');
  } catch {
    /* leave empty */
  }
  return { id: row.id, display_name: row.display_name, env };
}

async function assertStopped(serverId) {
  let info;
  try {
    info = await inspectStatus(serverId);
  } catch {
    return; // no container - definitely not running
  }
  if (info.exists === false) return;
  if (!['stopped', 'crashed'].includes(info.status)) {
    throw httpError(409, 'Stop the server before shrinking its world. Shrinking edits the world files directly.');
  }
}

/** TRUE when the container is up in a state that would be writing to the world. */
async function isLive(serverId) {
  const LIVE = new Set(['running', 'starting', 'unhealthy', 'stalled', 'updating']);
  let info;
  try {
    info = await inspectStatus(serverId);
  } catch {
    return false;
  }
  return Boolean(info.exists) && LIVE.has(info.status);
}

/**
 * Every directory of `worldName` that holds region files, tagged with whether
 * it is the overworld (the only dimension with spawn protection):
 *   - the world dir itself (unless the caller pointed at a *_nether/_the_end);
 *   - Bukkit-style siblings (world_nether, world_the_end);
 *   - vanilla/Forge/Fabric sub-dimensions (DIM-1, DIM1, dimensions/<ns>/<name>).
 */
function discoverDimensions(serverId, worldName) {
  const dims = [];
  const seen = new Set();
  const push = (dir, isOverworld) => {
    if (seen.has(dir)) return;
    seen.add(dir);
    dims.push({ dir, isOverworld });
  };
  const siblings = serverWorldDims(serverId, worldName);
  const main = siblings[0];
  push(main, !isDimName(worldName));
  for (const sibling of siblings.slice(1)) push(sibling, false);
  for (const sub of ['DIM-1', 'DIM1']) {
    const dir = path.join(main, sub);
    if (fs.existsSync(path.join(dir, 'region'))) push(dir, false);
  }
  const custom = path.join(main, 'dimensions');
  let namespaces = [];
  try {
    namespaces = fs.readdirSync(custom, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    /* no custom dimensions */
  }
  for (const ns of namespaces) {
    let names;
    try {
      names = fs.readdirSync(path.join(custom, ns.name), { withFileTypes: true }).filter((e) => e.isDirectory());
    } catch {
      continue;
    }
    for (const n of names) {
      const dir = path.join(custom, ns.name, n.name);
      if (fs.existsSync(path.join(dir, 'region'))) push(dir, false);
    }
  }
  return dims;
}

/** Spawn chunk from level.dat (block coords >> 4); the origin when unreadable. */
function spawnChunk(mainDir) {
  const spawn = readLevelSpawn(path.join(mainDir, 'level.dat'));
  if (!spawn) return { cx: 0, cz: 0, source: 'origin' };
  return { cx: spawn.x >> 4, cz: spawn.z >> 4, source: 'level.dat' };
}

/** Rewrite (or delete) one region-format file keeping only `keep(index)` slots. */
async function repackFile(abs, keep, dryRun) {
  let buf;
  try {
    buf = await fsp.readFile(abs);
  } catch {
    return { bytesBefore: 0, bytesAfter: 0, removed: 0 };
  }
  const packed = repack(buf, keep);
  if (!packed) return { bytesBefore: buf.length, bytesAfter: buf.length, removed: 0 };
  const bytesAfter = packed.kept === 0 ? 0 : packed.buffer.length;
  if (!dryRun) {
    if (packed.kept === 0) {
      await fsp.rm(abs, { force: true });
    } else {
      // Temp file + rename: the file is either the old one or the new one,
      // never a partial write, even if the panel dies mid-way.
      const tmp = `${abs}.tmp`;
      await fsp.writeFile(tmp, packed.buffer);
      await fsp.rename(tmp, abs);
    }
  }
  return { bytesBefore: buf.length, bytesAfter, removed: packed.dropped };
}

async function shrinkRegionFile(
  regionDir,
  file,
  { rx, rz, isOverworld, spawn, minInhabitedTicks, spawnKeepChunks, dryRun }
) {
  const abs = path.join(regionDir, file);
  const buf = await fsp.readFile(abs);
  const entries = parseHeader(buf);
  const drop = new Set();
  let unreadable = 0;
  for (const e of entries) {
    if (isOverworld && spawnKeepChunks > 0) {
      const cx = rx * 32 + e.x;
      const cz = rz * 32 + e.z;
      if (Math.abs(cx - spawn.cx) <= spawnKeepChunks && Math.abs(cz - spawn.cz) <= spawnKeepChunks) continue;
    }
    const ticks = await chunkInhabitedTime(buf, e);
    if (ticks == null) {
      unreadable++;
      continue;
    }
    if (ticks < minInhabitedTicks) drop.add(e.index);
  }

  const result = {
    chunksScanned: entries.length,
    chunksRemoved: 0,
    chunksUnreadable: unreadable,
    bytesBefore: buf.length,
    bytesAfter: buf.length,
  };
  if (!drop.size) return result;

  const keep = (idx) => !drop.has(idx);
  const region = await repackFile(abs, keep, dryRun);
  if (!region.removed) return result;
  result.chunksRemoved = region.removed;
  result.bytesAfter = region.bytesAfter;

  // The dropped slots' entities and points of interest go with them: a chunk
  // Minecraft regenerates from the seed must not be repopulated with the old
  // chunk's mobs, minecarts, item frames, or villager job sites.
  for (const companion of COMPANION_DIRS) {
    const sibling = path.join(path.dirname(regionDir), companion, file);
    if (!fs.existsSync(sibling)) continue;
    const r = await repackFile(sibling, keep, dryRun);
    result.bytesBefore += r.bytesBefore;
    result.bytesAfter += r.bytesAfter;
  }
  return result;
}

/**
 * @param {string} serverId
 * @param {object} [opts]
 * @param {string} [opts.worldName]        defaults to the active world
 * @param {number} [opts.minInhabitedTicks] keep chunks at or above this (default 600 = 30 s)
 * @param {number} [opts.spawnKeepChunks]  always keep overworld chunks within this many of the spawn chunk (default 8; 0 = don't protect spawn)
 * @param {boolean} [opts.dryRun]          measure only, change nothing
 * @param {string} [opts.actor]
 * @returns {Promise<{worldName,dimensions,regionsScanned,chunksScanned,chunksRemoved,chunksUnreadable,bytesFreed,dryRun,minInhabitedTicks,spawnKeepChunks,spawn}>}
 */
async function shrinkWorldImpl(serverId, opts = {}) {
  const server = mustServer(serverId);
  const minInhabitedTicks =
    Number.isFinite(opts.minInhabitedTicks) && opts.minInhabitedTicks > 0
      ? Math.min(Math.round(opts.minInhabitedTicks), 20 * 60 * 60) // cap at 1 game-hour
      : DEFAULT_MIN_INHABITED_TICKS;
  const spawnKeepChunks = Number.isFinite(opts.spawnKeepChunks)
    ? Math.max(0, Math.min(Math.round(opts.spawnKeepChunks), 256))
    : SPAWN_KEEP_CHUNKS;
  const dryRun = Boolean(opts.dryRun);
  const actor = opts.actor || 'system';
  const worldName = opts.worldName || activeLevelName(server);

  // A dry run only reads region files, so it is allowed while the server is
  // up (that is what the Preview button promises). A chunk the JVM happens to
  // be rewriting at that instant just counts as unreadable in the estimate.
  if (!dryRun) await assertStopped(serverId);

  const dims = discoverDimensions(serverId, worldName);
  if (!dims.length || !fs.existsSync(dims[0].dir)) throw httpError(404, `No world named "${worldName}" on this server`);
  const spawn = spawnChunk(dims[0].dir);

  const run = async () => {
    // Re-check inside the critical section: shrink edits region files directly,
    // and a start racing between the fast-fail above and the file mutations is
    // exactly how a live world gets torn. With guardOp('shrink') in flight no
    // start/stop/restore/backup can interleave here either.
    if (!dryRun) await assertStopped(serverId);
    let regionsScanned = 0;
    let chunksScanned = 0;
    let chunksRemoved = 0;
    let chunksUnreadable = 0;
    let bytesFreed = 0;
    const dimensions = [];

    for (const { dir, isOverworld } of dims) {
      const regionDir = path.join(dir, 'region');
      let files;
      try {
        files = (await fsp.readdir(regionDir)).filter((f) => REGION_RE.test(f));
      } catch {
        continue; // dimension has no region folder
      }
      dimensions.push(path.relative(dims[0].dir, dir) || '.');
      for (const file of files) {
        const [, rxs, rzs] = REGION_RE.exec(file);
        regionsScanned++;
        const r = await shrinkRegionFile(regionDir, file, {
          rx: Number(rxs),
          rz: Number(rzs),
          isOverworld,
          spawn,
          minInhabitedTicks,
          spawnKeepChunks,
          dryRun,
        });
        chunksScanned += r.chunksScanned;
        chunksRemoved += r.chunksRemoved;
        chunksUnreadable += r.chunksUnreadable;
        bytesFreed += Math.max(0, r.bytesBefore - r.bytesAfter);
      }
    }

    if (!dryRun && chunksRemoved > 0) {
      recordEvent({
        serverId,
        actor,
        type: 'world-shrunk',
        summary: `Shrank "${worldName}": removed ${chunksRemoved} rarely-visited chunk(s), freed ${humanBytes(bytesFreed)}.`,
        details: {
          worldName,
          dimensions,
          chunksRemoved,
          chunksUnreadable,
          regionsScanned,
          chunksScanned,
          bytesFreed,
          minInhabitedTicks,
          spawnKeepChunks,
          spawn,
        },
      });
    }
    return {
      worldName,
      dimensions,
      regionsScanned,
      chunksScanned,
      chunksRemoved,
      chunksUnreadable,
      bytesFreed,
      dryRun,
      minInhabitedTicks,
      spawnKeepChunks,
      spawn,
    };
  };

  // Serialize against backup / world export even though the server is stopped.
  return dryRun ? run() : withSaveLock(serverId, run);
}

// The operation guard serializes shrink against container lifecycle (start/stop),
// restore, install, rename, backup, … so the region repack can never overlap a
// boot. The withSaveLock mutex additionally keeps it out of a concurrent
// save-off/copy/save-on section (backup copy / world export) on the same server.
const shrinkWorld = guardOp('shrink', shrinkWorldImpl);

module.exports = { shrinkWorld, shrinkWorldImpl, isLive };
