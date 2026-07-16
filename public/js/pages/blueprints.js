// Blueprints page: create-server-from-blueprint, upload/preview/import flow,
// download and delete.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';

const grid = document.querySelector('[data-blueprints-page]');
if (grid) init();

function init() {
  grid.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-bp-card]');
    if (!card) return;
    const id = card.dataset.bpId;
    const name = card.dataset.bpName;

    const delBtn = e.target.closest('[data-bp-delete]');
    if (e.target.closest('[data-bp-create]')) {
      createFrom({ blueprintId: id }, name);
    } else if (delBtn) {
      const ok = await confirmDialog({
        title: `Delete blueprint "${name}"?`,
        message: 'Removes the .mcserver.zip from the library. Servers already created from it are not affected.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      await withBusy(delBtn, async () => {
        const res = await fetch(`/api/blueprints/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          toast(`Blueprint "${name}" deleted.`);
          card.remove();
        } else {
          toast(data.error || 'Delete failed', { kind: 'error' });
        }
      });
    }
  });

  // ---- Upload → preview → import ----
  const fileInput = document.getElementById('bp-import-file');
  document.getElementById('bp-import-btn')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const progress = openProgress('Uploading and validating blueprint…');
    let data;
    try {
      const res = await fetch('/api/blueprints/import-preview', { method: 'POST', body: form });
      data = await res.json();
    } catch (err) {
      progress.close();
      return toast(`Upload failed: ${err.message}`, { kind: 'error' });
    }
    progress.close();
    if (!data.ok) return toast(data.error || 'Not a valid blueprint', { kind: 'error', timeout: 9000 });
    showPreview(data.preview, { uploadToken: data.uploadToken });
  });
}

function showPreview(preview, importBody) {
  const m = preview.manifest;
  const content = document.createElement('div');
  content.className = 'space-y-3 text-sm';

  const overlayRows = m.overlay
    .map(
      (o) => `
    <li class="flex items-baseline justify-between gap-3">
      <span class="min-w-0 truncate">${esc(o.name)}${o.version ? ` <span class="text-ink-faint">${esc(o.version)}</span>` : ''}</span>
      <span class="shrink-0 font-mono text-[11px] text-ink-faint">${esc(sourceLabel(o))}</span>
    </li>`
    )
    .join('');

  content.innerHTML = `
    <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
      <div><dt class="text-ink-faint">Server type</dt><dd class="mt-0.5 font-medium">${esc(m.config.type)} · MC ${esc(m.config.mcVersion)}</dd></div>
      <div><dt class="text-ink-faint">Modpack</dt><dd class="mt-0.5 font-medium">${m.pack ? esc(`${m.pack.projectName || m.pack.projectRef} @ ${m.pack.versionName || m.pack.versionId}`) : 'None'}</dd></div>
      <div><dt class="text-ink-faint">Resources</dt><dd class="mt-0.5 font-medium">${m.resources.heapMb} MB heap · ${m.resources.containerMemoryMb} MB limit · ${m.resources.cpus || 'unlimited'} CPU · ${m.resources.diskQuotaGb} GB quota</dd></div>
      <div><dt class="text-ink-faint">Includes</dt><dd class="mt-0.5 font-medium">${m.configFiles.length} config file${m.configFiles.length === 1 ? '' : 's'} · ${m.world ? 'world included' : 'no world'} · ${m.embedFiles ? 'files embedded' : 'manifest-only'}</dd></div>
    </dl>
    ${
      m.overlay.length
        ? `
      <div>
        <div class="mb-1 text-xs font-medium text-ink-faint">Custom overlay (${m.overlay.length})</div>
        <ul class="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line bg-raised p-2.5 text-xs">${overlayRows}</ul>
      </div>`
        : ''
    }
    ${
      preview.warnings.length
        ? `
      <div class="rounded-md border border-gold-400/40 bg-gold-400/10 p-2.5 text-xs">
        <div class="mb-1 font-medium text-warn">Warnings</div>
        <ul class="list-inside list-disc space-y-0.5 text-ink-soft">${preview.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </div>`
        : ''
    }
    <p class="text-xs text-ink-faint">A new server will be created with fresh ports and a fresh RCON password. Nothing existing is touched.</p>`;

  openModal({
    title: `Import "${m.name}"`,
    content,
    size: 'lg',
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Create server',
        kind: 'primary',
        onClick: () => {
          // Kick off after this modal closes so the progress modal is on top.
          setTimeout(() => createFrom(importBody, m.name), 0);
        },
      },
    ],
  });
}

async function createFrom(body, name) {
  const progress = openProgress(
    `Creating server from "${name}" — pulling the image, installing the pack and mods. This can take a few minutes…`
  );
  let data;
  try {
    const res = await fetch('/api/blueprints/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch (err) {
    progress.close();
    return toast(`Import failed: ${err.message}`, { kind: 'error' });
  }
  progress.close();
  if (!data.ok) return toast(data.error || 'Import failed', { kind: 'error', timeout: 9000 });
  if (!data.report || !data.report.length) {
    toast(`Server "${data.server.name}" created.`);
    setTimeout(() => {
      location.href = `/servers/${data.server.id}`;
    }, 600);
    return;
  }
  showReport(data.server, data.report);
}

function showReport(server, report) {
  const BADGE = {
    ok: '<span class="badge badge-ok">ok</span>',
    'hash-mismatch': '<span class="badge badge-warn">hash mismatch</span>',
    failed: '<span class="badge badge-danger">failed</span>',
  };
  const content = document.createElement('div');
  content.className = 'space-y-3 text-sm';
  content.innerHTML = `
    <p>Server <b>${esc(server.name)}</b> was created on port ${server.portGame}. Install report:</p>
    <ul class="max-h-64 space-y-1.5 overflow-y-auto rounded-md border border-line bg-raised p-2.5 text-xs">
      ${report
        .map(
          (r) => `
        <li class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate font-medium">${esc(r.name)}</div>
            ${r.error ? `<div class="mt-0.5 text-[11px] text-ink-faint">${esc(r.error)}</div>` : ''}
          </div>
          <span class="shrink-0">${BADGE[r.status] || BADGE.failed}</span>
        </li>`
        )
        .join('')}
    </ul>
    ${report.some((r) => r.status !== 'ok') ? '<p class="text-xs text-ink-faint">Failed items can be added later from the server’s Mods tab.</p>' : ''}`;
  openModal({
    title: 'Blueprint import finished',
    content,
    actions: [
      { label: 'Stay here', kind: 'ghost' },
      {
        label: 'Open server',
        kind: 'primary',
        onClick: () => {
          location.href = `/servers/${server.id}`;
        },
      },
    ],
  });
}

function openProgress(text) {
  const content = document.createElement('div');
  content.className = 'space-y-3 text-sm';
  content.innerHTML = `
    <p></p>
    <div class="meter"><div class="bg-grass-500 animate-pulse" style="width:100%"></div></div>`;
  content.querySelector('p').textContent = text;
  return openModal({ title: 'Working…', content, actions: [] });
}

function sourceLabel(entry) {
  if (entry.platform && entry.platform !== 'url') return entry.platform;
  if (entry.sourceUrl) {
    try {
      return new URL(entry.sourceUrl).host;
    } catch {
      return 'url';
    }
  }
  return entry.filename ? 'embedded' : 'no source';
}

function esc(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
