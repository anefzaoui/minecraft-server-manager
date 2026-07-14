// Custom select. Replaces EVERY native <select> with a styled trigger button
// that opens a searchable modal picker — consistent across OSes and themes.
//
// The native <select> stays in the DOM (hidden) as the source of truth: forms
// submit it, scripts can read .value, and `change` events fire normally.
//
// Enhancement is automatic for all selects; opt out with data-native.
// Options can carry data-desc="secondary line" and data-icon="/path.svg".

import { openModal } from './modal.js';

const SEARCH_THRESHOLD = 6; // show the search box for lists this long or more

function optionData(select) {
  return [...select.options].map((o, index) => ({
    index,
    value: o.value,
    label: o.textContent.trim(),
    desc: o.dataset.desc || '',
    icon: o.dataset.icon || '',
    disabled: o.disabled,
    group: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : null,
  }));
}

function buildTrigger(select, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = (select.className || 'input') + ' msm-select flex items-center gap-2 text-left';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  // Give the trigger an accessible name (the field label) so a screen reader
  // announces "Difficulty, …" rather than just the current value.
  if (label) btn.setAttribute('aria-label', label);
  syncTrigger(select, btn);
  return btn;
}

function syncTrigger(select, btn) {
  const current = select.options[select.selectedIndex];
  btn.innerHTML = `
    <span class="min-w-0 flex-1 truncate">${current ? escapeHtml(current.textContent.trim()) : '<span class="text-ink-faint">Select…</span>'}</span>
    <svg class="icon size-3.5 shrink-0 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
}

function openPicker(select, btn) {
  const options = optionData(select);
  const label = select.dataset.label || select.getAttribute('aria-label') || labelFor(select) || 'Select an option';

  const content = document.createElement('div');
  content.className = 'space-y-2';

  let search = null;
  if (options.length >= SEARCH_THRESHOLD) {
    search = document.createElement('input');
    search.className = 'input';
    search.placeholder = 'Search…';
    search.autocomplete = 'off';
    content.appendChild(search);
  }

  const list = document.createElement('div');
  list.className = 'max-h-80 overflow-y-auto -mx-1 px-1';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', label);
  content.appendChild(list);

  let modal;
  let activeIdx = -1;
  let visible = [];

  function choose(opt) {
    select.value = opt.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    syncTrigger(select, btn);
    modal.close();
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }

  function render(filter = '') {
    const q = filter.trim().toLowerCase();
    visible = options.filter((o) => !q || o.label.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q));
    activeIdx = Math.max(
      0,
      visible.findIndex((o) => o.value === select.value)
    );
    list.innerHTML = '';
    let lastGroup = null;

    if (!visible.length) {
      list.innerHTML = '<div class="p-4 text-center text-sm text-ink-faint">No matches.</div>';
      return;
    }
    for (const [i, opt] of visible.entries()) {
      if (opt.group && opt.group !== lastGroup) {
        lastGroup = opt.group;
        const g = document.createElement('div');
        g.className = 'px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint';
        g.textContent = opt.group;
        list.appendChild(g);
      }
      const row = document.createElement('button');
      row.type = 'button';
      row.disabled = opt.disabled;
      row.dataset.i = i;
      row.id = `msm-opt-${i}`;
      row.className =
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition ' +
        'hover:bg-inset disabled:opacity-40 aria-selected:bg-grass-600/15 aria-selected:text-grass-300';
      row.setAttribute('role', 'option');
      if (opt.value === select.value) row.setAttribute('aria-selected', 'true');
      row.innerHTML = `
        ${opt.icon ? `<img src="${escapeHtml(opt.icon)}" alt="" class="size-6 rounded">` : ''}
        <span class="min-w-0 flex-1">
          <span class="block truncate">${escapeHtml(opt.label)}</span>
          ${opt.desc ? `<span class="block truncate text-xs text-ink-faint">${escapeHtml(opt.desc)}</span>` : ''}
        </span>
        ${opt.value === select.value ? '<svg class="icon size-4 shrink-0 text-grass-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ''}`;
      row.addEventListener('click', () => choose(opt));
      list.appendChild(row);
    }
    highlight();
  }

  function highlight() {
    list.querySelectorAll('[data-i]').forEach((el) => {
      el.classList.toggle('bg-inset', Number(el.dataset.i) === activeIdx);
    });
    const el = list.querySelector(`[data-i="${activeIdx}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
      // Announce the highlighted option to assistive tech during arrow nav.
      list.setAttribute('aria-activedescendant', el.id);
    }
  }

  function onKeydown(e) {
    if (e.key === 'ArrowDown') {
      activeIdx = Math.min(activeIdx + 1, visible.length - 1);
      highlight();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      activeIdx = Math.max(activeIdx - 1, 0);
      highlight();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (visible[activeIdx]) choose(visible[activeIdx]);
      e.preventDefault();
    }
  }

  modal = openModal({ title: label, content, size: 'sm' });
  btn.setAttribute('aria-expanded', 'true');
  modal.el.addEventListener('keydown', onKeydown);
  if (search) search.addEventListener('input', () => render(search.value));
  render();
  if (search) search.focus();
}

function labelFor(select) {
  if (select.id) {
    const l = document.querySelector(`label[for="${select.id}"]`);
    if (l) return l.textContent.trim();
  }
  const wrap = select.closest('div');
  const l = wrap && wrap.querySelector('label, .label');
  return l ? l.textContent.trim() : null;
}

export function enhanceSelect(select) {
  if (select.dataset.native !== undefined || select.dataset.enhanced) return;
  select.dataset.enhanced = '1';
  const label = select.dataset.label || select.getAttribute('aria-label') || labelFor(select) || 'Select an option';
  const btn = buildTrigger(select, label);
  select.classList.add('hidden');
  select.setAttribute('tabindex', '-1');
  select.setAttribute('aria-hidden', 'true');
  select.after(btn);
  btn.addEventListener('click', () => openPicker(select, btn));
  select.addEventListener('change', () => syncTrigger(select, btn));
}

export function enhanceAll(root = document) {
  root.querySelectorAll('select').forEach(enhanceSelect);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
