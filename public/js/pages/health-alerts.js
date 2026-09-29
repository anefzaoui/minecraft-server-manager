// Dashboard "Health · 24h" card: opens the list of crash, out-of-memory, and
// auto-restart alerts with their details. Each alert can be dismissed on its
// own or all at once; dismissals are per user and never delete history.

import { openModal } from '../lib/modal.js';
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { escapeHtml } from '../lib/format.js';
import { timeAgo, formatDateTime } from '../lib/datetime.js';

const card = document.querySelector('[data-health-card]');
const openBtn = card && card.querySelector('[data-open-alerts]');
if (openBtn) openBtn.addEventListener('click', openAlerts);

const TYPES = {
  crashed: { label: 'Crash', badge: 'badge-danger' },
  oom: { label: 'Out of Memory', badge: 'badge-danger' },
  'auto-restarted': { label: 'Auto-Restart', badge: 'badge-warn' },
};

const plural = (n, one, many) => (n === 1 ? one : many);

/** Keep the card in step with the list after a dismissal. */
function updateCard({ total, crashes, oom, autoRestarted }) {
  const totalEl = card.querySelector('[data-health-total]');
  totalEl.className = totalEl.className.replace(/\btext-(danger|ok)\b/, total ? 'text-danger' : 'text-ok');
  totalEl.innerHTML = `${total}<span class="text-base font-medium text-ink-soft"> ${plural(total, 'alert', 'alerts')}</span>`;
  card.querySelector('[data-health-detail]').textContent = total
    ? `${crashes} ${plural(crashes, 'crash', 'crashes')}, ${oom} out of memory, ${autoRestarted} ${plural(autoRestarted, 'auto-restart', 'auto-restarts')}`
    : 'No crashes, out-of-memory stops, or auto-restarts';
  openBtn.classList.toggle('hidden', !total);
}

async function post(url, action) {
  try {
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      toast(data.error || friendlyError(res, { action }), { kind: 'error' });
      return false;
    }
    return true;
  } catch (err) {
    toast(friendlyError(err, { action }), { kind: 'error' });
    return false;
  }
}

function alertHtml(a) {
  const type = TYPES[a.type] || { label: a.type, badge: '' };
  const details = [];
  if (a.type === 'crashed') {
    if (a.exitCode != null) details.push(`Exit code ${a.exitCode}.`);
    details.push(a.willRestart ? 'The panel will restart it automatically.' : 'It will not restart on its own.');
    if (a.report && a.report.exception) details.push(`Error: ${escapeHtml(a.report.exception)}.`);
    if (a.report && a.report.suspects.length) {
      details.push(`Suspected mods: ${escapeHtml(a.report.suspects.join(', '))}.`);
    }
  }
  const links = [];
  if (a.serverId) {
    links.push(
      `<a class="text-link hover:underline" href="/servers/${encodeURIComponent(a.serverId)}/history">Open History</a>`
    );
  }
  if (a.type === 'crashed' && a.hasLog) {
    links.push(
      `<a class="text-link hover:underline" href="/api/events/${a.id}/excerpt" target="_blank" rel="noopener">View Log</a>`
    );
  }
  return `
    <li class="flex items-start gap-3 py-3" data-alert-id="${a.id}">
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="badge ${type.badge}">${escapeHtml(type.label)}</span>
          <span class="truncate font-medium">${escapeHtml(a.server || 'A removed server')}</span>
          <time class="text-xs text-ink-faint" datetime="${escapeHtml(a.at)}" title="${escapeHtml(formatDateTime(a.at))}">${escapeHtml(timeAgo(a.at))}</time>
        </div>
        <p class="mt-1 break-words text-sm text-ink-soft">${escapeHtml(a.summary)}</p>
        ${details.length ? `<p class="mt-1 break-words text-xs text-ink-faint">${details.join(' ')}</p>` : ''}
        ${links.length ? `<div class="mt-1.5 flex gap-3 text-xs">${links.join('')}</div>` : ''}
      </div>
      <button type="button" class="btn btn-ghost btn-sm shrink-0" data-dismiss aria-label="Dismiss this alert">Dismiss</button>
    </li>`;
}

async function fetchAlerts() {
  const res = await fetch('/api/alerts');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || friendlyError(res, { action: 'load the alerts' }));
  return data;
}

async function openAlerts() {
  let state;
  try {
    state = await fetchAlerts();
  } catch (err) {
    toast(err.message || friendlyError(err, { action: 'load the alerts' }), { kind: 'error' });
    return;
  }

  const modal = openModal({
    title: 'Health Alerts',
    size: 'lg',
    content: '<div data-alert-host></div>',
    actions: [
      {
        label: 'Clear All',
        kind: 'danger',
        busyLabel: 'Clearing…',
        onClick: async () => {
          if (!(await post('/api/alerts/clear', 'clear the alerts'))) return false;
          state = { counts: { crashes: 0, oom: 0, autoRestarted: 0, total: 0 }, alerts: [] };
          updateCard(state.counts);
          toast('Alerts cleared.');
        },
      },
      { label: 'Close', kind: 'ghost' },
    ],
  });
  const host = modal.body.querySelector('[data-alert-host]');

  function render() {
    if (!state.alerts.length) {
      host.innerHTML = '<p class="py-6 text-center text-sm text-ink-faint">No alerts. Everything looks healthy.</p>';
      return;
    }
    const more = state.counts.total - state.alerts.length;
    host.innerHTML = `<ul class="divide-y divide-line">${state.alerts.map(alertHtml).join('')}</ul>${
      more > 0
        ? `<p class="pt-3 text-xs text-ink-faint">Showing the newest ${state.alerts.length}. ${more} older ${plural(more, 'alert is', 'alerts are')} hidden until you dismiss some.</p>`
        : ''
    }`;
  }

  host.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-dismiss]');
    if (!btn) return;
    const li = btn.closest('[data-alert-id]');
    btn.disabled = true;
    if (!(await post(`/api/alerts/${li.dataset.alertId}/dismiss`, 'dismiss that alert'))) {
      btn.disabled = false;
      return;
    }
    // Refetch: the counts, and any alert beyond the first page, come from the server.
    try {
      state = await fetchAlerts();
    } catch {
      const alerts = state.alerts.filter((a) => String(a.id) !== li.dataset.alertId);
      state = { counts: { ...state.counts, total: state.counts.total - 1 }, alerts };
    }
    updateCard(state.counts);
    render();
  });

  render();
}
