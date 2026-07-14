// Confirmation dialogs built on the modal core.
//
// confirmDialog({ title, message, detail, confirmLabel, danger, requireText })
//   -> Promise<boolean>
// requireText: the user must type this exact string to enable the confirm
// button (used for destructive actions like server deletion).

import { openModal } from './modal.js';

export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  detail = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  requireText = null,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };

    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    if (message) {
      const p = document.createElement('p');
      p.textContent = message;
      content.appendChild(p);
    }
    if (detail) {
      const d = document.createElement('div');
      d.className = 'rounded-md border border-line bg-raised p-2.5 text-xs text-ink-soft';
      d.textContent = detail;
      content.appendChild(d);
    }

    let input = null;
    if (requireText) {
      const wrap = document.createElement('div');
      const label = document.createElement('label');
      label.className = 'label';
      label.innerHTML = `Type <b class="font-mono">${escapeHtml(requireText)}</b> to confirm`;
      input = document.createElement('input');
      input.className = 'input font-mono';
      input.autocomplete = 'off';
      input.spellcheck = false;
      wrap.append(label, input);
      content.appendChild(wrap);
    }

    const modal = openModal({
      title,
      content,
      size: 'sm',
      onClose: () => settle(false),
      actions: [
        { label: cancelLabel, kind: 'ghost', onClick: () => settle(false) },
        {
          label: confirmLabel,
          kind: danger ? 'danger' : 'primary',
          onClick: () => {
            if (input && input.value !== requireText) {
              input.classList.add('border-redstone-500');
              input.focus();
              return false; // keep open
            }
            settle(true);
          },
        },
      ],
    });

    if (input) {
      const confirmBtn = modal.el.querySelector('.btn-danger, .btn-primary');
      confirmBtn.disabled = true;
      input.addEventListener('input', () => {
        confirmBtn.disabled = input.value !== requireText;
        input.classList.remove('border-redstone-500');
      });
    }
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
