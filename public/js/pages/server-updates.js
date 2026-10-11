// Per-server Versions tab (#52): which future Minecraft versions this server's
// mods have builds for.
//
// Two deliberate constraints shape this file:
//   1. DOM budget. A 400-mod pack across 30 candidate versions is 12,000 rows.
//      The page ships only one summary row per version; a version's mod lists
//      are fetched when that row is opened, and rendered a page at a time.
//   2. Progress outlives the page. A scan's state lives in the database, so
//      polling GET /compat picks up a scan started before a refresh, or one
//      still running after the panel restarted (which reports as interrupted
//      and offers to resume).

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { withBusy } from '../lib/loading.js';
import { confirmDialog } from '../lib/confirm.js';
import { runTask } from '../lib/progress.js';

const PAGE = 50; // mod rows rendered per "Show more" click
const OTHER = '__other'; // the loader picker's "Other build…" option

// Module state is declared before anything can run, and the entry point is the
// LAST statement in the file: init() starts polling straight away when the page
// loads mid-scan, and a `let` declared further down would still be in its
// temporal dead zone at that moment. The bundler turns these into `var` and
// hides it; a dev run serving the raw source does not.
let pollTimer = null;

function init(el) {
  const serverId = el.dataset.compatServer;
  const scanBtn = document.getElementById('compat-scan');

  scanBtn?.addEventListener('click', () =>
    withBusy(scanBtn, async () => {
      try {
        const res = await fetch(`/api/servers/${serverId}/compat/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || friendlyError(res, { action: 'start the version check' }));
        }
        toast('Checking which Minecraft versions your mods support…');
        apply(data);
        poll(serverId);
      } catch (err) {
        toast(err.message || friendlyError(err, { action: 'start the version check' }), { kind: 'error' });
      }
    })
  );

  document.getElementById('compat-versions')?.addEventListener('toggle', onToggle.bind(null, serverId), true);

  if (el.dataset.compatStatus === 'running') poll(serverId);
}

// ---- Polling ----------------------------------------------------------------

function poll(serverId) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/servers/${serverId}/compat`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) {
        apply(data);
        if (data.status === 'running') return poll(serverId);
        // A finished scan changes the summary card, the notices and the whole
        // version list at once - one reload is both simpler and more honest
        // than half-updating the page around the user.
        location.reload();
        return;
      }
    } catch {
      /* a dropped poll is not worth a toast - the next one retries */
    }
    poll(serverId);
  }, 1500);
}

function apply(state) {
  const box = document.getElementById('compat-progress');
  const phase = document.getElementById('compat-phase');
  const count = document.getElementById('compat-count');
  const bar = document.getElementById('compat-bar');
  if (!box) return;
  const running = state.status === 'running';
  box.classList.toggle('hidden', !running);
  if (!running) return;
  if (phase) phase.textContent = state.phaseLabel || 'Starting…';
  if (count) count.textContent = `${state.done || 0}/${state.total || 0}`;
  if (bar) bar.style.width = state.total ? `${Math.round(((state.done || 0) / state.total) * 100)}%` : '0%';
}

// ---- Per-version mod lists --------------------------------------------------

async function onToggle(serverId, e) {
  const details = e.target.closest('details[data-compat-version]');
  if (!details || !details.open || details.dataset.loaded === 'true') return;
  details.dataset.loaded = 'true';
  const body = details.querySelector('[data-compat-body]');
  const version = details.dataset.compatVersion;
  try {
    const res = await fetch(`/api/servers/${serverId}/compat/versions/${encodeURIComponent(version)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false)
      throw new Error(data.error || friendlyError(res, { action: 'load that version' }));
    render(body, data.version, data.unknown || [], data.unchecked || []);
  } catch (err) {
    details.dataset.loaded = 'false'; // let a retry re-fetch
    body.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'text-xs text-danger';
    p.textContent = err.message || friendlyError(err, { action: 'load that version' });
    body.append(p);
  }
}

function render(body, version, unknown, unchecked) {
  body.innerHTML = '';
  if (version.missingCount) {
    body.append(
      section(`No build for ${version.version}`, version.missing, 'danger', 'These mods would be left behind.')
    );
  }
  if (unknown.length) {
    body.append(
      section(
        'Could not be identified',
        unknown,
        'warn',
        'Neither registry recognises these files, so what they support is unknown.'
      )
    );
  }
  if (unchecked.length) {
    body.append(
      section(
        'Could not be checked',
        unchecked,
        'warn',
        'These come from a source that publishes no per-version build list, so nobody can say either way.'
      )
    );
  }
  if (version.readyCount) {
    body.append(section(`Ready for ${version.version}`, version.ready, 'ok', null, { collapsed: true }));
  }
  if (!version.missingCount && !version.readyCount && !unknown.length && !unchecked.length) {
    const p = document.createElement('p');
    p.className = 'text-xs text-ink-faint';
    p.textContent = 'This server has no mods to check.';
    body.append(p);
  }
}

/**
 * One labelled block of mods. Long lists render `PAGE` at a time behind a
 * "Show more" button - the blocking list is usually short, but the ready list
 * on a large pack is not, and it is the one nobody scrolls.
 */
function section(title, items, tone, help, { collapsed = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'mb-3 last:mb-0';

  const head = document.createElement('div');
  head.className = 'mb-1 flex flex-wrap items-center gap-2';
  const badge = document.createElement('span');
  badge.className = `badge badge-${tone}`;
  badge.textContent = String(items.length);
  const label = document.createElement('span');
  label.className = 'text-sm font-medium';
  label.textContent = title;
  head.append(badge, label);
  wrap.append(head);

  if (help) {
    const p = document.createElement('p');
    p.className = 'mb-2 text-xs text-ink-faint';
    p.textContent = help;
    wrap.append(p);
  }

  const list = document.createElement('ul');
  list.className = 'grid gap-1 text-xs sm:grid-cols-2';
  if (collapsed) list.classList.add('hidden');
  wrap.append(list);

  let shown = 0;
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'btn btn-ghost btn-sm mt-2';
  const showNext = () => {
    const next = items.slice(shown, shown + PAGE);
    for (const item of next) {
      const li = document.createElement('li');
      li.className = 'truncate';
      li.title = item.file;
      li.textContent = item.name || item.file;
      list.append(li);
    }
    shown += next.length;
    more.textContent = `Show More (${items.length - shown} left)`;
    more.classList.toggle('hidden', shown >= items.length);
  };
  more.addEventListener('click', showNext);

  if (collapsed) {
    const reveal = document.createElement('button');
    reveal.type = 'button';
    reveal.className = 'btn btn-ghost btn-sm';
    reveal.textContent = 'Show These Mods';
    reveal.addEventListener('click', () => {
      reveal.remove();
      list.classList.remove('hidden');
      showNext();
      wrap.append(more);
    });
    wrap.append(reveal);
  } else {
    showNext();
    wrap.append(more);
  }
  return wrap;
}

// ---- Loader version ---------------------------------------------------------

/**
 * The Loader Version card: fill the picker from the registry's build list,
 * show the build-number box for "Other build…", and apply the choice as a
 * task (backup, then rebuild). The server checks that a typed build exists.
 */
function initLoaderCard(card) {
  const select = document.getElementById('loader-select');
  const customWrap = document.getElementById('loader-custom-wrap');
  const custom = document.getElementById('loader-custom');
  const apply = document.getElementById('loader-apply');
  if (!select || !apply) return; // no permission to change it: the card is read-only
  const { serverId, loader, loaderName, loaderSource, loaderMc: mc, loaderPinned: pinned } = card.dataset;

  const chosen = () => (select.value === OTHER ? custom.value.trim() : select.value);
  const sync = () => {
    customWrap.classList.toggle('hidden', select.value !== OTHER);
    apply.disabled = select.value === OTHER ? !custom.value.trim() : chosen() === pinned;
  };
  select.addEventListener('change', () => {
    sync();
    if (select.value === OTHER) custom.focus();
  });
  custom.addEventListener('input', sync);
  custom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !apply.disabled) apply.click();
  });
  apply.addEventListener('click', () =>
    withBusy(apply, () => changeLoader({ serverId, name: loaderName, source: loaderSource, version: chosen(), pinned }))
  );
  fillBuilds(select, { loader, mc, pinned });
  sync();
}

async function fillBuilds(select, { loader, mc, pinned }) {
  let builds = [];
  try {
    const qs = new URLSearchParams({ loader, ...(mc ? { mc } : {}) });
    const res = await fetch(`/api/loaders/versions?${qs}`);
    const data = await res.json();
    // The registry's "Latest" entry is '' - the card's own first option covers it.
    if (res.ok && data.ok) builds = (data.builds || []).filter((b) => b.version);
  } catch {
    // Registry unreachable: the default, the current pin and "Other build…" still work.
  }
  if (!builds.length) return;
  const other = select.querySelector(`option[value="${OTHER}"]`);
  for (const opt of [...select.options]) if (opt.value && opt.value !== OTHER) opt.remove();
  // A pin older than the list's cap stays selectable, at the top.
  if (pinned && !builds.some((b) => b.version === pinned)) builds.unshift({ version: pinned, label: pinned });
  for (const b of builds) select.insertBefore(new Option(b.label, b.version), other);
  select.value = pinned || '';
  select.dispatchEvent(new Event('change', { bubbles: true })); // resyncs the enhanced trigger
}

/** POST the loader change; `dryRun` only checks it. Throws the server's message. */
async function postLoaderVersion(serverId, body) {
  const res = await fetch(`/api/servers/${serverId}/loader-version`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || friendlyError(res, { action: 'change the loader version' }));
  }
  return data;
}

async function changeLoader({ serverId, name, source, version, pinned }) {
  const fallback = source === 'curseforge' ? `the modpack's ${name} version` : `the default ${name} version`;
  const target = version ? `${name} ${version}` : fallback;
  // Check the build before asking to back up and rebuild for it: a build that
  // doesn't exist is refused here, with the closest real one named.
  try {
    await postLoaderVersion(serverId, { version, dryRun: true });
  } catch (err) {
    toast(err.message, { kind: 'error', timeout: 12000 });
    return;
  }
  const ok = await confirmDialog({
    title: `Switch to ${target}?`,
    message: pinned
      ? `This server moves from ${name} ${pinned} to ${target}. A backup is taken first, then the server is rebuilt with it.`
      : `A backup is taken first, then the server is rebuilt with ${target}.`,
    detail: 'The server is briefly offline while it is rebuilt.',
    confirmLabel: 'Change Version',
  });
  if (!ok) return;
  try {
    await runTask({
      title: `Changing the ${name} version…`,
      start: async () => (await postLoaderVersion(serverId, { version })).taskId,
    });
    toast(`Switched to ${target}.`);
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || friendlyError(err, { action: 'change the loader version' }), {
      kind: 'error',
      timeout: 12000,
    });
  }
}

const root = document.querySelector('[data-compat-server]');
if (root) init(root);
const loaderCard = document.getElementById('loader-card');
if (loaderCard) initLoaderCard(loaderCard);
