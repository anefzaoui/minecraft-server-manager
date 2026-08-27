// Mods tab: add-by-URL, Modrinth search modal, toggle, delete.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';

// Escape a value for safe interpolation into an HTML attribute (Modrinth icon
// URLs are third-party mod-author data - an unescaped `"` breaks out of src="").
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
      // Match name/file only - full row text includes button labels and status
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
            : `${file} ${enable ? 're-included' : 'excluded'}. Applies on the next restart.`,
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
          toast(data.error || friendlyError(res, { action: 'remove that file' }), { kind: 'error' });
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
      <label class="label">Mod/plugin/datapack URL or Modrinth slug</label>
      <input class="input font-mono" id="mod-url" placeholder="https://modrinth.com/mod/sodium, or any direct .jar or .zip URL" autocomplete="off">
      <p class="help">Direct .jar and .zip URLs, Modrinth project or version URLs and slugs, and CurseForge mod or file URLs all work, datapacks included. The panel detects the content type and picks the right build for this server's loader and Minecraft version for you.</p>
      ${
        mc
          ? `<label class="mt-3 flex cursor-pointer items-start gap-2 text-sm">
               <input type="checkbox" class="msm-check mt-0.5" id="mod-url-ignore-version">
               <span>Install even if this build isn't listed as compatible with ${escAttr(mc)} or this server's loader. It may not work correctly, and you accept that risk.</span>
             </label>`
          : ''
      }
      <div class="mt-3 hidden" id="mod-url-progress"><div class="meter meter-indeterminate"><div class="bg-grass-500" style="width:25%"></div></div></div>`;
    const modal = openModal({
      title: 'Add Mod by URL',
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
            const ignoreVersion = Boolean(content.querySelector('#mod-url-ignore-version')?.checked);
            const progress = content.querySelector('#mod-url-progress');
            progress.classList.remove('hidden');
            const res = await post(`/api/servers/${serverId}/mods`, { url, ignoreVersion });
            if (!res) {
              progress.classList.add('hidden'); // failure keeps the modal open - no zombie meter
              return false;
            }
            const note = overrideNote(res.installed);
            toast(
              `Installed ${res.installed.name}${res.installed.version ? ` ${res.installed.version}` : ''}.${note ? ` ${note}` : ''}`,
              note ? { kind: 'warn', timeout: 9000 } : undefined
            );
            setTimeout(() => location.reload(), 700);
          },
        },
      ],
    });
    modal.body.querySelector('#mod-url').focus();
  });

  // Shared "installed despite a compatibility check being overridden" toast
  // text - both Add by URL and the search results' Install button hit this.
  function overrideNote(installed) {
    const bits = [];
    if (installed.versionOverridden) bits.push(`isn't listed as compatible with ${mc}`);
    if (installed.loaderOverridden) bits.push("isn't built for this server's loader");
    return bits.length ? `This build ${bits.join(' and ')}, but was installed anyway.` : '';
  }

  // ---- Modrinth search (reused by the manual-download resolver) ----
  // allowDatapacks: shows a Mods/Datapacks toggle. Off for the manual-download
  // resolver's "Find on Modrinth" - that's specifically hunting a mod
  // replacement for a pack entry, never a datapack.
  function openModrinthSearch({ prefill = '', onInstalled = null, allowDatapacks = false } = {}) {
    const isPlugin = ['PAPER', 'PURPUR', 'SPIGOT', 'BUKKIT', 'FOLIA', 'LEAF', 'PUFFERFISH'].includes(serverType);
    const contentLabel = isPlugin ? 'Plugins' : 'Mods';
    const content = document.createElement('div');
    content.innerHTML = `
      <input class="input" id="mr-q" placeholder="Search Modrinth…" autocomplete="off">
      ${
        allowDatapacks
          ? `<div class="seg mt-2" id="mr-kind-seg" role="tablist" aria-label="Content type">
               <button class="seg-btn" type="button" role="tab" aria-selected="true" data-search-kind="content">${contentLabel}</button>
               <button class="seg-btn" type="button" role="tab" aria-selected="false" data-search-kind="datapack">Datapacks</button>
             </div>`
          : ''
      }
      ${
        mc
          ? `<label class="mt-2 flex cursor-pointer items-start gap-2 text-sm">
               <input type="checkbox" class="msm-check mt-0.5" id="mr-any-version">
               <span>Also show builds not listed as compatible with ${escAttr(mc)} or this server's loader. You accept the risk of installing one.</span>
             </label>`
          : ''
      }
      <div class="mt-3 max-h-96 space-y-2 overflow-y-auto" id="mr-results">
        <p class="p-6 text-center text-sm text-ink-faint">Type to search.</p>
      </div>`;
    const modal = openModal({ title: 'Search Modrinth', content, size: 'lg' });
    const q = content.querySelector('#mr-q');
    const kindSeg = content.querySelector('#mr-kind-seg');
    const anyVersion = content.querySelector('#mr-any-version');
    const results = content.querySelector('#mr-results');
    let timer;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 350);
    });
    kindSeg?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-search-kind]');
      if (!btn || btn.getAttribute('aria-selected') === 'true') return;
      kindSeg.querySelectorAll('[data-search-kind]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      runSearch();
    });
    anyVersion?.addEventListener('change', runSearch);
    q.value = prefill;
    q.focus();
    if (prefill) runSearch();

    let searchSeq = 0; // a slow earlier response must not overwrite a newer one
    async function runSearch() {
      const query = q.value.trim();
      if (!query) return;
      const seq = ++searchSeq;
      results.innerHTML = '<p class="p-6 text-center text-sm text-ink-faint">Searching…</p>';
      const searchingDatapacks =
        kindSeg?.querySelector('[data-search-kind="datapack"]')?.getAttribute('aria-selected') === 'true';
      const ignoreVersion = Boolean(anyVersion?.checked);
      const effectiveLoader =
        serverLoader || { FABRIC: 'fabric', QUILT: 'quilt', FORGE: 'forge', NEOFORGE: 'neoforge' }[serverType] || '';
      // Datapacks aren't loader-specific - Modrinth's loader facet would just
      // filter every datapack result out (none carry a fabric/forge category).
      // The override checkbox waives the loader match too, same as install does.
      const loader = searchingDatapacks || ignoreVersion ? '' : effectiveLoader;
      const kind = searchingDatapacks ? 'datapack' : isPlugin ? 'plugin' : 'mod';
      const params = new URLSearchParams({ q: query, kind });
      if (loader) params.set('loader', loader);
      // Skip the mc facet entirely when overriding, so Modrinth's own filter
      // doesn't hide the very builds the checkbox exists to surface.
      if (mc && !mc.startsWith('LATEST') && !ignoreVersion) params.set('mc', mc);
      let data;
      try {
        const res = await fetch(`/api/modrinth/search?${params}`);
        data = await res.json();
      } catch {
        // a network error used to strand "Searching…" on screen forever
        data = { ok: false, error: 'The search could not be completed. Check your connection and try again.' };
      }
      if (seq !== searchSeq) return;
      if (!data.ok) {
        const p = document.createElement('p');
        p.className = 'p-6 text-center text-sm text-danger';
        p.textContent = data.error || 'The search could not be completed. Please try again.'; // upstream text - never innerHTML
        results.replaceChildren(p);
        return;
      }
      if (!data.results.length) {
        results.innerHTML = searchingDatapacks
          ? '<p class="p-6 text-center text-sm text-ink-faint">No matches for this version.</p>'
          : '<p class="p-6 text-center text-sm text-ink-faint">No matches for this loader/version.</p>';
        return;
      }
      // Loader-mismatch checking only makes sense for plain mod search - plugin
      // search never filters by loader in the first place (Paper/Spigot/Purpur
      // aren't cleanly separable by Modrinth category), and datapacks have no
      // loader concept at all.
      const checkingLoaderMismatch = ignoreVersion && !searchingDatapacks && !isPlugin && effectiveLoader;
      results.innerHTML = '';
      for (const hit of data.results) {
        const versionMismatch = ignoreVersion && mc && !(hit.gameVersions || []).includes(mc);
        const loaderMismatch = checkingLoaderMismatch && !(hit.categories || []).includes(effectiveLoader);
        const notListed = versionMismatch || loaderMismatch;
        const tipBits = [
          versionMismatch ? `compatible with ${mc}` : null,
          loaderMismatch ? "built for this server's loader" : null,
        ].filter(Boolean);
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 rounded-md border border-line bg-raised p-2.5';
        row.innerHTML = `
          ${hit.iconUrl ? `<img src="${escAttr(hit.iconUrl)}" alt="" class="size-10 shrink-0 rounded bg-inset object-cover">` : '<span class="grid size-10 shrink-0 place-items-center rounded bg-inset text-ink-faint">?</span>'}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <div class="truncate text-sm font-semibold"></div>
              ${notListed ? `<span class="shrink-0 badge badge-warn" data-tip="Not listed as ${escAttr(tipBits.join(' or '))}. May not work correctly.">not verified</span>` : ''}
            </div>
            <div class="truncate text-xs text-ink-faint"></div>
          </div>
          <span class="shrink-0 text-xs text-ink-faint">${Number(hit.downloads).toLocaleString()} downloads</span>
          <button class="btn btn-primary btn-sm shrink-0">Install</button>`;
        row.querySelector('.font-semibold').textContent = hit.title;
        row.querySelector('.text-xs.text-ink-faint').textContent = hit.description;
        row.querySelector('button').addEventListener('click', async (ev) => {
          const btn = ev.currentTarget; // capture before await - currentTarget is null afterwards
          const urlKind = searchingDatapacks ? 'datapack' : 'mod';
          const res2 = await withBusy(btn, 'Installing…', () =>
            post(`/api/servers/${serverId}/mods`, {
              url: `https://modrinth.com/${urlKind}/${hit.slug}`,
              kind: searchingDatapacks ? 'datapack' : undefined,
              ignoreVersion,
            })
          );
          if (res2) {
            const note = overrideNote(res2.installed);
            toast(
              `Installed ${res2.installed.name}.${note ? ` ${note}` : ''}`,
              note ? { kind: 'warn', timeout: 9000 } : undefined
            );
            modal.close();
            if (onInstalled) onInstalled(res2);
            else setTimeout(() => location.reload(), 700);
          }
        });
        results.appendChild(row);
      }
    }
  }
  document
    .getElementById('mods-search-modrinth')
    ?.addEventListener('click', () => openModrinthSearch({ allowDatapacks: true }));

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
        <span class="text-warn">${list.length} ${list.length === 1 ? 'mod' : 'mods'} in this modpack couldn't be downloaded automatically. The pack won't finish installing until each one is resolved.</span>
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
      <p class="mb-3 text-sm text-ink-soft">These mods don't allow automatic download, or they came from CurseForge, so the pack can't finish on its own. For each one, <b>Exclude</b> it, install a replacement from <b>Modrinth</b>, or <b>upload</b> the file you downloaded by hand. Changes take effect the next time the container is rebuilt.</p>
      <div class="space-y-2" id="pending-list"></div>`;
    openModal({ title: 'Mods That Need Manual Action', content, size: 'lg' });
    const listEl = content.querySelector('#pending-list');

    function render(mods) {
      if (!mods.length) {
        listEl.innerHTML =
          '<p class="notice notice-ok text-ok">All resolved. Rebuild the server to apply the changes.</p>';
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
            <button class="btn btn-sm" data-act="upload">Upload file</button>
            <a class="btn btn-sm" target="_blank" rel="noopener" data-act="open">Open CurseForge page</a>
          </div>
          <input type="file" accept=".jar,.zip" class="hidden" data-role="file">`;
        row.querySelector('.font-semibold').textContent = m.name || m.filename;
        row.querySelector('.font-mono').textContent = m.filename;
        // Pack-manifest URL is third-party data - allow only http(s).
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
            if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'upload that file' }));
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
        toast(data.error || friendlyError(res, { action: 'complete that action' }), { kind: 'error', timeout: 9000 });
        return null;
      }
      return data;
    } catch {
      toast(friendlyError(null, { action: 'complete that action' }), { kind: 'error' });
      return null;
    }
  }
}
