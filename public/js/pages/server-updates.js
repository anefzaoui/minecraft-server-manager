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

  // Update buttons live in the summary rows: stop the click from also
  // toggling the row open.
  document.getElementById('compat-versions')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-compat-update]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    confirmUpdateTo(btn.dataset.compatUpdate);
  });

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
  if (version.readyCount) {
    body.append(section(`Ready for ${version.version}`, version.ready, 'ok'));
  }
  // One "not ready" list instead of three thin sections: a mod either has no
  // build for the version or no registry could say - the per-row chip keeps
  // which is which.
  const notReady = [
    ...version.missing.map((m) => ({ ...m, sub: 'No build' })),
    ...unknown.map((m) => ({ ...m, sub: 'Unknown' })),
    ...unchecked.map((m) => ({ ...m, sub: 'Unknown' })),
  ];
  if (notReady.length) {
    body.append(
      section(
        `Not ready for ${version.version}`,
        notReady,
        version.missingCount ? 'danger' : 'warn',
        'These mods have no build for this version, or no registry could say.'
      )
    );
  }
  if (!version.missingCount && !version.readyCount && !unknown.length && !unchecked.length) {
    const p = document.createElement('p');
    p.className = 'text-xs text-ink-faint';
    p.textContent = 'This server has no mods to check.';
    body.append(p);
  }
}

async function confirmUpdateTo(target) {
  const serverId = root.dataset.compatServer;
  const serverName = root.dataset.compatServerName || 'this server';
  const current = root.dataset.compatCurrent;
  const ok = await confirmDialog({
    title: `Update to Minecraft ${target}?`,
    message: `${serverName} moves from Minecraft ${current} to ${target}. A backup is taken first, but upgrading the world is permanent.`,
    detail: 'The server is briefly offline while the container is rebuilt.',
    confirmLabel: 'Update Now',
  });
  if (!ok) return;
  await runVersionUpgrade(serverId, serverName, target);
}

async function runVersionUpgrade(serverId, serverName, targetVersion, { force = false } = {}) {
  try {
    const result = await runTask({
      title: `Updating ${serverName}…`,
      start: async () =>
        (
          await postJSON(`/api/servers/${serverId}/mcversion/upgrade`, {
            targetVersion,
            force: force || undefined,
          })
        ).taskId,
    });
    toast(`Updated: ${result.from} → ${result.to}.`);
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    const downgrade = err.data && err.data.downgrade;
    if (downgrade && !force) return offerDowngradeForce(serverId, serverName, targetVersion, downgrade, err.message);
    const compat = err.data && err.data.compat;
    if (compat && !force) return offerForce(serverId, serverName, targetVersion, compat, err.message);
    toast(err.message || 'The update could not be completed. Please try again.', {
      kind: 'error',
      timeout: 12000,
    });
  }
}

// The mods can't follow this Minecraft version. Name them, and let the update
// through only on a second, explicit confirmation.
async function offerForce(serverId, serverName, targetVersion, compat, message) {
  const names = (compat.missing || []).map((m) => m.name || m.file);
  const shown = names.slice(0, 8).join(', ');
  const rest = names.length > 8 ? ` and ${names.length - 8} more` : '';
  const detail = names.length
    ? `Without a build for ${compat.targetVersion}: ${shown}${rest}.`
    : "Open the server's Versions tab to run a version check.";
  const known = compat.reason === 'blocked';
  const ok = await confirmDialog({
    title: known ? 'Your mods are not ready for this version.' : 'This version has not been checked.',
    message: known
      ? `${message} Updating anyway will start the server without them.`
      : `${message} Updating anyway means doing it without knowing what would break.`,
    detail,
    confirmLabel: 'Update Anyway',
    danger: true,
  });
  if (!ok) return;
  await runVersionUpgrade(serverId, serverName, targetVersion, { force: true });
}

// The target is older than the running version: the older jar cannot read the
// newer chunks and regenerates them as void.
async function offerDowngradeForce(serverId, serverName, targetVersion, downgrade, message) {
  const ok = await confirmDialog({
    title: 'This is a downgrade and it will destroy the world.',
    message: `${message} The damage saves over your builds as soon as the older version runs.`,
    detail:
      'A backup is taken first, but it holds the newer world: it only helps if you switch back to the newer version afterwards. Only continue if that is what you mean to do.',
    confirmLabel: 'Downgrade Anyway',
    danger: true,
  });
  if (!ok) return;
  await runVersionUpgrade(serverId, serverName, targetVersion, { force: true });
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || friendlyError(res, { action: 'start that update' }));
    // Structured refusals carry their detail in the body - keep it for the caller.
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

/**
 * One labelled block of mods. Long lists render `PAGE` at a time behind a
 * "Show more" button - the blocking list is usually short, but the ready list
 * on a large pack is not, and it is the one nobody scrolls.
 */
function section(title, items, tone, help) {
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
  list.className = 'grid gap-1.5 text-xs';
  wrap.append(list);

  const PUZZLE =
    '<svg class="icon size-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/></svg>';

  let shown = 0;
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'btn btn-ghost btn-sm mt-2';
  const showNext = () => {
    const next = items.slice(shown, shown + PAGE);
    for (const item of next) {
      const li = document.createElement('li');
      li.className = 'flex min-w-0 items-center gap-2.5 rounded-md border border-line bg-raised p-2';
      li.title = item.file || item.name || '';
      const iconBox = document.createElement('span');
      iconBox.className =
        'relative grid size-9 shrink-0 place-items-center overflow-hidden rounded bg-inset text-ink-faint';
      if (item.iconUrl) {
        iconBox.innerHTML = PUZZLE;
        const img = document.createElement('img');
        img.src = item.iconUrl;
        img.alt = '';
        img.loading = 'lazy';
        img.className = 'absolute inset-0 h-full w-full object-cover';
        img.onerror = () => img.remove();
        iconBox.append(img);
      } else {
        iconBox.innerHTML = PUZZLE;
      }
      const text = document.createElement('span');
      text.className = 'min-w-0 flex-1';
      const name = document.createElement('span');
      name.className = 'block truncate text-sm font-medium';
      name.textContent = item.name || item.file;
      const file = document.createElement('span');
      file.className = 'block truncate font-mono text-[11px] text-ink-faint';
      file.textContent = item.file || '';
      text.append(name, file);
      li.append(iconBox, text);
      if (item.sub) {
        const sub = document.createElement('span');
        sub.className = 'badge shrink-0';
        sub.textContent = item.sub;
        li.append(sub);
      }
      if (item.installedVersion) {
        const ver = document.createElement('span');
        ver.className = 'shrink-0 font-mono text-[11px] text-ink-faint';
        ver.textContent = item.installedVersion;
        li.append(ver);
      }
      list.append(li);
    }
    shown += next.length;
    more.textContent = `Show More (${items.length - shown} left)`;
    more.classList.toggle('hidden', shown >= items.length);
  };
  more.addEventListener('click', showNext);

  showNext();
  wrap.append(more);
  return wrap;
}

const root = document.querySelector('[data-compat-server]');
if (root) init(root);
