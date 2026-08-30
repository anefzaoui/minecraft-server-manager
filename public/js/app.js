// Minecraft Server Manager client entry. Shared behaviors live in ./lib/* - every page gets
// the same modals, tooltips, toasts, dropdowns, and custom selects.

import { toast } from './lib/toast.js';
import { friendlyError } from './lib/errors.js';
import { openModal } from './lib/modal.js';
import { confirmDialog } from './lib/confirm.js';
import { enhanceAll } from './lib/select.js';
import { setBusy, withBusy } from './lib/loading.js';
import { formatDateTime, timeAgo } from './lib/datetime.js';
import './lib/tooltip.js';
import './lib/dropdown.js';
import './lib/taskTray.js';
import './lib/seg.js';
import './lib/twoFactor.js';
import './lib/avatar.js';

// Expose for inline handlers and future page scripts.
window.CD = { toast, openModal, confirmDialog, setBusy, withBusy };

// ---- Custom selects everywhere ----
enhanceAll();

// ---- Icon fallback: replaces per-image inline onerror="" attributes (which
// script-src's CSP nonce doesn't cover) with one delegated listener. `error`
// doesn't bubble, so this has to listen on the capture phase. ----
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const fallback = img.dataset.fallbackIcon;
    if (!fallback || img.src === new URL(fallback, location.href).href) return;
    img.src = fallback;
  },
  true
);

// ---- Timestamps: raw UTC DB strings → the panel's timezone + locale ----
// Views render <span data-ts="…">raw</span> (absolute) or data-ts-ago
// (relative); the raw value stays as the no-JS fallback and the hover title.
for (const el of document.querySelectorAll('[data-ts], [data-ts-ago]')) {
  const raw = el.dataset.ts || el.dataset.tsAgo;
  const pretty = el.dataset.ts ? formatDateTime(raw) : timeAgo(raw);
  if (pretty) {
    el.title = formatDateTime(raw);
    el.textContent = pretty;
  }
}

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
  const close = () => {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  };
  toggle.addEventListener('click', () => {
    const closed = sidebar.classList.toggle('-translate-x-full');
    backdrop.classList.toggle('hidden', closed);
  });
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sidebar.classList.contains('-translate-x-full')) close();
  });
})();

// ---- Dashboard: live text filter over server cards ----
(() => {
  const input = document.getElementById('server-filter');
  const grid = document.getElementById('server-grid');
  if (!input || !grid) return;
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    // Match against data-filter (name/flavor/version/tags) - matching the full
    // card text made "cpu" or "memory" match every card via the stat labels.
    grid.querySelectorAll('[data-filter]').forEach((card) => {
      const hide = Boolean(q) && !(card.dataset.filter || '').toLowerCase().includes(q);
      card.classList.toggle('hidden', hide);
      if (!hide) shown += 1;
    });
    let empty = grid.querySelector('[data-filter-empty]');
    if (q && !shown) {
      if (!empty) {
        empty = document.createElement('p');
        empty.dataset.filterEmpty = '';
        empty.className = 'col-span-full py-6 text-center text-sm text-ink-faint';
        grid.appendChild(empty);
      }
      empty.textContent = `No servers match "${input.value.trim()}".`;
    } else if (empty) {
      empty.remove();
    }
  });
})();

// ---- Plain form posts: spinner + disable the submit on the way out ----
// (fetch-based flows use setBusy directly; this covers full-page posts like
// login, where a slow round-trip otherwise allows double submits)
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-disable-on-submit]');
  if (!form) return;
  const btn = form.querySelector('button[type="submit"], input[type="submit"]');
  if (btn) setBusy(btn);
});

// (Console behavior lives in pages/console.js - no bindings here.)

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
    kill: 'Force stopping…',
    recreate: 'Rebuilding…',
  };
  if (action === 'kill') {
    const ok = await confirmDialog({
      title: `Force stop ${name}?`,
      message:
        'A force stop skips the normal shutdown, so any unsaved world changes can be lost. Use Stop instead unless the server is frozen.',
      confirmLabel: 'Force stop',
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
  if (action === 'stop') toast('Stopping. The world saves first…', { kind: 'info' });
  const res = await api(`/api/servers/${id}/${action}`, 'POST');
  if (res.ok) {
    const done = {
      start: 'started',
      stop: 'stopped',
      restart: 'restarted',
      kill: 'force stopped',
      recreate: 'rebuilt',
    };
    toast(`${name} ${done[action] || 'updated'}.`);
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
      toast(data.error || friendlyError(res), { kind: 'error', timeout: 8000 });
      return { ok: false, data };
    }
    return { ok: true, data };
  } catch {
    toast(friendlyError(), { kind: 'error' });
    return { ok: false };
  }
}
window.CD.api = api;

// ---- Copy-to-clipboard: [data-copy="text"] or [data-copy-from="#selector"] ----
// Robust across contexts: the async Clipboard API only works on HTTPS/localhost,
// so over plain HTTP (LAN/IP) we fall back to execCommand, then to a prompt the
// user can copy from by hand - which also covers a <select> source that can't be
// selected in place. Returns true only when the copy landed programmatically.
async function copyText(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return true;
  } catch {
    /* fall through to the manual prompt */
  }
  // Last resort - a small modal with the value selected, ready for Ctrl/Cmd+C
  // (no native browser chrome; the modal core exists to avoid exactly that).
  const input = document.createElement('input');
  input.className = 'input font-mono';
  input.readOnly = true;
  input.value = text;
  input.addEventListener('focus', () => input.select());
  const wrap = document.createElement('div');
  wrap.className = 'space-y-2';
  const help = document.createElement('p');
  help.className = 'text-xs text-ink-faint';
  help.textContent = 'Automatic copy is not available here. Press Ctrl/Cmd+C to copy the selected value.';
  wrap.append(input, help);
  openModal({ title: 'Copy Manually', content: wrap, size: 'sm' });
  input.select();
  return false;
}
window.CD.copyText = copyText;

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-copy], [data-copy-from]');
  if (!el) return;
  let value = el.dataset.copy;
  if (el.dataset.copyFrom) {
    const src = document.querySelector(el.dataset.copyFrom);
    value = src ? (src.value ?? src.textContent) : '';
  }
  if (!value) value = el.value || el.textContent;
  if (await copyText(value)) toast('Copied to clipboard.');
});

// ---- Boot-phase hydration: keep status-detail chips live on any page ----
// Also broadcasts each fetch as `msm:servers-live` so other page scripts
// (e.g. the dashboard's card stats) can piggyback on this poll instead of
// running their own redundant interval against the same endpoint.
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
          el.title = phase || ''; // truncated chips stay readable on hover
          el.classList.toggle('hidden', !phase);
        }
        document.dispatchEvent(new CustomEvent('msm:servers-live', { detail: data }));
      }
    } catch {
      /* transient */
    }
    setTimeout(tick, 8000);
  }
  setTimeout(tick, 8000);
})();
