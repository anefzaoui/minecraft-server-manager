'use strict';

// Download-integrity helpers. Registries publish checksums for the files they
// serve (Modrinth: sha1+sha512, CurseForge: sha1+md5, Hangar: sha256, PaperMC
// Fill: sha256), so a download can be verified against the registry's own
// digest while it streams - a corrupted or tampered file becomes a hard error
// instead of a broken jar quietly landing on a server.

const PREFERENCE = ['sha512', 'sha256', 'sha1', 'md5'];

/** CurseForge hash lists are [{value, algo}] with algo 1 = sha1, 2 = md5. */
function fromCurseforge(hashes) {
  const out = {};
  for (const h of hashes || []) {
    if (!h || !h.value) continue;
    if (h.algo === 1) out.sha1 = String(h.value).toLowerCase();
    else if (h.algo === 2) out.md5 = String(h.value).toLowerCase();
  }
  return out;
}

/**
 * Pick the strongest usable digest from an {algo: hex} map, strongest first:
 * sha512 > sha256 > sha1 > md5. Returns {algo, hex} or null when nothing
 * verifiable was published.
 */
function strongest(expected) {
  if (!expected || typeof expected !== 'object') return null;
  for (const algo of PREFERENCE) {
    const hex = expected[algo];
    if (typeof hex === 'string' && /^[0-9a-fA-F]{32,128}$/.test(hex)) {
      return { algo, hex: hex.toLowerCase() };
    }
  }
  return null;
}

module.exports = { fromCurseforge, strongest, PREFERENCE };
