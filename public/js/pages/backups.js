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
import { t } from '../lib/i18n.js';

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
              const res = await talk(`/api/backups/${encodeURIComponent(backupId)}`, 'PATCH', { filename: name });
              row.dataset.file = res.backup.filename;
              const text = row.querySelector('.truncate.font-mono');
              if (text) {
                text.textContent = res.backup.filename;
                text.title = res.backup.filename;
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
    return;
  }

  if (action === 'restore') {
    const ok = await confirmDialog({
      title: t('backups_page.restore_confirm_title'),
      message: t('backups_page.restore_confirm_msg', { server: serverName || 'The server' }),
      detail: `${file}\n${fmtBytes(size)} · ${reason || 'manual'}`,
      confirmLabel: t('backups_page.restore_confirm_btn'),
      danger: true,
    });
    if (!ok) return;
    try {
      await runTask({
        title: t('backups_page.restoring_title', { file }),
        start: async () => {
          const res = await postJSON(`/api/servers/${serverId}/backups/${backupId}/restore`, {});
          return res.taskId;
        },
      });
      toast(t('backups_page.restored_ready_toast'));
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      if (err.dismissed) return; // progress hidden - the task tray takes over
      toast(err.message || t('backups_page.restore_failed_toast'), { kind: 'error', timeout: 9000 });
    }
    return;
  }

  if (action === 'delete') {
    const ok = await confirmDialog({
      title: t('backups_page.delete_confirm_title'),
      message: t('backups_page.delete_confirm_msg'),
      detail: t('backups_page.delete_confirm_detail', { file, size: fmtBytes(size) }),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!ok) return;
    const restore = setBusy(btn);
    try {
      const res = await fetch(`/api/backups/${backupId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false)
        throw new Error(data.error || friendlyError(res, { action: t('backups_page.action_delete') }));
      toast(t('backups_page.deleted_toast', { size: fmtBytes(data.freedBytes) }));
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
      title: t('backups_page.backing_up_title', { name: serverName }),
      start: async () => {
        const res = await postJSON(`/api/servers/${serverId}/backups`, {});
        return res.taskId;
      },
    });
    toast(
      t('backups_page.created_toast', {
        file: result && result.filename ? result.filename : 'done',
        size: result && result.size ? fmtBytes(result.size) : '',
      })
    );
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || t('backups_page.create_failed_toast'), { kind: 'error', timeout: 9000 });
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
  totalEl.textContent = t('backups_page.total_summary', { size: fmtBytes(bytes), count: rows.length });
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
    throw new Error(data.error || friendlyError(res, { action: t('backups_page.action_task') }));
  return data;
}
