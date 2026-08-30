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
  recoverDisplacedWorlds();
}

/**
 * A backup restore swaps the world with two renames, parking the original as
 * data/servers/.restore-displaced-<serverId>-<suffix>. If the panel died
 * between the two renames, the server directory is missing and that parked
 * copy is the only world left - put it back. If the server directory exists,
 * the restore finished and the parked copy is leftover debris - remove it.
 */
function recoverDisplacedWorlds() {
  const serversDir = path.join(config.dataDir, 'servers');
  for (const entry of fs.readdirSync(serversDir)) {
    const m = /^\.restore-displaced-(.+)-[^-]+$/.exec(entry);
    if (!m) continue;
    const abs = path.join(serversDir, entry);
    const serverDir = path.join(serversDir, m[1]);
    try {
      if (fs.existsSync(serverDir)) {
        fs.rmSync(abs, { recursive: true, force: true });
        logger.info('Removed a leftover displaced-world directory from a completed restore.', { entry });
      } else {
        fs.renameSync(abs, serverDir);
        logger.warn(
          'Recovered a world displaced by a restore that crashed mid-swap. The restore did not complete; the pre-restore world is back in place.',
          { serverId: m[1] }
        );
      }
    } catch (err) {
      logger.error('Could not recover or clean a displaced-world directory.', { entry, err: err.message });
    }
  }
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
