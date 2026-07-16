// Global task tray: running tasks (pack installs, backups, upgrades…) stay
// visible from ANY page with live progress — surviving navigation, unlike the
// per-action modal. Polls /api/tasks; hidden when idle.
import { toast } from './toast.js';

const mount = document.getElementById('task-tray');
if (mount) init();

function init() {
  const btn = mount.querySelector('button');
  const badge = mount.querySelector('[data-task-count]');
  const panel = mount.querySelector('[data-task-panel]');
  const list = mount.querySelector('[data-task-list]');
  const known = new Map(); // id -> last seen state (for completion toasts)
  let open = false;

  btn.addEventListener('click', () => {
    open = !open;
    panel.classList.toggle('hidden', !open);
  });
  document.addEventListener('click', (e) => {
    if (open && !mount.contains(e.target)) {
      open = false;
      panel.classList.add('hidden');
    }
  });

  async function poll() {
    let data;
    try {
      const res = await fetch('/api/tasks');
      data = await res.json();
    } catch {
      schedule(8000);
      return;
    }
    const tasks = data.tasks || [];
    const running = tasks.filter((t) => t.state === 'running');

    // Completion notifications for tasks we watched go by.
    for (const t of tasks) {
      const prev = known.get(t.id);
      if (prev === 'running' && t.state !== 'running') {
        toast(t.state === 'done' ? `${t.title} — finished.` : `${t.title} — failed: ${t.error}`, {
          kind: t.state === 'done' ? 'success' : 'error',
          timeout: 7000,
        });
      }
      known.set(t.id, t.state);
    }

    mount.classList.toggle('hidden', tasks.length === 0);
    badge.textContent = String(running.length || tasks.length);
    badge.classList.toggle('bg-grass-600', running.length > 0);
    btn.querySelector('svg')?.classList.toggle('animate-spin', running.length > 0);

    list.innerHTML = '';
    for (const t of tasks) {
      const row = document.createElement('div');
      row.className = 'space-y-1 border-b border-line p-3 text-sm last:border-0';
      const pct = t.percent != null ? t.percent : t.state === 'running' ? null : 100;
      row.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="min-w-0 flex-1 truncate font-medium"></span>
          <span class="shrink-0 text-[11px] ${t.state === 'failed' ? 'text-danger' : t.state === 'done' ? 'text-ok' : 'text-ink-faint'}">
            ${t.state === 'running' ? `${Math.round(t.elapsedMs / 1000)}s` : t.state}
          </span>
        </div>
        <div class="truncate text-xs text-ink-faint" data-step></div>
        <div class="meter h-1.5"><div class="${t.state === 'failed' ? 'bg-redstone-500' : 'bg-grass-500'} ${pct === null ? 'animate-pulse' : ''}" style="width:${pct === null ? 60 : Math.max(4, pct)}%"></div></div>`;
      row.querySelector('.font-medium').textContent = t.title;
      row.querySelector('[data-step]').textContent = t.step || '';
      list.appendChild(row);
    }
    if (!tasks.length && open) {
      open = false;
      panel.classList.add('hidden');
    }
    schedule(running.length ? 2500 : 10000);
  }

  let timer;
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(poll, ms);
  }
  poll();
}
