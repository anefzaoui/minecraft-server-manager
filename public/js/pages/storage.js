// Storage page: background re-scan + previewed one-click cleanups.
// Cleanup flow: dry-run POST (nothing deleted) → confirm with the REAL
// numbers → real POST → reload.

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { fmtBytes } from '../lib/format.js';
import { t } from '../lib/i18n.js';

document.getElementById('storage-rescan')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const restore = setBusy(btn, t('storage_page.scanning_btn'));
  toast(t('storage_page.rescan_toast'), { kind: 'info' });
  try {
    const res = await fetch('/api/storage/scan', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false)
      throw new Error(data.error || friendlyError(res, { action: t('storage_page.action_scan') }));
    toast(
      data.skipped
        ? t('storage_page.scan_already_running')
        : t('storage_page.scan_complete', { size: fmtBytes(data.totalBytes), dirs: data.dirs, ms: data.ms })
    );
    if (!data.skipped) setTimeout(() => location.reload(), 800);
  } catch (err) {
    toast(err.message, { kind: 'error', timeout: 8000 });
  } finally {
    restore();
  }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-cleanup-action]');
  if (!btn) return;
  const action = btn.dataset.cleanupAction;
  const label = btn.dataset.cleanupLabel || action;
  const days = btn.dataset.cleanupDays ? Number(btn.dataset.cleanupDays) : undefined;

  let preview;
  try {
    preview = await withBusy(btn, t('common.checking'), () =>
      postJSON('/api/storage/cleanup', { action, olderThanDays: days, dryRun: true })
    );
  } catch (err) {
    return toast(err.message, { kind: 'error', timeout: 8000 });
  }

  if (!preview.removed) {
    return toast(t('storage_page.nothing_to_clean'), { kind: 'info' });
  }
  const ok = await confirmDialog({
    title: label,
    message: t('storage_page.confirm_message', { count: preview.removed, size: fmtBytes(preview.freedBytes) }),
    detail: days
      ? t('storage_page.confirm_detail_days', { days })
      : action === 'tmp'
        ? t('storage_page.confirm_detail_tmp')
        : '',
    confirmLabel: t('storage_page.free_btn', { size: fmtBytes(preview.freedBytes) }),
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await withBusy(btn, t('storage_page.cleaning_btn'), () =>
      postJSON('/api/storage/cleanup', { action, olderThanDays: days })
    );
    toast(t('storage_page.cleanup_done', { count: result.removed, size: fmtBytes(result.freedBytes) }));
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    toast(err.message, { kind: 'error', timeout: 9000 });
  }
});

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false)
    throw new Error(data.error || friendlyError(res, { action: t('storage_page.action_cleanup') }));
  return data;
}
