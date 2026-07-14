// Toast notifications. One host, stacked, auto-dismiss, screen-reader friendly.
// Usage: toast('Saved'); toast('Boom', { kind: 'error', timeout: 8000 });

let host;

function ensureHost() {
  if (host) return host;
  host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.className = 'fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2';
    document.body.appendChild(host);
  }
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  return host;
}

const KIND = {
  success: {
    border: 'border-grass-700',
    icon: '<svg class="icon size-4 text-grass-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  },
  error: {
    border: 'border-redstone-700',
    icon: '<svg class="icon size-4 text-redstone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  },
  info: {
    border: 'border-diamond-700',
    icon: '<svg class="icon size-4 text-diamond-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  },
};

export function toast(message, { kind = 'success', timeout = 4500 } = {}) {
  const h = ensureHost();
  const meta = KIND[kind] || KIND.success;

  const el = document.createElement('div');
  el.className = `card flex items-start gap-2.5 p-3 text-sm shadow-lg ${meta.border} animate-[toast-in_.18s_ease-out]`;
  el.innerHTML = `${meta.icon}<span class="min-w-0 flex-1 break-words"></span>
    <button class="text-ink-faint transition hover:text-ink" aria-label="Dismiss">
      <svg class="icon size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>`;
  el.querySelector('span').textContent = message;

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.style.transition = 'opacity .15s, transform .15s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(8px)';
    setTimeout(() => el.remove(), 150);
  };
  el.querySelector('button').addEventListener('click', dismiss);
  if (timeout > 0) timer = setTimeout(dismiss, timeout);

  h.appendChild(el);
  return dismiss;
}

// Declarative hook: any element with data-toast pops a toast on click (used by
// the UI preview; real actions replace these handlers as features are wired).
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-toast]');
  if (t) toast(t.dataset.toast, { kind: t.dataset.toastKind || 'success' });
});
