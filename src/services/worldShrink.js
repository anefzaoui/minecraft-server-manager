'use strict';

// "Shrink world": delete region chunks that almost nobody has visited
// (InhabitedTime below a threshold - 600 ticks / 30 s by default) and repack
// each region file so it actually gets smaller on disk. Minecraft regenerates a
// removed chunk from the seed the next time someone goes there.
//
// Safety rails:
//   - the server MUST be stopped (we edit region files directly);
//   - overworld chunks within 8 of the world origin are always kept (default
//     spawn area);
//   - a chunk whose InhabitedTime can't be read is always kept;
//   - callers are expected to take a backup first (the Worlds UI and the
//     backup integration both do) - that backup is the undo.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');
const { inspectStatus } = require('../docker/containers');
const { withSaveLock } = require('./serverLocks');
const { guardOp } = require('./opLock');
const { serverWorldDims, activeLevelName } = require('./worlds');
const { parseHeader, chunkInhabitedTime, repack } = require('../utils/mcaRegion');
const db = require('../db');

const REGION_RE = /^r\.(-?\d+)\.(-?\d+)\.mca$/;
const SPAWN_KEEP_CHUNKS = 8; // default |chunkX|,|chunkZ| <= this in the overworld
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

async function shrinkRegionFile(abs, { rx, rz, isOverworld, minInhabitedTicks, spawnKeepChunks, dryRun }) {
  const buf = await fsp.readFile(abs);
  const entries = parseHeader(buf);
  const drop = new Set();
  for (const e of entries) {
    if (isOverworld && spawnKeepChunks > 0) {
      const cx = rx * 32 + e.x;
      const cz = rz * 32 + e.z;
      if (Math.abs(cx) <= spawnKeepChunks && Math.abs(cz) <= spawnKeepChunks) continue;
    }
    const ticks = await chunkInhabitedTime(buf, e);
    if (ticks != null && ticks < minInhabitedTicks) drop.add(e.index);
  }

  const result = { chunksScanned: entries.length, chunksRemoved: 0, bytesBefore: buf.length, bytesAfter: buf.length };
  if (!drop.size) return result;

  const packed = repack(buf, (idx) => !drop.has(idx));
  if (!packed) return result;
  result.chunksRemoved = packed.dropped;

  if (dryRun) {
    result.bytesAfter = packed.kept === 0 ? 0 : packed.buffer.length;
    return result;
  }
  if (packed.kept === 0) {
    await fsp.rm(abs, { force: true });
    result.bytesAfter = 0;
  } else {
    const tmp = `${abs}.tmp`;
    await fsp.writeFile(tmp, packed.buffer);
    await fsp.rename(tmp, abs);
    result.bytesAfter = packed.buffer.length;
  }
  return result;
}

/**
 * @param {string} serverId
 * @param {object} [opts]
 * @param {string} [opts.worldName]        defaults to the active world
 * @param {number} [opts.minInhabitedTicks] keep chunks at or above this (default 600 = 30 s)
 * @param {number} [opts.spawnKeepChunks]  always keep overworld chunks within this many of the origin (default 8; 0 = don't protect spawn)
 * @param {boolean} [opts.dryRun]          measure only, change nothing
 * @param {string} [opts.actor]
 * @returns {Promise<{worldName,regionsScanned,chunksScanned,chunksRemoved,bytesFreed,dryRun,minInhabitedTicks,spawnKeepChunks}>}
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

  await assertStopped(serverId);

  const dims = serverWorldDims(serverId, worldName);
  if (!dims.length || !fs.existsSync(dims[0])) throw httpError(404, `No world named "${worldName}" on this server`);

  const run = async () => {
    // Re-check inside the critical section: shrink edits region files directly,
    // and a start racing between the fast-fail above and the file mutations is
    // exactly how a live world gets torn. With guardOp('shrink') in flight no
    // start/stop/restore/backup can interleave here either.
    await assertStopped(serverId);
    let regionsScanned = 0;
    let chunksScanned = 0;
    let chunksRemoved = 0;
    let bytesFreed = 0;

    for (let di = 0; di < dims.length; di++) {
      const isOverworld = di === 0;
      const regionDir = path.join(dims[di], 'region');
      let files;
      try {
        files = (await fsp.readdir(regionDir)).filter((f) => REGION_RE.test(f));
      } catch {
        continue; // dimension has no region folder
      }
      for (const file of files) {
        const [, rxs, rzs] = REGION_RE.exec(file);
        regionsScanned++;
        const r = await shrinkRegionFile(path.join(regionDir, file), {
          rx: Number(rxs),
          rz: Number(rzs),
          isOverworld,
          minInhabitedTicks,
          spawnKeepChunks,
          dryRun,
        });
        chunksScanned += r.chunksScanned;
        chunksRemoved += r.chunksRemoved;
        bytesFreed += Math.max(0, r.bytesBefore - r.bytesAfter);
      }
    }

    if (!dryRun && chunksRemoved > 0) {
      recordEvent({
        serverId,
        actor,
        type: 'world-shrunk',
        summary: `Shrank "${worldName}": removed ${chunksRemoved} rarely-visited chunk(s), freed ${humanBytes(bytesFreed)}`,
        details: {
          worldName,
          chunksRemoved,
          regionsScanned,
          chunksScanned,
          bytesFreed,
          minInhabitedTicks,
          spawnKeepChunks,
        },
      });
    }
    return {
      worldName,
      regionsScanned,
      chunksScanned,
      chunksRemoved,
      bytesFreed,
      dryRun,
      minInhabitedTicks,
      spawnKeepChunks,
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
