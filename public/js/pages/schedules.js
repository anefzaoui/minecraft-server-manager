// Schedules page: New-task modal (cron builder with live next-run preview),
// enable/disable toggle, delete, and edit (= delete + recreate, labeled).

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { enhanceAll } from '../lib/select.js';
import { withBusy } from '../lib/loading.js';
import { formatDateTime } from '../lib/datetime.js';
import { escapeHtml } from '../lib/format.js';
import { t } from '../lib/i18n.js';

const table = document.getElementById('schedules-table'); // absent when the list is empty
const dataEl = document.getElementById('msm-schedule-data');
if (dataEl) init();

function readJson(attr) {
  try {
    return JSON.parse(dataEl.dataset[attr] || '[]');
  } catch {
    return [];
  }
}

function init() {
  const servers = readJson('servers');
  const taskTypes = readJson('taskTypes');

  document.getElementById('schedule-new')?.addEventListener('click', () => scheduleModal({ servers, taskTypes }));

  table?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-schedule-row]');
    if (!row) return;

    const delBtn = e.target.closest('[data-schedule-delete]');
    if (delBtn) {
      const ok = await confirmDialog({
        title: t('schedules_page.delete_confirm_title'),
        message: t('schedules_page.delete_confirm_msg', { task: row.dataset.task, cron: row.dataset.cron }),
        confirmLabel: t('common.delete'),
        danger: true,
      });
      if (!ok) return;
      await withBusy(delBtn, async () => {
        const res = await fetch(`/api/schedules/${row.dataset.scheduleId}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) {
          toast(t('schedules_page.deleted_toast'));
          const tbody = row.closest('tbody');
          row.remove();
          if (tbody && !tbody.querySelector('[data-schedule-row]')) setTimeout(() => location.reload(), 600);
        } else {
          toast(data.error || friendlyError(res, { action: t('schedules_page.action_delete') }), { kind: 'error' });
        }
      });
    } else if (e.target.closest('[data-schedule-edit]')) {
      let payload = {};
      try {
        payload = JSON.parse(row.dataset.payload || '{}');
      } catch {}
      scheduleModal({
        servers,
        taskTypes,
        edit: {
          id: row.dataset.scheduleId,
          serverId: row.dataset.serverId || '',
          taskType: row.dataset.taskType,
          cron: row.dataset.cron,
          payload,
        },
      });
    }
  });

  // Toggle: the checkbox is the source of truth; revert it if the API fails.
  table?.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-schedule-toggle]');
    if (!input) return;
    const row = input.closest('[data-schedule-row]');
    const enabled = input.checked;
    input.disabled = true; // lock the toggle in flight - keeps the switch visual
    try {
      const res = await fetch(`/api/schedules/${row.dataset.scheduleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false)
        throw new Error(data.error || friendlyError(res, { action: t('schedules_page.action_update') }));
      toast(
        t('schedules_page.toggle_toast', {
          state: enabled ? t('common.enabled').toLowerCase() : t('common.disabled').toLowerCase(),
        })
      );
    } catch (err) {
      input.checked = !enabled;
      toast(err.message, { kind: 'error', timeout: 8000 });
    } finally {
      input.disabled = false;
    }
  });
}

function scheduleModal({ servers, taskTypes, edit = null }) {
  const content = document.createElement('div');
  content.innerHTML = `
    <label class="label">${t('schedules_page.runs_on')}</label>
    <select class="input" data-sc-server data-label="${t('schedules_page.runs_on')}">
      <option value="">${t('schedules_page.global_panel')}</option>
      ${servers.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
    </select>
    <label class="label mt-3">${t('schedules_page.task_label')}</label>
    <select class="input" data-sc-type data-label="${t('schedules_page.task_type_label')}">
      ${taskTypes.map((taskType) => `<option value="${escapeHtml(taskType.value)}" data-desc="${taskType.serverScoped ? t('schedules_page.needs_server') : t('schedules_page.panel_wide')}">${escapeHtml(taskType.label)}</option>`).join('')}
    </select>
    <div class="mt-3 hidden" data-sc-cmdwrap>
      <label class="label">${t('schedules_page.rcon_command')}</label>
      <input class="input font-mono" data-sc-cmd placeholder="${t('schedules_page.rcon_placeholder')}" autocomplete="off">
    </div>
    <div class="mt-3 hidden" data-sc-shrinkwrap>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="msm-check" data-sc-shrink> ${t('schedules_page.shrink_label')} <span class="text-xs text-ink-faint">${t('schedules_page.shrink_desc')}</span></label>
    </div>
    <label class="label mt-3">${t('schedules_page.cron_label')}</label>
    <input class="input font-mono" data-sc-cron placeholder="${t('schedules_page.cron_placeholder')}" autocomplete="off" spellcheck="false">
    <p class="help">${t('schedules_page.cron_help')}</p>
    <div class="mt-2 rounded-md border border-line bg-raised p-2.5 text-xs" data-sc-preview>
      <span class="text-ink-faint">${t('schedules_page.cron_preview_hint')}</span>
    </div>
    ${edit ? `<p class="help mt-3">${t('schedules_page.edit_replacement_note')}</p>` : ''}`;

  const serverSel = content.querySelector('[data-sc-server]');
  const typeSel = content.querySelector('[data-sc-type]');
  const cmdWrap = content.querySelector('[data-sc-cmdwrap]');
  const cmdInput = content.querySelector('[data-sc-cmd]');
  const shrinkWrap = content.querySelector('[data-sc-shrinkwrap]');
  const shrinkInput = content.querySelector('[data-sc-shrink]');
  const cronInput = content.querySelector('[data-sc-cron]');
  const preview = content.querySelector('[data-sc-preview]');

  if (edit) {
    serverSel.value = edit.serverId || '';
    typeSel.value = edit.taskType;
    cronInput.value = edit.cron;
    if (edit.payload && edit.payload.command) cmdInput.value = edit.payload.command;
    if (edit.payload && edit.payload.shrink) shrinkInput.checked = true;
  }

  const typeMeta = () => taskTypes.find((item) => item.value === typeSel.value) || {};
  const syncTypeUi = () => {
    cmdWrap.classList.toggle('hidden', typeSel.value !== 'rcon');
    shrinkWrap.classList.toggle('hidden', typeSel.value !== 'backup');
    // Panel-wide tasks ignore the server - disable the picker instead of
    // silently discarding whatever was selected in it.
    const scoped = Boolean(typeMeta().serverScoped);
    serverSel.disabled = !scoped;
    if (!scoped) serverSel.value = '';
  };
  typeSel.addEventListener('change', syncTypeUi);
  syncTypeUi();

  let previewTimer;
  const renderPreview = async () => {
    const expr = cronInput.value.trim();
    if (!expr) {
      preview.innerHTML = `<span class="text-ink-faint">${t('schedules_page.cron_preview_hint')}</span>`;
      return;
    }
    try {
      const res = await fetch(`/api/schedules/preview?cron=${encodeURIComponent(expr)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        preview.innerHTML = `<span class="text-danger">${escapeHtml(data.error || t('schedules_page.cron_invalid'))}</span>`;
        return;
      }
      preview.innerHTML = `<span class="text-ink-faint">${t('schedules_page.next_runs')}</span> ${data.runs
        .map((iso) => `<span class="mr-2 font-mono">${escapeHtml(formatDateTime(iso))}</span>`)
        .join('')}`;
    } catch {
      preview.innerHTML = `<span class="text-ink-faint">${t('schedules_page.preview_error')}</span>`;
    }
  };
  cronInput.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 300);
  });
  if (edit) renderPreview();

  openModal({
    title: edit
      ? t('schedules_page.edit_modal_title', { taskType: edit.taskType })
      : t('schedules_page.new_modal_title'),
    content,
    actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      {
        label: edit ? t('schedules_page.save_changes') : t('schedules_page.create_schedule'),
        kind: 'primary',
        busyLabel: edit ? t('common.saving') : t('common.creating'),
        onClick: async () => {
          const cron = cronInput.value.trim();
          if (!cron) {
            toast(t('schedules_page.enter_cron_toast'), { kind: 'error' });
            return false;
          }
          const meta = typeMeta();
          const serverId = serverSel.value || null;
          if (meta.serverScoped && !serverId) {
            toast(t('schedules_page.pick_server_toast', { label: meta.label }), { kind: 'error' });
            return false;
          }
          const payload = {};
          if (typeSel.value === 'rcon') {
            const command = cmdInput.value.trim();
            if (!command) {
              toast(t('schedules_page.enter_rcon_toast'), { kind: 'error' });
              return false;
            }
            payload.command = command;
          }
          if (typeSel.value === 'backup' && shrinkInput.checked) payload.shrink = true;
          const body = {
            serverId: meta.serverScoped ? serverId : null,
            taskType: typeSel.value,
            cron,
            payload,
          };
          try {
            // CREATE first, delete after: the old order destroyed the schedule
            // when the re-create failed, leaving a stale row over lost data.
            const res = await fetch('/api/schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.ok === false)
              throw new Error(data.error || friendlyError(res, { action: t('schedules_page.action_save') }));
            if (edit) {
              const del = await fetch(`/api/schedules/${edit.id}`, { method: 'DELETE' });
              const delData = await del.json().catch(() => ({}));
              if (!del.ok || delData.ok === false) {
                // Worst case is a duplicate, never a loss - say so plainly.
                toast(t('schedules_page.old_remove_failed'), {
                  kind: 'warn',
                  timeout: 10000,
                });
              }
            }
            toast(edit ? t('schedules_page.updated_toast') : t('schedules_page.created_toast'));
            setTimeout(() => location.reload(), 600);
          } catch (err) {
            toast(err.message, { kind: 'error', timeout: 9000 });
            return false;
          }
        },
      },
    ],
  });
  enhanceAll(content);
}
