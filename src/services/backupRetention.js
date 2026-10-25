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
//
// A server's override is per key: a key it doesn't set follows the panel-wide
// policy, and setting a key to null removes it again.

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

/**
 * The policy one server WOULD run under if `global` were merged into the
 * panel-wide policy and/or `server` into its override (`server: null` = its
 * override removed), for previews. Overrides are partial: a key a server
 * doesn't override follows the global policy, so a global change can reach a
 * server that has an override too.
 * @param {string} serverId
 * @param {{ global?: object, server?: object | null }} [candidate]
 */
function effectiveIf(serverId, { global, server } = {}) {
  const stored = raw();
  const own = (stored.perServer && stored.perServer[serverId]) || {};
  return {
    ...DEFAULTS,
    ...sanitize(stored),
    ...sanitize(global),
    ...(server === null ? {} : mergeOverride(own, server)),
  };
}

/** An override with `patch` merged in: numbers set a key, null removes it. */
function mergeOverride(own, patch = {}) {
  const next = { ...sanitize(own), ...sanitize(patch) };
  for (const k of NUMERIC) if (patch && patch[k] === null) delete next[k];
  return next;
}

/** A server's own override (only the keys it sets), or null when it has none. */
function overrideFor(serverId) {
  const own = raw().perServer?.[serverId];
  return own && Object.keys(sanitize(own)).length ? sanitize(own) : null;
}

/** Merge a patch into the panel-wide policy. Returns the new global config. */
function setGlobal(patch) {
  const stored = raw();
  settings.set(KEY, { ...stored, ...sanitize(patch) });
  return globalConfig();
}

/**
 * Patch one server's override (a number sets a key, null removes it) or clear
 * it entirely (pass null). An override left with no keys is dropped.
 * Returns that server's effective policy.
 */
function setServer(serverId, patch) {
  const stored = raw();
  const perServer = { ...(stored.perServer || {}) };
  const next = patch === null ? {} : mergeOverride(perServer[serverId], patch);
  if (Object.keys(next).length) perServer[serverId] = next;
  else delete perServer[serverId];
  settings.set(KEY, { ...stored, perServer });
  return effective(serverId);
}

module.exports = { DEFAULTS, globalConfig, effective, effectiveIf, overrideFor, setGlobal, setServer };
