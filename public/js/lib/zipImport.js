// Shared UI for the mod-zip importer: the post-import report modal, with
// Open-CF-page + Upload-jar rows for mods whose authors disallow automated
// downloads. Used by the Mods tab and the wizard's create-from-zip flow.

import { toast } from './toast.js';
import { openModal } from './modal.js';
import { setBusy } from './loading.js';

/**
 * Show the outcome of a zip import. `onDone` runs when the user is finished
 * (immediately on a clean import, on Done otherwise).
 */
export function showZipImportReport({ serverId, report, blockedFallback = [], onDone = () => {} }) {
  const blocked = (report && report.blocked && report.blocked.length ? report.blocked : blockedFallback) || [];
  const failed = (report && report.failed) || [];
  const installedCount = (report && report.installed && report.installed.length) || 0;
  const parts = [`${installedCount} installed`];
  if (failed.length) parts.push(`${failed.length} failed`);
  if (blocked.length) parts.push(`${blocked.length} need manual download`);
  if (report && report.overrides && report.overrides.applied)
    parts.push(`${report.overrides.applied} override files applied`);

  if (!blocked.length && !failed.length) {
    toast(`Zip import done: ${parts.join(', ')}.`, { kind: 'success' });
    onDone();
    return;
  }

  const content = document.createElement('div');
  const summary = document.createElement('p');
  summary.className = 'mb-3 text-sm text-ink-soft';
  summary.textContent = `Import finished: ${parts.join(', ')}.`;
  content.appendChild(summary);

  if (failed.length) {
    const box = document.createElement('div');
    box.className = 'mb-3 space-y-1';
    for (const f of failed) {
      const p = document.createElement('p');
      p.className = 'text-xs text-danger';
      p.textContent = `${f.name}: ${f.reason}`;
      box.appendChild(p);
    }
    content.appendChild(box);
  }

  if (blocked.length) {
    const intro = document.createElement('p');
    intro.className = 'mb-2 text-xs text-ink-soft';
    intro.textContent =
      'These mods disallow automated downloads. Open each CurseForge page, download the exact file in your browser, then upload it here.';
    content.appendChild(intro);
    const box = document.createElement('div');
    box.className = 'space-y-2';
    for (const b of blocked) {
      const row = document.createElement('div');
      row.className = 'flex flex-wrap items-center gap-2 rounded-md border border-line bg-raised p-2 text-sm';
      row.innerHTML = `
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium" data-role="name"></span>
          <span class="block truncate font-mono text-xs text-ink-faint" data-role="file"></span>
        </span>
        <a class="btn btn-sm" target="_blank" rel="noopener" data-role="open">Open CF page</a>
        <button class="btn btn-sm" data-role="upload">Upload jar</button>
        <input type="file" accept=".jar,.zip" class="hidden" data-role="filepick">`;
      row.querySelector('[data-role="name"]').textContent = b.name;
      row.querySelector('[data-role="file"]').textContent = b.fileName || '';
      const link = row.querySelector('[data-role="open"]');
      // Pack-manifest / registry URL is third-party data — allow only http(s).
      if (/^https?:\/\//i.test(b.url || '')) link.href = b.url;
      else link.remove();
      const pick = row.querySelector('[data-role="filepick"]');
      row.querySelector('[data-role="upload"]').addEventListener('click', () => pick.click());
      pick.addEventListener('change', async () => {
        if (!pick.files.length) return;
        const fd = new FormData();
        fd.append('file', pick.files[0]);
        const restore = setBusy(row.querySelector('[data-role="upload"]'));
        try {
          const res = await fetch(`/api/servers/${serverId}/mods/upload`, { method: 'POST', body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');
          toast(`Uploaded ${pick.files[0].name}.`);
          row.remove();
        } catch (err) {
          toast(err.message, { kind: 'error' });
        } finally {
          restore();
        }
      });
      box.appendChild(row);
    }
    content.appendChild(box);
  }

  openModal({
    title: 'Zip import report',
    content,
    size: 'lg',
    actions: [{ label: 'Done', kind: 'primary', onClick: () => onDone() }],
  });
}
