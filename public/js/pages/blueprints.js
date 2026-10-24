// Blueprints page: create-server-from-blueprint, upload/preview/import flow,
// download and delete.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';
import { escapeHtml, escapeHtml as esc } from '../lib/format.js';
import { t } from '../lib/i18n.js';

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
        title: t('blueprints_modal.delete_title', { name }),
        message: t('blueprints_modal.delete_msg'),
        confirmLabel: t('blueprints_modal.delete_btn'),
        danger: true,
      });
      if (!ok) return;
      await withBusy(delBtn, async () => {
        const res = await fetch(`/api/blueprints/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          toast(t('blueprints_modal.deleted_toast', { name }));
          card.remove();
        } else {
          toast(data.error || 'That blueprint could not be deleted. Please try again.', { kind: 'error' });
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
    const progress = openProgress(t('blueprints_modal.uploading_validating'));
    let data;
    try {
      const res = await fetch('/api/blueprints/import-preview', { method: 'POST', body: form });
      data = await res.json();
    } catch {
      progress.close();
      return toast('The blueprint could not be uploaded. Check your connection and try again.', { kind: 'error' });
    }
    progress.close();
    if (!data.ok) return toast(data.error || "That file isn't a valid blueprint.", { kind: 'error', timeout: 9000 });
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
      <div><dt class="text-ink-faint">${escapeHtml(t('blueprints_modal.server_type'))}</dt><dd class="mt-0.5 font-medium">${esc(m.config.type)} · MC ${esc(m.config.mcVersion)}</dd></div>
      <div><dt class="text-ink-faint">${escapeHtml(t('blueprints_modal.modpack'))}</dt><dd class="mt-0.5 font-medium">${m.pack ? esc(`${m.pack.projectName || m.pack.projectRef} @ ${m.pack.versionName || m.pack.versionId}`) : 'None'}</dd></div>
      <div><dt class="text-ink-faint">${escapeHtml(t('blueprints_modal.resources'))}</dt><dd class="mt-0.5 font-medium">${esc(m.resources.heapMb)} MB heap · ${esc(m.resources.containerMemoryMb)} MB limit · ${esc(m.resources.cpus || 'unlimited')} CPU · ${esc(m.resources.diskQuotaGb)} GB quota</dd></div>
      <div><dt class="text-ink-faint">${escapeHtml(t('blueprints_modal.includes'))}</dt><dd class="mt-0.5 font-medium">${m.configFiles.length} config file${m.configFiles.length === 1 ? '' : 's'} · ${m.world ? 'world included' : 'no world'} · ${m.embedFiles ? 'files embedded' : 'manifest-only'}</dd></div>
    </dl>
    ${
      m.overlay.length
        ? `
      <div>
        <div class="mb-1 text-xs font-medium text-ink-faint">${escapeHtml(t('blueprints_modal.custom_mods', { count: m.overlay.length }))}</div>
        <ul class="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line bg-raised p-2.5 text-xs">${overlayRows}</ul>
      </div>`
        : ''
    }
    ${
      preview.warnings.length
        ? `
      <div class="rounded-md border border-gold-400/40 bg-gold-400/10 p-2.5 text-xs">
        <div class="mb-1 font-medium text-warn">${escapeHtml(t('blueprints_modal.warnings'))}</div>
        <ul class="list-inside list-disc space-y-0.5 text-ink-soft">${preview.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
      </div>`
        : ''
    }
    <p class="text-xs text-ink-faint">${escapeHtml(t('blueprints_modal.import_note'))}</p>`;

  openModal({
    title: t('blueprints_modal.import_preview_title', { name: m.name }),
    content,
    size: 'lg',
    actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      {
        label: t('blueprints_modal.create_server_btn'),
        kind: 'primary',
        onClick: () => {
          // Kick off after this modal closes so the progress modal is on top.
          setTimeout(() => createFrom(importBody, m.name), 0);
        },
      },
    ],
  });
}

let importInFlight = false; // dismissing the progress modal must not allow a second, duplicate create

async function createFrom(body, name) {
  if (importInFlight) {
    toast(t('blueprints_modal.import_in_flight'), { kind: 'info' });
    return;
  }
  importInFlight = true;
  const progress = openProgress(t('blueprints_modal.creating_server_progress', { name }));
  let data;
  try {
    const res = await fetch('/api/blueprints/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    data = await res.json();
  } catch {
    progress.close();
    return toast('The import could not be completed. Check your connection and try again.', { kind: 'error' });
  } finally {
    importInFlight = false;
  }
  progress.close();
  if (!data.ok)
    return toast(data.error || 'The blueprint could not be imported. Please try again.', {
      kind: 'error',
      timeout: 9000,
    });
  if (!data.report || !data.report.length) {
    toast(t('blueprints_modal.server_created_toast', { name: data.server.name }));
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
    <p>${t('blueprints_modal.install_report_header', { name: esc(server.name), port: server.portGame })}</p>
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
    ${report.some((r) => r.status !== 'ok') ? `<p class="text-xs text-ink-faint">${escapeHtml(t('blueprints_modal.finished_note'))}</p>` : ''}`;
  openModal({
    title: t('blueprints_modal.finished_title'),
    content,
    actions: [
      { label: t('blueprints_modal.stay_here_btn'), kind: 'ghost' },
      {
        label: t('blueprints_modal.open_server_btn'),
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
    <div class="meter meter-indeterminate"><div class="bg-grass-500" style="width:25%"></div></div>
    <p class="text-xs text-ink-faint">${escapeHtml(t('blueprints_modal.progress_note'))}</p>`;
  content.querySelector('p').textContent = text;
  return openModal({ title: t('blueprints_modal.progress_title'), content, actions: [] });
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
