// File manager tab: navigation is server-rendered (?path=), actions go through
// /api/servers/:id/files (or /api/files when unscoped). Text edit in a modal
// textarea (line numbers + wrap toggle; a full editor lands later) plus a
// bounded "find in files" grep.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { fmtBytes, escapeHtml } from '../lib/format.js';

const root = document.querySelector('[data-files-server], [data-files-global]');
if (root) init(root);

function init(rootEl) {
  const serverId = rootEl.dataset.filesServer || null;
  const base = serverId ? `/api/servers/${serverId}/files` : '/api/files';
  const currentPath = rootEl.dataset.filesPath || '';
  const join = (dir, name) => (dir ? `${dir}/${name}` : name);
  const reload = () => setTimeout(() => location.reload(), 600);

  // ---- Upload ----
  const uploadBtn = document.getElementById('files-upload');
  uploadBtn?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.addEventListener('change', async () => {
      if (!input.files.length) return;
      const form = new FormData();
      for (const f of input.files) form.append('files', f);
      toast(`Uploading ${input.files.length} file${input.files.length > 1 ? 's' : ''}…`, { kind: 'info' });
      await withBusy(uploadBtn, 'Uploading…', async () => {
        try {
          const res = await fetch(`${base}/upload?path=${encodeURIComponent(currentPath)}`, {
            method: 'POST',
            body: form,
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok !== false) {
            const n = (data.uploaded || []).length;
            toast(`Uploaded ${n} file${n === 1 ? '' : 's'}.`);
            reload();
          } else {
            toast(data.error || friendlyError(res, { action: 'upload those files' }), {
              kind: 'error',
              timeout: 9000,
            });
          }
        } catch {
          toast(friendlyError(null, { action: 'upload those files' }), { kind: 'error' });
        }
      });
    });
    input.click();
  });

  // ---- New folder ----
  document.getElementById('files-mkdir')?.addEventListener('click', () => {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Folder name</label>
      <input class="input" data-mk-name placeholder="new-folder" autocomplete="off">`;
    openModal({
      title: 'New Folder',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Create',
          kind: 'primary',
          busyLabel: 'Creating…',
          onClick: async () => {
            const name = content.querySelector('[data-mk-name]').value.trim();
            if (!name) return false;
            const res = await post(`${base}/mkdir`, { path: join(currentPath, name) });
            if (!res) return false;
            toast(`Folder "${name}" created.`);
            reload();
          },
        },
      ],
    });
  });

  // ---- Find in files ----
  document.getElementById('files-search')?.addEventListener('click', () => {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label" for="fs-q">Search text</label>
      <input class="input" id="fs-q" placeholder="a word or phrase (min 2 chars)" autocomplete="off">
      <label class="mt-2 flex items-center gap-2 text-xs text-ink-faint">
        <input type="checkbox" class="msm-check" id="fs-case"> Match case
      </label>
      <p class="help mt-1">Searches text files${currentPath ? ` under <span class="font-mono">${escapeHtml(currentPath)}</span>` : ' from here down'}. Large and binary files are skipped.</p>
      <div class="mt-3 max-h-80 overflow-y-auto rounded-md border border-line text-sm" id="fs-results" hidden></div>`;
    const q = content.querySelector('#fs-q');
    const results = content.querySelector('#fs-results');

    const run = async () => {
      const term = q.value.trim();
      if (term.length < 2) return false;
      results.hidden = false;
      results.innerHTML = '<div class="p-3 text-ink-faint">Searching…</div>';
      const params = new URLSearchParams({ q: term });
      if (currentPath) params.set('path', currentPath);
      if (content.querySelector('#fs-case').checked) params.set('case', '1');
      let data;
      try {
        const res = await fetch(`${base}/search?${params}`);
        data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          results.innerHTML = `<div class="p-3 text-danger">${escapeHtml(data.error || 'Search failed.')}</div>`;
          return false;
        }
      } catch {
        results.innerHTML = '<div class="p-3 text-danger">Search failed.</div>';
        return false;
      }
      if (!data.matches.length) {
        results.innerHTML = '<div class="p-3 text-ink-faint">No matches.</div>';
        return false;
      }
      results.innerHTML =
        data.matches
          .map(
            (m) => `
        <button class="flex w-full items-baseline gap-2 border-b border-line px-3 py-1.5 text-left last:border-0 hover:bg-inset" data-fs-open="${escapeHtml(m.path)}" data-fs-line="${m.line}">
          <span class="min-w-0 shrink-0 truncate font-mono text-xs text-link">${escapeHtml(m.path)}:${m.line}</span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-ink-faint">${escapeHtml(m.text)}</span>
        </button>`
          )
          .join('') +
        (data.truncated
          ? '<div class="px-3 py-1.5 text-xs text-ink-faint">Showing the first results only. Narrow the search to see the rest.</div>'
          : '');
      return false; // keep the modal open
    };

    openModal({
      title: 'Find in Files',
      content,
      size: 'lg',
      actions: [
        { label: 'Close', kind: 'ghost' },
        { label: 'Search', kind: 'primary', busyLabel: 'Searching…', onClick: run },
      ],
    });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });
    results.addEventListener('click', (e) => {
      const hit = e.target.closest('[data-fs-open]');
      if (!hit) return;
      openEditor(hit.dataset.fsOpen, hit.dataset.fsOpen.split('/').pop(), Number(hit.dataset.fsLine) || 0);
    });
    q.focus();
  });

  // ---- Row actions ----
  document.getElementById('files-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-file-row]');
    if (!row) return;
    const { path, name, size } = row.dataset;
    const isDir = row.dataset.dir === 'true';

    if (e.target.closest('[data-file-edit]')) {
      // The read fetch happens before the editor modal opens - spinner the
      // row button for that gap.
      await withBusy(e.target.closest('[data-file-edit]'), () => openEditor(path, name));
    } else if (e.target.closest('[data-file-download]')) {
      location.href = `${base}/download?path=${encodeURIComponent(path)}`;
    } else if (e.target.closest('[data-file-delete]')) {
      const btn = e.target.closest('[data-file-delete]');
      const ok = await confirmDialog({
        title: `Delete ${isDir ? 'folder' : 'file'} "${name}"?`,
        message: isDir ? 'Deletes the folder and everything inside it.' : 'Deletes this file permanently.',
        detail: `${fmtBytes(size)} will be freed.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`${base}?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) {
          toast(`"${name}" deleted (${fmtBytes(data.freedBytes)} freed).`);
          const tbody = row.closest('tbody');
          row.remove();
          // A header-only table after the last delete looks broken - restore
          // the empty state the server renders on first load.
          if (tbody && !tbody.querySelector('[data-file-row]')) {
            const tr = document.createElement('tr');
            tr.dataset.filesEmpty = '';
            tr.innerHTML =
              '<td data-th="" colspan="4" class="py-10 text-center text-sm text-ink-faint">This folder is empty. Upload files or create a folder above.</td>';
            tbody.appendChild(tr);
          }
        } else {
          toast(data.error || friendlyError(res, { action: 'delete that item' }), { kind: 'error' });
        }
      } finally {
        restore();
      }
    }
  });

  // Rename/move/copy live in the row overflow menu, which dropdown.js portals
  // to <body> - so these are document-delegated and carry their own data-path.
  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-file-rename], [data-file-move], [data-file-copy]');
    if (!act || !act.dataset.path) return;
    const { path, name } = act.dataset;
    if (act.hasAttribute('data-file-rename')) renameModal(path, name);
    else if (act.hasAttribute('data-file-move')) destinationModal('Move', path, name, `${base}/move`);
    else destinationModal('Copy', path, name, `${base}/copy`);
  });

  // ---- Text editor (modal textarea) ----
  const LANG_BY_EXT = {
    properties: 'Properties',
    json: 'JSON',
    json5: 'JSON5',
    yml: 'YAML',
    yaml: 'YAML',
    toml: 'TOML',
    txt: 'Text',
    md: 'Markdown',
    mcfunction: 'mcfunction',
    cfg: 'Config',
    conf: 'Config',
    ini: 'INI',
    js: 'JavaScript',
    ts: 'TypeScript',
    sh: 'Shell',
    xml: 'XML',
    html: 'HTML',
    css: 'CSS',
    log: 'Log',
  };

  async function openEditor(path, name, gotoLine = 0) {
    const res = await fetch(`${base}/read?path=${encodeURIComponent(path)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return toast(data.error || friendlyError(res, { action: 'open this file' }), { kind: 'error', timeout: 8000 });
    }
    const ext = (name.split('.').pop() || '').toLowerCase();
    const lang = LANG_BY_EXT[ext] || (ext ? ext.toUpperCase() : 'Text');
    const lineCount = data.content.split('\n').length;
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="mb-1 flex items-center gap-2 text-xs text-ink-faint">
        <span class="badge">${escapeHtml(lang)}</span>
        <span>${lineCount} line${lineCount === 1 ? '' : 's'} · ${fmtBytes(data.size)}</span>
        <label class="ml-auto flex cursor-pointer items-center gap-1.5"><input type="checkbox" class="msm-check" data-ed-wrap> Wrap</label>
      </div>
      <textarea class="input h-96 w-full resize-y whitespace-pre font-mono text-xs leading-relaxed" spellcheck="false" wrap="off"></textarea>
      <p class="help mt-2">${escapeHtml(path)}. Tab inserts a tab; saves are written safely in one step.</p>`;
    const textarea = content.querySelector('textarea');
    textarea.value = data.content;
    content.querySelector('[data-ed-wrap]').addEventListener('change', (e) => {
      const on = e.target.checked;
      textarea.setAttribute('wrap', on ? 'soft' : 'off');
      textarea.classList.toggle('whitespace-pre', !on);
      textarea.classList.toggle('whitespace-pre-wrap', on);
    });
    // Tab should indent, not move focus out of the editor.
    textarea.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || e.shiftKey) return;
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = textarea;
      textarea.setRangeText('\t', s, en, 'end');
    });
    openModal({
      title: `Edit ${name}`,
      content,
      size: 'lg',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Save',
          kind: 'primary',
          busyLabel: 'Saving…',
          onClick: async () => {
            const saved = await post(`${base}/write`, { path, content: textarea.value });
            if (!saved) return false;
            toast(`${name} saved (${fmtBytes(saved.size)}).`);
            reload();
          },
        },
      ],
    });
    textarea.focus();
    if (gotoLine > 0) {
      // Put the caret at the start of the target line and scroll it into view.
      const offset =
        textarea.value
          .split('\n')
          .slice(0, gotoLine - 1)
          .join('\n').length + (gotoLine > 1 ? 1 : 0);
      textarea.setSelectionRange(offset, offset);
      const approxLineHeight = 16;
      textarea.scrollTop = Math.max(0, (gotoLine - 3) * approxLineHeight);
    }
  }

  function renameModal(path, name) {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">New name</label>
      <input class="input" data-rn-name autocomplete="off">`;
    const input = content.querySelector('[data-rn-name]');
    input.value = name;
    openModal({
      title: `Rename ${name}`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Rename',
          kind: 'primary',
          busyLabel: 'Renaming…',
          onClick: async () => {
            const newName = input.value.trim();
            if (!newName || newName === name) return false;
            const res = await post(`${base}/rename`, { path, newName });
            if (!res) return false;
            toast(`Renamed to "${newName}".`);
            reload();
          },
        },
      ],
    });
    input.select();
  }

  function destinationModal(verb, path, name, url) {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Destination folder (relative to the root)</label>
      <input class="input font-mono" data-dst placeholder="e.g. world/datapacks (leave empty for the root)" autocomplete="off">
      <p class="help">${verb === 'Copy' ? 'Copies' : 'Moves'} "${escapeHtml(name)}" into the folder. It must already exist.</p>`;
    const input = content.querySelector('[data-dst]');
    input.value = currentPath;
    openModal({
      title: `${verb} ${name}`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: verb,
          kind: 'primary',
          busyLabel: verb === 'Copy' ? 'Copying…' : 'Moving…',
          onClick: async () => {
            const res = await post(url, { path, dest: input.value.trim() });
            if (!res) return false;
            toast(`${verb === 'Copy' ? 'Copied' : 'Moved'} to ${res.path}.`);
            reload();
          },
        },
      ],
    });
    input.focus();
  }

  async function post(url, body) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        toast(data.error || friendlyError(res, { action: 'complete that file action' }), {
          kind: 'error',
          timeout: 9000,
        });
        return null;
      }
      return data;
    } catch {
      toast(friendlyError(null, { action: 'complete that file action' }), { kind: 'error' });
      return null;
    }
  }
}
