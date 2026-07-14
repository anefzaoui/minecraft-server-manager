'use strict';

// Shared per-server "world saves paused" lock. Any operation that runs the
// save-off → copy → save-on dance on a running server (backups, world export,
// world duplicate, world download) must hold this lock so two of them can't
// overlap — otherwise one operation's save-on re-enables world writes while the
// other is still copying region files, producing a silently torn archive.

const { createKeyedMutex } = require('../utils/keyedMutex');

const mutex = createKeyedMutex();

/** Serialize a save-off/copy/save-on critical section for one server. */
function withSaveLock(serverId, fn) {
  return mutex.withLock(`save:${serverId}`, fn);
}

module.exports = { withSaveLock };
