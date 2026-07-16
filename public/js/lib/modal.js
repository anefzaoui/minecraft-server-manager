// Modal core. Every dialog in the panel goes through this: consistent styling,
// backdrop, ESC/backdrop close, focus trap, scroll lock, stacking.
//
// openModal({ title, content, actions, size, onClose }) -> { el, body, close }
//   content: string (HTML) or Node
//   actions: array of { label, kind: 'primary'|'danger'|'default'|'ghost',
//                       onClick(ctx) — return false to keep the modal open }
//   size: 'sm' | 'md' | 'lg' (default 'md')

import { enhanceAll } from './select.js'; // circular with select.js — safe: both only call at runtime
import { setBusy } from './loading.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const stack = [];

export function openModal({ title = '', content = '', actions = [], size = 'md', onClose } = {}) {
  const previouslyFocused = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-[2px]';

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };
  const panel = document.createElement('div');
  panel.className = `card w-full ${widths[size] || widths.md} max-h-[85vh] flex flex-col shadow-modal animate-[modal-in_.15s_ease-out]`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  panel.innerHTML = `
    <div class="flex items-center gap-3 border-b border-line py-3 pl-5 pr-3">
      <h3 class="min-w-0 flex-1 truncate font-semibold"></h3>
      <button data-modal-x class="icon-btn" aria-label="Close">
        <svg class="icon size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div data-modal-body class="min-h-0 flex-1 overflow-y-auto p-5"></div>`;
  panel.querySelector('h3').textContent = title;

  const body = panel.querySelector('[data-modal-body]');
  if (typeof content === 'string') body.innerHTML = content;
  else if (content) body.appendChild(content);
  enhanceAll(body); // injected <select>s get the same styled picker as page ones

  const ctx = { el: panel, body, close };

  let footer = null;
  if (actions.length) {
    footer = document.createElement('div');
    footer.className = 'flex justify-end gap-2 border-t border-line px-5 py-3.5';
    for (const action of actions) {
      const btn = document.createElement('button');
      const kinds = { primary: 'btn btn-primary', danger: 'btn btn-danger', ghost: 'btn btn-ghost', default: 'btn' };
      btn.className = kinds[action.kind] || kinds.default;
      btn.textContent = action.label;
      btn.addEventListener('click', async () => {
        if (!action.onClick) return close();
        // Async work in flight: spinner on the clicked button, siblings
        // disabled — no double-submits, no soft-freeze.
        if (footer.dataset.busy) return;
        footer.dataset.busy = '1';
        const others = [...footer.querySelectorAll('button')].filter((b) => b !== btn);
        const prevDisabled = others.map((b) => b.disabled);
        others.forEach((b) => {
          b.disabled = true;
        });
        const restore = setBusy(btn, action.busyLabel);
        try {
          const result = await action.onClick(ctx);
          if (result !== false) close();
        } finally {
          delete footer.dataset.busy;
          restore();
          others.forEach((b, i) => {
            b.disabled = prevDisabled[i];
          });
        }
      });
      footer.appendChild(btn);
    }
    panel.appendChild(footer);
  }

  function close(value) {
    const idx = stack.indexOf(entry);
    if (idx === -1) return;
    stack.splice(idx, 1);
    document.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    if (!stack.length) document.documentElement.style.overflow = '';
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (onClose) onClose(value);
  }

  function onKeydown(e) {
    if (stack[stack.length - 1] !== entry) return; // only the top modal reacts
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      // Focus trap
      const focusables = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }

  const entry = { close, onKeydown };
  stack.push(entry);

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  panel.querySelector('[data-modal-x]').addEventListener('click', () => close());
  document.addEventListener('keydown', onKeydown);

  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  document.documentElement.style.overflow = 'hidden';

  // Initial focus: querySelector returns the first match in DOCUMENT order, so
  // querying the whole panel always landed on the close-X (it precedes the
  // body). Prefer a body field, then a footer action, then anything focusable.
  const firstInput =
    body.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), button.msm-select') ||
    (footer && footer.querySelector('button:not([disabled])')) ||
    panel.querySelector(FOCUSABLE);
  if (firstInput) firstInput.focus();

  return ctx;
}
