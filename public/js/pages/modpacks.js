// Modpacks page (U2): CurseForge + Modrinth pack browser, installed section
// with working Check/Upgrade, and the shared pack-details modal. The details
// modal (showPackDetails) is also imported by the wizard's From-modpack tab.
import { toast } from '../lib/toast.js';
import { confirmDialog } from '../lib/confirm.js';
import { runTask } from '../lib/progress.js';
import { openModal } from '../lib/modal.js';

const PUZZLE_SVG =
  '<svg class="icon size-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>';

/** External pack icon with a puzzle-piece fallback (icons are third-party URLs). */
export function packIconHtml(iconUrl, size = 'size-10') {
  const shell = `class="relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-md bg-inset text-ink-faint"`;
  if (!iconUrl) return `<span ${shell}>${PUZZLE_SVG}</span>`;
  return `<span ${shell}>${PUZZLE_SVG}<img src="${escapeHtml(iconUrl)}" alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover" onerror="this.remove()"></span>`;
}

export function formatDownloads(n) {
  if (!Number.isFinite(n)) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(n);
}

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// ---- Shared pack-details modal ---------------------------------------------

/**
 * showPackDetails({ platform, ref }) for browsed packs, or
 * showPackDetails({ installedServerId }) for a server's pinned pack (adds the
 * pack-managed mod list + a link to the server).
 */
export async function showPackDetails({ platform, ref, installedServerId } = {}) {
  const qs = installedServerId
    ? `serverId=${encodeURIComponent(installedServerId)}`
    : `platform=${encodeURIComponent(platform)}&ref=${encodeURIComponent(ref)}`;
  const loading = openModal({
    title: 'Loading pack details…',
    size: 'sm',
    content: '<p class="text-sm text-ink-faint">Fetching from the platform…</p>',
  });
  let pack;
  try {
    const res = await fetch(`/api/packs/details?${qs}`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load pack details');
    pack = data.pack;
  } catch (err) {
    loading.close();
    toast(err.message, { kind: 'error', timeout: 9000 });
    return;
  }
  loading.close();
  renderPackDetails(pack);
}

function renderPackDetails(pack) {
  const content = document.createElement('div');
  content.className = 'space-y-4 text-sm';

  const meta = [];
  if (pack.author) meta.push(`by ${escapeHtml(pack.author)}`);
  if (Number.isFinite(pack.downloads)) meta.push(`${formatDownloads(pack.downloads)} downloads`);
  if (pack.mcVersion) meta.push(`Minecraft ${escapeHtml(pack.mcVersion)}`);
  if (pack.loaders && pack.loaders.length) meta.push(escapeHtml(pack.loaders.join(', ')));

  content.innerHTML = `
    <div class="flex items-center gap-3">
      ${packIconHtml(pack.iconUrl, 'size-14')}
      <div class="min-w-0 flex-1">
        <div class="truncate text-base font-semibold">${escapeHtml(pack.name)}</div>
        <div class="text-xs text-ink-faint">
          <span class="badge bg-inset text-ink-soft">${pack.platform === 'curseforge' ? 'CurseForge' : 'Modrinth'}</span>
          ${meta.length ? `<span class="ml-1">${meta.join(' · ')}</span>` : ''}
        </div>
        ${pack.installed ? `<div class="mt-1 text-xs text-grass-400">Installed on ${escapeHtml(pack.installed.serverName)} — pinned @ ${escapeHtml(pack.installed.versionName)}</div>` : ''}
      </div>
    </div>
    <div data-desc class="max-h-72 overflow-y-auto rounded-md border border-line bg-inset p-4 text-sm leading-relaxed"></div>
    <div>
      <label class="label" for="pd-version">Version to pin</label>
      <select class="input" id="pd-version" data-label="Pack version"></select>
      <p class="help">Installs are always pinned to this exact version — a restart can never silently upgrade.</p>
    </div>
    <div data-mods class="hidden">
      <div class="label" data-mods-title>Pack contents</div>
      <div data-mods-list class="max-h-56 overflow-y-auto rounded-md border border-line"></div>
    </div>`;

  // Description arrives sanitized server-side (sanitize-html); constrain images.
  const descEl = content.querySelector('[data-desc]');
  descEl.innerHTML = pack.description || '<span class="text-ink-faint">No description provided.</span>';
  descEl.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.borderRadius = '4px';
  });
  descEl.querySelectorAll('a').forEach((a) => {
    a.className = 'text-diamond-400 hover:underline';
  });
  descEl.querySelectorAll('p, ul, ol, pre, blockquote, h1, h2, h3, h4').forEach((el) => {
    el.style.margin = '0 0 .6em';
  });

  const versionSel = content.querySelector('#pd-version');
  for (const v of pack.versions || []) {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.name}${v.type && v.type !== 'release' ? ` (${v.type})` : ''}`;
    if (v.date) opt.dataset.desc = String(v.date).slice(0, 10);
    versionSel.appendChild(opt);
  }
  versionSel.value =
    (pack.installed && pack.installed.versionId) ||
    pack.defaultVersionId ||
    (pack.versions[0] && pack.versions[0].id) ||
    '';

  const actions = [
    {
      label: 'Create server with this pack',
      kind: 'primary',
      onClick: () => {
        const v = versionSel.value ? `&version=${encodeURIComponent(versionSel.value)}` : '';
        location.href = `/servers/new?pack=${encodeURIComponent(`${pack.platform}:${pack.ref}`)}${v}`;
      },
    },
  ];
  if (pack.installed) {
    actions.unshift({
      label: 'Open server',
      kind: 'default',
      onClick: () => {
        location.href = `/servers/${pack.installed.serverId}`;
      },
    });
  }

  openModal({ title: pack.name, size: 'lg', content, actions });

  if (pack.installed) loadInstalledMods(content, pack.installed.serverId);
}

async function loadInstalledMods(content, serverId) {
  const wrap = content.querySelector('[data-mods]');
  const list = content.querySelector('[data-mods-list]');
  const title = content.querySelector('[data-mods-title]');
  wrap.classList.remove('hidden');
  list.innerHTML = '<div class="p-3 text-center text-xs text-ink-faint">Reading installed pack content…</div>';
  try {
    const res = await fetch(`/api/servers/${serverId}/pack/mods`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to list pack content');
    if (!data.mods.length) {
      list.innerHTML =
        '<div class="p-3 text-center text-xs text-ink-faint">No pack-managed files on disk yet — they appear after the first start finishes installing the pack.</div>';
      return;
    }
    title.textContent = `Pack contents (${data.mods.length} pack-managed file${data.mods.length === 1 ? '' : 's'})`;
    list.innerHTML = data.mods
      .map(
        (m) => `
      <div class="flex items-center gap-2.5 border-b border-line px-2.5 py-1.5 text-sm last:border-b-0">
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">${escapeHtml(m.name)}</span>
          <span class="block truncate font-mono text-[11px] text-ink-faint">${escapeHtml(m.file)}</span>
        </span>
        ${m.version ? `<span class="shrink-0 font-mono text-xs text-ink-faint">${escapeHtml(m.version)}</span>` : ''}
        ${m.enabled ? '' : '<span class="badge shrink-0 bg-inset text-ink-faint">disabled</span>'}
      </div>`
      )
      .join('');
  } catch (err) {
    list.innerHTML = `<div class="p-3 text-center text-xs text-redstone-400">${escapeHtml(err.message)}</div>`;
  }
}

// ---- Page wiring (only on /modpacks) ----------------------------------------

const page = document.getElementById('modpacks-page');
if (page) initPage();

function initPage() {
  const q = document.getElementById('packs-q');
  const platformsEl = document.getElementById('packs-platforms');
  const resultsWrap = document.getElementById('packs-results-wrap');
  const resultsEl = document.getElementById('packs-results');
  let platform = 'modrinth';
  let lastResults = [];

  document.getElementById('packs-install-btn')?.addEventListener('click', () => {
    q.focus();
    q.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  platformsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-platform]');
    if (!btn) return;
    platform = btn.dataset.platform;
    for (const b of platformsEl.querySelectorAll('[data-platform]')) {
      b.classList.toggle('border-grass-500', b === btn);
      b.classList.toggle('text-grass-300', b === btn);
    }
    if (q.value.trim()) search();
  });

  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    if (!q.value.trim()) {
      resultsWrap.classList.add('hidden');
      resultsEl.innerHTML = '';
      return;
    }
    timer = setTimeout(search, 350);
  });

  async function search() {
    const term = q.value.trim();
    if (!term) return;
    resultsWrap.classList.remove('hidden');
    resultsEl.innerHTML = '<div class="card p-4 text-sm text-ink-faint">Searching…</div>';
    try {
      const res = await fetch(`/api/packs/search?q=${encodeURIComponent(term)}&platform=${platform}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Search failed');
      lastResults = data.results;
      renderResults();
    } catch (err) {
      resultsEl.innerHTML = `<div class="card p-4 text-sm text-redstone-400">${escapeHtml(err.message)}${platform === 'curseforge' ? ' — <a href="/settings" class="text-diamond-400 hover:underline">API keys</a>' : ''}</div>`;
    }
  }

  function renderResults() {
    if (!lastResults.length) {
      resultsEl.innerHTML =
        '<div class="card p-4 text-sm text-ink-faint">No modpacks found — try another search term.</div>';
      return;
    }
    resultsEl.innerHTML = lastResults
      .map(
        (p, i) => `
      <div class="card flex flex-col p-4">
        <div class="flex items-center gap-3">
          ${packIconHtml(p.iconUrl, 'size-10')}
          <div class="min-w-0 flex-1">
            <div class="truncate font-semibold">${escapeHtml(p.name)}</div>
            <div class="text-xs text-ink-faint">${formatDownloads(p.downloads)} downloads</div>
          </div>
        </div>
        <p class="mt-2 line-clamp-2 flex-1 text-xs text-ink-faint">${escapeHtml(p.description || '')}</p>
        <div class="mt-3 flex gap-2 border-t border-line pt-3">
          <button type="button" class="btn btn-ghost btn-sm" data-details="${i}">Details</button>
          <button type="button" class="btn btn-sm ml-auto" data-create="${i}">Create server</button>
        </div>
      </div>`
      )
      .join('');
  }

  resultsEl.addEventListener('click', (e) => {
    const detailsBtn = e.target.closest('[data-details]');
    if (detailsBtn) {
      const p = lastResults[Number(detailsBtn.dataset.details)];
      if (p) showPackDetails({ platform: p.platform, ref: p.ref });
      return;
    }
    const createBtn = e.target.closest('[data-create]');
    if (createBtn) {
      const p = lastResults[Number(createBtn.dataset.create)];
      if (p) location.href = `/servers/new?pack=${encodeURIComponent(`${p.platform}:${p.ref}`)}`;
    }
  });

  // Installed cards: card click → details modal; Check/Upgrade buttons are real.
  document.getElementById('packs-installed')?.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-pack-card]');
    if (!card) return;
    const { serverId, serverName, packName, current, latest } = card.dataset;

    if (e.target.closest('[data-pack-check]')) {
      try {
        const result = await runTask({
          title: `Checking ${packName} for updates`,
          start: async () => (await postJSON(`/api/servers/${serverId}/updates/check`, {})).taskId,
        });
        const n = result && result.findings ? result.findings.length : 0;
        toast(n ? `${n} update(s) available for ${serverName}.` : `${packName} is up to date.`);
        if (n) setTimeout(() => location.reload(), 900);
      } catch (err) {
        toast(err.message || 'Update check failed', { kind: 'error', timeout: 9000 });
      }
      return;
    }

    if (e.target.closest('[data-pack-upgrade]')) {
      const ok = await confirmDialog({
        title: `Upgrade ${packName}?`,
        message: `${serverName}: ${current} → ${latest}. Safe flow: pre-update backup → stop → re-pin → recreate → start → monitor, with one-click rollback if it fails.`,
        detail: 'Custom overlay mods are preserved. The server is briefly offline during the swap.',
        confirmLabel: 'Upgrade now',
      });
      if (!ok) return;
      try {
        const result = await runTask({
          title: `Upgrading ${packName} on ${serverName}`,
          start: async () => (await postJSON(`/api/servers/${serverId}/pack/upgrade`, {})).taskId,
        });
        if (result && result.ok === false) {
          toast(
            `Upgrade failed: ${result.error || 'server did not come up healthy'} — roll back from the Updates page.`,
            { kind: 'error', timeout: 12000 }
          );
          return;
        }
        toast(`Upgraded: ${result.from} → ${result.to}.`);
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        toast(err.message || 'Upgrade failed', { kind: 'error', timeout: 12000 });
      }
      return;
    }

    // Anywhere else on the card (but not a link) → details modal.
    if (e.target.closest('a')) return;
    showPackDetails({ installedServerId: serverId });
  });
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
