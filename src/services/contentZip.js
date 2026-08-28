// @ts-nocheck — dynamic zip/registry JSON interop.
'use strict';

// Mod-zip importer. One upload endpoint, two zip shapes, auto-detected:
//   curseforge-pack — a CurseForge modpack export: manifest.json pinning
//     {projectID, fileID} pairs + an overrides/ tree. Resolved via the CF bulk
//     endpoints (not one GET per mod), partitioned into downloadable vs
//     blocked (authors can forbid API downloads), installed as overlay mods.
//   jars — a hand-assembled zip of mod/plugin jars. Each jar is identified
//     (Modrinth sha1 → CF fingerprint → embedded metadata) and judged against
//     the target server before anything installs.
// Preview never mutates; import tolerates per-item failure like the wizard's
// from-mods loop. Overrides extraction is opt-in, zip-slip-guarded, and backs
// up every file it would overwrite first (reversible by construction).

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const httpError = require('../utils/httpError');
const { readZipIndex, readEntryBuffers, extractZipSafe, safeEntryName } = require('../utils/zip');
const { recordEvent } = require('../events');
const { dataPath } = require('../storage/pathGuard');
const curseforge = require('./curseforgeApi');
const modIdentify = require('./modIdentify');
const modsService = require('./mods');
const serversService = require('./servers');

const MAX_MANIFEST_FILES = 1000; // a pack pinning more than this is malformed
const MAX_JARS = 500;
const MAX_OVERRIDE_ENTRIES = 20000;
const MAX_OVERRIDE_BYTES = 8 * 1024 ** 3; // decompression-bomb ceiling (headers can lie; sizes re-checked on extract)

// ---- Detection & manifest parsing ------------------------------------------

/** Parse a CurseForge modpack manifest.json (throws 400 on junk). */
function parsePackManifest(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw httpError(400, 'manifest.json is not valid JSON');
  }
  if (!raw || raw.manifestType !== 'minecraftModpack' || !Array.isArray(raw.files)) {
    throw httpError(400, 'manifest.json is not a CurseForge modpack manifest');
  }
  if (raw.files.length > MAX_MANIFEST_FILES) {
    throw httpError(400, `Manifest pins ${raw.files.length} files — the ${MAX_MANIFEST_FILES} limit blocks it`);
  }
  const files = raw.files
    .map((f) => ({
      projectId: Number(f.projectID ?? f.projectId),
      fileId: Number(f.fileID ?? f.fileId),
      required: f.required !== false,
    }))
    .filter((f) => Number.isFinite(f.projectId) && Number.isFinite(f.fileId));
  const loaderId = String(
    ((raw.minecraft && raw.minecraft.modLoaders) || []).find((l) => l && l.primary)?.id ||
      ((raw.minecraft && raw.minecraft.modLoaders) || [])[0]?.id ||
      ''
  );
  const dash = loaderId.indexOf('-');
  return {
    name: String(raw.name || 'CurseForge modpack').slice(0, 120),
    version: String(raw.version || '').slice(0, 60),
    author: String(raw.author || '').slice(0, 120),
    mcVersion: String((raw.minecraft && raw.minecraft.version) || '').slice(0, 32),
    loader: dash > 0 ? loaderId.slice(0, dash).toLowerCase() : loaderId.toLowerCase() || null,
    loaderVersion: dash > 0 ? loaderId.slice(dash + 1) : null,
    files,
    overridesPrefix: `${String(raw.overrides || 'overrides').replace(/\/+$/, '')}/`,
  };
}

const isJarEntry = (name) =>
  name.toLowerCase().endsWith('.jar') && !name.startsWith('__MACOSX/') && !path.basename(name).startsWith('.');

/**
 * Detect what kind of zip this is and index it.
 * @returns {{type: 'curseforge-pack'|'jars', manifest?, jarEntries, overridesEntries}}
 */
async function inspect(zipPath) {
  const { entries, texts } = await readZipIndex(zipPath, { textEntry: (n) => n === 'manifest.json' });
  const manifestText = texts.get('manifest.json');
  if (manifestText) {
    let manifest = null;
    try {
      manifest = parsePackManifest(manifestText);
    } catch {
      /* a manifest.json that isn't a CF pack manifest → fall through to jar detection */
    }
    if (manifest) {
      const overridesEntries = entries.filter(
        (e) => e.name.startsWith(manifest.overridesPrefix) && !e.name.endsWith('/')
      );
      return { type: 'curseforge-pack', manifest, jarEntries: [], overridesEntries };
    }
  }
  const jarEntries = entries.filter((e) => isJarEntry(e.name));
  if (!jarEntries.length) {
    throw httpError(
      400,
      'Unrecognized zip: neither a CurseForge modpack export (manifest.json) nor an archive containing mod jars'
    );
  }
  if (jarEntries.length > MAX_JARS) {
    throw httpError(400, `Zip contains ${jarEntries.length} jars — the ${MAX_JARS} limit blocks it`);
  }
  return { type: 'jars', manifest: null, jarEntries, overridesEntries: [] };
}

// ---- Shared helpers ---------------------------------------------------------

function serverTarget(serverId) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  return server;
}

async function installedIndex(serverId) {
  const items = await modsService.listContent(serverId).catch(() => []);
  const keys = new Set();
  const filenames = new Set();
  for (const m of items) {
    if (m.platform && m.projectId) keys.add(`${m.platform}:${m.projectId}`);
    if (m.file) filenames.add(m.file);
  }
  return { keys, filenames };
}

/** Resolve manifest {projectId, fileId} pairs via the CF bulk endpoints. */
async function resolveManifestEntries(manifestFiles) {
  const files = await curseforge.getFilesBulk(manifestFiles.map((f) => f.fileId));
  const mods = await curseforge.getModsBulk(manifestFiles.map((f) => f.projectId));
  const fileById = new Map(files.map((f) => [Number(f.fileId), f]));
  const modById = new Map(mods.map((m) => [Number(m.modId), m]));
  return manifestFiles.map((entry) => {
    const file = fileById.get(entry.fileId) || null;
    const mod = modById.get(entry.projectId) || null;
    const { mcVersions, loaders } = modIdentify.splitCfGameVersions((file && file.gameVersions) || []);
    const slug = (mod && mod.slug) || String(entry.projectId);
    return {
      projectId: entry.projectId,
      fileId: entry.fileId,
      required: entry.required,
      resolved: Boolean(file),
      name: (mod && mod.name) || (file && file.name) || `Project ${entry.projectId}`,
      slug,
      fileName: (file && file.fileName) || null,
      version: (file && file.name) || null,
      iconUrl: (mod && mod.iconUrl) || null,
      downloadable: Boolean(file && file.downloadUrl),
      downloadUrl: (file && file.downloadUrl) || null,
      url: `https://www.curseforge.com/minecraft/mc-mods/${slug}/files/${entry.fileId}`,
      mcVersions,
      loaders,
    };
  });
}

// ---- Preview ----------------------------------------------------------------

/**
 * Non-mutating preview of a zip against a server: what's inside, what fits,
 * what's blocked, what's already installed.
 */
async function previewForServer(serverId, zipPath) {
  const server = serverTarget(serverId);
  const kind = modsService.contentKindOf(server);
  const serverMc = server.mc_version;
  const serverLoader = modsService.loaderOf(server);
  const info = await inspect(zipPath);
  const installed = await installedIndex(serverId);
  const judge = (identityish) => modIdentify.verdictFor(identityish, { kind, loader: serverLoader, mc: serverMc });

  if (info.type === 'curseforge-pack') {
    const items = (await resolveManifestEntries(info.manifest.files)).map((e) => ({
      ...e,
      downloadUrl: undefined, // CDN URL is server-side detail; the client gets the CF page url
      verdict: e.resolved
        ? judge({ source: 'curseforge', loaders: e.loaders, mcVersions: e.mcVersions, kind: 'mod' })
        : { status: 'unknown', loaderOk: null, mcOk: null },
      installed:
        installed.keys.has(`curseforge:${e.projectId}`) || (e.fileName ? installed.filenames.has(e.fileName) : false),
    }));
    const warnings = [];
    if (
      info.manifest.mcVersion &&
      serverMc &&
      !/^(LATEST|SNAPSHOT)/.test(serverMc) &&
      info.manifest.mcVersion !== serverMc
    ) {
      warnings.push(`Pack targets Minecraft ${info.manifest.mcVersion}, this server runs ${serverMc}`);
    }
    if (info.manifest.loader && serverLoader && info.manifest.loader !== serverLoader) {
      warnings.push(`Pack targets ${info.manifest.loader}, this server runs ${serverLoader}`);
    }
    return {
      type: 'curseforge-pack',
      pack: {
        name: info.manifest.name,
        version: info.manifest.version,
        author: info.manifest.author,
        mcVersion: info.manifest.mcVersion,
        loader: info.manifest.loader,
        loaderVersion: info.manifest.loaderVersion,
      },
      items,
      overrides: { count: info.overridesEntries.length },
      warnings,
    };
  }

  // jars
  const buffers = await readEntryBuffers(zipPath, isJarEntry);
  const identified = await modIdentify.identifyJars([...buffers.entries()].map(([name, buffer]) => ({ name, buffer })));
  const items = identified.map((j) => ({
    entry: j.filename,
    filename: path.basename(j.filename),
    size: j.size,
    sha256: j.sha256,
    identity: j.identity,
    verdict: judge(j.identity),
    installed:
      (j.identity && j.identity.platform && installed.keys.has(`${j.identity.platform}:${j.identity.projectId}`)) ||
      installed.filenames.has(path.basename(j.filename)),
  }));
  return { type: 'jars', items, overrides: { count: 0 }, warnings: [] };
}

/**
 * Server-less preview for the wizard's "create from zip" flow: what's inside,
 * plus (for jar zips) the loader / MC version / content kind inferred from the
 * identified jars, so the wizard can prefill server creation.
 */
async function previewStandalone(zipPath) {
  const info = await inspect(zipPath);
  if (info.type === 'curseforge-pack') {
    const items = (await resolveManifestEntries(info.manifest.files)).map((e) => ({ ...e, downloadUrl: undefined }));
    return {
      type: 'curseforge-pack',
      pack: {
        name: info.manifest.name,
        version: info.manifest.version,
        author: info.manifest.author,
        mcVersion: info.manifest.mcVersion,
        loader: info.manifest.loader,
        loaderVersion: info.manifest.loaderVersion,
      },
      items,
      overrides: { count: info.overridesEntries.length },
      inferred: { loader: info.manifest.loader, mcVersion: info.manifest.mcVersion, kind: 'mod' },
    };
  }
  const buffers = await readEntryBuffers(zipPath, isJarEntry);
  const identified = await modIdentify.identifyJars([...buffers.entries()].map(([name, buffer]) => ({ name, buffer })));
  const items = identified.map((j) => ({
    entry: j.filename,
    filename: path.basename(j.filename),
    size: j.size,
    identity: j.identity,
  }));
  // Majority vote across identified jars. mcVersions lists every version a
  // build supports, so count each; loaders likewise.
  const tally = (values) => {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };
  const loaderVotes = tally(
    items.flatMap((i) => ((i.identity && i.identity.loaders) || []).map((l) => l.toLowerCase()))
  );
  const kindVotes = tally(items.map((i) => (i.identity && i.identity.kind) || 'mod'));
  const kind = (kindVotes[0] && kindVotes[0][0]) || 'mod';
  const modLoaderVotes = loaderVotes.filter(([l]) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(l));
  const mcVotes = tally(items.flatMap((i) => (i.identity && i.identity.mcVersions) || []));
  return {
    type: 'jars',
    items,
    overrides: { count: 0 },
    inferred: {
      kind,
      loader: kind === 'plugin' ? 'paper' : (modLoaderVotes[0] && modLoaderVotes[0][0]) || null,
      mcVersion: (mcVotes[0] && mcVotes[0][0]) || null,
      mcVersionOptions: mcVotes.map(([v]) => v).slice(0, 20),
    },
  };
}

// ---- Overrides apply --------------------------------------------------------

/**
 * Extract a pack's overrides/ tree into the server dir. Every file that would
 * be overwritten is copied into a timestamped backup dir first.
 */
async function applyOverridesTo(serverId, zipPath, overridesPrefix, { actor = 'system' } = {}) {
  serverTarget(serverId);
  const serverDir = dataPath('servers', serverId);
  const { entries } = await readZipIndex(zipPath);
  const overrideFiles = entries.filter((e) => e.name.startsWith(overridesPrefix) && !e.name.endsWith('/'));
  if (!overrideFiles.length) return { applied: 0, backedUp: 0, backupDir: null };
  if (overrideFiles.length > MAX_OVERRIDE_ENTRIES) throw httpError(400, 'Overrides tree has too many files');
  const totalBytes = overrideFiles.reduce((n, e) => n + (e.size || 0), 0);
  if (totalBytes > MAX_OVERRIDE_BYTES) throw httpError(413, 'Overrides tree is too large');

  // Reversibility first: copy aside everything the extraction would replace.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupRel = path.join('.import-backups', stamp);
  const backupDir = path.join(serverDir, backupRel);
  let backedUp = 0;
  for (const e of overrideFiles) {
    const rel = e.name.slice(overridesPrefix.length);
    if (!rel || !safeEntryName(rel)) continue;
    const target = path.join(serverDir, rel);
    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      const dest = path.join(backupDir, rel);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.copyFile(target, dest);
      backedUp += 1;
    }
  }

  let applied = 0;
  await extractZipSafe(zipPath, serverDir, {
    map: (name) => {
      if (!name.startsWith(overridesPrefix)) return null;
      const rel = name.slice(overridesPrefix.length);
      if (!rel) return null;
      // Never let overrides touch the panel's own backup tree.
      if (rel === '.import-backups' || rel.startsWith('.import-backups/')) return null;
      if (!name.endsWith('/')) applied += 1;
      return rel;
    },
  });
  recordEvent({
    serverId,
    actor,
    type: 'mod-installed',
    summary: `Modpack overrides applied: ${applied} files (${backedUp} overwritten files backed up to ${backupRel})`,
    details: { applied, backedUp, backupDir: backedUp ? backupRel : null },
  });
  return { applied, backedUp, backupDir: backedUp ? backupRel : null };
}

// ---- Import -----------------------------------------------------------------

/**
 * Install a previewed zip into a server.
 * selections: for curseforge-pack — fileIds to install (default: every
 * resolved downloadable entry); for jars — entry names (default: every jar
 * whose verdict isn't wrong-*). applyOverrides only applies to pack zips.
 * @returns {installed, failed, blocked, skipped, overrides}
 */
async function importForServer(
  serverId,
  zipPath,
  { selections = null, applyOverrides = false, actor = 'system', onStep = () => {} } = {}
) {
  const server = serverTarget(serverId);
  // Server-type-derived, like every other install path — a hardcoded 'mod'
  // would file pack jars under mods/ on a Paper-family server, where the Mods
  // tab never lists them (so they couldn't even be removed from the panel).
  const targetKind = modsService.contentKindOf(server);
  const info = await inspect(zipPath);
  const report = { installed: [], failed: [], blocked: [], skipped: [], overrides: null };

  if (info.type === 'curseforge-pack') {
    onStep(`Resolving ${info.manifest.files.length} mods via CurseForge`);
    const entries = await resolveManifestEntries(info.manifest.files);
    const wanted = selections ? new Set(selections.map(Number)) : null;
    const queue = [];
    // Missing/blocked status outranks deselection: the UI force-unchecks those
    // rows, so 'deselected' would hide a pack's real gaps from the report and
    // the event log.
    for (const e of entries) {
      if (!e.resolved) {
        report.failed.push({ name: e.name, reason: 'file no longer exists on CurseForge' });
      } else if (!e.downloadable) {
        report.blocked.push({
          name: e.name,
          fileName: e.fileName,
          url: e.url,
          projectId: e.projectId,
          fileId: e.fileId,
        });
      } else if (wanted && !wanted.has(e.fileId)) {
        report.skipped.push({ name: e.name, reason: 'deselected' });
      } else {
        queue.push(e);
      }
    }
    for (let i = 0; i < queue.length; i += 1) {
      const e = queue[i];
      onStep(`Installing mod ${i + 1}/${queue.length}: ${e.name}`);
      try {
        const { filename } = await modsService.installResolved(
          serverId,
          {
            downloadUrl: e.downloadUrl,
            kind: targetKind,
            meta: {
              category: targetKind,
              platform: 'curseforge',
              projectId: String(e.projectId),
              fileId: String(e.fileId),
              name: e.name,
              filename: e.fileName,
              version: e.version,
              iconUrl: e.iconUrl,
              mcVersions: e.mcVersions,
              loaders: e.loaders,
            },
          },
          { actor }
        );
        report.installed.push({ name: e.name, filename });
      } catch (err) {
        report.failed.push({ name: e.name, reason: err.message });
      }
    }
    if (applyOverrides) {
      onStep('Applying pack overrides');
      report.overrides = await applyOverridesTo(serverId, zipPath, info.manifest.overridesPrefix, { actor });
    }
  } else {
    onStep(`Reading ${info.jarEntries.length} jars`);
    const buffers = await readEntryBuffers(zipPath, isJarEntry);
    const identified = await modIdentify.identifyJars(
      [...buffers.entries()].map(([name, buffer]) => ({ name, buffer }))
    );
    const identityByEntry = new Map(identified.map((j) => [j.filename, j.identity]));
    // Documented default (no selections): install every jar whose verdict isn't
    // wrong-* — unidentified jars stay in, but a jar known to be the wrong
    // loader/kind/MC for this server never installs implicitly.
    const judge = (entry) =>
      modIdentify.verdictFor(identityByEntry.get(entry) || null, {
        kind: targetKind,
        loader: modsService.loaderOf(server),
        mc: server.mc_version,
      });
    const wanted = selections ? new Set(selections) : null;
    const names = [];
    for (const entry of buffers.keys()) {
      const verdict = wanted ? null : judge(entry);
      if (wanted && !wanted.has(entry)) {
        report.skipped.push({ name: path.basename(entry), reason: 'deselected' });
      } else if (verdict && verdict.status.startsWith('wrong-')) {
        report.skipped.push({ name: path.basename(entry), reason: verdict.status });
      } else {
        names.push(entry);
      }
    }
    const tmpDir = dataPath('tmp');
    await fsp.mkdir(tmpDir, { recursive: true });
    for (let i = 0; i < names.length; i += 1) {
      const entry = names[i];
      const base = path.basename(entry);
      onStep(`Installing ${i + 1}/${names.length}: ${base}`);
      const tmpFile = path.join(tmpDir, `zipjar-${Date.now()}-${i}-${base.replace(/[^\w.-]/g, '_')}`);
      try {
        await fsp.writeFile(tmpFile, buffers.get(entry));
        const res = await modsService.installLocalContent(serverId, tmpFile, base, {
          identity: identityByEntry.get(entry) || null,
          actor,
        });
        report.installed.push({ name: res.name || base, filename: res.filename });
      } catch (err) {
        report.failed.push({ name: base, reason: err.message });
      } finally {
        await fsp.rm(tmpFile, { force: true }).catch(() => {});
      }
    }
  }

  recordEvent({
    serverId,
    actor,
    type: 'mod-installed',
    summary: `Zip import: ${report.installed.length} installed, ${report.failed.length} failed, ${report.blocked.length} need manual download`,
    details: {
      installed: report.installed.length,
      failed: report.failed.length,
      blocked: report.blocked.length,
      skipped: report.skipped.length,
    },
  });
  return report;
}

module.exports = {
  inspect,
  parsePackManifest,
  previewForServer,
  previewStandalone,
  importForServer,
  applyOverridesTo,
  resolveManifestEntries,
};
