// Per-server Worlds tab: snapshot/upload, install from library, and per-world
// actions (activate, download, duplicate, copy-to, rename, reset, delete).
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';
import {
  serverOptions,
  fmtBytes,
  postJSON,
  escapeHtml,
  uploadWorldModal,
  extractWorldModal,
  installWorldModal,
  installWithConfirm,
} from './worlds.js';

const root = document.querySelector('[data-worlds-server]');
if (root) init(root.dataset.worldsServer, root.dataset.worldsServerName, root.dataset.worldsStatus);

function init(serverId, serverName, serverStatus) {
  const base = `/api/servers/${serverId}/worlds`;
  const reload = () => setTimeout(() => location.reload(), 700);
  const isRunning = ['running', 'starting', 'unhealthy'].includes(serverStatus);

  // ---- Header actions ----
  document.getElementById('worlds-extract')?.addEventListener('click', () => {
    extractWorldModal({ serverId, onDone: reload });
  });
  document.getElementById('worlds-upload')?.addEventListener('click', () => {
    uploadWorldModal({ onDone: reload });
  });

  // ---- Library section: install here ----
  document.querySelectorAll('[data-lib-row]').forEach((row) => {
    row.querySelector('[data-lib-install]')?.addEventListener('click', () => {
      installWorldModal(row.dataset.id, row.dataset.name, { serverId, onDone: reload });
    });
  });

  // ---- Per-world actions ----
  document.getElementById('server-worlds-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-world-row]');
    if (!row) return;
    const world = row.dataset.world;
    const size = row.dataset.size;

    if (e.target.closest('[data-world-activate]')) {
      const btn = e.target.closest('[data-world-activate]');
      const ok = await confirmDialog({
        title: `Activate "${world}"?`,
        message: `Sets level-name to "${world}" — the server loads it on next start.${isRunning ? ' The server must be stopped first.' : ''}`,
        confirmLabel: 'Activate',
      });
      if (!ok) return;
      const res = await withBusy(btn, () => postJSON(`${base}/activate`, { world }));
      if (res) {
        toast(`"${world}" is now the active world — applies on next start.`);
        reload();
      }
    } else if (e.target.closest('[data-world-download]')) {
      toast('Preparing a consistent snapshot — the download starts when it is ready…', { kind: 'info', timeout: 8000 });
      location.href = `${base}/${encodeURIComponent(world)}/download`;
    } else if (e.target.closest('[data-world-duplicate]')) {
      const btn = e.target.closest('[data-world-duplicate]');
      const ok = await confirmDialog({
        title: `Duplicate "${world}"?`,
        message: 'Forks a full copy of this world (all dimension dirs) on this server.',
        detail: `Needs ~${fmtBytes(size)} of additional disk space.`,
        confirmLabel: 'Duplicate',
      });
      if (!ok) return;
      const res = await withBusy(btn, () => postJSON(`${base}/duplicate`, { world }));
      if (res) {
        toast(`Duplicated as "${res.name}" (${fmtBytes(res.sizeBytes)}).`);
        reload();
      }
    } else if (e.target.closest('[data-world-copy]')) {
      copyToModal(world);
    } else if (e.target.closest('[data-world-rename]')) {
      renameModal(world);
    } else if (e.target.closest('[data-world-reset]')) {
      resetModal(world, size);
    } else if (e.target.closest('[data-world-delete]')) {
      const btn = e.target.closest('[data-world-delete]');
      const ok = await confirmDialog({
        title: `Delete world "${world}"?`,
        message: 'Removes this world and its dimension dirs from the server. This is not the active world.',
        detail: `${fmtBytes(size)} will be freed. No automatic backup is taken for non-active worlds.`,
        confirmLabel: 'Delete world',
        danger: true,
        requireText: world,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`${base}/${encodeURIComponent(world)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) {
          toast(`World "${world}" deleted (${fmtBytes(data.freedBytes)} freed).`);
          reload();
        } else {
          toast(data.error || 'Delete failed', { kind: 'error' });
        }
      } finally {
        restore();
      }
    }
  });

  // ---- Copy to another instance ----
  function copyToModal(world) {
    const targets = serverOptions().filter((s) => s.id !== serverId);
    if (!targets.length) return toast('No other servers to copy to.', { kind: 'info' });

    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Target server</label>
      <select class="input" data-c-target data-label="Copy world to server">
        ${targets.map((s) => `<option value="${s.id}" data-desc="${escapeHtml(s.flavor)} · ${escapeHtml(s.status)}">${escapeHtml(s.name)}</option>`).join('')}
      </select>
      <label class="label mt-3">Install mode on the target</label>
      <select class="input" data-c-mode data-label="Install mode">
        <option value="replace" data-desc="Target must be stopped — its current world is auto-backed-up first">Replace target's world</option>
        <option value="alongside" data-desc="Adds it next to the target's worlds — activate it later">Install alongside</option>
      </select>
      <div class="mt-3 hidden" data-c-namewrap>
        <label class="label">World folder name on the target</label>
        <input class="input" data-c-name value="${escapeHtml(world)}" autocomplete="off">
      </div>
      <p class="help">Works while this server is running — the panel snapshots with the save-off/save-all dance, then installs via the library.</p>
      <div class="mt-3 hidden" data-c-progress><div class="meter"><div class="bg-grass-500 animate-pulse" style="width:100%"></div></div></div>`;

    const mode = content.querySelector('[data-c-mode]');
    mode.addEventListener('change', () => {
      content.querySelector('[data-c-namewrap]').classList.toggle('hidden', mode.value !== 'alongside');
    });

    openModal({
      title: `Copy "${world}" to another server`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Copy world',
          kind: 'primary',
          busyLabel: 'Copying…',
          onClick: async () => {
            const body = {
              targetServerId: content.querySelector('[data-c-target]').value,
              mode: mode.value,
            };
            if (mode.value === 'alongside') {
              body.newName = content.querySelector('[data-c-name]').value.trim();
              if (!body.newName) {
                toast('Give the copied world a folder name.', { kind: 'error' });
                return false;
              }
            }
            content.querySelector('[data-c-progress]').classList.remove('hidden');
            const done = await installWithConfirm(`${base}/copy-to`, body);
            if (!done) {
              content.querySelector('[data-c-progress]').classList.add('hidden');
              return false;
            }
            toast(`World copied — installed as "${done.installedAs}" (${fmtBytes(done.sizeBytes)}).`);
            reload();
          },
        },
      ],
    });
  }

  // ---- Rename ----
  function renameModal(world) {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">New name for "${escapeHtml(world)}"</label>
      <input class="input" data-r-name value="${escapeHtml(world)}" autocomplete="off">
      <p class="help">The server must be stopped. Dimension dirs are renamed too; if this is the active world, level-name is updated.</p>`;
    const modal = openModal({
      title: 'Rename world',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Rename',
          kind: 'primary',
          onClick: async () => {
            const newName = content.querySelector('[data-r-name]').value.trim();
            if (!newName || newName === world) return false;
            const res = await postJSON(`${base}/rename`, { world, newName });
            if (!res) return false;
            toast(`World renamed to "${res.name}".`);
            reload();
          },
        },
      ],
    });
    modal.body.querySelector('[data-r-name]').focus();
  }

  // ---- Reset (active world) ----
  function resetModal(world, size) {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <p>Deletes the world "${escapeHtml(world)}" and all its dimension dirs so the server generates a fresh one on next start. A safety backup is taken automatically first.</p>
      <div class="rounded-md border border-line bg-raised p-2.5 text-xs text-ink-soft">${fmtBytes(size)} will be cleared. The server must be stopped.</div>
      <label class="msm-toggle flex items-center gap-2">
        <input type="checkbox" data-keep-seed checked>
        <span></span>
        <span class="text-sm">Keep the current seed (read from server.properties or level.dat)</span>
      </label>`;
    openModal({
      title: `Reset world "${world}"?`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Reset world',
          kind: 'danger',
          busyLabel: 'Resetting…',
          onClick: async () => {
            const keepSeed = content.querySelector('[data-keep-seed]').checked;
            const res = await postJSON(`${base}/reset`, { keepSeed });
            if (!res) return false;
            toast(
              res.keptSeed
                ? `World reset — seed ${res.keptSeed} kept (${fmtBytes(res.freedBytes)} cleared).`
                : `World reset with a new random seed (${fmtBytes(res.freedBytes)} cleared).`
            );
            reload();
          },
        },
      ],
    });
  }
}
