// Action menus (the "⋯" buttons). Trigger: [data-menu] whose value is the id
// of a template element containing the menu items. Keyboard + outside-click.

let openMenu = null;
let openTrigger = null;

function close() {
  const trigger = openTrigger;
  // Removing the menu while a menuitem is focused would drop keyboard focus to
  // <body>; hand it back to the trigger (only when the menu actually had it —
  // an outside click must keep its own target focused).
  const hadFocus = openMenu && openMenu.contains(document.activeElement);
  if (openTrigger) {
    openTrigger.setAttribute('aria-expanded', 'false');
    openTrigger = null;
  }
  if (!openMenu) return;
  openMenu.remove();
  openMenu = null;
  if (hadFocus && trigger) trigger.focus();
}

function open(trigger) {
  close();
  const tpl = document.getElementById(trigger.dataset.menu);
  if (!tpl) return;

  const menu = document.createElement('div');
  // z-[68]: menus must clear a modal backdrop (60) when triggered from inside
  // one. See the stacking scale in input.css.
  menu.className = 'card fixed z-[68] min-w-44 p-1 shadow-overlay animate-[menu-in_.12s_ease-out]';
  menu.setAttribute('role', 'menu');
  menu.appendChild(tpl.content.cloneNode(true));
  menu.querySelectorAll('button, a').forEach((el) => {
    el.classList.add('nav-item', 'w-full');
    el.setAttribute('role', 'menuitem');
  });
  document.body.appendChild(menu);

  const r = trigger.getBoundingClientRect();
  const mr = menu.getBoundingClientRect();
  let left = Math.min(r.right - mr.width, window.innerWidth - mr.width - 8);
  let top = r.bottom + 4;
  const flipped = top + mr.height > window.innerHeight - 8;
  if (flipped) top = r.top - mr.height - 4;
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${top}px`;
  // Scale out of the trigger's edge, whichever side the menu landed on.
  menu.style.transformOrigin = flipped ? 'bottom right' : 'top right';

  openMenu = menu;
  openTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  const first = menu.querySelector('[role="menuitem"]');
  if (first) first.focus();
}

// Advertise the popup on every menu trigger so assistive tech announces it.
for (const t of document.querySelectorAll('[data-menu]')) {
  t.setAttribute('aria-haspopup', 'menu');
  if (!t.hasAttribute('aria-expanded')) t.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-menu]');
  if (trigger) {
    e.preventDefault();
    if (openMenu) close();
    else open(trigger);
    return;
  }
  if (!openMenu) return;
  // A click on a menu item performs its action (delegated handlers still run —
  // the event has already been dispatched) and the menu closes itself.
  if (openMenu.contains(e.target)) {
    if (e.target.closest('[role="menuitem"]')) close();
    return;
  }
  close();
});
document.addEventListener('keydown', (e) => {
  if (!openMenu) return;
  if (e.key === 'Escape') {
    close();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const items = [...openMenu.querySelectorAll('[role="menuitem"]')];
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
    items[next].focus();
    e.preventDefault();
  }
});
document.addEventListener('scroll', close, true);
