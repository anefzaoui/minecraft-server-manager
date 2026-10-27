// Permissions page: the users × servers matrix. Each cell opens a modal of
// capability toggles; saving PUTs the grant (or null = role default).
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { t } from '../lib/i18n.js';

const page = document.getElementById('permissions-page');
if (page) init();

function init() {
  const capabilities = JSON.parse(document.getElementById('permissions-capabilities').textContent);
  const labelOf = Object.fromEntries(capabilities.map((c) => [c.key, c.label]));

  for (const cell of page.querySelectorAll('[data-perm-cell]')) renderCell(cell);

  page.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-perm-cell]');
    if (cell) openEditor(cell);
  });

  function readCell(cell) {
    return {
      grant: JSON.parse(cell.dataset.grant),
      effective: JSON.parse(cell.dataset.effective),
    };
  }

  function summarize(list) {
    if (list.length === 0) return t('permissions_page.summary_hidden');
    if (list.length === capabilities.length) return t('permissions_page.summary_everything');
    if (list.length === 1 && list[0] === 'view') return t('permissions_page.summary_view_only');
    return list
      .filter((c) => c !== 'view')
      .map((c) => labelOf[c] || c)
      .join(', ');
  }

  function renderCell(cell) {
    const { grant, effective } = readCell(cell);
    const summary = cell.querySelector('[data-perm-summary]');
    summary.textContent = summarize(effective);
    cell.classList.toggle('text-ink-faint', grant === null);
    cell.classList.toggle('text-danger', grant !== null && grant.length === 0);
    // Custom grants get the pressed (green) border; a hidden cell reads in red on a neutral border instead.
    cell.setAttribute('aria-pressed', grant !== null && grant.length > 0 ? 'true' : 'false');
    cell.dataset.tip = grant === null ? t('permissions_page.tip_default') : t('permissions_page.tip_custom');
  }

  function openEditor(cell) {
    const row = cell.closest('tr');
    const { grant, effective } = readCell(cell);
    const username = row.dataset.username;
    const role = row.dataset.role;
    const roleLabel = t(`roles.${role}`, { defaultValue: role });
    const serverName = cell.dataset.serverName;
    const current = new Set(effective);

    const content = document.createElement('div');
    content.className = 'space-y-3';
    const status = document.createElement('p');
    status.className = 'help mt-0';
    status.textContent =
      grant === null
        ? t('permissions_page.status_default', { role: roleLabel, server: serverName })
        : t('permissions_page.status_custom', { role: roleLabel, server: serverName });
    content.appendChild(status);

    const list = document.createElement('div');
    list.className = 'divide-y divide-line';
    for (const cap of capabilities) {
      const label = document.createElement('label');
      label.className = 'flex cursor-pointer items-start justify-between gap-4 py-2';
      label.innerHTML = `
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-ink"></span>
          <span class="mt-0.5 block max-w-prose text-xs leading-relaxed text-ink-faint"></span>
        </span>
        <span class="msm-toggle mt-0.5 shrink-0"><input type="checkbox" data-cap><span></span></span>`;
      label.querySelector('.text-sm').textContent = cap.label;
      label.querySelector('.text-xs').textContent = cap.help;
      const input = label.querySelector('input');
      input.value = cap.key;
      input.checked = current.has(cap.key);
      list.appendChild(label);
    }
    content.appendChild(list);

    const hint = document.createElement('p');
    hint.className = 'help';
    hint.textContent = t('permissions_page.hint');
    content.appendChild(hint);

    // Every capability implies view: ticking any other box ticks view, and
    // unticking view clears the rest, so the modal never shows an impossible mix.
    list.addEventListener('change', (e) => {
      const input = e.target.closest('input[data-cap]');
      if (!input) return;
      const boxes = [...list.querySelectorAll('input[data-cap]')];
      const view = boxes.find((b) => b.value === 'view');
      if (input.value === 'view' && !input.checked) boxes.forEach((b) => (b.checked = false));
      else if (input.checked) view.checked = true;
    });

    const actions = [{ label: t('common.cancel'), kind: 'ghost' }];
    if (grant !== null) {
      actions.push({
        label: t('permissions_page.btn_role_default'),
        kind: 'default',
        busyLabel: t('permissions_page.btn_resetting'),
        onClick: async () => {
          const res = await save(row.dataset.userId, cell.dataset.serverId, null);
          if (!res) return false;
          applyResult(cell, res);
          toast(t('permissions_page.toast_role_default', { username, role: roleLabel, server: serverName }));
        },
      });
    }
    actions.push({
      label: t('common.save'),
      kind: 'primary',
      busyLabel: t('common.saving'),
      onClick: async () => {
        const perms = [...list.querySelectorAll('input[data-cap]:checked')].map((b) => b.value);
        const res = await save(row.dataset.userId, cell.dataset.serverId, perms);
        if (!res) return false;
        applyResult(cell, res);
        toast(
          perms.length
            ? t('permissions_page.toast_saved', { username, server: serverName })
            : t('permissions_page.toast_hidden', { server: serverName, username })
        );
      },
    });

    openModal({ title: `${username} on ${serverName}`, content, actions });
  }

  function applyResult(cell, res) {
    cell.dataset.grant = JSON.stringify(res.grant);
    cell.dataset.effective = JSON.stringify(res.effective);
    renderCell(cell);
  }

  async function save(userId, serverId, perms) {
    try {
      const res = await fetch(`/api/permissions/${encodeURIComponent(userId)}/${encodeURIComponent(serverId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perms }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        toast(data.error || friendlyError(res, { action: t('permissions_page.action_save') }), {
          kind: 'error',
          timeout: 8000,
        });
        return null;
      }
      return data;
    } catch {
      toast(friendlyError(null, { action: t('permissions_page.action_save') }), { kind: 'error' });
      return null;
    }
  }
}
