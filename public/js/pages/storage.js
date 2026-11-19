// Storage page: background re-scan + previewed one-click cleanups.
// Cleanup flow: dry-run POST (nothing deleted) → confirm with the REAL
// numbers → real POST → reload.

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { fmtBytes, escapeHtml } from '../lib/format.js';

// Largest-files list loads after render (a bounded filesystem walk that used
// to block the whole /storage render). Populated via DOM nodes never
// innerHTML, so a path can't smuggle markup into the page.
const largestBody = document.getElementById('largest-files-body');
if (largestBody) {
  fetch('/api/storage/largest-files')
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false)
        throw new Error(data.error || friendlyError(res, { action: 'list the largest files' }));
      return data.files;
    })
    .then((files) => {
      if (!files.length) {
        largestBody.innerHTML =
          '<tr><td data-th="" class="p-6 text-center text-ink-faint">No files in the data folder yet.</td></tr>';
        return;
      }
      largestBody.textContent = '';
      for (const f of files) {
        const tr = document.createElement('tr');
        const cell = td(tr);
        const mono = document.createElement('span');
        mono.className = 'break-all font-mono text-xs';
        mono.textContent = f.path;
        cell.append(mono);
        td(tr, 'text-ink-faint sm:w-24 sm:text-right').textContent = fmtBytes(f.size);
        const linkCell = td(tr, 'sm:w-10 sm:text-right');
        const a = document.createElement('a');
        a.className = 'btn btn-ghost btn-sm';
        a.href = f.link;
        a.dataset.tip = f.path;
        a.textContent = 'folder';
        linkCell.append(a);
        largestBody.append(tr);
      }
    })
    .catch((err) => {
      largestBody.innerHTML = `<tr><td data-th="" class="p-6 text-center text-ink-faint">Could not load the largest files: ${escapeHtml(err.message)}</td></tr>`;
    });
}

function td(tr, cls = '') {
  const cell = document.createElement('td');
  cell.dataset.th = '';
  if (cls) cell.className = cls;
  tr.append(cell);
  return cell;
}

document.getElementById('storage-rescan')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const restore = setBusy(btn, 'Scanning…');
  toast('Re-scanning the data folder…', { kind: 'info' });
  try {
    const res = await fetch('/api/storage/scan', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || friendlyError(res, { action: 'start the scan' }));
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
        ? 'Only temporary files older than 1 hour are removed, so downloads in progress are safe.'
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
  if (!res.ok || data.ok === false) throw new Error(data.error || friendlyError(res, { action: 'run that cleanup' }));
  return data;
}
