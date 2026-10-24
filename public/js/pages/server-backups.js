// Server Backups tab: create (with real task progress), restore, download
// (plain link in the partial), delete.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { confirmDialog } from '../lib/confirm.js';
import { openModal } from '../lib/modal.js';
import { runTask } from '../lib/progress.js';
import { setBusy } from '../lib/loading.js';
import { fmtBytes } from '../lib/format.js';
import { t } from '../lib/i18n.js';

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
      throw new Error(data.error || friendlyError(res, { action: t('backups_page.action_run') }));
    return data;
  }

  // ---- Back up now ----
  document.getElementById('bk-now')?.addEventListener('click', async () => {
    const shrink = document.getElementById('bk-shrink')?.checked || false;
    try {
      await runTask({
        title: shrink ? t('backups_page.backing_up_shrink_title') : t('backups_page.backing_up_simple_title'),
        start: () => postJson(`/api/servers/${serverId}/backups`, shrink ? { shrink: true } : undefined),
      });
      toast(shrink ? t('backups_page.created_shrink_toast') : t('backups_page.created_simple_toast'));
      reload();
    } catch (err) {
      if (err.dismissed) return; // progress hidden - the task tray takes over
      toast(err.message || t('backups_page.create_failed_toast'), { kind: 'error', timeout: 9000 });
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
        title: t('backups_page.restore_server_title', { file }),
        message: t('backups_page.restore_server_msg'),
        detail: t('backups_page.restore_server_detail'),
        confirmLabel: t('backups_page.restore'),
        danger: true,
      });
      if (!ok) return;
      try {
        await runTask({
          title: t('backups_page.restoring_title', { file }),
          start: () => postJson(`/api/servers/${serverId}/backups/${encodeURIComponent(backupId)}/restore`),
        });
        toast(t('backups_page.restored_toast'));
        reload();
      } catch (err) {
        if (err.dismissed) return; // progress hidden - the task tray takes over
        toast(err.message || t('backups_page.restore_failed_toast'), {
          kind: 'error',
          timeout: 9000,
        });
      }
    } else if (e.target.closest('[data-backup-rename]')) {
      const content = document.createElement('div');
      const label = document.createElement('label');
      label.className = 'label';
      label.setAttribute('for', 'bk-rename-name');
      label.textContent = t('backups_page.archive_name');
      const input = document.createElement('input');
      input.className = 'input font-mono';
      input.id = 'bk-rename-name';
      input.maxLength = 120;
      input.value = file;
      const help = document.createElement('p');
      help.className = 'help';
      help.textContent = t('backups_page.rename_help');
      content.append(label, input, help);
      openModal({
        title: t('backups_page.rename_title'),
        content,
        actions: [
          { label: t('common.cancel'), kind: 'ghost' },
          {
            label: t('backups_page.rename_btn'),
            kind: 'primary',
            busyLabel: t('backups_page.renaming_btn'),
            onClick: async () => {
              const name = input.value.trim();
              if (!name) {
                toast(t('backups_page.enter_name_toast'), { kind: 'error' });
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
                  throw new Error(data.error || friendlyError(res, { action: t('backups_page.rename_archive') }));
                row.dataset.file = data.backup.filename;
                const text = row.querySelector('.truncate.font-mono');
                if (text) {
                  text.textContent = data.backup.filename;
                  text.title = data.backup.filename;
                }
                toast(t('backups_page.renamed_toast'));
              } catch (err) {
                toast(err.message || t('backups_page.rename_fail_toast'), { kind: 'error', timeout: 8000 });
                return false;
              }
            },
          },
        ],
      });
    } else if (e.target.closest('[data-backup-delete]')) {
      const btn = e.target.closest('[data-backup-delete]');
      const ok = await confirmDialog({
        title: t('backups_page.delete_server_title', { file }),
        message: t('backups_page.delete_confirm_msg'),
        detail: t('backups_page.delete_server_detail', { size: fmtBytes(size) }),
        confirmLabel: t('common.delete'),
        danger: true,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`/api/backups/${encodeURIComponent(backupId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false)
          throw new Error(data.error || friendlyError(res, { action: t('backups_page.action_delete') }));
        toast(t('backups_page.deleted_file_freed_toast', { file, size: fmtBytes(size) }));
        const tbody = row.closest('tbody');
        row.remove();
        // Last one gone → re-render for the proper empty state instead of a
        // header-only table.
        if (tbody && !tbody.querySelector('[data-backup-row]')) reload();
      } catch (err) {
        toast(err.message || t('backups_page.delete_fail_toast'), { kind: 'error' });
      } finally {
        restore();
      }
    }
  });
}
