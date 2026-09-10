// Per-server Worlds tab: snapshot/upload, install from library, and per-world
// actions (activate, download, duplicate, copy-to, rename, reset, delete).
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { runTask } from '../lib/progress.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { escapeHtml } from '../lib/format.js';
import {
  serverOptions,
  fmtBytes,
  postJSON,
  uploadWorldModal,
  extractWorldModal,
  installWorldModal,
  installWithConfirm,
} from './worlds.js';

const root = document.querySelector('[data-worlds-server]');
if (root) init(root.dataset.worldsServer, root.dataset.worldsServerName, root.dataset.worldsStatus);

function init(serverId, serverName, serverStatus) {
  const base = `/api/servers/${serverId}/worlds`;
  const reload = () => setTimeout(() => location.reload(), 700);
  const isRunning = ['running', 'starting', 'unhealthy', 'stalled'].includes(serverStatus);

  // ---- Header actions ----
  document.getElementById('worlds-extract')?.addEventListener('click', () => {
    extractWorldModal({ serverId, onDone: reload });
  });
  document.getElementById('worlds-upload')?.addEventListener('click', () => {
    uploadWorldModal({ onDone: reload });
  });

  // ---- Library section: install here ----
  document.querySelectorAll('[data-lib-row]').forEach((row) => {
    row.querySelector('[data-lib-install]')?.addEventListener('click', () => {
      installWorldModal(row.dataset.id, row.dataset.name, { serverId, onDone: reload });
    });
  });

  // ---- Per-world actions ----
  document.getElementById('server-worlds-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-world-row]');
    if (!row) return;
    const world = row.dataset.world;
    const size = row.dataset.size;

    if (e.target.closest('[data-world-activate]')) {
      const btn = e.target.closest('[data-world-activate]');
      const ok = await confirmDialog({
        title: `Activate "${world}"?`,
        message: `The server will load "${world}" on its next start.${isRunning ? ' The server must be stopped first.' : ''}`,
        confirmLabel: 'Activate',
      });
      if (!ok) return;
      const res = await withBusy(btn, () => postJSON(`${base}/activate`, { world }));
      if (res) {
        toast(`"${world}" is now the active world. It loads on the next start.`);
        reload();
      }
    } else if (e.target.closest('[data-world-download]')) {
      // Navigation download - no completion event exists, so busy the button
      // for the snapshot-prep window instead of leaving a dead-looking click.
      const dlBtn = e.target.closest('[data-world-download]');
      toast('Preparing a consistent snapshot. The download starts when it is ready…', { kind: 'info', timeout: 8000 });
      const restore = setBusy(dlBtn, 'Preparing…');
      setTimeout(restore, 8000);
      location.href = `${base}/${encodeURIComponent(world)}/download`;
    } else if (e.target.closest('[data-world-duplicate]')) {
      const btn = e.target.closest('[data-world-duplicate]');
      const ok = await confirmDialog({
        title: `Duplicate "${world}"?`,
        message: 'Makes a full copy of this world, including every dimension, on this server.',
        detail: `Needs ~${fmtBytes(size)} of additional disk space.`,
        confirmLabel: 'Duplicate',
      });
      if (!ok) return;
      const res = await withBusy(btn, () => postJSON(`${base}/duplicate`, { world }));
      if (res) {
        toast(`Duplicated as "${res.name}" (${fmtBytes(res.sizeBytes)}).`);
        reload();
      }
    } else if (e.target.closest('[data-world-copy]')) {
      copyToModal(world);
    } else if (e.target.closest('[data-world-rename]')) {
      renameModal(world);
    } else if (e.target.closest('[data-world-shrink]')) {
      shrinkModal(world);
    } else if (e.target.closest('[data-world-reset]')) {
      resetModal(world, size);
    } else if (e.target.closest('[data-world-delete]')) {
      const btn = e.target.closest('[data-world-delete]');
      const ok = await confirmDialog({
        title: `Delete world "${world}"?`,
        message: 'Removes this world and all of its dimensions from the server. It is not the active world.',
        detail: `${fmtBytes(size)} will be freed. No automatic backup is taken for worlds that aren't active.`,
        confirmLabel: 'Delete World',
        danger: true,
        requireText: world,
      });
      if (!ok) return;
      const restore = setBusy(btn);
      try {
        const res = await fetch(`${base}/${encodeURIComponent(world)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok !== false) {
          toast(`World "${world}" deleted (${fmtBytes(data.freedBytes)} freed).`);
          reload();
        } else {
          toast(data.error || friendlyError(res, { action: 'delete that world' }), { kind: 'error' });
        }
      } finally {
        restore();
      }
    }
  });

  // ---- Copy to another server ----
  function copyToModal(world) {
    const targets = serverOptions().filter((s) => s.id !== serverId);
    if (!targets.length) return toast('No other servers to copy to.', { kind: 'info' });

    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Target server</label>
      <select class="input" data-c-target data-label="Copy world to server">
        ${targets.map((s) => `<option value="${escapeHtml(s.id)}" data-desc="${escapeHtml(s.flavor)} · ${escapeHtml(s.status)}">${escapeHtml(s.name)}</option>`).join('')}
      </select>
      <label class="label mt-3">Install mode on the target</label>
      <select class="input" data-c-mode data-label="Install mode">
        <option value="replace" data-desc="Target must be stopped. Its current world is backed up first.">Replace target's world</option>
        <option value="alongside" data-desc="Adds it next to the target's worlds. Activate it later.">Install alongside</option>
      </select>
      <div class="mt-3 hidden" data-c-namewrap>
        <label class="label">World folder name on the target</label>
        <input class="input" data-c-name value="${escapeHtml(world)}" autocomplete="off">
      </div>
      <p class="help">Works while this server is running. The panel takes a consistent snapshot, then installs it on the target through the library.</p>
      <div class="mt-3 hidden" data-c-progress><div class="meter meter-indeterminate"><div class="bg-grass-500" style="width:25%"></div></div></div>`;

    const mode = content.querySelector('[data-c-mode]');
    mode.addEventListener('change', () => {
      content.querySelector('[data-c-namewrap]').classList.toggle('hidden', mode.value !== 'alongside');
    });

    openModal({
      title: `Copy "${world}" to Another Server`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Copy World',
          kind: 'primary',
          busyLabel: 'Copying…',
          onClick: async () => {
            const body = {
              targetServerId: content.querySelector('[data-c-target]').value,
              mode: mode.value,
            };
            if (mode.value === 'alongside') {
              body.newName = content.querySelector('[data-c-name]').value.trim();
              if (!body.newName) {
                toast('Give the copied world a folder name.', { kind: 'error' });
                return false;
              }
            }
            content.querySelector('[data-c-progress]').classList.remove('hidden');
            const done = await installWithConfirm(`${base}/copy-to`, body);
            if (!done) {
              content.querySelector('[data-c-progress]').classList.add('hidden');
              return false;
            }
            toast(`World copied and installed as "${done.installedAs}" (${fmtBytes(done.sizeBytes)}).`);
            reload();
          },
        },
      ],
    });
  }

  // ---- Rename ----
  function renameModal(world) {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">New name for "${escapeHtml(world)}"</label>
      <input class="input" data-r-name value="${escapeHtml(world)}" autocomplete="off">
      <p class="help">The server must be stopped. Every dimension folder is renamed too, and if this is the active world, the server is pointed at the new name.</p>`;
    const modal = openModal({
      title: 'Rename World',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Rename',
          kind: 'primary',
          onClick: async () => {
            const newName = content.querySelector('[data-r-name]').value.trim();
            if (!newName || newName === world) return false;
            const res = await postJSON(`${base}/rename`, { world, newName });
            if (!res) return false;
            toast(`World renamed to "${res.name}".`);
            reload();
          },
        },
      ],
    });
    modal.body.querySelector('[data-r-name]').focus();
  }

  // ---- Shrink (remove rarely-visited chunks) ----
  function shrinkModal(world) {
    const content = document.createElement('div');
    content.innerHTML = `
      <p class="text-sm">This removes parts of <b>${escapeHtml(world)}</b> that players have barely
        spent time in, so the world takes less space on disk. Minecraft rebuilds a removed area from
        the seed the next time someone travels there.</p>
      <p class="help mt-2"><b>Back up first</b>. Anything a player built but barely stood in would be
        removed too.</p>
      <div class="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="sh-secs">Remove chunks visited under</label>
          <div class="flex items-center gap-1.5">
            <input class="input w-20" id="sh-secs" type="number" min="1" max="3600" value="30">
            <span class="text-sm text-ink-faint">seconds</span>
          </div>
        </div>
        <div>
          <label class="label" for="sh-keep">Always keep spawn (chunks)</label>
          <input class="input w-24" id="sh-keep" type="number" min="0" max="256" value="8">
        </div>
      </div>
      ${
        isRunning
          ? `<label class="notice notice-warn mt-3 flex items-center gap-2 text-sm">
               <input type="checkbox" class="msm-check" id="sh-wrap">
               The server is running, so stop it, shrink the world, then start it again.
             </label>`
          : '<p class="help mt-2">The server is stopped, so the shrink runs directly.</p>'
      }
      <div class="mt-3 hidden rounded-md border border-line bg-inset/40 px-3 py-2 text-sm" data-sh-result></div>`;
    const resultEl = content.querySelector('[data-sh-result]');
    const opts = () => {
      const secs = Math.max(1, Math.min(3600, Number(content.querySelector('#sh-secs').value) || 30));
      const keep = Math.max(0, Math.min(256, Number(content.querySelector('#sh-keep').value) || 0));
      return { minInhabitedTicks: secs * 20, spawnKeepChunks: keep };
    };

    openModal({
      title: `Shrink "${world}"`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Preview',
          kind: 'ghost',
          busyLabel: 'Checking…',
          onClick: async () => {
            // A dry run never touches the server, so it works while it's running too.
            const res = await postJSON(`${base}/${encodeURIComponent(world)}/shrink`, { dryRun: true, ...opts() });
            if (!res) return false;
            resultEl.classList.remove('hidden');
            const dims =
              Array.isArray(res.dimensions) && res.dimensions.length > 1
                ? ` across ${res.dimensions.length} dimensions`
                : '';
            const unreadable = res.chunksUnreadable
              ? ` ${res.chunksUnreadable.toLocaleString()} chunk(s) could not be read (unsupported compression) and will be kept.`
              : '';
            resultEl.textContent = res.chunksRemoved
              ? `About ${res.chunksRemoved.toLocaleString()} chunks (~${fmtBytes(res.bytesFreed)}) would be removed, from ${res.regionsScanned} region file(s)${dims}.${unreadable}`
              : `Nothing to remove: every chunk in this world has been visited long enough.${unreadable}`;
            return false; // keep the modal open
          },
        },
        {
          label: 'Shrink World',
          kind: 'primary',
          busyLabel: 'Shrinking…',
          onClick: async () => {
            const wrap = isRunning && content.querySelector('#sh-wrap')?.checked;
            if (isRunning && !wrap) {
              toast('Tick the stop-and-restart option, or stop the server first.', { kind: 'error' });
              return false;
            }
            try {
              const r = await runTask({
                title: `Shrinking "${world}"…`,
                start: () =>
                  postJSON(`${base}/${encodeURIComponent(world)}/shrink`, { ...opts(), autoStopStart: Boolean(wrap) }),
              });
              toast(
                r && r.chunksRemoved
                  ? `Removed ${r.chunksRemoved.toLocaleString()} chunks, freeing ${fmtBytes(r.bytesFreed)}.${r.restarted ? ' Server restarted.' : ''}`
                  : `No rarely-visited chunks to remove.${r && r.restarted ? ' Server restarted.' : ''}`
              );
              reload();
            } catch (err) {
              if (err.dismissed) return true; // task tray took over
              toast(err.message || 'The world could not be shrunk. Please try again.', {
                kind: 'error',
                timeout: 9000,
              });
              return false;
            }
          },
        },
      ],
    });
  }

  // ---- Reset / re-roll (active world) ----
  function resetModal(world, size) {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <p>Deletes the world "${escapeHtml(world)}" and all of its dimensions, then the server generates a fresh one on its next start. The server must be stopped.</p>
      <div class="rounded-md border border-line bg-raised p-2.5 text-xs text-ink-soft">${fmtBytes(size)} will be cleared.</div>
      <div>
        <label class="label" for="rw-seedmode">Seed</label>
        <select class="input" id="rw-seedmode" data-label="Seed">
          <option value="random" selected>New random seed (re-roll)</option>
          <option value="keep">Keep the current seed</option>
          <option value="custom">Custom seed…</option>
        </select>
      </div>
      <div class="hidden" id="rw-customwrap">
        <label class="label" for="rw-seed">Custom seed</label>
        <input class="input font-mono" id="rw-seed" placeholder="e.g. 12345 or any text" autocomplete="off">
        <p class="help">Numbers and text both work. Minecraft converts text seeds to a number.</p>
      </div>
      <div>
        <label class="label" for="rw-leveltype">World type</label>
        <select class="input" id="rw-leveltype" data-label="World type">
          <option value="" selected>Keep current</option>
          <option value="DEFAULT">Default</option>
          <option value="FLAT">Superflat</option>
          <option value="LARGEBIOMES">Large biomes</option>
          <option value="AMPLIFIED">Amplified</option>
        </select>
        <p class="help">More world-generation options (generator settings, structures, the Nether, and so on) live in Settings → World.</p>
      </div>
      <label class="flex cursor-pointer items-center gap-2">
        <span class="msm-toggle"><input type="checkbox" id="rw-backup" checked><span></span></span>
        <span>Take a safety backup first</span>
      </label>`;
    const seedMode = content.querySelector('#rw-seedmode');
    const customWrap = content.querySelector('#rw-customwrap');
    seedMode.addEventListener('change', () => customWrap.classList.toggle('hidden', seedMode.value !== 'custom'));
    openModal({
      title: `Reset world "${world}"?`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Reset World',
          kind: 'danger',
          busyLabel: 'Resetting…',
          onClick: async () => {
            const mode = seedMode.value;
            const seed = content.querySelector('#rw-seed').value.trim();
            if (mode === 'custom' && !seed) {
              toast('Enter a custom seed, or pick another seed option.', { kind: 'error' });
              return false;
            }
            const levelType = content.querySelector('#rw-leveltype').value;
            const res = await postJSON(`${base}/reset`, {
              seedMode: mode,
              seed,
              levelType: levelType || undefined,
              backup: content.querySelector('#rw-backup').checked,
            });
            if (!res) return false;
            const what =
              res.seedMode === 'keep' && res.keptSeed
                ? `seed ${res.keptSeed} kept`
                : res.seed
                  ? `custom seed ${res.seed}`
                  : 'a new random seed';
            toast(
              `World reset with ${what}${res.levelType ? `, type ${res.levelType}` : ''} (${fmtBytes(res.freedBytes)} cleared).`
            );
            reload();
          },
        },
      ],
    });
  }
}
