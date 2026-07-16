// Tooltips for any element with data-tip="text". Hover + keyboard focus on
// desktop, tap on touch. Single floating element, viewport-aware placement.

let tipEl;
let currentTarget = null;
let showTimer;
let lastShownAt = 0; // sibling tooltips within the grace window skip the delay

function ensure() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  // Shown/hidden via opacity (not `hidden`) so it gets the same ~120ms ease
  // as every other surface instead of snapping; pointer-events stay off.
  tipEl.className =
    'pointer-events-none fixed z-[70] max-w-64 rounded-md border border-line-strong bg-raised px-2.5 py-1.5 text-xs text-ink opacity-0 shadow-overlay transition-opacity duration-100';
  tipEl.setAttribute('role', 'tooltip');
  document.body.appendChild(tipEl);
  return tipEl;
}

// Icon-only controls carry their meaning in data-tip, which assistive tech can't
// read. Promote it to an accessible name when the element has no other label, so
// screen readers announce "Restore backup" instead of just "button".
function labelFromTip(el) {
  if (!el.dataset.tip) return;
  if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
  if ((el.textContent || '').trim()) return;
  el.setAttribute('aria-label', el.dataset.tip);
}

export function labelTips(root = document) {
  for (const el of root.querySelectorAll('[data-tip]')) labelFromTip(el);
}

function show(target) {
  const text = target.dataset.tip;
  if (!text) return;
  labelFromTip(target);
  const el = ensure();
  el.textContent = text;
  el.classList.remove('opacity-0');
  currentTarget = target;
  lastShownAt = Date.now();

  const r = target.getBoundingClientRect();
  const tr = el.getBoundingClientRect();
  // Prefer above; flip below if it would clip.
  let top = r.top - tr.height - 8;
  if (top < 4) top = r.bottom + 8;
  let left = r.left + r.width / 2 - tr.width / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - tr.width - 4));
  el.style.top = `${Math.round(top)}px`;
  el.style.left = `${Math.round(left)}px`;
}

function hide() {
  clearTimeout(showTimer);
  currentTarget = null;
  if (tipEl) tipEl.classList.add('opacity-0');
}

document.addEventListener('pointerover', (e) => {
  const t = e.target.closest('[data-tip]');
  if (!t || t === currentTarget) return;
  clearTimeout(showTimer);
  // Only the first tooltip of a scan waits; moving between neighbors while
  // one was just visible shows the next instantly.
  const instant = currentTarget || Date.now() - lastShownAt < 300;
  if (instant) show(t);
  else showTimer = setTimeout(() => show(t), 350);
});
document.addEventListener('pointerout', (e) => {
  if (e.target.closest('[data-tip]')) hide();
});
document.addEventListener('focusin', (e) => {
  const t = e.target.closest('[data-tip]');
  if (t) show(t);
});
document.addEventListener('focusout', hide);
document.addEventListener('scroll', hide, true);

// Give every server-rendered tooltipped control an accessible name up front.
labelTips();
