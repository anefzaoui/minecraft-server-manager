'use strict';

// MC version → itzg image tag selection. The image does NOT pick Java for you;
// this matrix implements the rules from docs/versions/java.md.
// Users can always override per server (servers.java_tag).

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(v);
  if (!m) return null; // snapshots like 26w02a → latest
  return { major: +m[1], minor: +m[2], patch: +(m[3] || 0) };
}

/**
 * @param {string} mcVersion 'LATEST' | 'SNAPSHOT' | '1.20.4' | '26w02a'…
 * @param {string} type      itzg TYPE (FORGE needs java8 below 1.18)
 */
function pickJavaTag(mcVersion, type = 'VANILLA') {
  // LATEST/SNAPSHOT and Mojang's 2026+ version scheme (e.g. "26.2") need the
  // newest Java the image ships (:latest tag) — verified live: 26.x class
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
