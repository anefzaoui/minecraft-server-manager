// Create-server wizard. TWO independent controls:
//   SOURCE TABS  — Vanilla | From mods | From modpack | From blueprint
//   SIMPLE/ADVANCED — whether the full itzg catalog (#wz-advanced) renders
// "From mods" is the modded-server hub: a loader-first browser (pick loader +
// MC → search Modrinth/CurseForge → per-mod version pinning with required
// dependencies auto-resolved for review) plus an optional "Auto-detect" solver.
// Vanilla/modpack/mods creation each run as ONE server-side task with real
// progress; blueprint imports via its own endpoint.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { runTask } from '../lib/progress.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { enhanceSelect } from '../lib/select.js';
import { showPackDetails, packIconHtml, formatDownloads } from './modpacks.js';
import { attachMotdEditor, toSectionCodes } from '../lib/motd.js';

const root = document.getElementById('wizard');
if (root) init();

function init() {
  let icon = 'grass';
  let accent = '#3fa62b';
  let type = 'VANILLA';

  pickGroup(
    'wz-icons',
    'icon',
    (v) => {
      icon = v;
    },
    ['border-2', 'border-grass-500']
  );
  pickGroup(
    'wz-colors',
    'accent',
    (v) => {
      accent = v;
    },
    ['border-2', 'border-white/60']
  );
  pickGroup(
    'wz-flavors',
    'type',
    (v) => {
      type = v;
    },
    ['border-2', 'border-grass-500', 'text-grass-300']
  );

  // Visual MOTD editor (shared lib: toolbar + presets + live preview)
  const motd = document.getElementById('wz-motd');
  const preview = document.getElementById('wz-motd-preview');
  attachMotdEditor(motd, {
    preview,
    getName: () => document.getElementById('wz-name')?.value.trim() || 'My Server',
  });

  // ---- Source tabs + Simple/Advanced toggle (two INDEPENDENT controls) ----
  const ACTIVE = ['bg-grass-600/20', 'text-grass-300'];
  const sourceTabsEl = document.getElementById('wz-source-tabs');
  const detailToggleEl = document.getElementById('wz-detail-toggle');
  const modsPanel = document.getElementById('wz-mods-panel');
  const packPanel = document.getElementById('wz-modpack');
  const bpPanel = document.getElementById('wz-blueprint-panel');
  const flavorCard = document.getElementById('wz-card-flavor');
  const worldCard = document.getElementById('wz-card-world');
  const resourcesCard = document.getElementById('wz-card-resources');
  const advPanel = document.getElementById('wz-advanced');

  let sourceTab = 'vanilla';
  let detail = 'simple';
  // From-mods sub-mode + the loader/version chosen by the Auto-detect solver.
  let modsMode = 'browse';
  const solverState = { pick: null, slugs: [] };

  function setClasses(btn, on) {
    for (const c of ACTIVE) btn.classList.toggle(c, on);
  }

  /** Grey out a whole section: dim it and disable every control inside. */
  function setSectionDisabled(card, disabled) {
    if (!card) return;
    card.classList.toggle('opacity-50', disabled);
    card.classList.toggle('pointer-events-none', disabled);
    card.querySelectorAll('input, select, textarea, button').forEach((el) => {
      el.disabled = disabled;
    });
  }

  function refreshDetailUI() {
    // Advanced env applies to vanilla, from-mods AND pack servers (extra env is
    // honored by the image); a blueprint owns its env, so hide it there.
    const allowAdvanced = sourceTab !== 'blueprint';
    detailToggleEl?.classList.toggle('hidden', !allowAdvanced);
    advPanel?.classList.toggle('hidden', !(allowAdvanced && detail === 'advanced'));
    detailToggleEl?.querySelectorAll('[data-detail]').forEach((b) => setClasses(b, b.dataset.detail === detail));
  }

  /** Show/hide the From-mods sub-panels for the current sub-mode. */
  function refreshModsMode() {
    document.getElementById('wz-mods-browse')?.classList.toggle('hidden', modsMode !== 'browse');
    document.getElementById('wz-solver')?.classList.toggle('hidden', modsMode !== 'auto');
    document
      .getElementById('wz-mods-mode')
      ?.querySelectorAll('[data-mode]')
      .forEach((b) => setClasses(b, b.dataset.mode === modsMode));
  }

  function refreshPanels() {
    modsPanel?.classList.toggle('hidden', sourceTab !== 'mods');
    packPanel?.classList.toggle('hidden', sourceTab !== 'modpack');
    bpPanel?.classList.toggle('hidden', sourceTab !== 'blueprint');
    // Flavor & version card is the Vanilla tab's own — the mod loaders live in
    // the From-mods browser, and modpack/blueprint dictate their own type.
    flavorCard?.classList.toggle('hidden', sourceTab !== 'vanilla');
    // Blueprint owns world/rules/resources (audit F2): grey them out for real.
    setSectionDisabled(worldCard, sourceTab === 'blueprint');
    setSectionDisabled(resourcesCard, sourceTab === 'blueprint');
    if (sourceTab === 'mods') refreshModsMode();
    refreshDetailUI();
  }

  function setSourceTab(tab) {
    if (sourceTab === tab) return;
    // Leaving From-mods clears its queued selection so Create never silently
    // installs mods chosen under another tab.
    if (sourceTab === 'mods') {
      const hadSelection = browser.count() > 0 || solverState.pick;
      browser.clear();
      solverState.pick = null;
      solverState.slugs = [];
      if (hadSelection) toast('Left "From mods" — the queued mods were cleared.', { kind: 'info' });
    }
    sourceTab = tab;
    sourceTabsEl?.querySelectorAll('[data-source]').forEach((b) => setClasses(b, b.dataset.source === tab));
    refreshPanels();
    if (tab === 'mods') document.getElementById('wz-mods-q')?.focus();
    if (tab === 'modpack') document.getElementById('wz-pack-q')?.focus();
  }

  sourceTabsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-source]');
    if (btn) setSourceTab(btn.dataset.source);
  });
  detailToggleEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-detail]');
    if (!btn) return;
    detail = btn.dataset.detail;
    refreshDetailUI();
  });
  document.getElementById('wz-mods-mode')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    modsMode = btn.dataset.mode;
    refreshModsMode();
    document.getElementById(modsMode === 'auto' ? 'wz-solver-q' : 'wz-mods-q')?.focus();
  });

  initSolver({
    onApplied: (pair, slugs) => {
      solverState.pick = pair;
      solverState.slugs = slugs;
    },
  });

  const browser = initModBrowser();
  const packPicker = initPackPicker();
  initPortCheck();
  refreshPanels();

  // Deep link from the pack browser / details modal:
  // /servers/new?pack=<platform>:<ref>[&version=<id>] → From-modpack, prefilled.
  const params = new URLSearchParams(location.search);
  const packParam = /^(modrinth|curseforge):(.+)$/.exec(params.get('pack') || '');
  if (packParam && packPicker) {
    setSourceTab('modpack');
    packPicker.select(packParam[1], packParam[2], params.get('version') || undefined);
  }

  /** Collect only NON-DEFAULT advanced values as env vars. */
  function collectAdvancedEnv() {
    const env = {};
    if (!advPanel || advPanel.classList.contains('hidden')) return env;
    advPanel.querySelectorAll('[data-catalog-key][data-catalog-scope="env"]').forEach((el) => {
      const key = el.dataset.catalogKey;
      const def = el.dataset.catalogDefault ?? '';
      if (el.dataset.catalogType === 'boolean') {
        const defaultOn = def === 'true';
        if (el.checked !== defaultOn) env[key] = el.checked ? 'true' : 'false';
      } else if (el.dataset.catalogType === 'list') {
        const value = el.value.trim();
        if (value) env[key] = value;
      } else {
        const value = el.value.trim();
        if (value && value !== String(def)) env[key] = value;
      }
    });
    const extra = document.getElementById('wz-extra-env')?.value || '';
    for (const line of extra.split(/\r?\n/)) {
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) env[m[1]] = m[2];
    }
    return env;
  }
  window.__wzCollectAdvancedEnv = collectAdvancedEnv;

  /** Simple-mode world/rules env, shared by the vanilla, modpack and mods paths. */
  function collectSimpleEnv() {
    return {
      MOTD: toSectionCodes(motd.value), // vanilla renders § codes only
      DIFFICULTY: document.getElementById('wz-difficulty').value,
      MODE: document.getElementById('wz-mode').value,
      PVP: document.getElementById('wz-pvp').value,
      MAX_PLAYERS: String(Number(document.getElementById('wz-maxplayers').value) || 10),
      ...(document.getElementById('wz-seed').value.trim()
        ? { SEED: document.getElementById('wz-seed').value.trim() }
        : {}),
      ...collectAdvancedEnv(),
    };
  }

  function resources() {
    const heapMb = Number(document.getElementById('wz-ram').value);
    return {
      heapMb,
      containerMemoryMb: Math.round((heapMb * 1.5) / 512) * 512,
      diskQuotaGb: Number(document.getElementById('wz-quota').value),
      portGame: Number(document.getElementById('wz-port').value) || undefined,
    };
  }

  document.getElementById('wz-create').addEventListener('click', async () => {
    const name = document.getElementById('wz-name').value.trim();
    if (!name) {
      toast('Give the server a name first.', { kind: 'error' });
      document.getElementById('wz-name').focus();
      return;
    }
    if (sourceTab === 'blueprint') return createFromBlueprint(name);
    if (sourceTab === 'modpack') return createFromPack(name);
    if (sourceTab === 'mods') return createFromMods(name);
    return createVanilla(name);
  });

  // ---- Create: blueprint (import with full identity overrides) ----
  async function createFromBlueprint(name) {
    const blueprintId = document.getElementById('wz-blueprint')?.value;
    if (!blueprintId) {
      toast('Choose a blueprint first.', { kind: 'error' });
      return;
    }
    const modal = openModal({
      title: `Creating ${name} from blueprint…`,
      size: 'sm',
      content:
        '<div class="space-y-3 text-sm"><p>Installing the blueprint: pinned pack, overlay mods (hash-verified), and config files.</p><div class="meter"><div class="bg-grass-500 animate-pulse" style="width:100%"></div></div></div>',
    });
    try {
      const res = await fetch('/api/blueprints/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId,
          overrides: {
            name,
            icon,
            accent,
            ...(document.getElementById('wz-desc').value.trim()
              ? { description: document.getElementById('wz-desc').value.trim() }
              : {}),
          },
        }),
      });
      const data = await res.json();
      modal.close();
      if (!res.ok || !data.ok) {
        toast(data.error || 'Blueprint import failed', { kind: 'error', timeout: 10000 });
        return;
      }
      toast(`${name} created from blueprint.`);
      location.href = `/servers/${data.server.id}`;
    } catch (err) {
      modal.close();
      toast(`Network error: ${err.message}`, { kind: 'error' });
    }
  }

  // ---- Create: modpack (ONE server-side task — real progress end to end) ----
  async function createFromPack(name) {
    const selection = packPicker && packPicker.getSelection();
    if (!selection) {
      toast('Search and select a modpack first.', { kind: 'error' });
      document.getElementById('wz-pack-q')?.focus();
      return;
    }
    const r = resources();
    const body = {
      name,
      description: document.getElementById('wz-desc').value.trim(),
      icon,
      accent,
      platform: selection.platform,
      ref: selection.ref,
      versionId: document.getElementById('wz-pack-version')?.value || selection.resolved.versionId,
      ...r,
      env: collectSimpleEnv(),
    };
    try {
      const result = await runTask({
        title: `Creating ${name} — ${selection.resolved.projectName}`,
        start: async () => {
          const res = await fetch('/api/servers/from-pack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || 'Creation failed');
          return data.taskId;
        },
      });
      toast(`${name} created — ${result.pack.name} @ ${result.pack.version} pinned. Starting up!`);
      location.href = `/servers/${result.serverId}`;
    } catch (err) {
      toast(err.message || 'Creation failed', { kind: 'error', timeout: 12000 });
    }
  }

  // ---- Create: from mods (ONE server-side task — create → install pinned → start) ----
  async function createFromMods(name) {
    let loader;
    let mcVersion;
    let loaderVersion = '';
    let mods = [];
    if (modsMode === 'auto') {
      if (!solverState.pick) {
        toast('Solve compatibility and press "Apply" first.', { kind: 'error' });
        document.getElementById('wz-solver-q')?.focus();
        return;
      }
      loader = solverState.pick.loader;
      mcVersion = solverState.pick.mcVersion;
      mods = solverState.slugs.map((slug) => ({ platform: 'modrinth', ref: slug })); // latest matching build
    } else {
      const state = browser.getState();
      loader = state.loader;
      mcVersion = state.mc;
      loaderVersion = state.loaderVersion;
      mods = state.mods;
    }
    if (!loader || !mcVersion) {
      toast('Pick a loader and Minecraft version first.', { kind: 'error' });
      return;
    }
    const body = {
      name,
      description: document.getElementById('wz-desc').value.trim(),
      icon,
      accent,
      loader,
      mcVersion,
      ...(loaderVersion ? { loaderVersion } : {}),
      mods,
      ...resources(),
      env: collectSimpleEnv(),
    };
    try {
      const result = await runTask({
        title: `Creating ${name} (${loader})`,
        start: async () => {
          const res = await fetch('/api/servers/from-mods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || 'Creation failed');
          return data.taskId;
        },
      });
      if (result.failed && result.failed.length) {
        toast(
          `${name} created — ${result.installed}/${result.total} mods installed. Failed: ${result.failed.join(', ')}`,
          {
            kind: 'error',
            timeout: 14000,
          }
        );
      } else {
        toast(
          `${name} created${result.total ? ` — ${result.total} mod${result.total === 1 ? '' : 's'} installed` : ''}. Starting up!`
        );
      }
      location.href = `/servers/${result.serverId}`;
    } catch (err) {
      toast(err.message || 'Creation failed', { kind: 'error', timeout: 12000 });
    }
  }

  // ---- Create: vanilla / plugin server (no mods) ----
  async function createVanilla(name) {
    const body = {
      name,
      description: document.getElementById('wz-desc').value.trim(),
      icon,
      accent,
      type,
      mcVersion: document.getElementById('wz-version').value,
      ...resources(),
      env: collectSimpleEnv(),
      start: true,
    };

    const modal = openModal({
      title: `Creating ${name}…`,
      size: 'sm',
      content: `<div class="space-y-3 text-sm">
        <p>Pulling the server image if needed (first time can take a few minutes), creating the container, and starting it.</p>
        <div class="meter"><div class="bg-grass-500 animate-pulse" style="width:100%"></div></div>
      </div>`,
    });

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      modal.close();
      if (!res.ok || !data.ok) {
        toast(data.error || 'Creation failed', { kind: 'error', timeout: 10000 });
        return;
      }
      toast(`${name} created — starting up!`);
      location.href = `/servers/${data.server.id}`;
    } catch (err) {
      modal.close();
      toast(`Network error: ${err.message}`, { kind: 'error' });
    }
  }
}

// ---- Live game-port validation ----------------------------------------------

function initPortCheck() {
  const input = document.getElementById('wz-port');
  const help = document.getElementById('wz-port-help');
  if (!input || !help) return;
  const setHelp = (text, cls) => {
    help.textContent = text;
    help.className = `help ${cls}`;
  };
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(check, 400);
  });
  async function check() {
    const port = Number(input.value);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      setHelp('Enter a port between 1024 and 65535.', 'text-redstone-400');
      return;
    }
    try {
      const res = await fetch(`/api/ports/check?port=${port}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'check failed');
      if (Number(input.value) !== port) return; // user kept typing — stale
      if (data.free) setHelp(`✓ Port ${port} is free — RCON gets ${port + 1000}.`, 'text-grass-400');
      else setHelp(`✗ Port ${port} is already in use — pick another.`, 'text-redstone-400');
    } catch {
      setHelp('Could not check the port right now.', 'text-ink-faint');
    }
  }
}

// ---- From-mods: loader-first browser ----------------------------------------
// Pick loader + MC → search Modrinth/CurseForge → a full list of selected mods
// (icon, name, description, version dropdown) with required dependencies
// auto-resolved into "added as dependency" rows the user can edit or remove.

function initModBrowser() {
  const panel = document.getElementById('wz-mods-browse');
  if (!panel)
    return { getState: () => ({ loader: '', mc: '', loaderVersion: '', mods: [] }), clear() {}, count: () => 0 };

  const mcSel = document.getElementById('wz-mods-mc');
  const loaderVerSel = document.getElementById('wz-mods-loaderver');
  const q = document.getElementById('wz-mods-q');
  const platformsEl = document.getElementById('wz-mods-platforms'); // absent when no CF key
  const resultsEl = document.getElementById('wz-mods-results');
  const selectedWrap = document.getElementById('wz-mods-selected-wrap');
  const selectedEl = document.getElementById('wz-mods-selected');
  const countEl = document.getElementById('wz-mods-count');
  const depHintEl = document.getElementById('wz-mods-dephint');

  let loader = 'fabric';
  let platform = 'modrinth';
  const picked = new Map(); // key -> {platform, ref, projectId, name, description, iconUrl, versions, versionId}
  const deps = new Map(); // key -> {platform, ref, projectId, name, iconUrl, versions, versionId, dependency:true}
  const suppressed = new Set(); // dep keys the user removed — don't re-add
  let lastResults = [];

  const key = (p, ref) => `${p}:${ref}`;
  const mc = () => mcSel?.value || '';

  // Seed the MC picker from the Vanilla tab's full version list (concrete
  // versions only — mods need a real MC), defaulting to the newest release.
  (function seedMcOptions() {
    const src = document.getElementById('wz-version');
    if (!src || !mcSel) return;
    const opts = [...src.options].filter((o) => o.value !== 'LATEST');
    mcSel.innerHTML = opts
      .map(
        (o) =>
          `<option value="${escapeHtml(o.value)}"${o.dataset.desc ? ` data-desc="${escapeHtml(o.dataset.desc)}"` : ''}>${escapeHtml(o.value)}</option>`
      )
      .join('');
    const latestRelease = opts.find((o) => !o.dataset.desc); // releases carry no channel desc
    mcSel.value = latestRelease ? latestRelease.value : opts[0]?.value || '';
    mcSel.dispatchEvent(new Event('change', { bubbles: true }));
  })();

  pickGroup(
    'wz-loaders',
    'loader',
    (v) => {
      loader = v;
      clearSelection(true);
      refreshLoaderBuilds();
      if (q.value.trim()) search();
    },
    ['border-2', 'border-grass-500', 'text-grass-300']
  );

  function syncPlatformChips() {
    platformsEl?.querySelectorAll('[data-platform]').forEach((b) => {
      const on = b.dataset.platform === platform;
      b.classList.toggle('border-grass-500', on);
      b.classList.toggle('text-grass-300', on);
    });
  }
  platformsEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-platform]');
    if (!btn) return;
    platform = btn.dataset.platform;
    syncPlatformChips();
    if (q.value.trim()) search();
  });

  mcSel?.addEventListener('change', () => {
    clearSelection(true);
    refreshLoaderBuilds();
    if (q.value.trim()) search();
  });
  loaderVerSel?.addEventListener('change', () => {}); // value read on demand in getState

  let searchTimer;
  q.addEventListener('input', () => {
    clearTimeout(searchTimer);
    if (!q.value.trim()) {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
      return;
    }
    searchTimer = setTimeout(search, 350);
  });

  async function refreshLoaderBuilds() {
    if (!loaderVerSel) return;
    loaderVerSel.innerHTML = '<option value="">Latest (recommended)</option>';
    loaderVerSel.dispatchEvent(new Event('change', { bubbles: true }));
    try {
      const res = await fetch(
        `/api/loaders/versions?loader=${encodeURIComponent(loader)}&mc=${encodeURIComponent(mc())}`
      );
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      loaderVerSel.innerHTML = (data.builds || [{ version: '', label: 'Latest (recommended)' }])
        .map((b) => `<option value="${escapeHtml(b.version)}">${escapeHtml(b.label)}</option>`)
        .join('');
      loaderVerSel.value = data.default || '';
      loaderVerSel.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      /* offline — the Latest option still works */
    }
  }

  async function search() {
    const term = q.value.trim();
    if (!term) return;
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = '<div class="p-3 text-center text-sm text-ink-faint">Searching…</div>';
    try {
      const url = `/api/mods/search?q=${encodeURIComponent(term)}&platform=${platform}&loader=${encodeURIComponent(loader)}&mc=${encodeURIComponent(mc())}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Search failed');
      lastResults = data.results;
      renderResults();
    } catch (err) {
      resultsEl.innerHTML = `<div class="p-3 text-center text-sm text-redstone-400">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderResults() {
    if (!lastResults.length) {
      resultsEl.innerHTML = `<div class="p-3 text-center text-sm text-ink-faint">No ${escapeHtml(loader)} mods found for ${escapeHtml(mc())}.</div>`;
      return;
    }
    resultsEl.innerHTML = lastResults
      .map((m, i) => {
        const added = picked.has(key(m.platform, m.ref));
        return `
      <div class="flex items-center gap-2.5 border-b border-line px-2.5 py-2 text-sm last:border-b-0">
        ${packIconHtml(m.iconUrl, 'size-9')}
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">${escapeHtml(m.name)}</span>
          <span class="block truncate text-xs text-ink-faint">${escapeHtml(m.description || '')}</span>
        </span>
        <span class="shrink-0 font-mono text-xs text-ink-faint">${formatDownloads(m.downloads)}</span>
        <button type="button" class="btn btn-sm shrink-0" data-add="${i}" ${added ? 'disabled' : ''}>${added ? 'Added' : 'Add'}</button>
      </div>`;
      })
      .join('');
  }

  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const hit = lastResults[Number(btn.dataset.add)];
    if (hit) withBusy(btn, 'Adding…', () => addMod(hit));
  });

  async function fetchVersions(p, ref) {
    const url = `/api/mods/versions?platform=${p}&ref=${encodeURIComponent(ref)}&loader=${encodeURIComponent(loader)}&mc=${encodeURIComponent(mc())}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load versions');
    return data.versions || [];
  }

  async function addMod(hit) {
    const k = key(hit.platform, hit.ref);
    if (picked.has(k)) return;
    try {
      const versions = await fetchVersions(hit.platform, hit.ref);
      if (!versions.length) {
        toast(`${hit.name} has no ${loader} build for ${mc()}.`, { kind: 'error' });
        return;
      }
      picked.set(k, {
        platform: hit.platform,
        ref: hit.ref,
        projectId: hit.projectId,
        name: hit.name,
        description: hit.description || '',
        iconUrl: hit.iconUrl,
        versions,
        versionId: versions[0].versionId,
      });
      suppressed.delete(k); // re-adding a manually-removed dep un-suppresses it
      renderSelected();
      renderResults();
      resolveDeps();
    } catch (err) {
      toast(err.message, { kind: 'error' });
    }
  }

  function removeEntry(k) {
    if (picked.has(k)) {
      picked.delete(k);
      resolveDeps(); // orphaned dependencies drop out on the next resolve
    } else if (deps.has(k)) {
      deps.delete(k);
      suppressed.add(k); // don't let the resolver bring it straight back
    }
    renderSelected();
    renderResults();
  }

  let depTimer;
  function resolveDeps() {
    clearTimeout(depTimer);
    depTimer = setTimeout(doResolveDeps, 300);
  }

  async function doResolveDeps() {
    const selection = [...picked.values()].map((m) => ({ platform: m.platform, ref: m.ref, versionId: m.versionId }));
    if (!selection.length) {
      deps.clear();
      renderSelected();
      return;
    }
    if (depHintEl) depHintEl.textContent = 'Resolving dependencies…';
    try {
      const res = await fetch('/api/mods/deps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loader, mc: mc(), selection }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Dependency resolve failed');
      // Rebuild the dependency set from the fresh closure so removing a mod also
      // removes its now-orphaned deps; keep a user's version pick where the dep
      // persists, and never re-add a dep the user explicitly removed.
      const next = new Map();
      for (const d of data.deps || []) {
        const k = key(d.platform, d.ref);
        if (suppressed.has(k) || picked.has(k)) continue;
        const prev = deps.get(k);
        const versionId = prev && d.versions.some((v) => v.versionId === prev.versionId) ? prev.versionId : d.versionId;
        next.set(k, { ...d, versionId, dependency: true });
      }
      deps.clear();
      for (const [k, v] of next) deps.set(k, v);
      if (depHintEl) {
        const warn = (data.warnings || []).length ? ` · ${data.warnings.length} skipped` : '';
        depHintEl.textContent = deps.size
          ? `${deps.size} dependency${deps.size === 1 ? '' : 'ies'} added${warn}`
          : warn.replace(/^ · /, '');
      }
      renderSelected();
    } catch (err) {
      if (depHintEl) depHintEl.textContent = `Dependency check failed: ${err.message}`;
    }
  }

  function versionOptions(m) {
    if (!m.versions || !m.versions.length) return '<option value="">(no compatible build)</option>';
    return m.versions
      .map((v) => {
        const nonRelease = v.versionType && v.versionType !== 'release';
        const desc = nonRelease ? ` data-desc="${escapeHtml(capitalize(v.versionType))}"` : '';
        const sel = v.versionId === m.versionId ? ' selected' : '';
        return `<option value="${escapeHtml(v.versionId)}"${desc}${sel}>${escapeHtml(v.name || v.versionNumber)}</option>`;
      })
      .join('');
  }

  function rowHtml(m, isDep) {
    const k = key(m.platform, m.ref);
    const platChip = `<span class="chip shrink-0 text-[11px]">${m.platform === 'curseforge' ? 'CurseForge' : 'Modrinth'}</span>`;
    const depBadge = isDep ? '<span class="badge bg-diamond-400/15 text-diamond-300">dependency</span>' : '';
    return `
      <div class="flex items-start gap-3 rounded-md border border-line bg-raised p-3" data-key="${escapeHtml(k)}">
        ${packIconHtml(m.iconUrl, 'size-10')}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="truncate font-semibold">${escapeHtml(m.name)}</span>
            ${depBadge}
            ${platChip}
          </div>
          ${m.description ? `<div class="truncate text-xs text-ink-faint">${escapeHtml(m.description)}</div>` : isDep ? '<div class="text-xs text-ink-faint">Required by your selection</div>' : ''}
          <div class="mt-2 max-w-xs">
            <select class="input" data-modkey="${escapeHtml(k)}" data-label="Version">${versionOptions(m)}</select>
          </div>
        </div>
        <button type="button" class="grid size-7 shrink-0 place-items-center rounded-md text-ink-faint transition hover:bg-line hover:text-ink" data-remove="${escapeHtml(k)}" aria-label="Remove ${escapeHtml(m.name)}">
          <svg class="icon size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>`;
  }

  function renderSelected() {
    const total = picked.size + deps.size;
    if (countEl) countEl.textContent = String(total);
    selectedWrap?.classList.toggle('hidden', total === 0);
    if (!total) {
      selectedEl.innerHTML = '';
      return;
    }
    const rows = [...picked.values()]
      .map((m) => rowHtml(m, false))
      .concat([...deps.values()].map((m) => rowHtml(m, true)));
    selectedEl.innerHTML = rows.join('');
    // Style each freshly-created version <select> (enhanceAll already ran on load).
    selectedEl.querySelectorAll('select[data-modkey]').forEach((el) => enhanceSelect(el));
  }

  selectedEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) removeEntry(btn.dataset.remove);
  });
  selectedEl.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-modkey]');
    if (!sel) return;
    const k = sel.dataset.modkey;
    const entry = picked.get(k) || deps.get(k);
    if (!entry) return;
    entry.versionId = sel.value;
    if (picked.has(k)) resolveDeps(); // a different build may pull different deps
  });

  function clearSelection(silent) {
    const had = picked.size + deps.size;
    picked.clear();
    deps.clear();
    suppressed.clear();
    if (depHintEl) depHintEl.textContent = '';
    renderSelected();
    if (had && !silent) toast('Selection cleared.', { kind: 'info' });
  }

  refreshLoaderBuilds();
  syncPlatformChips();

  return {
    count: () => picked.size + deps.size,
    clear: () => clearSelection(true),
    getState: () => ({
      loader,
      mc: mc(),
      loaderVersion: loaderVerSel?.value || '',
      mods: [...picked.values(), ...deps.values()]
        .filter((m) => m.versionId)
        .map((m) => ({ platform: m.platform, ref: m.ref, versionId: m.versionId })),
    }),
  };
}

// ---- From-modpack tab: search → select → pin a version -----------------------

function initPackPicker() {
  const panel = document.getElementById('wz-modpack');
  if (!panel) return null;
  const q = document.getElementById('wz-pack-q');
  const platformsEl = document.getElementById('wz-pack-platforms');
  const resultsEl = document.getElementById('wz-pack-results');
  const selectedEl = document.getElementById('wz-pack-selected');
  const summaryEl = document.getElementById('wz-pack-summary');
  const versionSel = document.getElementById('wz-pack-version');
  const detailsBtn = document.getElementById('wz-pack-details-btn');

  let platform = 'modrinth';
  let lastResults = [];
  let selection = null; // { platform, ref, resolved }
  let syncing = false;

  function syncChips() {
    platformsEl.querySelectorAll('[data-platform]').forEach((b) => {
      const on = b.dataset.platform === platform;
      b.classList.toggle('border-grass-500', on);
      b.classList.toggle('text-grass-300', on);
    });
  }

  platformsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-platform]');
    if (!btn) return;
    platform = btn.dataset.platform;
    syncChips();
    if (q.value.trim()) search();
  });

  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    if (!q.value.trim()) {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
      return;
    }
    timer = setTimeout(search, 350);
  });

  async function search() {
    const term = q.value.trim();
    if (!term) return;
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = '<div class="p-3 text-center text-sm text-ink-faint">Searching…</div>';
    try {
      const res = await fetch(`/api/packs/search?q=${encodeURIComponent(term)}&platform=${platform}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Search failed');
      lastResults = data.results;
      renderResults();
    } catch (err) {
      resultsEl.innerHTML = `<div class="p-3 text-center text-sm text-redstone-400">${escapeHtml(err.message)}${platform === 'curseforge' ? ' — <a href="/settings" class="text-diamond-400 hover:underline">API keys</a>' : ''}</div>`;
    }
  }

  function renderResults() {
    if (!lastResults.length) {
      resultsEl.innerHTML = '<div class="p-3 text-center text-sm text-ink-faint">No modpacks found.</div>';
      return;
    }
    resultsEl.innerHTML = lastResults
      .map(
        (p, i) => `
      <div class="flex items-center gap-2.5 border-b border-line px-2.5 py-2 text-sm last:border-b-0">
        ${packIconHtml(p.iconUrl, 'size-9')}
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">${escapeHtml(p.name)}</span>
          <span class="block truncate text-xs text-ink-faint">${escapeHtml(p.description || '')}</span>
        </span>
        <span class="shrink-0 font-mono text-xs text-ink-faint">${formatDownloads(p.downloads)}</span>
        <button type="button" class="btn btn-ghost btn-sm shrink-0" data-details="${i}">Details</button>
        <button type="button" class="btn btn-sm shrink-0" data-pick="${i}">Select</button>
      </div>`
      )
      .join('');
  }

  resultsEl.addEventListener('click', (e) => {
    const detailsBtn2 = e.target.closest('[data-details]');
    if (detailsBtn2) {
      const p = lastResults[Number(detailsBtn2.dataset.details)];
      if (p) showPackDetails({ platform: p.platform, ref: p.ref });
      return;
    }
    const pickBtn = e.target.closest('[data-pick]');
    if (pickBtn) {
      const p = lastResults[Number(pickBtn.dataset.pick)];
      if (p) withBusy(pickBtn, () => select(p.platform, p.ref)); // select() handles its own errors
    }
  });

  async function resolve(ref, versionId) {
    const res = await fetch('/api/packs/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, ref, ...(versionId ? { versionId } : {}) }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Could not resolve the pack');
    return data.pack;
  }

  async function select(pf, ref, versionId) {
    platform = pf;
    syncChips();
    selectedEl.classList.remove('hidden');
    summaryEl.innerHTML = '<span class="text-sm text-ink-faint">Resolving pack versions…</span>';
    try {
      const pack = await resolve(ref, versionId);
      selection = { platform: pf, ref: pack.projectRef, resolved: pack };
      syncing = true;
      versionSel.innerHTML = '';
      const versions =
        pack.allVersions && pack.allVersions.length
          ? pack.allVersions
          : [{ id: pack.versionId, name: pack.versionName, type: 'release' }];
      for (const v of versions) {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.name}${v.type && v.type !== 'release' ? ` (${v.type})` : ''}`;
        if (v.date) opt.dataset.desc = String(v.date).slice(0, 10);
        versionSel.appendChild(opt);
      }
      if (![...versionSel.options].some((o) => o.value === pack.versionId)) {
        const opt = document.createElement('option');
        opt.value = pack.versionId;
        opt.textContent = pack.versionName;
        versionSel.insertBefore(opt, versionSel.firstChild);
      }
      versionSel.value = pack.versionId;
      versionSel.dispatchEvent(new Event('change', { bubbles: true })); // sync the styled trigger
      syncing = false;
      renderSummary();
    } catch (err) {
      selection = null;
      summaryEl.innerHTML = `<span class="text-sm text-redstone-400">${escapeHtml(err.message)}</span>`;
      toast(err.message, { kind: 'error', timeout: 9000 });
    }
  }

  versionSel.addEventListener('change', async () => {
    if (syncing || !selection) return;
    const versionId = versionSel.value;
    summaryEl.innerHTML = '<span class="text-sm text-ink-faint">Resolving pack versions…</span>';
    try {
      const pack = await resolve(selection.ref, versionId);
      selection.resolved = pack;
      renderSummary();
    } catch (err) {
      renderSummary(); // put the previous (still valid) summary back
      toast(err.message, { kind: 'error', timeout: 9000 });
    }
  });

  detailsBtn.addEventListener('click', () => {
    if (selection) showPackDetails({ platform: selection.platform, ref: selection.ref });
  });

  function renderSummary() {
    const p = selection.resolved;
    const bits = [];
    if (p.mcVersion) bits.push(`Minecraft ${escapeHtml(p.mcVersion)}`);
    const loader = (p.loaders || []).find((l) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(l));
    if (loader) bits.push(escapeHtml(loader));
    summaryEl.innerHTML = `
      ${packIconHtml(p.iconUrl, 'size-10')}
      <div class="min-w-0 flex-1">
        <div class="truncate font-semibold">${escapeHtml(p.projectName)}</div>
        <div class="text-xs text-ink-faint">${bits.join(' · ') || 'Loader & MC version come from the pack'} — the pack dictates flavor and version</div>
      </div>
      <span class="chip shrink-0">pinned @ ${escapeHtml(p.versionName)}</span>`;
  }

  return {
    getSelection: () => selection,
    select,
  };
}

// ---- From-mods "Auto-detect": compatibility solver --------------------------

const CHECK_SVG =
  '<svg class="icon size-3.5 shrink-0 text-grass-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const X_SVG =
  '<svg class="icon size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

function initSolver({ onApplied = () => {} } = {}) {
  const panel = document.getElementById('wz-solver');
  if (!panel) return;

  const searchInput = document.getElementById('wz-solver-q');
  const resultsEl = document.getElementById('wz-solver-results');
  const chipsEl = document.getElementById('wz-solver-chips');
  const runBtn = document.getElementById('wz-solver-run');
  const hintEl = document.getElementById('wz-solver-hint');
  const resultEl = document.getElementById('wz-solver-result');
  const hiddenInput = document.getElementById('wz-solver-mods');

  const picked = new Map(); // slug -> { slug, title, iconUrl }
  let lastResults = [];
  let solveData = null; // last solve response
  let chosenPair = null; // pair the Apply button will use

  // Debounced Modrinth search
  let timer;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    const term = searchInput.value.trim();
    if (!term) {
      resultsEl.classList.add('hidden');
      resultsEl.innerHTML = '';
      return;
    }
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/solver/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Search failed');
        lastResults = data.results;
        renderResults();
      } catch (err) {
        toast(`Modrinth search failed: ${err.message}`, { kind: 'error' });
      }
    }, 300);
  });

  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const hit = lastResults.find((r) => r.slug === btn.dataset.add);
    if (!hit || picked.has(hit.slug)) return;
    if (picked.size >= 25) {
      toast('25 mods max per solve.', { kind: 'error' });
      return;
    }
    picked.set(hit.slug, { slug: hit.slug, title: hit.title, iconUrl: hit.iconUrl });
    invalidateResult();
    renderChips();
    renderResults();
  });

  chipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    picked.delete(btn.dataset.remove);
    invalidateResult();
    renderChips();
    renderResults();
  });

  runBtn.addEventListener('click', async () => {
    if (!picked.size) return;
    const restore = setBusy(runBtn, 'Solving…');
    hintEl.textContent = 'Checking every mod’s loaders and versions on Modrinth…';
    try {
      const res = await fetch('/api/solver/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: [...picked.keys()] }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Solve failed');
      solveData = data;
      chosenPair = data.best || data.partial || null;
      renderSolveResult();
      hintEl.textContent = '';
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 8000 });
      hintEl.textContent = 'Solve failed — try again.';
    } finally {
      restore();
      runBtn.disabled = !picked.size;
    }
  });

  resultEl.addEventListener('click', (e) => {
    const altBtn = e.target.closest('[data-alt]');
    if (altBtn && solveData) {
      const idx = Number(altBtn.dataset.alt);
      chosenPair = idx === -1 ? solveData.best || solveData.partial : solveData.alternatives[idx];
      renderSolveResult();
      return;
    }
    if (e.target.closest('[data-apply]')) applyChoice();
  });

  function invalidateResult() {
    solveData = null;
    chosenPair = null;
    hiddenInput.value = '';
    resultEl.classList.add('hidden');
    resultEl.innerHTML = '';
    hintEl.textContent = picked.size ? '' : 'Add at least one mod to solve.';
  }

  function renderChips() {
    runBtn.disabled = !picked.size;
    chipsEl.innerHTML = '';
    chipsEl.classList.toggle('hidden', !picked.size);
    chipsEl.classList.toggle('flex', !!picked.size);
    for (const mod of picked.values()) {
      const chip = document.createElement('span');
      chip.className =
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-inset py-1 pl-1.5 pr-1 text-xs';
      chip.innerHTML = `
        ${mod.iconUrl ? `<img src="${escapeHtml(mod.iconUrl)}" alt="" class="size-4 rounded-sm">` : ''}
        <span class="max-w-40 truncate">${escapeHtml(mod.title)}</span>
        <button type="button" data-remove="${escapeHtml(mod.slug)}" class="grid size-5 place-items-center rounded-full text-ink-faint transition hover:bg-line hover:text-ink" aria-label="Remove ${escapeHtml(mod.title)}">${X_SVG}</button>`;
      chipsEl.appendChild(chip);
    }
  }

  function renderResults() {
    resultsEl.innerHTML = '';
    if (!lastResults.length) {
      resultsEl.innerHTML = '<div class="p-3 text-center text-sm text-ink-faint">No mods found.</div>';
      resultsEl.classList.remove('hidden');
      return;
    }
    for (const hit of lastResults) {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2.5 border-b border-line px-2.5 py-2 text-sm last:border-b-0';
      const added = picked.has(hit.slug);
      row.innerHTML = `
        ${hit.iconUrl ? `<img src="${escapeHtml(hit.iconUrl)}" alt="" class="size-8 shrink-0 rounded">` : '<span class="grid size-8 shrink-0 place-items-center rounded bg-inset text-ink-faint">?</span>'}
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">${escapeHtml(hit.title)}</span>
          <span class="block truncate text-xs text-ink-faint">${escapeHtml(hit.description || '')}</span>
        </span>
        <span class="shrink-0 font-mono text-xs text-ink-faint">${formatDownloads(hit.downloads)}</span>
        <button type="button" data-add="${escapeHtml(hit.slug)}" class="btn btn-sm shrink-0" ${added ? 'disabled' : ''}>${added ? 'Added' : 'Add'}</button>`;
      resultsEl.appendChild(row);
    }
    resultsEl.classList.remove('hidden');
  }

  function renderSolveResult() {
    if (!solveData) return;
    const total = solveData.perProject.length;
    const pair = chosenPair;
    resultEl.innerHTML = '';
    resultEl.classList.remove('hidden');

    if (!pair) {
      resultEl.innerHTML =
        '<div class="rounded-md border border-redstone-700 bg-redstone-600/10 p-4 text-sm">No loader has builds for any of these mods. Try removing one and solving again.</div>';
      return;
    }

    const isPartial = !solveData.best;
    const chosenIsBest =
      solveData.best && pair.loader === solveData.best.loader && pair.mcVersion === solveData.best.mcVersion;

    const head = document.createElement('div');
    head.className = isPartial
      ? 'rounded-md border border-gold-700 bg-gold-600/10 p-4'
      : 'rounded-md border border-grass-700 bg-grass-600/10 p-4';
    head.innerHTML = `
      <p class="text-xs font-semibold uppercase tracking-wider ${isPartial ? 'text-gold-400' : 'text-grass-400'}">${isPartial ? 'Best partial match' : 'Best match'}</p>
      <p class="mt-1 text-lg font-semibold">${escapeHtml(pair.loaderLabel)} on Minecraft ${escapeHtml(pair.mcVersion)}</p>
      <p class="text-sm text-ink-faint">${
        isPartial
          ? `Covers ${solveData.partial.coveredCount} of ${total} mods — no combo runs everything`
          : `All ${total} mod${total === 1 ? '' : 's'} compatible`
      }</p>`;
    resultEl.appendChild(head);

    if (solveData.alternatives.length) {
      const alts = document.createElement('div');
      alts.className = 'mt-2 flex flex-wrap items-center gap-1.5';
      const label = document.createElement('span');
      label.className = 'text-xs text-ink-faint';
      label.textContent = 'Also works:';
      alts.appendChild(label);
      if (!chosenIsBest && solveData.best) {
        alts.appendChild(altButton(-1, solveData.best, false));
      }
      solveData.alternatives.forEach((alt, i) => {
        const active = pair.loader === alt.loader && pair.mcVersion === alt.mcVersion;
        if (!active) alts.appendChild(altButton(i, alt, false));
      });
      resultEl.appendChild(alts);
    }

    if (isPartial && solveData.partial.dropped.length) {
      const warn = document.createElement('div');
      warn.className = 'mt-3 rounded-md border border-gold-700 bg-gold-600/10 p-3 text-sm';
      warn.innerHTML =
        `<p class="mb-1.5 font-semibold text-gold-400">These mods would be left out:</p>` +
        solveData.partial.dropped
          .map(
            (d) => `
          <p class="text-ink-faint">${escapeHtml(d.title)} — ${
            d.supportedVersions.length
              ? `on ${escapeHtml(solveData.partial.loaderLabel)} it only supports ${d.supportedVersions.map(escapeHtml).join(', ')}`
              : `no ${escapeHtml(solveData.partial.loaderLabel)} builds at all`
          }</p>`
          )
          .join('');
      resultEl.appendChild(warn);
    }

    const list = document.createElement('div');
    list.className = 'mt-3 space-y-1';
    for (const p of solveData.perProject) {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 text-sm';
      row.innerHTML = `
        ${p.supported ? CHECK_SVG : `<span class="text-redstone-400">${X_SVG}</span>`}
        ${p.iconUrl ? `<img src="${escapeHtml(p.iconUrl)}" alt="" class="size-5 rounded-sm">` : ''}
        <span class="min-w-0 flex-1 truncate">${escapeHtml(p.title)}</span>
        <span class="shrink-0 font-mono text-xs text-ink-faint">${p.bestOwnVersions.versions.length ? escapeHtml(`${p.bestOwnVersions.loader}: ${p.bestOwnVersions.versions.slice(0, 3).join(', ')}`) : 'no release builds'}</span>`;
      list.appendChild(row);
    }
    resultEl.appendChild(list);

    const applyRow = document.createElement('div');
    applyRow.className = 'mt-3 flex items-center gap-2';
    applyRow.innerHTML = `
      <button type="button" data-apply class="btn btn-primary btn-sm">Apply</button>
      <span class="text-xs text-ink-faint">Sets the loader + version; press "Create &amp; start" to build the server and install the mods.</span>`;
    resultEl.appendChild(applyRow);
  }

  function altButton(idx, alt, active) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.alt = String(idx);
    b.className = 'btn btn-ghost btn-sm text-xs' + (active ? ' bg-grass-600/20 text-grass-300' : '');
    b.textContent = `${alt.loaderLabel} · ${alt.mcVersion}`;
    return b;
  }

  function applyChoice() {
    if (!chosenPair) return;
    // On a partial apply only the covered mods are installed — the dropped ones
    // would not load anyway.
    const usePartial =
      !solveData.best &&
      solveData.partial &&
      chosenPair.loader === solveData.partial.loader &&
      chosenPair.mcVersion === solveData.partial.mcVersion;
    const slugs = usePartial ? solveData.partial.coveredSlugs : [...picked.keys()];
    hiddenInput.value = JSON.stringify(slugs);

    const skipped = picked.size - slugs.length;
    toast(
      `Applied: ${chosenPair.loaderLabel} on ${chosenPair.mcVersion}. ${slugs.length} mod${slugs.length === 1 ? '' : 's'} will install after creation${skipped > 0 ? ` (${skipped} incompatible skipped)` : ''}. Press "Create & start".`
    );
    onApplied(chosenPair, slugs);
  }
}

function capitalize(s) {
  return typeof s === 'string' && s ? s[0].toUpperCase() + s.slice(1) : s;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function pickGroup(containerId, dataKey, onPick, activeClasses) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest(`[data-${dataKey}]`);
    if (!btn) return;
    for (const b of container.children) {
      b.classList.remove(...activeClasses);
      if (!b.className.includes('border ')) b.classList.add('border', 'border-line');
    }
    btn.classList.remove('border', 'border-line');
    btn.classList.add(...activeClasses);
    onPick(btn.dataset[dataKey]);
  });
}
