// Minecraft Server Manager client entry. Shared behaviors live in ./lib/* — every page gets
// the same modals, tooltips, toasts, dropdowns, and custom selects.

import { toast } from './lib/toast.js';
import { openModal } from './lib/modal.js';
import { confirmDialog } from './lib/confirm.js';
import { enhanceAll } from './lib/select.js';
import { setBusy, withBusy } from './lib/loading.js';
import './lib/tooltip.js';
import './lib/dropdown.js';
import './lib/taskTray.js';

// Expose for inline handlers and future page scripts.
window.CD = { toast, openModal, confirmDialog, setBusy, withBusy };

// ---- Custom selects everywhere ----
enhanceAll();

// ---- Theme toggle (persisted; applied pre-paint by the inline layout script) ----
(() => {
  const btn = document.getElementById('theme-toggle');
  const sync = () => {
    const theme = document.documentElement.dataset.theme;
    document.querySelectorAll('[data-theme-icon]').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.themeIcon !== theme);
    });
  };
  btn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('msm-theme', next);
    } catch {}
    sync();
  });
  sync();
})();

// ---- Mobile sidebar ----
(() => {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggle = document.getElementById('sidebar-toggle');
  if (!sidebar || !toggle) return;
  toggle.addEventListener('click', () => {
    const closed = sidebar.classList.toggle('-translate-x-full');
    backdrop.classList.toggle('hidden', closed);
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  });
})();

// ---- Dashboard: live text filter over server cards ----
(() => {
  const input = document.getElementById('server-filter');
  const grid = document.getElementById('server-grid');
  if (!input || !grid) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    grid.querySelectorAll('a[href^="/servers/"]').forEach((card) => {
      card.classList.toggle('hidden', Boolean(q) && !card.textContent.toLowerCase().includes(q));
    });
  });
})();

// (Console behavior lives in pages/console.js — no bindings here.)

// ---- Range sliders: live value readout ----
document.querySelectorAll('input[type="range"][data-out]').forEach((range) => {
  const out = document.getElementById(range.dataset.out);
  if (!out) return;
  const unit = range.dataset.unit || '';
  const render = () => {
    out.textContent = range.value === '0' && range.dataset.zero ? range.dataset.zero : `${range.value}${unit}`;
  };
  range.addEventListener('input', render);
  render();
});

// ---- Real server lifecycle actions ----
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-server-action]');
  if (!btn) return;
  const action = btn.dataset.serverAction;
  const id = btn.dataset.serverId;
  const name = btn.dataset.serverName || 'server';

  if (action === 'delete') {
    const ok = await confirmDialog({
      title: `Delete ${name}?`,
      message: 'This permanently deletes the container, its world, mods, and config. Backups are kept.',
      confirmLabel: 'Delete forever',
      danger: true,
      requireText: name,
    });
    if (!ok) return;
    const restore = setBusy(btn, 'Deleting…');
    const res = await api(`/api/servers/${id}`, 'DELETE');
    if (res.ok) {
      toast('Server deleted.');
      location.href = '/';
    } else {
      restore();
    }
    return;
  }

  const labels = {
    start: 'Starting…',
    stop: 'Stopping…',
    restart: 'Restarting…',
    kill: 'Killing…',
    recreate: 'Recreating…',
  };
  if (action === 'kill') {
    const ok = await confirmDialog({
      title: `Force kill ${name}?`,
      message: 'Kill skips the graceful stop — unsaved world data may be lost. Use Stop unless the server is frozen.',
      confirmLabel: 'Kill it',
      danger: true,
    });
    if (!ok) return;
  }
  // Spinner + label on the clicked control; freeze every other lifecycle
  // button for this server so Start/Stop can't be raced.
  const restore = setBusy(btn, labels[action]);
  const siblings = [...document.querySelectorAll(`[data-server-action][data-server-id="${id}"]`)].filter(
    (b) => b !== btn
  );
  siblings.forEach((b) => {
    b.disabled = true;
  });
  if (action === 'stop') toast('Stopping — the world saves first…', { kind: 'info' });
  const res = await api(`/api/servers/${id}/${action}`, 'POST');
  if (res.ok) {
    toast(`${name}: ${action} complete.`);
    setTimeout(() => location.reload(), 800); // spinner stays until the reload lands
  } else {
    restore();
    siblings.forEach((b) => {
      b.disabled = false;
    });
  }
});

async function api(url, method = 'GET', body) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      toast(data.error || `Request failed (${res.status})`, { kind: 'error', timeout: 8000 });
      return { ok: false, data };
    }
    return { ok: true, data };
  } catch (err) {
    toast(`Network error: ${err.message}`, { kind: 'error' });
    return { ok: false };
  }
}
window.CD.api = api;

// ---- Copy-to-clipboard: [data-copy="text"] or [data-copy-from="#selector"] ----
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-copy], [data-copy-from]');
  if (!el) return;
  let value = el.dataset.copy;
  if (el.dataset.copyFrom) {
    const src = document.querySelector(el.dataset.copyFrom);
    value = src ? (src.value ?? src.textContent) : '';
  }
  if (!value) value = el.value || el.textContent;
  try {
    await navigator.clipboard.writeText(String(value).trim());
    toast('Copied to clipboard.');
  } catch {
    toast('Copy failed — select and copy manually.', { kind: 'error' });
  }
});

// ---- Boot-phase hydration: keep status-detail chips live on any page ----
(() => {
  const els = () => document.querySelectorAll('[data-status-detail]');
  if (!els().length) return;
  async function tick() {
    try {
      const res = await fetch('/api/servers/live');
      const data = await res.json();
      if (data.ok) {
        for (const el of els()) {
          const live = data.servers[el.dataset.statusDetail];
          const phase = live && live.phase;
          el.textContent = phase || '';
          el.classList.toggle('hidden', !phase);
        }
      }
    } catch {
      /* transient */
    }
    setTimeout(tick, 8000);
  }
  setTimeout(tick, 8000);
})();
