'use strict';

// Backup retention policy: how many / how old / how large a server's backup set
// may grow before pruneRetention() trims it. Stored as one JSON blob in the
// `settings` table (key `backup_retention`) with an optional per-server override
// map, so it needs no migration and no new table.
//
//   { keepScheduled, keepPreUpdate, keepManual, keepPreRestore,
//     maxAgeDays,        // 0 = no age limit (default - never surprise-delete)
//     maxTotalGb,        // 0 = no size limit
//     perServer: { <serverId>: { <any of the above> } } }

const settings = require('./settings');

const KEY = 'backup_retention';

// Historic hard-coded caps become the defaults (unchanged behaviour when the
// operator has set nothing).
const DEFAULTS = Object.freeze({
  keepScheduled: 10,
  keepPreUpdate: 10,
  keepManual: 20,
  keepPreRestore: 5,
  maxAgeDays: 0,
  maxTotalGb: 0,
});

const NUMERIC = Object.keys(DEFAULTS);

function clampInt(v, min, max) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Sanitise an incoming patch to known numeric keys within sane bounds. */
function sanitize(patch = {}) {
  const out = {};
  for (const k of NUMERIC) {
    if (patch[k] === undefined || patch[k] === null || patch[k] === '') continue;
    // count caps 1..500; age 0..3650 days; size 0..100000 GB
    const bounds = k === 'maxAgeDays' ? [0, 3650] : k === 'maxTotalGb' ? [0, 100000] : [1, 500];
    const n = clampInt(patch[k], bounds[0], bounds[1]);
    if (n !== null) out[k] = n;
  }
  return out;
}

function raw() {
  const v = settings.get(KEY, {});
  return v && typeof v === 'object' ? v : {};
}

/** The panel-wide policy (defaults merged with whatever the operator saved). */
function globalConfig() {
  const stored = raw();
  return { ...DEFAULTS, ...sanitize(stored) };
}

/** The effective policy for one server: global, then its per-server override. */
function effective(serverId) {
  const stored = raw();
  const perServer = (stored.perServer && stored.perServer[serverId]) || {};
  return { ...DEFAULTS, ...sanitize(stored), ...sanitize(perServer) };
}

/** Merge a patch into the panel-wide policy. Returns the new global config. */
function setGlobal(patch) {
  const stored = raw();
  settings.set(KEY, { ...stored, ...sanitize(patch) });
  return globalConfig();
}

/**
 * Set (patch) or clear (pass null) one server's override.
 * Returns that server's effective policy.
 */
function setServer(serverId, patch) {
  const stored = raw();
  const perServer = { ...(stored.perServer || {}) };
  if (patch === null) {
    delete perServer[serverId];
  } else {
    perServer[serverId] = { ...(perServer[serverId] || {}), ...sanitize(patch) };
  }
  settings.set(KEY, { ...stored, perServer });
  return effective(serverId);
}

module.exports = { DEFAULTS, globalConfig, effective, setGlobal, setServer };
