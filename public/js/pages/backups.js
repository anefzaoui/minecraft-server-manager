// Shared backups behavior - used by BOTH the global /backups page and the
// per-server Backups tab. Contract (document-level delegation):
//   rows:    [data-backup-row] with data-backup-id, data-server-id,
//            data-server-name, data-file, data-size, data-reason
//   actions: [data-backup-action="restore"|"download"|"delete"] inside a row
//   create:  [data-backup-create] with data-server-id (+ optional
//            data-server-name) anywhere on the page
// Create + restore are long operations: the API returns {taskId} and the
// progress modal (runTask) polls it.

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { confirmDialog } from '../lib/confirm.js';
import { openModal } from '../lib/modal.js';
import { fmtBytes } from '../lib/format.js';
import { runTask } from '../lib/progress.js';
import { setBusy } from '../lib/loading.js';

document.addEventListener('click', async (e) => {
  const createBtn = e.target.closest('[data-backup-create]');
  if (createBtn) {
    e.preventDefault();
    return createBackup(createBtn.dataset.serverId, createBtn.dataset.serverName || 'server');
  }

  const btn = e.target.closest('[data-backup-action]');
  if (!btn) return;
  const row = btn.closest('[data-backup-row]');
  if (!row) return;
  e.preventDefault();
  const { backupId, serverId, serverName, file, size, reason } = row.dataset;
  const action = btn.dataset.backupAction;

  if (action === 'download') {
    location.href = `/api/backups/${backupId}/download`;
    return;
  }

  if (action === 'rename') {
    const content = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'label';
    label.setAttribute('for', 'bk-rename-name');
    label.textContent = 'Archive name';
    const input = document.createElement('input');
    input.className = 'input font-mono';
    input.id = 'bk-rename-name';
    input.maxLength = 120;
    input.value = file;
    const help = document.createElement('p');
    help.className = 'help';
    help.textContent = 'Changes the displayed name and the file you download. Restore and retention are unaffected.';
    content.append(label, input, help);
    openModal({
      title: 'Rename Backup',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Rename',
          kind: 'primary',
          busyLabel: 'Renaming…',
          onClick: async () => {
            const name = input.value.trim();
            if (!name) {
              toast('Enter a name first.', { kind: 'error' });
              return false;
            }
            try {
              const res = await talk(`/api/backups/${encodeURIComponent(backupId)}`, 'PATCH', { filename: name });
              row.dataset.file = res.backup.filename;
              const text = row.querySelector('.truncate.font-mono');
              if (text) {
                text.textContent = res.backup.filename;
                text.title = res.backup.filename;
              }
              toast('Backup renamed.');
            } catch (err) {
              toast(err.message || 'That backup could not be renamed.', { kind: 'error', timeout: 8000 });
              return false;
            }
          },
        },
      ],
    });
    return;
  }

  if (action === 'restore') {
    const ok = await confirmDialog({
      title: `Restore this backup?`,
      message: `${serverName || 'The server'} is stopped first, a safety backup of the current state is taken, then the server's files are replaced with this archive.`,
      detail: `${file}\n${fmtBytes(size)} · ${reason || 'manual'}`,
      confirmLabel: 'Restore Backup',
      danger: true,
    });
    if (!ok) return;
    try {
      await runTask({
        title: `Restoring ${file}…`,
        start: async () => {
          const res = await postJSON(`/api/servers/${serverId}/backups/${backupId}/restore`, {});
          return res.taskId;
        },
      });
      toast('Backup restored. Start the server when you are ready.');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      if (err.dismissed) return; // progress hidden - the task tray takes over
      toast(err.message || 'That backup could not be restored. Please try again.', { kind: 'error', timeout: 9000 });
    }
    return;
  }

  if (action === 'delete') {
    const ok = await confirmDialog({
      title: 'Delete this backup?',
      message: 'The archive is removed permanently.',
      detail: `${file}\n${fmtBytes(size)} will be freed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const restore = setBusy(btn);
    try {
      const res = await fetch(`/api/backups/${backupId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false)
        throw new Error(data.error || friendlyError(res, { action: 'delete that backup' }));
      toast(`Backup deleted (${fmtBytes(data.freedBytes)} freed).`);
      row.remove();
      refreshTotal();
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 9000 });
    } finally {
      restore();
    }
  }
});

async function createBackup(serverId, serverName) {
  if (!serverId) return;
  try {
    const result = await runTask({
      title: `Backing up ${serverName}…`,
      start: async () => {
        const res = await postJSON(`/api/servers/${serverId}/backups`, {});
        return res.taskId;
      },
    });
    toast(
      `Backup created: ${result && result.filename ? result.filename : 'done'}${result && result.size ? ` (${fmtBytes(result.size)})` : ''}.`
    );
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'That backup could not be created. Please try again.', { kind: 'error', timeout: 9000 });
  }
}

// ---- Global page filters (no-ops on the server tab) ----
const serverFilter = document.getElementById('backups-filter-server');
const reasonFilter = document.getElementById('backups-filter-reason');
if (serverFilter || reasonFilter) {
  const apply = () => {
    const sid = serverFilter ? serverFilter.value : '';
    const reason = reasonFilter ? reasonFilter.value : '';
    let visible = 0;
    document.querySelectorAll('#backups-table [data-backup-row]').forEach((row) => {
      const match = (!sid || row.dataset.serverId === sid) && (!reason || row.dataset.reason === reason);
      row.classList.toggle('hidden', !match);
      if (match) visible += 1;
    });
    // Filters can hide every row - say so instead of showing a bare header.
    document.getElementById('backups-no-match')?.classList.toggle('hidden', visible > 0);
    refreshTotal();
  };
  serverFilter?.addEventListener('change', apply);
  reasonFilter?.addEventListener('change', apply);
}

/** Recompute the "Total: X in N archives" line from the visible rows. */
function refreshTotal() {
  const totalEl = document.getElementById('backups-total');
  if (!totalEl) return;
  const rows = [...document.querySelectorAll('#backups-table [data-backup-row]:not(.hidden)')];
  const bytes = rows.reduce((n, r) => n + (Number(r.dataset.size) || 0), 0);
  totalEl.textContent = `Total: ${fmtBytes(bytes)} in ${rows.length} archive${rows.length === 1 ? '' : 's'}`;
}

async function postJSON(url, body) {
  return talk(url, 'POST', body);
}

/** fetch helper: returns the parsed JSON or throws with the server's error. */
async function talk(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false)
    throw new Error(data.error || friendlyError(res, { action: 'start that backup task' }));
  return data;
}
