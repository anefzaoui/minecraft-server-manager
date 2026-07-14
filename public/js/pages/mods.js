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
if (root) init(root.dataset.modsServer, root.dataset.modsLoader, root.dataset.modsMc);

function init(serverId, serverType, mcVersion) {
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

  // ---- Modrinth search ----
  document.getElementById('mods-search-modrinth')?.addEventListener('click', () => {
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
    q.focus();

    async function runSearch() {
      const query = q.value.trim();
      if (!query) return;
      results.innerHTML = '<p class="p-6 text-center text-sm text-ink-faint">Searching…</p>';
      const loader = { FABRIC: 'fabric', QUILT: 'quilt', FORGE: 'forge', NEOFORGE: 'neoforge' }[serverType] || '';
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
            setTimeout(() => location.reload(), 700);
          }
        });
        results.appendChild(row);
      }
    }
  });

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
