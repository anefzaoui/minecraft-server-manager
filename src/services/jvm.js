'use strict';

// What the server's memory settings mean for the number the panel shows.
//
// Issue #25: a modded server "sat at 12 GB of RAM with nobody playing". The
// image hands MEMORY to Java as BOTH the starting (-Xms) and the maximum (-Xmx)
// heap, and Java fills a heap it was given up front within the first minute of
// world generation - measured live: a 2 GB heap reads 2.5 GB with Aikar's flags
// AND 2.5 GB with no flags at all. The presets' -XX:+AlwaysPreTouch only makes
// the jump instantaneous. The setting that actually lowers idle memory is a
// smaller starting heap (INIT_MEMORY): the same server read 1.35 GB with
// INIT_MEMORY=512M. So the note the meters show keys on "starting heap equals
// maximum heap", not on which flag preset is on.

const SIZE_RE = /^\s*(\d+(?:\.\d+)?)\s*([kmgt]?)b?\s*$/i;
const UNIT_MB = { '': 1, k: 1 / 1024, m: 1, g: 1024, t: 1024 * 1024 };

/**
 * A JVM memory size ("512M", "4G", "4096", "2g") in megabytes, or null when it
 * cannot be read (empty, a percentage, junk). A bare number is taken as MB,
 * which is how the panel's own size fields store values.
 * @param {unknown} raw
 * @returns {number | null}
 */
function parseMemMb(raw) {
  if (raw == null) return null;
  const m = SIZE_RE.exec(String(raw));
  if (!m) return null;
  const mb = Number(m[1]) * UNIT_MB[m[2].toLowerCase()];
  return Number.isFinite(mb) && mb > 0 ? Math.round(mb) : null;
}

/** The image's own truthiness test for env flags (`isTrue` in its start scripts). */
function isTrue(value) {
  return /^(true|on|1|yes)$/i.test(String(value ?? '').trim());
}

/**
 * How the JVM will treat its heap, from the server row's env + heap setting.
 * @param {Record<string, string> | null | undefined} env
 * @param {number} heapMb  the panel's "RAM (Java heap)" value
 * @returns {{ heapMb: number, initMb: number, growsOnDemand: boolean, preTouch: boolean, note: string | null }}
 */
function heapPlan(env, heapMb) {
  const e = env || {};
  const maxMb = parseMemMb(e.MAX_MEMORY) || Number(heapMb) || 0;
  const initMb = parseMemMb(e.INIT_MEMORY) || maxMb;
  const preTouch =
    isTrue(e.USE_AIKAR_FLAGS) ||
    isTrue(e.USE_MEOWICE_FLAGS) ||
    isTrue(e.USE_MEOWICE_GRAALVM_FLAGS) ||
    /-XX:\+AlwaysPreTouch\b/.test(`${e.JVM_XX_OPTS || ''} ${e.JVM_OPTS || ''}`);
  const growsOnDemand = initMb < maxMb;
  let note = null;
  if (maxMb > 0) {
    note = growsOnDemand
      ? `Java starts with ${initMb} MB and grows toward its ${maxMb} MB heap as the world needs it.`
      : `Java was given the whole ${maxMb} MB heap up front, so memory settles around that figure even when nobody is playing. Lower "Initial heap" under Settings → Resources (advanced) to let it grow on demand instead.`;
  }
  return { heapMb: maxMb, initMb, growsOnDemand, preTouch, note };
}

module.exports = { parseMemMb, isTrue, heapPlan };
