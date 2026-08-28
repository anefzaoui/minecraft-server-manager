'use strict';

// Bootstraps the ./data layout on boot. Everything the panel persists lives
// under this one root so copying it migrates the whole panel.

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const logger = require('../logger')(path.basename(__filename));

const LAYOUT = [
  'servers',
  'backups',
  'blueprints',
  'library/mods',
  'library/modpacks',
  'library/worlds',
  'library/icons',
  'logs',
  'tmp',
];

function ensureDataRoot() {
  try {
    for (const dir of LAYOUT) {
      fs.mkdirSync(path.join(config.dataDir, dir), { recursive: true });
    }
  } catch (err) {
    // Turn a bare ENOENT/EACCES into an actionable message instead of a raw
    // stack trace at boot (e.g. DATA_DIR on a missing drive or a read-only path).
    throw new Error(
      `Could not create the data directory at ${config.dataDir}: ${err.message}. ` +
        `Check that DATA_DIR points somewhere this user can write, then start the panel again.`,
      { cause: err }
    );
  }
  cleanTmp();
}

/**
 * Clean tmp/. On boot (no args) everything goes - nothing can be in flight.
 * The scheduled sweep passes { olderThanMs } so in-progress transfers survive.
 */
function cleanTmp({ olderThanMs = 0 } = {}) {
  const tmp = path.join(config.dataDir, 'tmp');
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  for (const entry of fs.readdirSync(tmp)) {
    const abs = path.join(tmp, entry);
    if (olderThanMs > 0) {
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue; // intentional: entry vanished between readdir and stat
      }
      if (stat.mtimeMs > cutoff) continue; // too fresh - may be in flight
    }
    fs.rmSync(abs, { recursive: true, force: true });
    removed += 1;
  }
  if (removed) logger.debug('Cleared temporary working files.', { removed, olderThanMs });
}

module.exports = { ensureDataRoot, cleanTmp, LAYOUT };
