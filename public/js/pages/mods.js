// Mods tab: add-by-URL, Modrinth search modal, toggle, delete.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';

// Escape a value for safe interpolation into an HTML attribute (Modrinth icon
// URLs are third-party mod-author data — an unescaped `"` breaks out of src="").
const escAttr = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const root = document.querySelector('[data-mods-server]');
if (root) init(root.dataset.modsServer, root.dataset.modsType, root.dataset.modsMc, root.dataset.modsLoader);

function init(serverId, serverType, mcVersion, serverLoader) {
  const mc = (mcVersion || '').replace(/^(LATEST|SNAPSHOT) \((.+)\)$/, '$2');

  // ---- Filters ----
  const filter = document.getElementById('mods-filter');
  const source = document.getElementById('mods-source');
  function refilter() {
    const q = (filter.value || '').toLowerCase();
    const src = source.value;
    document.querySelectorAll('[data-mod-row]').forEach((row) => {
      const matches = (!q || row.textContent.toLowerCase().includes(q)) && (!src || row.dataset.source === src);
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
        const data = await res.json();
        if (data.ok) {
          toast(`${file} removed.`);
          row.remove();
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
      <div class="mt-3 hidden" id="mod-url-progress"><div class="meter"><div class="bg-grass-500 animate-pulse" style="width:100%"></div></div></div>`;
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
            content.querySelector('#mod-url-progress').classList.remove('hidden');
            const res = await post(`/api/servers/${serverId}/mods`, { url });
            if (!res) return false;
            toast(`Installed ${res.installed.name}${res.installed.version ? ` ${res.installed.version}` : ''}.`);
            setTimeout(() => location.reload(), 700);
          },
        },
      ],
    });
    modal.body.querySelector('#mod-url').focus();
  });

  // ---- Modrinth search (reused by the manual-download resolver) ----
  function openModrinthSearch({ prefill = '', onInstalled = null } = {}) {
    const content = document.createElement('div');
    content.innerHTML = `
      <input class="input" id="mr-q" placeholder="Search Modrinth…" autocomplete="off">
      <div class="mt-3 max-h-96 space-y-2 overflow-y-auto" id="mr-results">
        <p class="p-6 text-center text-sm text-ink-faint">Type to search.</p>
      </div>`;
    const modal = openModal({ title: 'Search Modrinth', content, size: 'lg' });
    const q = content.querySelector('#mr-q');
    const results = content.querySelector('#mr-results');
    let timer;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 350);
    });
    q.value = prefill;
    q.focus();
    if (prefill) runSearch();

    async function runSearch() {
      const query = q.value.trim();
      if (!query) return;
      results.innerHTML = '<p class="p-6 text-center text-sm text-ink-faint">Searching…</p>';
      const loader =
        serverLoader || { FABRIC: 'fabric', QUILT: 'quilt', FORGE: 'forge', NEOFORGE: 'neoforge' }[serverType] || '';
      const kind = ['PAPER', 'PURPUR', 'SPIGOT', 'BUKKIT', 'FOLIA', 'LEAF', 'PUFFERFISH'].includes(serverType)
        ? 'plugin'
        : 'mod';
      const params = new URLSearchParams({ q: query, kind });
      if (loader) params.set('loader', loader);
      if (mc && !mc.startsWith('LATEST')) params.set('mc', mc);
      const res = await fetch(`/api/modrinth/search?${params}`);
      const data = await res.json();
      if (!data.ok) {
        results.innerHTML = `<p class="p-6 text-center text-sm text-redstone-400">${data.error || 'Search failed'}</p>`;
        return;
      }
      if (!data.results.length) {
        results.innerHTML = '<p class="p-6 text-center text-sm text-ink-faint">No matches for this loader/version.</p>';
        return;
      }
      results.innerHTML = '';
      for (const hit of data.results) {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 rounded-md border border-line bg-raised p-2.5';
        row.innerHTML = `
          ${hit.iconUrl ? `<img src="${escAttr(hit.iconUrl)}" alt="" class="size-10 shrink-0 rounded bg-inset object-cover">` : '<span class="grid size-10 shrink-0 place-items-center rounded bg-inset text-ink-faint">?</span>'}
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold"></div>
            <div class="truncate text-xs text-ink-faint"></div>
          </div>
          <span class="shrink-0 text-xs text-ink-faint">${Number(hit.downloads).toLocaleString()} DLs</span>
          <button class="btn btn-primary btn-sm shrink-0">Install</button>`;
        row.querySelector('.font-semibold').textContent = hit.title;
        row.querySelector('.text-xs.text-ink-faint').textContent = hit.description;
        row.querySelector('button').addEventListener('click', async (ev) => {
          const btn = ev.currentTarget; // capture before await — currentTarget is null afterwards
          const res2 = await withBusy(btn, 'Installing…', () =>
            post(`/api/servers/${serverId}/mods`, { url: `https://modrinth.com/mod/${hit.slug}` })
          );
          if (res2) {
            toast(`Installed ${res2.installed.name}.`);
            modal.close();
            if (onInstalled) onInstalled(res2);
            else setTimeout(() => location.reload(), 700);
          }
        });
        results.appendChild(row);
      }
    }
  }
  document.getElementById('mods-search-modrinth')?.addEventListener('click', () => openModrinthSearch());

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
      <div class="flex flex-wrap items-center gap-3 rounded-md border border-gold-700/60 bg-gold-900/20 p-3 text-sm">
        <span class="text-gold-300">${list.length} mod(s) in this modpack couldn't be auto-downloaded — the pack won't finish installing until each is resolved.</span>
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
      <p class="mb-3 text-sm text-ink-soft">These mods disallow automated download (or were pulled from CurseForge), so the pack can't finish. For each one, <b>Exclude</b> it, install a replacement from <b>Modrinth</b>, or <b>upload</b> the jar you downloaded by hand. Changes apply on the next recreate.</p>
      <div class="space-y-2" id="pending-list"></div>`;
    openModal({ title: 'Mods that need manual action', content, size: 'lg' });
    const listEl = content.querySelector('#pending-list');

    function render(mods) {
      if (!mods.length) {
        listEl.innerHTML =
          '<p class="rounded-md border border-grass-700 bg-grass-600/10 p-3 text-sm text-grass-300">All resolved — recreate the server to apply.</p>';
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
            <button class="btn btn-sm" data-act="modrinth">Find on Modrinth</button>
            <button class="btn btn-sm" data-act="upload">Upload jar</button>
            <a class="btn btn-sm" target="_blank" rel="noopener" data-act="open">Open CF page</a>
          </div>
          <input type="file" accept=".jar,.zip" class="hidden" data-role="file">`;
        row.querySelector('.font-semibold').textContent = m.name || m.filename;
        row.querySelector('.font-mono').textContent = m.filename;
        row.querySelector('[data-act="open"]').href = m.url;
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

        row.querySelector('[data-act="modrinth"]').addEventListener('click', () => {
          openModrinthSearch({
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
      const data = await res.json();
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
