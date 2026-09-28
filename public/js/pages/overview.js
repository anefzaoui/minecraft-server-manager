// Overview tab: keep the "Live usage" card actually live. Subscribes to the
// same stats WebSocket the Metrics tab uses; without this the card showed the
// values from page load under a "Live" heading, forever.
//
// Plus the Software & Version change flows (same endpoints as the Versions
// tab: POST /api/servers/:id/type/change for software, POST
// /api/servers/:id/mcversion/upgrade for versions, both task-backed).

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { runTask } from '../lib/progress.js';
import { escapeHtml } from '../lib/format.js';

const card = document.querySelector('[data-ov-live]');
if (card && card.dataset.running === '1') init(card);

const softCard = document.querySelector('[data-ov-software]');
if (softCard) initSoftwareCard(softCard);

function init(card) {
  const serverId = card.dataset.ovLive;
  const memLimit = Number(card.dataset.memLimit) || 0;
  const cpus = Number(card.dataset.cpus) || 0;
  const cpuLabel = card.querySelector('[data-ov-cpu-label]');
  const cpuBar = card.querySelector('[data-ov-cpu-bar]');
  const memLabel = card.querySelector('[data-ov-mem-label]');
  const memBar = card.querySelector('[data-ov-mem-bar]');

  const METER = ['bg-grass-500', 'bg-gold-400', 'bg-redstone-500'];
  function paint(bar, pct) {
    bar.style.width = `${Math.min(100, Math.round(pct))}%`;
    bar.classList.remove(...METER);
    bar.classList.add(pct >= 95 ? METER[2] : pct >= 80 ? METER[1] : METER[0]);
  }

  let ws = null;
  let delay = 5000;
  function connect() {
    if (document.hidden) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/stats/${serverId}`);
    ws.addEventListener('open', () => {
      delay = 5000;
    });
    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.kind !== 'stats') return;
      const memUsedMb = Math.round(msg.memUsedBytes / 1024 / 1024);
      cpuLabel.textContent = `${msg.cpuPct}%${cpus ? ` of ${cpus} cores` : ''}`;
      paint(cpuBar, (msg.cpuPct / (cpus ? cpus * 100 : 100)) * 100);
      if (memLimit) {
        memLabel.textContent = `${memUsedMb} / ${memLimit} MB`;
        paint(memBar, (memUsedMb / memLimit) * 100);
      } else {
        memLabel.textContent = `${memUsedMb} MB`;
      }
    });
    ws.addEventListener('close', () => {
      if (document.hidden) return;
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, 30000);
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ws?.close();
    else {
      delay = 5000;
      connect();
    }
  });
  connect();
}

// ---- Software & version changes -------------------------------------------
// The card only renders its Change buttons for accounts holding the `settings`
// capability (and never for modpack servers), so no extra gating here.

function initSoftwareCard(card) {
  const serverId = card.dataset.serverId;
  const serverName = card.dataset.serverName || 'this server';
  const currentType = card.dataset.type;
  const currentMc = card.dataset.mc;
  let softTypes = [];
  try {
    softTypes = JSON.parse(card.querySelector('[data-ov-soft-types]')?.textContent || '[]');
  } catch {
    softTypes = [];
  }

  card.querySelector('[data-ov-change-type]')?.addEventListener('click', openTypePicker);
  card.querySelector('[data-ov-change-version]')?.addEventListener('click', openVersionPicker);

  function openTypePicker() {
    const options = softTypes.filter((t) => t.value !== currentType);
    if (!options.length) {
      toast('There is no other software to switch to.', { kind: 'info' });
      return;
    }
    const modal = openModal({
      title: 'Change Software',
      size: 'sm',
      content: `
        <div class="space-y-3 text-sm">
          <div>
            <label class="label" for="ov-soft-select">New software</label>
            <select class="input" id="ov-soft-select" data-label="New software">
              ${options.map((t) => `<option value="${escapeHtml(t.value)}">${escapeHtml(t.label)}</option>`).join('')}
            </select>
            <p class="help" data-soft-desc></p>
          </div>
          <p class="text-xs text-ink-faint">The server restarts on the new software. A backup is taken first, and mods built for the old software stay in the folder, so remove or update them afterwards.</p>
        </div>`,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Continue',
          kind: 'primary',
          onClick: async (ctx) => {
            const value = ctx.body.querySelector('#ov-soft-select')?.value;
            const picked = options.find((t) => t.value === value);
            if (!picked) {
              toast('Pick a software first.', { kind: 'error' });
              return false;
            }
            ctx.close();
            await confirmTypeChange(picked);
          },
        },
      ],
    });
    const sel = modal.body.querySelector('#ov-soft-select');
    const desc = modal.body.querySelector('[data-soft-desc]');
    const paint = () => {
      const picked = options.find((t) => t.value === sel.value);
      if (desc) desc.textContent = picked?.desc || '';
    };
    sel?.addEventListener('change', paint);
    paint();
  }

  async function confirmTypeChange(picked) {
    const ok = await confirmDialog({
      title: 'Change the software?',
      message: `${serverName} moves from ${labelOf(currentType)} to ${picked.label}. A backup is taken first.`,
      detail: 'The server is briefly offline while the container is rebuilt for the new software.',
      confirmLabel: 'Change Now',
    });
    if (!ok) return;
    try {
      const result = await runTask({
        title: `Changing ${serverName} to ${picked.label}…`,
        start: async () =>
          (await postJSON(`/api/servers/${serverId}/type/change`, { targetType: picked.value })).taskId,
      });
      toast(`Software changed: ${result.from} → ${result.to}.`);
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      if (err.dismissed) return; // creation continues server-side - task tray takes over
      toast(err.message || 'The software could not be changed. Please try again.', {
        kind: 'error',
        timeout: 12000,
      });
    }
  }

  function labelOf(type) {
    return softTypes.find((t) => t.value === type)?.label || type;
  }

  async function openVersionPicker() {
    const modal = openModal({
      title: 'Change Version',
      size: 'sm',
      content: '<p class="text-sm text-ink-faint">Loading versions…</p>',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Continue',
          kind: 'primary',
          onClick: async (ctx) => {
            const value = ctx.body.querySelector('#ov-version-select')?.value;
            if (!value) {
              toast('The version list could not be loaded. Please try again.', { kind: 'error' });
              return false;
            }
            if (value === currentMc) {
              toast(`This server already runs Minecraft ${currentMc}.`, { kind: 'info' });
              return false;
            }
            ctx.close();
            await confirmVersionChange(value);
          },
        },
      ],
    });
    try {
      const res = await fetch(`/api/versions?snapshots=true`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'load the version list' }));
      const versions = data.versions || [];
      const releases = versions.filter((v) => v.type === 'release');
      const snapshots = versions.filter((v) => v.type === 'snapshot');
      const group = (label, list) =>
        list.length
          ? `<optgroup label="${escapeHtml(label)}">${list.map((v) => `<option value="${escapeHtml(v.id)}"${v.id === currentMc ? ' selected' : ''}>${escapeHtml(v.id)}</option>`).join('')}</optgroup>`
          : '';
      modal.body.innerHTML = `
        <div class="space-y-3 text-sm">
          <div>
            <label class="label" for="ov-version-select">New version (running ${escapeHtml(currentMc)})</label>
            <select class="input font-mono" id="ov-version-select" data-label="New version">
              ${group('Releases', releases)}${group('Snapshots', snapshots)}
            </select>
          </div>
          <p class="text-xs text-ink-faint">A backup is taken first, but upgrading the world is permanent. Moving to an older version is a downgrade and destroys world data, so the panel asks twice before doing one. Modded servers only move when every mod has a build for the new version.</p>
        </div>`;
    } catch (err) {
      modal.body.innerHTML = `<p class="text-sm text-danger">${escapeHtml(err.message || 'The version list could not be loaded.')}</p>`;
    }
  }

  async function confirmVersionChange(target) {
    const ok = await confirmDialog({
      title: 'Update the Minecraft version?',
      message: `${serverName} moves from Minecraft ${currentMc} to ${target}. A backup is taken first, but upgrading the world is permanent.`,
      detail: 'The server is briefly offline while the container is rebuilt.',
      confirmLabel: 'Update Now',
    });
    if (!ok) return;
    await runVersionUpgrade({ targetVersion: target });
  }

  async function runVersionUpgrade({ targetVersion, force = false }) {
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
      if (downgrade && !force) return offerDowngradeForce({ targetVersion }, downgrade, err.message);
      const compat = err.data && err.data.compat;
      if (compat && !force) return offerForce({ targetVersion }, compat, err.message);
      toast(err.message || 'The update could not be completed. Please try again.', {
        kind: 'error',
        timeout: 12000,
      });
    }
  }

  // The target is older than the running version: the older jar cannot read
  // the newer chunks and regenerates them as void. Name that plainly, and let
  // the downgrade through only on a second, explicit confirmation.
  async function offerDowngradeForce(ctx, downgrade, message) {
    const ok = await confirmDialog({
      title: 'This is a downgrade and it will destroy the world.',
      message: `${message} The damage saves over your builds as soon as the older version runs.`,
      detail:
        'A backup is taken first, but it holds the newer world: it only helps if you switch back to the newer version afterwards. Only continue if that is what you mean to do.',
      confirmLabel: 'Downgrade Anyway',
      danger: true,
    });
    if (!ok) return;
    await runVersionUpgrade({ ...ctx, force: true });
  }

  // The mods can't follow this Minecraft version. Name them, point at the
  // server's own Versions tab, and let the update through only on a second,
  // explicit confirmation.
  async function offerForce(ctx, compat, message) {
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
    await runVersionUpgrade({ ...ctx, force: true });
  }
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || friendlyError(res, { action: 'start that change' }));
    // Structured refusals (e.g. a Minecraft version the mods can't follow)
    // carry their detail in the body - keep it for the caller to render.
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}
