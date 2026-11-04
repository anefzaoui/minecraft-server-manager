'use strict';

// "Last backup" summary for the server cards. Pure (the clock is a parameter) so
// the wording and the stale threshold are unit-testable.

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

// A server whose newest backup is older than this (or that has never been
// backed up, once it is no longer brand new) gets the warning badge.
const STALE_AFTER_DAYS = 7;
// A just-created server has had no chance to be backed up yet; don't nag.
const GRACE_MS = DAY_MS;

/** SQLite datetime('now') is UTC without a zone marker. */
function parseSqlUtc(value) {
  if (!value) return null;
  const ms = Date.parse(String(value).replace(' ', 'T') + 'Z');
  return Number.isFinite(ms) ? ms : null;
}

/** @param {number} n @param {string} one @param {string} many */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * @param {string | null | undefined} lastBackupAt  newest backup's created_at (SQLite UTC), or null
 * @param {{ createdAt?: string | null, now?: number }} [opts]  the server's created_at, and the clock
 * @returns {{ text: string, stale: boolean, never: boolean, at: string | null }}
 */
function describeBackupAge(lastBackupAt, { createdAt = null, now = Date.now() } = {}) {
  const at = parseSqlUtc(lastBackupAt);
  if (at === null) {
    const born = parseSqlUtc(createdAt);
    const brandNew = born !== null && now - born < GRACE_MS;
    return { text: 'Never', stale: !brandNew, never: true, at: null };
  }
  const age = Math.max(0, now - at);
  let text;
  if (age < HOUR_MS) text = 'Less than an hour ago';
  else if (age < DAY_MS) text = `${plural(Math.floor(age / HOUR_MS), 'hour', 'hours')} ago`;
  else if (age < 60 * DAY_MS) text = `${plural(Math.floor(age / DAY_MS), 'day', 'days')} ago`;
  else text = `${plural(Math.floor(age / (30 * DAY_MS)), 'month', 'months')} ago`;
  return { text, stale: age > STALE_AFTER_DAYS * DAY_MS, never: false, at: lastBackupAt || null };
}

module.exports = { describeBackupAge, STALE_AFTER_DAYS };
