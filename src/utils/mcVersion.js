'use strict';

// Dotted-numeric Minecraft version comparison, for the downgrade guard on the
// version-change flow. Only answers when both sides are plain dotted numbers
// ("1.21.4", "26.2"); anything else ("LATEST", "SNAPSHOT", "24w03a",
// "1.20.4-rc1") is uncomparable and fails OPEN - the guard only refuses a
// downgrade it can prove, never a version it cannot parse.

/**
 * Numeric segments of a dotted version, or null when it is not one.
 * @param {string} version
 * @returns {number[] | null}
 */
function parseDotted(version) {
  const parts = String(version || '')
    .trim()
    .split('.');
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p))) return null;
  return parts.map(Number);
}

/**
 * -1 when a < b, 0 when equal (missing segments count as 0, so "1.20" is
 * "1.20.0"), 1 when a > b, null when either side is not dotted-numeric.
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1 | null}
 */
function compareMcVersions(a, b) {
  const pa = parseDotted(a);
  const pb = parseDotted(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * True only when `to` is provably older than `from`.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function isDowngrade(from, to) {
  return compareMcVersions(from, to) === 1;
}

module.exports = { parseDotted, compareMcVersions, isDowngrade };
