// Schedules page: New-task modal (cron builder with live next-run preview),
// enable/disable toggle, delete, and edit (= delete + recreate, labeled).

import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { enhanceAll } from '../lib/select.js';
import { withBusy } from '../lib/loading.js';
import { formatDateTime } from '../lib/datetime.js';

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
        title: 'Delete this schedule?',
        message: `${row.dataset.task} (${row.dataset.cron}) stops firing immediately.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      await withBusy(delBtn, async () => {
        const res = await fetch(`/api/schedules/${row.dataset.scheduleId}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) {
          toast('Schedule deleted.');
          const tbody = row.closest('tbody');
          row.remove();
          if (tbody && !tbody.querySelector('[data-schedule-row]')) setTimeout(() => location.reload(), 600);
        } else {
          toast(data.error || 'Delete failed', { kind: 'error' });
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
    input.disabled = true; // lock the toggle in flight — keeps the switch visual
    try {
      const res = await fetch(`/api/schedules/${row.dataset.scheduleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `Toggle failed (${res.status})`);
      toast(`Schedule ${enabled ? 'enabled' : 'disabled'}.`);
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
    <label class="label">Runs on</label>
    <select class="input" data-sc-server data-label="Runs on">
      <option value="">— global (the panel itself) —</option>
      ${servers.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('')}
    </select>
    <label class="label mt-3">Task</label>
    <select class="input" data-sc-type data-label="Task type">
      ${taskTypes.map((t) => `<option value="${escapeHtml(t.value)}" data-desc="${t.serverScoped ? 'Needs a server' : 'Panel-wide'}">${escapeHtml(t.label)}</option>`).join('')}
    </select>
    <div class="mt-3 hidden" data-sc-cmdwrap>
      <label class="label">RCON command</label>
      <input class="input font-mono" data-sc-cmd placeholder="say Server restarts in 5 minutes" autocomplete="off">
    </div>
    <label class="label mt-3">Cron expression</label>
    <input class="input font-mono" data-sc-cron placeholder="0 4 * * *" autocomplete="off" spellcheck="false">
    <p class="help">Five fields: minute hour day-of-month month day-of-week. Example: <b class="font-mono">0 4 * * *</b> = daily at 04:00.</p>
    <div class="mt-2 rounded-md border border-line bg-raised p-2.5 text-xs" data-sc-preview>
      <span class="text-ink-faint">Type a cron expression to preview the next runs.</span>
    </div>
    ${edit ? '<p class="help mt-3">Saving replaces the schedule (create, then remove the old one) — timing continues seamlessly.</p>' : ''}`;

  const serverSel = content.querySelector('[data-sc-server]');
  const typeSel = content.querySelector('[data-sc-type]');
  const cmdWrap = content.querySelector('[data-sc-cmdwrap]');
  const cmdInput = content.querySelector('[data-sc-cmd]');
  const cronInput = content.querySelector('[data-sc-cron]');
  const preview = content.querySelector('[data-sc-preview]');

  if (edit) {
    serverSel.value = edit.serverId || '';
    typeSel.value = edit.taskType;
    cronInput.value = edit.cron;
    if (edit.payload && edit.payload.command) cmdInput.value = edit.payload.command;
  }

  const typeMeta = () => taskTypes.find((t) => t.value === typeSel.value) || {};
  const syncTypeUi = () => {
    cmdWrap.classList.toggle('hidden', typeSel.value !== 'rcon');
    // Panel-wide tasks ignore the server — disable the picker instead of
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
      preview.innerHTML = '<span class="text-ink-faint">Type a cron expression to preview the next runs.</span>';
      return;
    }
    try {
      const res = await fetch(`/api/schedules/preview?cron=${encodeURIComponent(expr)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        preview.innerHTML = `<span class="text-danger">${escapeHtml(data.error || 'Invalid cron expression')}</span>`;
        return;
      }
      preview.innerHTML = `<span class="text-ink-faint">Next runs:</span> ${data.runs
        .map((iso) => `<span class="mr-2 font-mono">${escapeHtml(formatDateTime(iso))}</span>`)
        .join('')}`;
    } catch {
      preview.innerHTML = '<span class="text-ink-faint">Preview unavailable (network error).</span>';
    }
  };
  cronInput.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 300);
  });
  if (edit) renderPreview();

  openModal({
    title: edit ? `Edit schedule — ${edit.taskType}` : 'New scheduled task',
    content,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: edit ? 'Save changes' : 'Create schedule',
        kind: 'primary',
        busyLabel: edit ? 'Saving…' : 'Creating…',
        onClick: async () => {
          const cron = cronInput.value.trim();
          if (!cron) {
            toast('Enter a cron expression.', { kind: 'error' });
            return false;
          }
          const meta = typeMeta();
          const serverId = serverSel.value || null;
          if (meta.serverScoped && !serverId) {
            toast(`"${meta.label}" runs on a server — pick one.`, { kind: 'error' });
            return false;
          }
          const payload = {};
          if (typeSel.value === 'rcon') {
            const command = cmdInput.value.trim();
            if (!command) {
              toast('Enter the RCON command to run.', { kind: 'error' });
              return false;
            }
            payload.command = command;
          }
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
            if (!res.ok || data.ok === false) throw new Error(data.error || `Save failed (${res.status})`);
            if (edit) {
              const del = await fetch(`/api/schedules/${edit.id}`, { method: 'DELETE' });
              const delData = await del.json().catch(() => ({}));
              if (!del.ok || delData.ok === false) {
                // Worst case is a duplicate, never a loss — say so plainly.
                toast('Saved as a new schedule, but the old one could not be removed — delete it manually.', {
                  kind: 'warn',
                  timeout: 10000,
                });
              }
            }
            toast(edit ? 'Schedule updated.' : 'Schedule created.');
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

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
