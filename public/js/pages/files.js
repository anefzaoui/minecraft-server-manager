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
import { t } from '../lib/i18n.js';

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
      <label class="label">${escapeHtml(t('files.folder_name_label'))}</label>
      <input class="input" data-mk-name placeholder="${escapeHtml(t('files.folder_name_placeholder'))}" autocomplete="off">`;
    openModal({
      title: t('files.new_folder_title'),
      content,
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('common.create'),
          kind: 'primary',
          busyLabel: t('common.creating'),
          onClick: async () => {
            const name = content.querySelector('[data-mk-name]').value.trim();
            if (!name) return false;
            const res = await post(`${base}/mkdir`, { path: join(currentPath, name) });
            if (!res) return false;
            toast(t('files.folder_created_toast', { name }));
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
      <label class="label" for="fs-q">${escapeHtml(t('files.search_text_label'))}</label>
      <input class="input" id="fs-q" placeholder="${escapeHtml(t('files.search_text_placeholder'))}" autocomplete="off">
      <label class="mt-2 flex items-center gap-2 text-xs text-ink-faint">
        <input type="checkbox" class="msm-check" id="fs-case"> ${escapeHtml(t('files.match_case'))}
      </label>
      <p class="help mt-1">${t('files.find_help', { path: currentPath ? t('files.under_folder', { path: escapeHtml(currentPath) }) : t('files.from_here_down') })}</p>
      <div class="mt-3 max-h-80 overflow-y-auto rounded-md border border-line text-sm" id="fs-results" hidden></div>`;
    const q = content.querySelector('#fs-q');
    const results = content.querySelector('#fs-results');

    const run = async () => {
      const term = q.value.trim();
      if (term.length < 2) return false;
      results.hidden = false;
      results.innerHTML = `<div class="p-3 text-ink-faint">${escapeHtml(t('files.searching'))}</div>`;
      const params = new URLSearchParams({ q: term });
      if (currentPath) params.set('path', currentPath);
      if (content.querySelector('#fs-case').checked) params.set('case', '1');
      let data;
      try {
        const res = await fetch(`${base}/search?${params}`);
        data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          results.innerHTML = `<div class="p-3 text-danger">${escapeHtml(data.error || t('files.search_failed'))}</div>`;
          return false;
        }
      } catch {
        results.innerHTML = `<div class="p-3 text-danger">${escapeHtml(t('files.search_failed'))}</div>`;
        return false;
      }
      if (!data.matches.length) {
        results.innerHTML = `<div class="p-3 text-ink-faint">${escapeHtml(t('files.no_matches'))}</div>`;
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
          ? `<div class="px-3 py-1.5 text-xs text-ink-faint">${escapeHtml(t('files.showing_first_results'))}</div>`
          : '');
      return false; // keep the modal open
    };

    openModal({
      title: t('files.find_title'),
      content,
      size: 'lg',
      actions: [
        { label: t('common.close'), kind: 'ghost' },
        {
          label: t('common.search', { defaultValue: 'Search' }),
          kind: 'primary',
          busyLabel: t('files.searching'),
          onClick: run,
        },
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
      const typeLabel = isDir ? t('files.type_folder') : t('files.type_file');
      const ok = await confirmDialog({
        title: t('files.delete_confirm_title', { type: typeLabel, name }),
        message: isDir ? t('files.delete_dir_msg') : t('files.delete_file_msg'),
        detail: `${fmtBytes(size)} will be freed.`,
        confirmLabel: t('common.delete'),
        danger: true,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`${base}?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) {
          toast(t('files.deleted_toast', { name, freed: fmtBytes(data.freedBytes) }));
          const tbody = row.closest('tbody');
          row.remove();
          // A header-only table after the last delete looks broken - restore
          // the empty state the server renders on first load.
          if (tbody && !tbody.querySelector('[data-file-row]')) {
            const tr = document.createElement('tr');
            tr.dataset.filesEmpty = '';
            tr.innerHTML = `<td data-th="" colspan="4" class="py-10 text-center text-sm text-ink-faint">${escapeHtml(t('files_page.folder_empty', { defaultValue: 'This folder is empty. Upload files or create a folder above.' }))}</td>`;
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
        <span>${escapeHtml(t('files.lines_counter', { count: lineCount, size: fmtBytes(data.size) }))}</span>
        <label class="ml-auto flex cursor-pointer items-center gap-1.5"><input type="checkbox" class="msm-check" data-ed-wrap> ${escapeHtml(t('files.wrap_label'))}</label>
      </div>
      <textarea class="input h-96 w-full resize-y whitespace-pre font-mono text-xs leading-relaxed" spellcheck="false" wrap="off"></textarea>
      <p class="help mt-2">${t('files.editor_help', { path: escapeHtml(path) })}</p>`;
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
      title: t('files.edit_file_title', { name }),
      content,
      size: 'lg',
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('common.save'),
          kind: 'primary',
          busyLabel: t('common.saving'),
          onClick: async () => {
            const saved = await post(`${base}/write`, { path, content: textarea.value });
            if (!saved) return false;
            toast(t('files.file_saved_toast', { name, size: fmtBytes(saved.size) }));
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
      <label class="label">${escapeHtml(t('files.new_name_label'))}</label>
      <input class="input" data-rn-name autocomplete="off">`;
    const input = content.querySelector('[data-rn-name]');
    input.value = name;
    openModal({
      title: t('files.rename_title', { name }),
      content,
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('files_page.rename', { defaultValue: 'Rename' }),
          kind: 'primary',
          busyLabel: t('common.saving'),
          onClick: async () => {
            const newName = input.value.trim();
            if (!newName || newName === name) return false;
            const res = await post(`${base}/rename`, { path, newName });
            if (!res) return false;
            toast(t('files.renamed_toast', { name: newName }));
            reload();
          },
        },
      ],
    });
    input.select();
  }

  function destinationModal(verb, path, name, url) {
    const verbLabel = verb === 'Copy' ? t('files.verb_copy') : t('files.verb_move');
    const actionLabel = verb === 'Copy' ? t('files.action_copies') : t('files.action_moves');
    const doneVerb = verb === 'Copy' ? t('files.verb_copied') : t('files.verb_moved');
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">${escapeHtml(t('files.dest_folder_label'))}</label>
      <input class="input font-mono" data-dst placeholder="${escapeHtml(t('files.dest_placeholder'))}" autocomplete="off">
      <p class="help">${t('files.dest_help', { action: actionLabel, name: escapeHtml(name) })}</p>`;
    const input = content.querySelector('[data-dst]');
    input.value = currentPath;
    openModal({
      title: t('files.dest_title', { verb: verbLabel, name }),
      content,
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: verbLabel,
          kind: 'primary',
          busyLabel: t('common.saving'),
          onClick: async () => {
            const res = await post(url, { path, dest: input.value.trim() });
            if (!res) return false;
            toast(t('files.dest_toast', { verb: doneVerb, path: res.path }));
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
