// World library page: upload archives, extract from servers, install anywhere.
// Also exports the shared world modals used by the per-server Worlds tab.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { enhanceAll } from '../lib/select.js';
import { setBusy } from '../lib/loading.js';
import { fmtBytes } from '../lib/format.js';

// ---------------------------------------------------------------------------
// Shared helpers (imported by worlds-tab.js)

export function serverOptions() {
  try {
    return JSON.parse(document.getElementById('msm-server-options')?.dataset.options || '[]');
  } catch {
    return [];
  }
}

export { fmtBytes }; // re-export for worlds-tab.js

export async function postJSON(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
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

/** Upload a world archive into the library (XHR for real progress). */
export function uploadWorldModal({ onDone } = {}) {
  const content = document.createElement('div');
  content.innerHTML = `
    <label class="label">World name</label>
    <input class="input" data-w-name placeholder="My survival world" autocomplete="off">
    <label class="label mt-3">Archive (.zip, .mcworld, .tar, .tar.gz)</label>
    <label class="btn w-full cursor-pointer justify-center">
      Choose archive…
      <input type="file" data-w-file class="hidden" accept=".zip,.mcworld,.tar,.gz,.tgz">
    </label>
    <p class="help" data-w-filename>No file selected — the world root (level.dat) is detected automatically, Bukkit split dirs included.</p>
    <div class="mt-3 hidden" data-w-progress>
      <div class="meter"><div class="bg-grass-500" style="width:0%" data-w-bar></div></div>
      <p class="help mt-1" data-w-status>Uploading…</p>
    </div>`;

  const file = content.querySelector('[data-w-file]');
  const filename = content.querySelector('[data-w-filename]');
  file.addEventListener('change', () => {
    filename.textContent = file.files[0]
      ? `${file.files[0].name} (${fmtBytes(file.files[0].size)})`
      : 'No file selected.';
  });

  let busy = false;
  let activeXhr = null;
  openModal({
    title: 'Upload world to library',
    content,
    // Closing the modal must actually cancel the transfer — a "cancelled"
    // upload used to keep running and reload the page when it finished.
    onClose: () => activeXhr?.abort(),
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Upload & import',
        kind: 'primary',
        busyLabel: 'Uploading…',
        onClick: () => {
          if (busy) return false;
          if (!file.files[0]) {
            toast('Pick an archive first.', { kind: 'error' });
            return false;
          }
          busy = true;
          content.querySelector('[data-w-progress]').classList.remove('hidden');
          const bar = content.querySelector('[data-w-bar]');
          const status = content.querySelector('[data-w-status]');

          const form = new FormData();
          form.append('file', file.files[0]);
          const name = content.querySelector('[data-w-name]').value.trim();
          if (name) form.append('name', name);

          return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            activeXhr = xhr;
            xhr.addEventListener('abort', () => {
              busy = false;
              toast('Upload cancelled.', { kind: 'info' });
              resolve(false);
            });
            xhr.open('POST', '/api/worlds/upload');
            xhr.upload.addEventListener('progress', (e) => {
              if (!e.lengthComputable) return;
              const pct = Math.round((e.loaded / e.total) * 100);
              bar.style.width = `${pct}%`;
              status.textContent = pct < 100 ? `Uploading… ${pct}%` : 'Extracting & normalizing archive…';
            });
            xhr.addEventListener('load', () => {
              let data = {};
              try {
                data = JSON.parse(xhr.responseText);
              } catch {}
              if (xhr.status < 400 && data.ok) {
                toast(`World "${data.world.name}" added to the library (${fmtBytes(data.world.size)}).`);
                if (onDone) onDone(data.world);
                resolve(undefined); // close modal
              } else {
                busy = false;
                toast(data.error || `Upload failed (${xhr.status})`, { kind: 'error', timeout: 9000 });
                resolve(false); // keep modal open
              }
            });
            xhr.addEventListener('error', () => {
              busy = false;
              toast('Network error during upload.', { kind: 'error' });
              resolve(false);
            });
            xhr.send(form);
          });
        },
      },
    ],
  });
}

/** Extract a server's active world into the library. */
export function extractWorldModal({ serverId = null, onDone } = {}) {
  const servers = serverOptions();
  const content = document.createElement('div');
  content.innerHTML = `
    ${
      serverId
        ? ''
        : `
      <label class="label">Server</label>
      <select class="input" data-x-server data-label="Extract world from server">
        ${servers.map((s) => `<option value="${escapeHtml(s.id)}" data-desc="${escapeHtml(s.flavor)} · ${escapeHtml(s.status)}">${escapeHtml(s.name)}</option>`).join('')}
      </select>`
    }
    <label class="label ${serverId ? '' : 'mt-3'}">Library entry name (optional)</label>
    <input class="input" data-x-name placeholder="Leave empty to name it after the server" autocomplete="off">
    <p class="help">Takes a consistent snapshot — safe while the server is running (save-off → save-all → copy → save-on).</p>
    <div class="mt-3 hidden" data-x-progress><div class="meter meter-indeterminate"><div class="bg-grass-500" style="width:25%"></div></div></div>`;

  openModal({
    title: 'Save world to library',
    content,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Snapshot world',
        kind: 'primary',
        busyLabel: 'Snapshotting…',
        onClick: async () => {
          const sid = serverId || content.querySelector('[data-x-server]')?.value;
          if (!sid) {
            toast('Pick a server first.', { kind: 'error' });
            return false;
          }
          content.querySelector('[data-x-progress]').classList.remove('hidden');
          const res = await postJSON('/api/worlds/extract', {
            serverId: sid,
            name: content.querySelector('[data-x-name]').value.trim() || undefined,
          });
          if (!res) return false;
          toast(`World saved to library: ${res.world.name} (${fmtBytes(res.world.size)}).`);
          if (onDone) onDone(res.world);
        },
      },
    ],
  });
  enhanceAll(content);
}

/**
 * Install a library world into a server: mode picker (+ alongside name), then
 * the confirm-on-warnings round trip.
 */
export function installWorldModal(libId, libName, { serverId = null, onDone } = {}) {
  const servers = serverOptions();
  const content = document.createElement('div');
  content.innerHTML = `
    ${
      serverId
        ? ''
        : `
      <label class="label">Target server</label>
      <select class="input" data-i-server data-label="Install into server">
        ${servers.map((s) => `<option value="${escapeHtml(s.id)}" data-desc="${escapeHtml(s.flavor)} · ${escapeHtml(s.status)}">${escapeHtml(s.name)}</option>`).join('')}
      </select>`
    }
    <label class="label ${serverId ? '' : 'mt-3'}">Install mode</label>
    <select class="input" data-i-mode data-label="Install mode">
      <option value="replace" data-desc="Server must be stopped — current world is auto-backed-up first">Replace current world</option>
      <option value="alongside" data-desc="Adds it as another level dir — switch with Activate later">Install alongside</option>
    </select>
    <div class="mt-3 hidden" data-i-namewrap>
      <label class="label">New world folder name</label>
      <input class="input" data-i-name value="${escapeHtml(libName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 64))}" autocomplete="off">
    </div>
    <p class="help">Compatibility (flavor + MC version) is checked before anything is touched; replace mode takes a safety backup automatically.</p>
    <div class="mt-3 hidden" data-i-progress><div class="meter meter-indeterminate"><div class="bg-grass-500" style="width:25%"></div></div></div>`;

  const mode = content.querySelector('[data-i-mode]');
  mode.addEventListener('change', () => {
    content.querySelector('[data-i-namewrap]').classList.toggle('hidden', mode.value !== 'alongside');
  });

  openModal({
    title: `Install "${libName}"`,
    content,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Install world',
        kind: 'primary',
        busyLabel: 'Installing…',
        onClick: async () => {
          const sid = serverId || content.querySelector('[data-i-server]')?.value;
          if (!sid) {
            toast('Pick a target server first.', { kind: 'error' });
            return false;
          }
          const body = { serverId: sid, mode: mode.value };
          if (mode.value === 'alongside') {
            body.newName = content.querySelector('[data-i-name]').value.trim();
            if (!body.newName) {
              toast('Give the new world a folder name.', { kind: 'error' });
              return false;
            }
          }
          content.querySelector('[data-i-progress]').classList.remove('hidden');
          const done = await installWithConfirm(`/api/worlds/${libId}/install`, body);
          if (!done) {
            content.querySelector('[data-i-progress]').classList.add('hidden');
            return false;
          }
          toast(`World installed as "${done.installedAs}" (${fmtBytes(done.sizeBytes)}).`);
          if (onDone) onDone(done);
        },
      },
    ],
  });
  enhanceAll(content);
}

/** POST an install/copy endpoint; on requiresConfirm show the warnings, then retry. */
export async function installWithConfirm(url, body) {
  let res = await postJSON(url, body);
  if (!res) return null;
  if (res.requiresConfirm) {
    const ok = await confirmDialog({
      title: 'Compatibility warnings',
      message: 'The panel found potential problems with this install:',
      detail: res.warnings.join('\n\n'),
      confirmLabel: 'Install anyway',
      danger: true,
    });
    if (!ok) return null;
    res = await postJSON(url, { ...body, confirm: true });
    if (!res) return null;
  }
  return res;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// ---------------------------------------------------------------------------
// Page wiring (global library page only)

const page = document.querySelector('[data-worlds-page]');
if (page) {
  document.getElementById('world-upload')?.addEventListener('click', () => {
    uploadWorldModal({ onDone: () => setTimeout(() => location.reload(), 700) });
  });

  document.getElementById('world-extract')?.addEventListener('click', () => {
    if (!serverOptions().length) return toast('No servers yet — create one first.', { kind: 'info' });
    extractWorldModal({ onDone: () => setTimeout(() => location.reload(), 700) });
  });

  document.getElementById('worlds-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-world-row]');
    if (!row) return;
    const { id, name, size } = row.dataset;

    if (e.target.closest('[data-world-install]')) {
      if (!serverOptions().length) return toast('No servers yet — create one first.', { kind: 'info' });
      installWorldModal(id, name, { onDone: () => setTimeout(() => location.reload(), 700) });
    } else if (e.target.closest('[data-world-delete]')) {
      const btn = e.target.closest('[data-world-delete]');
      const ok = await confirmDialog({
        title: `Delete "${name}" from the library?`,
        message: 'Removes the archive from ./data/library/worlds. Worlds already installed on servers are not touched.',
        detail: `${fmtBytes(size)} will be freed.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`/api/worlds/${id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) {
          toast(`"${name}" removed (${fmtBytes(data.freedBytes)} freed).`);
          row.remove();
        } else {
          toast(data.error || 'Delete failed', { kind: 'error' });
        }
      } finally {
        restore();
      }
    }
  });
}
