// Server Backups tab: create (with real task progress), restore, download
// (plain link in the partial), delete.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { confirmDialog } from '../lib/confirm.js';
import { openModal } from '../lib/modal.js';
import { runTask } from '../lib/progress.js';
import { setBusy } from '../lib/loading.js';
import { fmtBytes } from '../lib/format.js';

const root = document.querySelector('[data-backups-server]');
if (root) init(root.dataset.backupsServer);

function init(serverId) {
  const reload = () => setTimeout(() => location.reload(), 700);

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false)
      throw new Error(data.error || friendlyError(res, { action: 'run that backup action' }));
    return data;
  }

  // ---- Back up now ----
  document.getElementById('bk-now')?.addEventListener('click', async () => {
    const shrink = document.getElementById('bk-shrink')?.checked || false;
    try {
      await runTask({
        title: shrink ? 'Backing up, then shrinking the world…' : 'Creating backup…',
        start: () => postJson(`/api/servers/${serverId}/backups`, shrink ? { shrink: true } : undefined),
      });
      toast(shrink ? 'Backup created. World shrink ran if the server was stopped.' : 'Backup created.');
      reload();
    } catch (err) {
      if (err.dismissed) return; // progress hidden - the task tray takes over
      toast(err.message || 'That backup could not be created. Please try again.', { kind: 'error', timeout: 9000 });
    }
  });

  // ---- Row actions ----
  document.getElementById('bk-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-backup-row]');
    if (!row) return;
    const backupId = row.dataset.backupId;
    const file = row.dataset.file;
    const size = Number(row.dataset.size) || 0;

    if (e.target.closest('[data-backup-restore]')) {
      const ok = await confirmDialog({
        title: `Restore ${file}?`,
        message: 'The server is stopped, its current data replaced with this archive, then started again.',
        detail: 'A running server goes offline during the restore. This cannot be undone unless you back up first.',
        confirmLabel: 'Restore',
        danger: true,
      });
      if (!ok) return;
      try {
        await runTask({
          title: `Restoring ${file}…`,
          start: () => postJson(`/api/servers/${serverId}/backups/${encodeURIComponent(backupId)}/restore`),
        });
        toast('Backup restored.');
        reload();
      } catch (err) {
        if (err.dismissed) return; // progress hidden - the task tray takes over
        toast(err.message || 'That backup could not be restored. Please try again.', {
          kind: 'error',
          timeout: 9000,
        });
      }
    } else if (e.target.closest('[data-backup-rename]')) {
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
                const res = await fetch(`/api/backups/${encodeURIComponent(backupId)}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename: name }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || data.ok === false)
                  throw new Error(data.error || friendlyError(res, { action: 'rename that backup' }));
                row.dataset.file = data.backup.filename;
                const text = row.querySelector('.truncate.font-mono');
                if (text) {
                  text.textContent = data.backup.filename;
                  text.title = data.backup.filename;
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
    } else if (e.target.closest('[data-backup-delete]')) {
      const btn = e.target.closest('[data-backup-delete]');
      const ok = await confirmDialog({
        title: `Delete ${file}?`,
        message: 'Removes the backup archive permanently.',
        detail: `${fmtBytes(size)} will be freed.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`/api/backups/${encodeURIComponent(backupId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false)
          throw new Error(data.error || friendlyError(res, { action: 'delete that backup' }));
        toast(`${file} deleted (${fmtBytes(size)} freed).`);
        const tbody = row.closest('tbody');
        row.remove();
        // Last one gone → re-render for the proper empty state instead of a
        // header-only table.
        if (tbody && !tbody.querySelector('[data-backup-row]')) reload();
      } catch (err) {
        toast(err.message || 'That backup could not be deleted. Please try again.', { kind: 'error' });
      } finally {
        restore();
      }
    }
  });
}
