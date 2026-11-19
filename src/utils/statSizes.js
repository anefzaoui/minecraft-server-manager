'use strict';

const fsp = require('node:fs/promises');

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

module.exports = { sumFileSizes, STAT_BATCH };
