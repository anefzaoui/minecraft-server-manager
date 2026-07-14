// Button loading states. Every click that kicks off an async request must
// show pending feedback ON the control itself — a spinner (plus optional
// label swap) and a disabled state — so the UI never soft-freezes.
//
//   const restore = setBusy(btn, 'Starting…');  // manual control
//   ...await work...
//   restore();
//
//   await withBusy(btn, () => api(...));         // scoped, always restores
//   await withBusy(btn, 'Saving…', () => api(...));

const SPINNER =
  '<svg class="icon size-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';

/**
 * Put a button (or chip/link) into a busy state. Returns a restore function.
 * Safe to call on an already-busy control — returns a no-op restorer so the
 * first caller keeps ownership.
 */
export function setBusy(el, label) {
  if (!el || el.dataset.busy) return () => {};
  el.dataset.busy = '1';
  const hadDisabled = el.disabled === true;
  const prevHtml = el.innerHTML;
  // Freeze the current width so short labels ("Stop" → spinner) don't make
  // the layout jump under the cursor.
  const w = el.offsetWidth;
  if (w) el.style.minWidth = `${w}px`;
  el.disabled = true;
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = label ? `${SPINNER}<span>${escapeHtml(label)}</span>` : SPINNER;
  return () => {
    if (!el.isConnected && !prevHtml) return;
    delete el.dataset.busy;
    el.innerHTML = prevHtml;
    el.disabled = hadDisabled;
    el.removeAttribute('aria-busy');
    el.style.minWidth = '';
  };
}

/** Run an async fn with the control busy; always restores, rethrows errors. */
export async function withBusy(el, labelOrFn, maybeFn) {
  const label = typeof labelOrFn === 'string' ? labelOrFn : undefined;
  const fn = typeof labelOrFn === 'function' ? labelOrFn : maybeFn;
  const restore = setBusy(el, label);
  try {
    return await fn();
  } finally {
    restore();
  }
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
