'use strict';

// MC version → itzg image tag selection. The image does NOT pick Java for you;
// this matrix implements the rules from docs/versions/java.md.
// Users can always override per server (servers.java_tag).

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(v);
  if (!m) return null; // snapshots like 26w02a → latest
  return { major: +m[1], minor: +m[2], patch: +(m[3] || 0) };
}

// GTNH is a 1.7.10 pack that also runs on modern Java via its bundled lwjgl3ify
// patches, and its release index states the highest Java each version supports.
// Ladder down to the newest tag the panel actually ships that fits under the cap.
const GTNH_JAVA_LADDER = [
  { min: 25, tag: 'java25' },
  { min: 21, tag: 'java21' },
  { min: 17, tag: 'java17' },
];

/**
 * @param {string} mcVersion 'LATEST' | 'SNAPSHOT' | '1.20.4' | '26w02a'…
 * @param {string} type      itzg TYPE (FORGE needs java8 below 1.18)
 * @param {{maxJavaVersion?: number|null}} [options]  { maxJavaVersion } - GTNH-specific cap
 */
function pickJavaTag(mcVersion, type = 'VANILLA', { maxJavaVersion = null } = {}) {
  // GTNH: the pinned pack version decides, not the 1.7.10 → java8 rule below.
  // Unknown cap (no pin yet, or the index was unreachable) → java17, which every
  // version in the GTNH index supports.
  if (type === 'GTNH') {
    const cap = Number.isInteger(maxJavaVersion) ? maxJavaVersion : 17;
    if (cap < 17) return 'java8';
    return (GTNH_JAVA_LADDER.find((step) => cap >= step.min) || { tag: 'java17' }).tag;
  }
  // LATEST/SNAPSHOT and Mojang's 2026+ version scheme (e.g. "26.2") need the
  // newest Java the image ships (:latest tag) - verified live: 26.x class
  // files are version 69 (Java 25), which java21 refuses to load.
  if (!mcVersion || mcVersion === 'LATEST' || mcVersion === 'SNAPSHOT') return 'latest';
  const v = parseVersion(mcVersion);
  if (!v) return 'latest'; // snapshot naming (26w02a…) → newest
  if (v.major > 1) return 'latest'; // 25.x/26.x era versions

  const isForgeFamily = ['FORGE', 'MOHIST', 'ARCLIGHT', 'MAGMA', 'MAGMA_MAINTAINED', 'CRUCIBLE', 'KETTING'].includes(
    type
  );

  if (v.major === 1 && v.minor <= 16) {
    // Paper 1.16.5 runs on java16, but java8 is the safe default for the era,
    // and Forge < 1.18 hard-requires it.
    if (type === 'PAPER' && v.minor === 16 && v.patch === 5) return 'java16';
    return 'java8';
  }
  if (v.major === 1 && v.minor === 17) return 'java16';
  if (v.major === 1 && (v.minor === 18 || v.minor === 19)) return 'java17';
  if (v.major === 1 && v.minor === 20 && v.patch <= 4) return 'java17';
  // 1.20.5+ and all 1.21+
  if (isForgeFamily && v.major === 1 && v.minor === 20) return 'java21';
  return 'java21';
}

module.exports = { pickJavaTag, parseVersion };
