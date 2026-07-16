// @ts-nocheck — dynamic HTTP-JSON interop across two mod registries.
'use strict';

// Backend for the "From mods" wizard browser. Three concerns, both platforms:
//   search()   — find mods for a loader + MC version (Modrinth or CurseForge)
//   versions() — a mod's builds filtered to that loader + MC, newest first
//   resolveDependencies() — the required-dependency closure of a selection,
//                           so the wizard can show "added as dependency" rows
// A dependency stays on the same platform as its parent (Modrinth project ids
// and CurseForge mod ids never cross), so no cross-platform mapping is needed.

const modrinth = require('./modrinthApi');
const curseforge = require('./curseforgeApi');

const MAX_DEPS = 50; // safety cap on the resolved-dependency closure
const MAX_ITER = 300; // recursion guard

function normMc(mc) {
  const v = String(mc || '').trim();
  return v && v !== 'LATEST' && v !== 'SNAPSHOT' ? v : undefined;
}

// ---- Search -----------------------------------------------------------------

/** Unified mod search. Returns [{platform, ref, projectId, name, description, iconUrl, downloads}]. */
async function search({ query, platform, loader, mc, limit = 20 }) {
  const q = String(query || '').trim();
  if (!q) return [];
  const mcVersion = normMc(mc);
  if (platform === 'curseforge') {
    const hits = await curseforge.search({ query: q, kind: 'mod', loader, mcVersion, limit });
    return hits.map((m) => ({
      platform: 'curseforge',
      ref: m.slug,
      projectId: String(m.modId),
      name: m.name,
      description: m.summary || '',
      iconUrl: m.iconUrl || null,
      downloads: m.downloads || 0,
    }));
  }
  const hits = await modrinth.search({ query: q, kind: 'mod', loader, mcVersion, limit });
  return hits.map((h) => ({
    platform: 'modrinth',
    ref: h.slug,
    projectId: h.projectId,
    name: h.title,
    description: h.description || '',
    iconUrl: h.iconUrl || null,
    downloads: h.downloads || 0,
  }));
}

// ---- Project metadata + versions -------------------------------------------

/** {ref, projectId, name, iconUrl} for a mod given a slug or platform id. */
async function metaFor(platform, refOrId) {
  if (platform === 'curseforge') {
    const mod = /^\d+$/.test(String(refOrId))
      ? await curseforge.getMod(Number(refOrId))
      : await curseforge.resolveUrl(String(refOrId));
    return { ref: mod.slug, projectId: String(mod.modId), name: mod.name, iconUrl: mod.iconUrl || null };
  }
  const p = await modrinth.getProject(refOrId);
  return { ref: p.slug, projectId: p.id, name: p.title, iconUrl: p.icon_url || null };
}

/** Normalize one Modrinth version to the shared shape (+ required-dep project ids). */
function normModrinthVersion(v) {
  return {
    versionId: v.id,
    name: v.name || v.version_number,
    versionNumber: v.version_number,
    datePublished: v.date_published || null,
    versionType: v.version_type || 'release',
    gameVersions: v.game_versions || [],
    requiredDeps: (v.dependencies || [])
      .filter((d) => d.dependency_type === 'required' && d.project_id)
      .map((d) => String(d.project_id)),
  };
}

/** Normalize one CurseForge file to the shared shape (relationType 3 = required). */
function normCurseforgeFile(f) {
  return {
    versionId: String(f.fileId),
    name: f.name || f.fileName,
    versionNumber: f.name || f.fileName,
    datePublished: f.fileDate || null,
    versionType: f.releaseType || 'release',
    gameVersions: f.gameVersions || [],
    requiredDeps: (f.dependencies || []).filter((d) => d.relation === 3).map((d) => String(d.modId)),
    downloadable: Boolean(f.downloadUrl), // CF authors can forbid API download
  };
}

/**
 * A mod's builds for a loader + MC version, newest first.
 * @returns [{versionId, name, versionNumber, datePublished, versionType, gameVersions, requiredDeps}]
 */
async function versions({ platform, ref, loader, mc, limit = 30 }) {
  const mcVersion = normMc(mc);
  if (platform === 'curseforge') {
    const meta = await metaFor('curseforge', ref);
    const files = await curseforge.getFiles(meta.projectId, { mcVersion, loader });
    return files.slice(0, limit).map(normCurseforgeFile);
  }
  const list = await modrinth.getVersions(ref, { loader, mcVersion });
  return list.slice(0, limit).map(normModrinthVersion);
}

// ---- Required-dependency resolution ----------------------------------------

const depKey = (platform, projectId) => `${platform}:${projectId}`;

/** Required-dependency project ids of ONE build (same platform as its parent). */
async function requiredDepsOfVersion(platform, projectId, versionId) {
  try {
    if (platform === 'curseforge') {
      const file = await curseforge.getFile(Number(projectId), Number(versionId));
      return normCurseforgeFile(file).requiredDeps;
    }
    const v = await modrinth.getVersion(versionId);
    return normModrinthVersion(v).requiredDeps;
  } catch {
    return []; // a missing/removed build shouldn't break the whole resolve
  }
}

/**
 * Resolve the recursive required-dependency closure of a selection.
 * @param {{loader, mc, selection:[{platform, ref, versionId}]}} args
 * @returns {Promise<{deps:[{platform, ref, projectId, name, iconUrl, versions, versionId}], warnings:string[]}>}
 *   deps excludes anything already in the selection; each carries its own
 *   version list + default pick so the wizard row is immediately editable.
 */
async function resolveDependencies({ loader, mc, selection = [] }) {
  const have = new Set(); // projects already covered (selection + resolved deps)
  const warnings = [];
  const deps = [];
  const queue = []; // { platform, projectId }

  // Seed: mark every selected project as covered, then enqueue its required deps.
  for (const item of selection) {
    if (!item || !item.ref) continue;
    let meta;
    try {
      meta = await metaFor(item.platform, item.ref);
    } catch {
      continue;
    }
    have.add(depKey(item.platform, meta.projectId));
    const reqs = item.versionId ? await requiredDepsOfVersion(item.platform, meta.projectId, item.versionId) : [];
    for (const pid of reqs) queue.push({ platform: item.platform, projectId: pid });
  }

  let iter = 0;
  while (queue.length && iter < MAX_ITER && deps.length < MAX_DEPS) {
    iter += 1;
    const node = queue.shift();
    const k = depKey(node.platform, node.projectId);
    if (have.has(k)) continue;
    have.add(k);

    let meta;
    try {
      meta = await metaFor(node.platform, node.projectId);
    } catch {
      continue; // unresolvable id — skip quietly
    }
    let vers = [];
    try {
      vers = await versions({ platform: node.platform, ref: meta.ref, loader, mc });
    } catch {
      vers = [];
    }
    if (!vers.length) {
      warnings.push(`${meta.name} has no ${loader}${mc ? ` ${mc}` : ''} build — skipped`);
      continue;
    }
    const chosen = vers[0]; // newest compatible build
    deps.push({
      platform: node.platform,
      ref: meta.ref,
      projectId: meta.projectId,
      name: meta.name,
      iconUrl: meta.iconUrl,
      versions: vers,
      versionId: chosen.versionId,
    });
    // Recurse into this dependency's own required deps.
    for (const pid of chosen.requiredDeps) queue.push({ platform: node.platform, projectId: pid });
  }

  return { deps, warnings };
}

module.exports = { search, versions, resolveDependencies, metaFor };
