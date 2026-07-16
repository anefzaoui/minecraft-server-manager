// JEI-style item browser. Searches EVERY item and block on a server (vanilla +
// mods) by display name, id or mod — the registry is built server-side from
// the server's own jar files, so it matches exactly what /give accepts.
//
// openItemBrowser({ serverId, onPick, onManual }) -> modal
//   onPick({id, name, mod, kind})  — called when a row is clicked (modal closes)
//   onManual()                     — optional "enter id manually" fallback link

import { openModal } from './modal.js';
import { toast } from './toast.js';
import { runTask } from './progress.js';
import { withBusy } from './loading.js';

const PAGE = 100;
const KINDS = [
  { value: '', label: 'All' },
  { value: 'item', label: 'Items' },
  { value: 'block', label: 'Blocks' },
];

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

export function openItemBrowser({ serverId, onPick, onManual } = {}) {
  const base = `/api/servers/${serverId}/items`;
  const state = { q: '', mod: '', kind: '', offset: 0, total: 0, loading: false, modsLoaded: false };

  const content = document.createElement('div');
  content.className = 'space-y-3 text-sm';
  content.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      <input class="input flex-1 min-w-48" data-ib-q placeholder="Search by name or id — Iron Ingot, allthemodium, minecraft:tnt…"
             maxlength="120" autocomplete="off" spellcheck="false">
      <div class="w-52 max-w-full">
        <select data-ib-mod data-label="Filter by mod" aria-label="Filter by mod">
          <option value="">All mods</option>
        </select>
      </div>
      <div class="flex rounded-md border border-line" data-ib-kinds role="group" aria-label="Kind">
        ${KINDS.map(
          (k) => `
          <button type="button" data-kind="${k.value}"
                  class="px-2.5 py-1.5 text-xs font-medium transition first:rounded-l-md last:rounded-r-md
                         ${k.value === '' ? 'bg-inset text-ink' : 'text-ink-faint hover:text-ink'}">${k.label}</button>`
        ).join('')}
      </div>
    </div>
    <div data-ib-list class="min-h-48 divide-y divide-line/60 rounded-md border border-line"></div>
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-ink-faint" data-ib-status></span>
      <button class="btn btn-sm hidden" data-ib-more>Load more</button>
      <span class="ml-auto flex items-center gap-3">
        ${onManual ? '<a href="#" class="text-xs text-ink-faint underline hover:text-ink" data-ib-manual>enter id manually</a>' : ''}
        <button class="btn btn-ghost btn-sm" data-ib-rebuild data-tip="Re-scan the mod jars and server jar (use after adding or removing mods)">Rebuild registry</button>
      </span>
    </div>`;

  const modal = openModal({ title: 'Item browser', content, size: 'lg' });
  const $ = (sel) => content.querySelector(sel);
  const listEl = $('[data-ib-list]');
  const statusEl = $('[data-ib-status]');
  const moreBtn = $('[data-ib-more]');
  const qEl = $('[data-ib-q]');
  const modSel = $('[data-ib-mod]');

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function row(item) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-inset';
    btn.innerHTML = `
      <span class="min-w-0 flex-1">
        <span class="block truncate font-semibold">${esc(item.name)}</span>
        <span class="block truncate font-mono text-[11px] text-ink-faint">${esc(item.id)}</span>
      </span>
      ${item.kind === 'block' ? '<span class="chip shrink-0">block</span>' : ''}
      <span class="chip max-w-40 shrink-0 truncate">${esc(item.mod)}</span>`;
    btn.addEventListener('click', () => {
      modal.close();
      if (onPick) onPick({ id: item.id, name: item.name, mod: item.mod, kind: item.kind });
    });
    return btn;
  }

  async function fetchPage() {
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(state.offset) });
    if (state.q) params.set('q', state.q);
    if (state.mod) params.set('mod', state.mod);
    if (state.kind) params.set('kind', state.kind);
    const res = await fetch(`${base}?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    return data;
  }

  async function load({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    moreBtn.disabled = true;
    if (!append) {
      state.offset = 0;
      listEl.innerHTML =
        '<div class="p-6 text-center text-sm text-ink-faint">Loading items… <span class="text-xs">(first open scans every mod jar — later opens are instant)</span></div>';
      setStatus('');
    }
    try {
      const data = await fetchPage();
      state.total = data.total;
      if (!state.modsLoaded && data.mods) {
        state.modsLoaded = true;
        for (const m of data.mods) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.name;
          opt.dataset.desc = `${m.id} · ${m.count} item${m.count === 1 ? '' : 's'}`;
          modSel.appendChild(opt);
        }
      }
      if (!append) listEl.innerHTML = '';
      if (!data.items.length && !append) {
        listEl.innerHTML = `<div class="p-6 text-center text-sm text-ink-faint">No items match${state.q ? ` "${esc(state.q)}"` : ''}. Try a different search, mod or kind filter.</div>`;
      }
      for (const item of data.items) listEl.appendChild(row(item));
      const shown = state.offset + data.items.length;
      state.offset = shown;
      setStatus(state.total ? `${shown.toLocaleString()} of ${state.total.toLocaleString()} items` : '');
      moreBtn.classList.toggle('hidden', shown >= state.total);
      moreBtn.disabled = false;
    } catch (err) {
      if (!append)
        listEl.innerHTML = `<div class="p-6 text-center text-sm text-danger">${esc(err.message)}</div>`;
      else toast(err.message, { kind: 'error' });
    } finally {
      state.loading = false;
    }
  }

  // --- wiring -------------------------------------------------------------
  let debounce;
  qEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.q = qEl.value.trim();
      load();
    }, 250);
  });
  qEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounce);
      state.q = qEl.value.trim();
      load();
    }
  });

  modSel.addEventListener('change', () => {
    state.mod = modSel.value;
    load();
  });

  content.querySelectorAll('[data-ib-kinds] [data-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.kind = btn.dataset.kind;
      content.querySelectorAll('[data-ib-kinds] [data-kind]').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('bg-inset', active);
        b.classList.toggle('text-ink', active);
        b.classList.toggle('text-ink-faint', !active);
      });
      load();
    });
  });

  moreBtn.addEventListener('click', () => withBusy(moreBtn, () => load({ append: true })));

  $('[data-ib-rebuild]').addEventListener('click', async () => {
    try {
      const result = await runTask({
        title: 'Rebuilding item registry',
        start: async () => {
          const res = await fetch(`${base}/rebuild`, { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) throw new Error(data.error || 'Could not start the rebuild');
          return data.taskId;
        },
      });
      toast(`Registry rebuilt: ${result.items.toLocaleString()} items from ${result.mods} mods`);
      state.modsLoaded = false;
      modSel.innerHTML = '<option value="">All mods</option>';
      state.mod = '';
      modSel.dispatchEvent(new Event('change', { bubbles: true })); // resync enhanced trigger + reload
    } catch (err) {
      toast(err.message, { kind: 'error' });
    }
  });

  if (onManual) {
    $('[data-ib-manual]').addEventListener('click', (e) => {
      e.preventDefault();
      modal.close();
      onManual();
    });
  }

  load();
  qEl.focus();
  return modal;
}
