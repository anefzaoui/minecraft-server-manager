'use strict';

const fsp = require('node:fs/promises');
const path = require('node:path');

// How many stat() calls run at once. Enough to hide per-call latency on a big
// world folder, small enough not to exhaust file descriptors or the libuv pool.
const STAT_BATCH = 32;

/**
 * Total size in bytes of the given absolute file paths, stat'd in bounded
 * parallel batches instead of one awaited round-trip per file. A path that
 * vanished or can't be read counts as 0.
 * @param {string[]} files
 * @returns {Promise<number>}
 */
async function sumFileSizes(files) {
  let total = 0;
  for (let i = 0; i < files.length; i += STAT_BATCH) {
    const sizes = await Promise.all(
      files.slice(i, i + STAT_BATCH).map((f) =>
        fsp.stat(f).then(
          (st) => st.size,
          () => 0 // transient: vanished between readdir and stat
        )
      )
    );
    for (const n of sizes) total += n;
  }
  return total;
}

// How many directories one dirSize() walk reads at once. Each one stats its
// files in STAT_BATCH-sized groups, so a walk never has more than
// DIR_WORKERS * STAT_BATCH filesystem calls in flight, however deep the tree.
const DIR_WORKERS = 4;

/**
 * Total size in bytes of every regular file under `root`, recursively.
 * Symlinks are skipped (never followed, never counted), so a link to a parent
 * cannot loop and a linked file is not counted twice. An unreadable root or
 * subdirectory counts as 0.
 *
 * One bounded pool walks the whole tree breadth-first. The per-service walkers
 * this replaces started a fresh 32-wide pool inside every subdirectory, so
 * in-flight calls multiplied with depth (32, 1024, 32768…): on a big world
 * that hit EMFILE, and the swallowed errors quietly under-counted the size.
 * @param {string} root
 * @returns {Promise<number>}
 */
async function dirSize(root) {
  const queue = [root];
  let head = 0; // index, not shift(): shift() is O(n) on a queue of thousands of dirs
  let total = 0;
  let active = 0;
  /** @type {Array<() => void>} */
  let waiters = [];
  const wake = () => {
    const w = waiters;
    waiters = [];
    for (const fn of w) fn();
  };
  const worker = async () => {
    for (;;) {
      const dir = head < queue.length ? queue[head++] : undefined;
      if (dir === undefined) {
        if (active === 0) return; // queue drained and nobody can add more
        await new Promise((resolve) => waiters.push(() => resolve(undefined)));
        continue;
      }
      active += 1;
      try {
        let entries;
        try {
          entries = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
          entries = [];
        }
        const files = [];
        for (const e of entries) {
          if (e.isSymbolicLink()) continue;
          const child = path.join(dir, e.name);
          if (e.isDirectory()) queue.push(child);
          else if (e.isFile()) files.push(child);
        }
        // Await first, then add: `total += await x` reads `total` before the
        // await, so concurrent workers would overwrite each other's sums.
        const bytes = await sumFileSizes(files);
        total += bytes;
      } finally {
        active -= 1;
        wake();
      }
    }
  };
  await Promise.all(Array.from({ length: DIR_WORKERS }, worker));
  return total;
}

module.exports = { sumFileSizes, dirSize, STAT_BATCH };
