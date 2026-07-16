// Sliding-pill segmented controls. Every .seg gets an injected .seg-pill that
// GLIDES to the selected segment instead of the raised state teleporting
// between buttons. Zero page-code changes: selection already lives in
// aria-pressed/aria-selected (the .seg contract), so a MutationObserver on
// those attributes is the whole wiring. Reduced motion collapses the glide via
// the global media query. Without JS the plain CSS selected state still shows.

const SELECTED = '.seg-btn[aria-pressed="true"], .seg-btn[aria-selected="true"]';

function enhance(seg) {
  if (seg.dataset.segAnimated) return;
  seg.dataset.segAnimated = '1';

  const pill = document.createElement('span');
  pill.className = 'seg-pill';
  pill.setAttribute('aria-hidden', 'true');
  seg.prepend(pill);

  function position({ animate = true } = {}) {
    const btn = seg.querySelector(SELECTED);
    // Hidden container (display:none tab panel) or no selection: park the pill.
    if (!btn || !btn.offsetWidth) {
      pill.style.opacity = '0';
      return;
    }
    if (!animate) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.height = `${btn.offsetHeight}px`;
    pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    if (!animate) {
      void pill.offsetWidth; // flush so the next change animates again
      pill.style.transition = '';
    }
  }

  // Selection changes → glide. Pages only ever flip the aria attribute.
  new MutationObserver(() => position()).observe(seg, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'aria-selected'],
  });
  // Layout changes (container shown, fonts swapped, window resized) → snap
  // into place without a misleading glide.
  new ResizeObserver(() => position({ animate: false })).observe(seg);

  position({ animate: false });
}

export function enhanceSegs(root = document) {
  for (const seg of root.querySelectorAll('.seg')) enhance(seg);
}

// Enhance everything present now, and anything added later (modal tablists,
// injected pickers) — the observer makes this a fire-and-forget import.
enhanceSegs();
new MutationObserver((muts) => {
  for (const m of muts) {
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches?.('.seg')) enhance(n);
      if (n.querySelectorAll) enhanceSegs(n);
    }
  }
}).observe(document.body, { childList: true, subtree: true });
