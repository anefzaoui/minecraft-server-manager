// Storage page: background re-scan + previewed one-click cleanups.
// Cleanup flow: dry-run POST (nothing deleted) → confirm with the REAL
// numbers → real POST → reload.

import { toast } from '../lib/toast.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { fmtBytes } from '../lib/format.js';

document.getElementById('storage-rescan')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const restore = setBusy(btn, 'Scanning…');
  toast('Re-scanning ./data…', { kind: 'info' });
  try {
    const res = await fetch('/api/storage/scan', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || `Scan failed (${res.status})`);
    toast(
      data.skipped
        ? 'A scan is already running.'
        : `Scan complete: ${fmtBytes(data.totalBytes)} across ${data.dirs} folders (${data.ms} ms).`
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
    preview = await withBusy(btn, 'Checking…', () =>
      postJSON('/api/storage/cleanup', { action, olderThanDays: days, dryRun: true })
    );
  } catch (err) {
    return toast(err.message, { kind: 'error', timeout: 8000 });
  }

  if (!preview.removed) {
    return toast('Nothing to clean up for this action right now.', { kind: 'info' });
  }
  const ok = await confirmDialog({
    title: label,
    message: `This permanently removes ${preview.removed} item${preview.removed === 1 ? '' : 's'} and frees ${fmtBytes(preview.freedBytes)}.`,
    detail: days
      ? `Only items older than ${days} days are touched.`
      : action === 'tmp'
        ? 'Only tmp entries older than 1 hour are touched — in-flight transfers are safe.'
        : '',
    confirmLabel: `Free ${fmtBytes(preview.freedBytes)}`,
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await withBusy(btn, 'Cleaning…', () =>
      postJSON('/api/storage/cleanup', { action, olderThanDays: days })
    );
    toast(
      `Cleanup done: ${result.removed} item${result.removed === 1 ? '' : 's'} removed, ${fmtBytes(result.freedBytes)} freed.`
    );
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
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
