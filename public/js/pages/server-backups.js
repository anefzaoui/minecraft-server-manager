// Server Backups tab: create (with real task progress), restore, download
// (plain link in the partial), delete.
import { toast } from '../lib/toast.js';
import { confirmDialog } from '../lib/confirm.js';
import { runTask } from '../lib/progress.js';
import { setBusy } from '../lib/loading.js';

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
    if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // ---- Back up now ----
  document.getElementById('bk-now')?.addEventListener('click', async () => {
    try {
      await runTask({
        title: 'Creating backup…',
        start: () => postJson(`/api/servers/${serverId}/backups`),
      });
      toast('Backup created.');
      reload();
    } catch (err) {
      toast(err.message || 'Backup failed', { kind: 'error', timeout: 9000 });
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
        detail: 'A running server goes down during the restore. This cannot be undone unless you back up first.',
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
        toast(err.message || 'Restore failed', { kind: 'error', timeout: 9000 });
      }
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
        if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
        toast(`${file} deleted (${fmtBytes(size)} freed).`);
        row.remove();
      } catch (err) {
        toast(err.message || 'Delete failed', { kind: 'error' });
      } finally {
        restore();
      }
    }
  });
}

function fmtBytes(n) {
  n = Number(n) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
