// Mods tab: add-by-URL, Modrinth/CurseForge search modal, zip import, toggle, delete.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { runTask } from '../lib/progress.js';
import { showZipImportReport } from '../lib/zipImport.js';

// Escape a value for safe interpolation into an HTML attribute (Modrinth icon
// URLs are third-party mod-author data — an unescaped `"` breaks out of src="").
const escAttr = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const root = document.querySelector('[data-mods-server]');
if (root)
  init(
    root.dataset.modsServer,
    root.dataset.modsType,
    root.dataset.modsMc,
    root.dataset.modsLoader,
    root.dataset.modsCf === 'true'
  );

function init(serverId, serverType, mcVersion, serverLoader, cfEnabled) {
  const mc = (mcVersion || '').replace(/^(LATEST|SNAPSHOT) \((.+)\)$/, '$2');
  const contentKind = ['PAPER', 'PURPUR', 'SPIGOT', 'BUKKIT', 'FOLIA', 'LEAF', 'PUFFERFISH', 'CANYON'].includes(
    serverType
  )
    ? 'plugin'
    : 'mod';
  // CF page section differs for plugins; also used for "open in browser" fallbacks.
  const cfSection = contentKind === 'plugin' ? 'bukkit-plugins' : 'mc-mods';

  // ---- Filters ----
  const filter = document.getElementById('mods-filter');
  const source = document.getElementById('mods-source');
  function refilter() {
    const q = (filter.value || '').toLowerCase();
    const src = source.value;
    document.querySelectorAll('[data-mod-row]').forEach((row) => {
      // Match name/file only — full row text includes button labels and status
      // words, so searching "disable" or "update" matched virtually every row.
      const hay = `${row.dataset.name || ''} ${row.dataset.file || ''}`.toLowerCase();
      const matches = (!q || hay.includes(q)) && (!src || row.dataset.source === src);
      row.classList.toggle('hidden', !matches);
    });
  }
  filter?.addEventListener('input', refilter);
  source?.addEventListener('change', refilter);

  // ---- Row actions ----
  document.getElementById('mods-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-mod-row]');
    if (!row) return;
    const file = row.dataset.file;

    if (e.target.closest('[data-mod-update]')) {
      const btn = e.target.closest('[data-mod-update]');
      const res = await withBusy(btn, 'Updating…', () => post(`/api/servers/${serverId}/mods/update`, { file }));
      if (res) {
        const inst = res.installed || {};
        toast(`Updated to ${inst.name || file}${inst.version ? ` ${inst.version}` : ''}.`);
        setTimeout(() => location.reload(), 700);
      }
    } else if (e.target.closest('[data-mod-toggle]')) {
      const btn = e.target.closest('[data-mod-toggle]');
      const enable = row.dataset.enabled !== 'true';
      const res = await withBusy(btn, () => post(`/api/servers/${serverId}/mods/toggle`, { file, enabled: enable }));
      if (res) {
        toast(
          res.applied === 'instant'
            ? `${file} ${enable ? 'enabled' : 'disabled'}.`
            : `${file} ${enable ? 're-included' : 'excluded'} — applies on next restart.`,
          { kind: 'success' }
        );
        setTimeout(() => location.reload(), 600);
      }
    } else if (e.target.closest('[data-mod-delete]')) {
      const btn = e.target.closest('[data-mod-delete]');
      const ok = await confirmDialog({
        title: `Delete ${file}?`,
        message: 'Removes the file from this server. The shared library copy stays for other servers.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`/api/servers/${serverId}/mods/${encodeURIComponent(file)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          toast(`${file} removed.`);
          const tbody = row.closest('tbody');
          row.remove();
          // Last row gone → re-render for the proper empty state.
          if (tbody && !tbody.querySelector('[data-mod-row]')) setTimeout(() => location.reload(), 600);
        } else {
          toast(data.error || 'Delete failed', { kind: 'error' });
        }
      } finally {
        restore();
      }
    }
  });

  // ---- Add by URL ----
  document.getElementById('mods-add-url')?.addEventListener('click', () => {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Mod URL or Modrinth slug</label>
      <input class="input font-mono" id="mod-url" placeholder="https://modrinth.com/mod/sodium — or any direct .jar URL" autocomplete="off">
      <p class="help">Direct .jar URLs, Modrinth project/version URLs or slugs, and CurseForge mod/file URLs all work. The right build for this server's loader and MC version is picked automatically.</p>
      <div class="mt-3 hidden" id="mod-url-progress"><div class="meter meter-indeterminate"><div class="bg-grass-500" style="width:25%"></div></div></div>`;
    const modal = openModal({
      title: 'Add mod by URL',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Download & install',
          kind: 'primary',
          busyLabel: 'Installing…',
          onClick: async () => {
            const url = content.querySelector('#mod-url').value.trim();
            if (!url) return false;
            const progress = content.querySelector('#mod-url-progress');
            progress.classList.remove('hidden');
            const res = await post(`/api/servers/${serverId}/mods`, { url });
            if (!res) {
              progress.classList.add('hidden'); // failure keeps the modal open — no zombie meter
              return false;
            }
            toast(`Installed ${res.installed.name}${res.installed.version ? ` ${res.installed.version}` : ''}.`);
            setTimeout(() => location.reload(), 700);
          },
        },
      ],
    });
    modal.body.querySelector('#mod-url').focus();
  });

  // ---- Import zip: CurseForge modpack export OR hand-assembled jar zip ----
  const zipInput = document.createElement('input');
  zipInput.type = 'file';
  zipInput.accept = '.zip';
  zipInput.className = 'hidden';
  document.body.appendChild(zipInput);
  document.getElementById('mods-import-zip')?.addEventListener('click', () => zipInput.click());
  zipInput.addEventListener('change', async () => {
    if (!zipInput.files.length) return;
    const file = zipInput.files[0];
    zipInput.value = '';
    const btn = document.getElementById('mods-import-zip');
    const restore = setBusy(btn, 'Reading zip…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/servers/${serverId}/mods/import-zip/preview`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `Preview failed (${res.status})`);
      openZipPreview(data.preview, data.uploadToken);
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 9000 });
    } finally {
      restore();
    }
  });

  const verdictBadge = (v) => {
    if (!v) return '';
    if (v.status === 'ok')
      return v.mcOk === null
        ? '<span class="badge" data-tip="Loader matches; MC version could not be verified">fits (MC unverified)</span>'
        : '<span class="badge badge-ok">fits this server</span>';
    if (v.status === 'wrong-loader') return '<span class="badge badge-warn">wrong loader</span>';
    if (v.status === 'wrong-mc') return '<span class="badge badge-warn">wrong MC version</span>';
    if (v.status === 'wrong-kind') return '<span class="badge badge-warn">wrong content type</span>';
    return '<span class="badge" data-tip="Not found on Modrinth/CurseForge and no readable metadata">unidentified</span>';
  };

  function openZipPreview(preview, uploadToken) {
    const isPack = preview.type === 'curseforge-pack';
    const content = document.createElement('div');
    const head = document.createElement('div');
    if (isPack) {
      head.className = 'mb-3 text-sm';
      head.innerHTML = `<div class="font-semibold" data-role="packname"></div>
        <div class="text-xs text-ink-faint" data-role="packmeta"></div>`;
      head.querySelector('[data-role="packname"]').textContent =
        `${preview.pack.name}${preview.pack.version ? ` ${preview.pack.version}` : ''}`;
      head.querySelector('[data-role="packmeta"]').textContent =
        `CurseForge modpack export — Minecraft ${preview.pack.mcVersion || '?'}, ${preview.pack.loader || 'unknown loader'}`;
    } else {
      head.className = 'mb-3 text-sm text-ink-soft';
      head.textContent = `${preview.items.length} jar${preview.items.length === 1 ? '' : 's'} found — each was identified via Modrinth, CurseForge, or its own metadata and checked against this server.`;
    }
    content.appendChild(head);

    for (const w of preview.warnings || []) {
      const n = document.createElement('div');
      n.className = 'notice notice-warn mb-2 text-xs text-warn';
      n.textContent = w;
      content.appendChild(n);
    }

    const list = document.createElement('div');
    list.className = 'max-h-80 space-y-1.5 overflow-y-auto';
    content.appendChild(list);

    const blocked = isPack ? preview.items.filter((i) => i.resolved && !i.downloadable) : [];
    const rows = [];
    for (const item of preview.items) {
      const isBlocked = isPack && item.resolved && !item.downloadable;
      const missing = isPack && !item.resolved;
      const row = document.createElement('label');
      row.className = 'flex items-center gap-2.5 rounded-md border border-line bg-raised p-2 text-sm';
      const checked = isPack
        ? item.resolved && item.downloadable && !item.installed
        : item.verdict && item.verdict.status === 'ok' && !item.installed;
      row.innerHTML = `
        <input type="checkbox" class="msm-check shrink-0" ${checked ? 'checked' : ''} ${isBlocked || missing ? 'disabled' : ''}>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium" data-role="name"></span>
          <span class="block truncate text-xs text-ink-faint" data-role="sub"></span>
        </span>
        <span class="flex shrink-0 items-center gap-1.5" data-role="badges"></span>`;
      const idn = isPack ? item : item.identity || {};
      row.querySelector('[data-role="name"]').textContent =
        idn.name || item.filename || item.entry || `Project ${item.projectId}`;
      row.querySelector('[data-role="sub"]').textContent = isPack
        ? item.fileName || (missing ? 'file no longer exists on CurseForge' : '')
        : `${item.filename}${idn.version ? ` — ${idn.version}` : ''}${idn.source ? ` · via ${idn.source}` : ''}`;
      const badges = row.querySelector('[data-role="badges"]');
      if (item.installed) badges.insertAdjacentHTML('beforeend', '<span class="badge badge-ok">Installed</span>');
      if (missing) badges.insertAdjacentHTML('beforeend', '<span class="badge badge-danger">missing</span>');
      else if (isBlocked)
        badges.insertAdjacentHTML(
          'beforeend',
          '<span class="badge badge-warn" data-tip="The author disallows automated downloads — resolve after import">manual download</span>'
        );
      else if (!isPack) badges.insertAdjacentHTML('beforeend', verdictBadge(item.verdict));
      rows.push({ item, row, isBlocked, missing });
      list.appendChild(row);
    }

    let overridesToggle = null;
    if (isPack && preview.overrides && preview.overrides.count > 0) {
      const box = document.createElement('label');
      box.className = 'mt-3 flex items-start gap-2 rounded-md border border-line bg-raised p-2.5 text-xs';
      box.innerHTML = `
        <input type="checkbox" class="msm-check mt-0.5 shrink-0">
        <span class="text-ink-soft">Also apply the pack's <b>${Number(preview.overrides.count)} override file${preview.overrides.count === 1 ? '' : 's'}</b> (configs/scripts) to this server. Files that would be overwritten are backed up first inside the server folder.</span>`;
      overridesToggle = box.querySelector('input');
      content.appendChild(box);
    }

    const modal = openModal({
      title: isPack ? 'Import CurseForge modpack' : 'Import mods from zip',
      content,
      size: 'lg',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Install selected',
          kind: 'primary',
          onClick: async () => {
            const selections = rows
              .filter((r) => !r.isBlocked && !r.missing && r.row.querySelector('input').checked)
              .map((r) => (isPack ? r.item.fileId : r.item.entry));
            if (!selections.length && !(overridesToggle && overridesToggle.checked)) {
              toast('Nothing selected.', { kind: 'info' });
              return false;
            }
            modal.close();
            let report;
            try {
              report = await runTask({
                title: 'Importing mod zip',
                start: async () => {
                  const res = await post(`/api/servers/${serverId}/mods/import-zip`, {
                    uploadToken,
                    selections,
                    applyOverrides: Boolean(overridesToggle && overridesToggle.checked),
                  });
                  if (!res) throw Object.assign(new Error('Import failed to start'), { dismissed: true });
                  return res.taskId;
                },
              });
            } catch (err) {
              if (!err.dismissed) toast(err.message, { kind: 'error', timeout: 9000 });
              return;
            }
            showZipImportReport({
              serverId,
              report,
              blockedFallback: blocked,
              onDone: () => setTimeout(() => location.reload(), 400),
            });
          },
        },
      ],
    });
  }

  // ---- Mod search: Modrinth + CurseForge (reused by the manual-download resolver) ----
  function openModSearch({ prefill = '', onInstalled = null } = {}) {
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="flex flex-wrap items-center gap-2">
        <input class="input min-w-48 flex-1" id="mr-q" placeholder="Search ${contentKind}s…" autocomplete="off">
        ${
          cfEnabled
            ? `<div class="seg" id="mr-platforms" role="group" aria-label="Search platform">
                 <button type="button" class="seg-btn" aria-pressed="true" data-platform="modrinth">Modrinth</button>
                 <button type="button" class="seg-btn" aria-pressed="false" data-platform="curseforge">CurseForge</button>
               </div>`
            : ''
        }
      </div>
      <div class="mt-3 max-h-96 space-y-2 overflow-y-auto" id="mr-results">
        <p class="p-6 text-center text-sm text-ink-faint">Type to search.</p>
      </div>`;
    const modal = openModal({
      title: contentKind === 'plugin' ? 'Search plugins' : 'Search mods',
      content,
      size: 'lg',
    });
    const q = content.querySelector('#mr-q');
    const results = content.querySelector('#mr-results');
    let platform = 'modrinth';
    content.querySelector('#mr-platforms')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-platform]');
      if (!btn || btn.dataset.platform === platform) return;
      platform = btn.dataset.platform;
      content.querySelectorAll('#mr-platforms [data-platform]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.platform === platform));
      });
      runSearch();
    });

    // Already-installed hits get a badge instead of an Install button. Keyed by
    // platform:projectId — only content installed through a platform can match.
    let installedKeys = new Set();
    fetch(`/api/servers/${serverId}/mods`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          installedKeys = new Set(
            (data.mods || []).filter((m) => m.platform && m.projectId).map((m) => `${m.platform}:${m.projectId}`)
          );
        }
      })
      .catch(() => {});

    let timer;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 350);
    });
    q.value = prefill;
    q.focus();
    if (prefill) runSearch();

    const loader =
      serverLoader || { FABRIC: 'fabric', QUILT: 'quilt', FORGE: 'forge', NEOFORGE: 'neoforge' }[serverType] || '';

    let searchSeq = 0; // a slow earlier response must not overwrite a newer one
    async function runSearch() {
      const query = q.value.trim();
      if (!query) return;
      const seq = ++searchSeq;
      results.innerHTML = '<p class="p-6 text-center text-sm text-ink-faint">Searching…</p>';
      const params = new URLSearchParams({ q: query, kind: contentKind, platform });
      if (loader) params.set('loader', loader);
      if (mc && !mc.startsWith('LATEST')) params.set('mc', mc);
      let data;
      try {
        const res = await fetch(`/api/mods/search?${params}`);
        data = await res.json();
      } catch {
        // a network error used to strand "Searching…" on screen forever
        data = { ok: false, error: 'Search failed — check the connection and try again.' };
      }
      if (seq !== searchSeq) return;
      if (!data.ok) {
        const p = document.createElement('p');
        p.className = 'p-6 text-center text-sm text-danger';
        p.textContent = data.error || 'Search failed'; // upstream text — never innerHTML
        results.replaceChildren(p);
        return;
      }
      if (!data.results.length) {
        results.innerHTML = '<p class="p-6 text-center text-sm text-ink-faint">No matches for this loader/version.</p>';
        return;
      }
      results.innerHTML = '';
      for (const hit of data.results) results.appendChild(resultRow(hit));
    }

    function resultRow(hit) {
      const row = document.createElement('div');
      row.className = 'rounded-md border border-line bg-raised p-2.5';
      const installed = installedKeys.has(`${hit.platform}:${hit.projectId}`);
      row.innerHTML = `
        <div class="flex items-center gap-3">
          ${hit.iconUrl ? `<img src="${escAttr(hit.iconUrl)}" alt="" class="size-10 shrink-0 rounded bg-inset object-cover">` : '<span class="grid size-10 shrink-0 place-items-center rounded bg-inset text-ink-faint">?</span>'}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold"></div>
            <div class="truncate text-xs text-ink-faint" data-role="desc"></div>
          </div>
          <span class="shrink-0 text-xs text-ink-faint">${Number(hit.downloads).toLocaleString()} DLs</span>
          ${installed ? '<span class="badge badge-ok shrink-0">Installed</span>' : '<button class="btn btn-primary btn-sm shrink-0" data-role="install">Install</button>'}
        </div>
        <div class="mt-2 hidden" data-role="fallback"></div>`;
      row.querySelector('.font-semibold').textContent = hit.name;
      row.querySelector('[data-role="desc"]').textContent = hit.description;
      row.querySelector('[data-role="install"]')?.addEventListener('click', async (ev) => {
        const btn = ev.currentTarget; // capture before await — currentTarget is null afterwards
        if (hit.platform === 'curseforge') return installCurseforge(hit, row, btn);
        const res2 = await withBusy(btn, 'Installing…', () =>
          post(`/api/servers/${serverId}/mods`, { url: `https://modrinth.com/mod/${hit.ref}` })
        );
        if (res2) done(res2);
      });
      return row;
    }

    // CurseForge installs pre-check the chosen build: authors can forbid API
    // downloads (downloadUrl null), and failing at install time with a raw 409
    // is a dead end — offer the browser-download + manual-upload path instead.
    async function installCurseforge(hit, row, btn) {
      const params = new URLSearchParams({ platform: 'curseforge', ref: hit.ref, kind: contentKind });
      if (loader) params.set('loader', loader);
      if (mc && !mc.startsWith('LATEST')) params.set('mc', mc);
      const restore = setBusy(btn, 'Installing…');
      let versions;
      try {
        const data = await fetch(`/api/mods/versions?${params}`).then((r) => r.json());
        if (!data.ok) throw new Error(data.error || 'Version lookup failed');
        versions = data.versions || [];
      } catch (err) {
        restore();
        toast(err.message, { kind: 'error' });
        return;
      }
      if (!versions.length) {
        restore();
        toast(`No ${hit.name} build matches this server's loader/MC version.`, { kind: 'error' });
        return;
      }
      const build = versions[0];
      if (build.downloadable === false) {
        restore();
        showManualFallback(hit, row, build);
        return;
      }
      // Pin the exact build we just checked so what installs is what was vetted.
      const url = `https://www.curseforge.com/minecraft/${cfSection}/${hit.ref}/files/${build.versionId}`;
      const res2 = await post(`/api/servers/${serverId}/mods`, { url });
      restore();
      if (res2) done(res2);
    }

    function showManualFallback(hit, row, build) {
      const box = row.querySelector('[data-role="fallback"]');
      box.classList.remove('hidden');
      box.innerHTML = `
        <div class="notice notice-warn flex-wrap items-center gap-2 text-xs">
          <span class="text-warn">The author disallows automated downloads — grab <b data-role="build"></b> in a browser, then upload the jar here.</span>
          <a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.curseforge.com/minecraft/${cfSection}/${encodeURIComponent(hit.ref)}/files">Open CurseForge</a>
          <button class="btn btn-sm" data-role="upload">Upload jar</button>
          <input type="file" accept=".jar,.zip" class="hidden" data-role="file">
        </div>`;
      box.querySelector('[data-role="build"]').textContent = build.name || build.versionNumber || 'the file';
      const fileInput = box.querySelector('[data-role="file"]');
      box.querySelector('[data-role="upload"]').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        if (!fileInput.files.length) return;
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        const restore = setBusy(box.querySelector('[data-role="upload"]'));
        try {
          const res = await fetch(`/api/servers/${serverId}/mods/upload`, { method: 'POST', body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');
          toast(`Uploaded ${fileInput.files[0].name}.`);
          done(data);
        } catch (err) {
          toast(err.message, { kind: 'error' });
        } finally {
          restore();
        }
      });
    }

    function done(res) {
      if (res.installed && res.installed.name) toast(`Installed ${res.installed.name}.`);
      modal.close();
      if (onInstalled) onInstalled(res);
      else setTimeout(() => location.reload(), 700);
    }
  }
  document.getElementById('mods-search')?.addEventListener('click', () => openModSearch());

  // ---- Manual-download resolver: MODS_NEED_DOWNLOAD.txt → guided actions ----
  const pendingBox = document.getElementById('mods-pending');
  let pendingAutoOpened = false;

  async function refreshPending(autoOpen = false) {
    if (!pendingBox) return;
    let list = [];
    try {
      const data = await fetch(`/api/servers/${serverId}/pending-downloads`).then((r) => r.json());
      list = (data.ok && data.mods) || [];
    } catch {
      return;
    }
    if (!list.length) {
      pendingBox.classList.add('hidden');
      pendingBox.innerHTML = '';
      return;
    }
    pendingBox.classList.remove('hidden');
    pendingBox.innerHTML = `
      <div class="notice notice-warn flex-wrap gap-3">
        <span class="text-warn">${list.length} ${list.length === 1 ? 'mod' : 'mods'} in this modpack couldn't be auto-downloaded — the pack won't finish installing until each is resolved.</span>
        <button class="btn btn-sm ml-auto" id="mods-pending-open">Resolve now</button>
      </div>`;
    pendingBox.querySelector('#mods-pending-open').addEventListener('click', () => openPendingModal(list));
    if (autoOpen && !pendingAutoOpened) {
      pendingAutoOpened = true;
      openPendingModal(list);
    }
  }

  function openPendingModal(list) {
    const content = document.createElement('div');
    content.innerHTML = `
      <p class="mb-3 text-sm text-ink-soft">These mods disallow automated download (or were pulled from CurseForge), so the pack can't finish. For each one, <b>Exclude</b> it, install a replacement via <b>search</b>, or <b>upload</b> the jar you downloaded by hand. Changes apply on the next recreate.</p>
      <div class="space-y-2" id="pending-list"></div>`;
    openModal({ title: 'Mods that need manual action', content, size: 'lg' });
    const listEl = content.querySelector('#pending-list');

    function render(mods) {
      if (!mods.length) {
        listEl.innerHTML = '<p class="notice notice-ok text-ok">All resolved — recreate the server to apply.</p>';
        return;
      }
      listEl.innerHTML = '';
      for (const m of mods) {
        const term =
          m.filename
            .replace(/\.(jar|zip)$/i, '')
            .split(/[-_]\d/)[0]
            .replace(/[-_]+/g, ' ')
            .trim() ||
          m.name ||
          m.filename;
        const row = document.createElement('div');
        row.className = 'rounded-md border border-line bg-raised p-3';
        row.innerHTML = `
          <div class="mb-2 min-w-0">
            <div class="truncate text-sm font-semibold"></div>
            <div class="truncate font-mono text-xs text-ink-faint"></div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn btn-sm" data-act="exclude">Exclude from pack</button>
            <button class="btn btn-sm" data-act="search">Find replacement</button>
            <button class="btn btn-sm" data-act="upload">Upload jar</button>
            <a class="btn btn-sm" target="_blank" rel="noopener" data-act="open">Open CF page</a>
          </div>
          <input type="file" accept=".jar,.zip" class="hidden" data-role="file">`;
        row.querySelector('.font-semibold').textContent = m.name || m.filename;
        row.querySelector('.font-mono').textContent = m.filename;
        // Pack-manifest URL is third-party data — allow only http(s).
        const cfLink = row.querySelector('[data-act="open"]');
        if (/^https?:\/\//i.test(m.url || '')) cfLink.href = m.url;
        else cfLink.remove();
        const fileInput = row.querySelector('[data-role="file"]');

        row.querySelector('[data-act="exclude"]').addEventListener('click', async (ev) => {
          const res = await withBusy(ev.currentTarget, 'Excluding…', () =>
            post(`/api/servers/${serverId}/pending-downloads/exclude`, { filename: m.filename })
          );
          if (res) {
            toast(`Excluded ${m.name || m.filename}.`);
            render(res.mods || []);
            refreshPending();
          }
        });

        row.querySelector('[data-act="search"]').addEventListener('click', () => {
          openModSearch({
            prefill: term,
            onInstalled: async () => {
              await post(`/api/servers/${serverId}/pending-downloads/exclude`, { filename: m.filename });
              const data = await fetch(`/api/servers/${serverId}/pending-downloads`)
                .then((r) => r.json())
                .catch(() => ({}));
              render((data && data.mods) || []);
              refreshPending();
            },
          });
        });

        row.querySelector('[data-act="upload"]').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
          if (!fileInput.files.length) return;
          const fd = new FormData();
          fd.append('file', fileInput.files[0]);
          fd.append('excludeFilename', m.filename);
          const restore = setBusy(row.querySelector('[data-act="upload"]'));
          try {
            const res = await fetch(`/api/servers/${serverId}/mods/upload`, { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');
            toast(`Uploaded ${fileInput.files[0].name}.`);
            render(data.mods || []);
            refreshPending();
          } catch (err) {
            toast(err.message, { kind: 'error' });
          } finally {
            restore();
          }
        });

        listEl.appendChild(row);
      }
    }
    render(list);
  }

  refreshPending(true);

  async function post(url, body) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast(data.error || `Request failed (${res.status})`, { kind: 'error', timeout: 9000 });
        return null;
      }
      return data;
    } catch (err) {
      toast(`Network error: ${err.message}`, { kind: 'error' });
      return null;
    }
  }
}
