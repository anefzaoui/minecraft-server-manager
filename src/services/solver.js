'use strict';

// Compatibility Solver — "pick mods first".
// Given a list of Modrinth project slugs/ids, fetch every project's version
// list (cached client, sequential — never hammers the API), build a
// loader → supported-MC-versions map per project, and find the newest
// (loader, MC version) pair that EVERY project supports. When no pair covers
// all projects, return the best partial pair plus which projects drop.

const httpError = require('../utils/httpError');
const modrinth = require('./modrinthApi');
const { parseVersion } = require('./javaMatrix');

const MAX_PROJECTS = 25;

// Panel loader buckets, in preference order (used as the tiebreaker after
// "newest MC version wins"). Each bucket lists the Modrinth loader tags that
// count as compatible with it — plugin projects tag bukkit/spigot builds that
// Paper runs fine.
const LOADERS = [
  { id: 'fabric', label: 'Fabric', type: 'FABRIC', tags: ['fabric'] },
  { id: 'neoforge', label: 'NeoForge', type: 'NEOFORGE', tags: ['neoforge'] },
  { id: 'forge', label: 'Forge', type: 'FORGE', tags: ['forge'] },
  { id: 'quilt', label: 'Quilt', type: 'QUILT', tags: ['quilt'] },
  { id: 'paper', label: 'Paper', type: 'PAPER', tags: ['paper', 'purpur', 'spigot', 'bukkit'] },
];

const LOADER_RANK = new Map(LOADERS.map((l, i) => [l.id, i]));

/** Newest-first comparator for release-style MC versions ("1.21.4"). */
function compareMcDesc(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return 0; // non-parseable never reaches candidate ranking
  return vb.major - va.major || vb.minor - va.minor || vb.patch - va.patch;
}

/** loader id → Set of release-style MC versions, from a project's version list. */
function buildLoaderMap(versions) {
  const map = new Map(LOADERS.map((l) => [l.id, new Set()]));
  for (const v of versions) {
    if (v.version_type !== 'release' && v.version_type !== 'beta') continue; // skip alphas
    const vLoaders = (v.loaders || []).map((x) => String(x).toLowerCase());
    for (const loader of LOADERS) {
      if (!loader.tags.some((t) => vLoaders.includes(t))) continue;
      for (const gv of v.game_versions || []) {
        // Plain release versions only — parseVersion() matches prefixes, so
        // also reject snapshots/RCs like "26.2-rc-1" or "1.21.2-pre1".
        if (/^\d+\.\d+(\.\d+)?$/.test(gv) && parseVersion(gv)) map.get(loader.id).add(gv);
      }
    }
  }
  return map;
}

function pairMeta(loaderId, mcVersion) {
  const loader = LOADERS.find((l) => l.id === loaderId);
  return { loader: loaderId, loaderLabel: loader.label, type: loader.type, mcVersion };
}

/** Newest-first, then loader preference. */
function comparePairs(a, b) {
  return compareMcDesc(a.mcVersion, b.mcVersion) || LOADER_RANK.get(a.loader) - LOADER_RANK.get(b.loader);
}

/**
 * Solve compatibility for a set of Modrinth projects.
 * @param {string[]} projectRefs slugs or project ids (1..25)
 * @returns {Promise<{best, alternatives, perProject, partial}>}
 */
async function solve(projectRefs) {
  const refs = [...new Set((projectRefs || []).map((r) => String(r).trim()).filter(Boolean))];
  if (!refs.length) throw httpError(400, 'Pick at least one mod to solve for');
  if (refs.length > MAX_PROJECTS) throw httpError(400, `At most ${MAX_PROJECTS} mods per solve`);

  // Sequential fetches through the cached Modrinth client (2 calls/project max).
  const projects = [];
  for (const ref of refs) {
    let meta;
    let versions;
    try {
      meta = await modrinth.getProject(ref);
      versions = await modrinth.getVersions(ref); // ALL versions, unfiltered
    } catch (err) {
      if (err.status === 404) throw httpError(404, `"${ref}" was not found on Modrinth`);
      throw err;
    }
    projects.push({
      ref,
      slug: meta.slug,
      title: meta.title,
      iconUrl: meta.icon_url || null,
      loaderMap: buildLoaderMap(versions),
    });
  }

  // Full-coverage candidates: for each loader, intersect every project's
  // supported MC versions on that loader.
  const fullPairs = [];
  for (const loader of LOADERS) {
    const sets = projects.map((p) => p.loaderMap.get(loader.id));
    if (sets.some((s) => s.size === 0)) continue; // some project has no builds for this loader
    let intersection = [...sets[0]];
    for (const s of sets.slice(1)) intersection = intersection.filter((gv) => s.has(gv));
    for (const gv of intersection) fullPairs.push(pairMeta(loader.id, gv));
  }
  fullPairs.sort(comparePairs);

  const best = fullPairs.length ? { ...fullPairs[0], coverage: 'all' } : null;
  const alternatives = fullPairs.slice(1, 6);

  // Partial fallback: the (loader, MC version) pair supported by the MOST
  // projects, with the same newest-first/loader-preference tiebreaks.
  let partial = null;
  if (!best) {
    let bestPartial = null;
    for (const loader of LOADERS) {
      const union = new Set();
      for (const p of projects) for (const gv of p.loaderMap.get(loader.id)) union.add(gv);
      for (const gv of union) {
        const covered = projects.filter((p) => p.loaderMap.get(loader.id).has(gv));
        const cand = { ...pairMeta(loader.id, gv), covered };
        if (
          !bestPartial ||
          covered.length > bestPartial.covered.length ||
          (covered.length === bestPartial.covered.length && comparePairs(cand, bestPartial) < 0)
        ) {
          bestPartial = cand;
        }
      }
    }
    if (bestPartial) {
      const coveredSet = new Set(bestPartial.covered.map((p) => p.slug));
      partial = {
        loader: bestPartial.loader,
        loaderLabel: bestPartial.loaderLabel,
        type: bestPartial.type,
        mcVersion: bestPartial.mcVersion,
        coveredCount: bestPartial.covered.length,
        total: projects.length,
        coveredSlugs: [...coveredSet],
        dropped: projects
          .filter((p) => !coveredSet.has(p.slug))
          .map((p) => ({
            ref: p.ref,
            slug: p.slug,
            title: p.title,
            // What this project DOES support on the chosen loader (newest few),
            // so the UI can say "only up to 1.20.1 on Fabric" or "no Fabric builds".
            supportedVersions: [...p.loaderMap.get(bestPartial.loader)].sort(compareMcDesc).slice(0, 8),
          })),
      };
    }
  }

  // Per-project detail for the result card. `supported` is judged against the
  // best pair (or the partial pair when nothing covers everything).
  const judged = best || partial;
  const perProject = projects.map((p) => ({
    ref: p.ref,
    slug: p.slug,
    title: p.title,
    iconUrl: p.iconUrl,
    supported: judged ? p.loaderMap.get(judged.loader).has(judged.mcVersion) : false,
    // Newest MC versions this project supports on the judged loader (falls back
    // to its overall best loader when it has none there).
    bestOwnVersions: bestOwnVersions(p, judged ? judged.loader : null),
  }));

  return { best, alternatives, perProject, partial };
}

function bestOwnVersions(project, preferredLoader) {
  const pick = (loaderId) => [...project.loaderMap.get(loaderId)].sort(compareMcDesc).slice(0, 5);
  if (preferredLoader && project.loaderMap.get(preferredLoader).size) {
    return { loader: preferredLoader, versions: pick(preferredLoader) };
  }
  for (const loader of LOADERS) {
    if (project.loaderMap.get(loader.id).size) return { loader: loader.id, versions: pick(loader.id) };
  }
  return { loader: null, versions: [] };
}

module.exports = { solve, LOADERS, MAX_PROJECTS, compareMcDesc, buildLoaderMap, pairMeta };
