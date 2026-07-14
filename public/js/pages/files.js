// File manager tab: navigation is server-rendered (?path=), actions go through
// /api/servers/:id/files (or /api/files when unscoped). Text edit in a modal
// textarea for v1 — CodeMirror lands later.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';

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
            toast(`Uploaded ${data.uploaded.length} file${data.uploaded.length > 1 ? 's' : ''}.`);
            reload();
          } else {
            toast(data.error || 'Upload failed', { kind: 'error', timeout: 9000 });
          }
        } catch (err) {
          toast(`Network error: ${err.message}`, { kind: 'error' });
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
      title: 'New folder',
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

  // ---- Row actions ----
  document.getElementById('files-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-file-row]');
    if (!row) return;
    const { path, name, size } = row.dataset;
    const isDir = row.dataset.dir === 'true';

    if (e.target.closest('[data-file-edit]')) {
      // The read fetch happens before the editor modal opens — spinner the
      // row button for that gap.
      await withBusy(e.target.closest('[data-file-edit]'), () => openEditor(path, name));
    } else if (e.target.closest('[data-file-download]')) {
      location.href = `${base}/download?path=${encodeURIComponent(path)}`;
    } else if (e.target.closest('[data-file-rename]')) {
      renameModal(path, name);
    } else if (e.target.closest('[data-file-move]')) {
      destinationModal('Move', path, name, `${base}/move`);
    } else if (e.target.closest('[data-file-copy]')) {
      destinationModal('Copy', path, name, `${base}/copy`);
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
          row.remove();
        } else {
          toast(data.error || 'Delete failed', { kind: 'error' });
        }
      } finally {
        restore();
      }
    }
  });

  // ---- Text editor (modal textarea, v1) ----
  async function openEditor(path, name) {
    const res = await fetch(`${base}/read?path=${encodeURIComponent(path)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return toast(data.error || 'Cannot open this file', { kind: 'error', timeout: 8000 });
    }
    const content = document.createElement('div');
    content.innerHTML = `
      <textarea class="input h-96 w-full resize-y font-mono text-xs leading-relaxed" spellcheck="false"></textarea>
      <p class="help mt-2">${escapeHtml(path)} · ${fmtBytes(data.size)} — saved atomically.</p>`;
    const textarea = content.querySelector('textarea');
    textarea.value = data.content;
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
      <input class="input font-mono" data-dst placeholder="e.g. world/datapacks — empty for the root" autocomplete="off">
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

function fmtBytes(n) {
  n = Number(n) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
