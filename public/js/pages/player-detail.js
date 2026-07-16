// Per-player page actions: whitelist / op / ban toggles, kick, and the full
// teleport modal. Uses the same /api/servers/:id/players endpoints as the roster.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';

const root = document.querySelector('[data-player-detail]');
if (root) init(root);

function init(root) {
  const serverId = root.dataset.serverId;
  const name = root.dataset.playerName;
  const base = `/api/servers/${serverId}/players`;

  async function api(path, body) {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    return data;
  }
  const fail = (err) => toast(err.message || 'Something went wrong', { kind: 'error' });
  const prettyBiome = (id) => {
    const b = String(id).replace(/^#/, '').split(':').pop().split('/').pop().replace(/_/g, ' ');
    return b.charAt(0).toUpperCase() + b.slice(1);
  };
  const DIM_SHORT = {
    'minecraft:overworld': 'Overworld',
    'minecraft:the_nether': 'Nether',
    'minecraft:the_end': 'End',
  };
  const dimShort = (d) =>
    DIM_SHORT[d] ||
    String(d || '')
      .split(':')
      .pop();
  const dimLong = (d) =>
    ({ 'minecraft:overworld': 'the Overworld', 'minecraft:the_nether': 'the Nether', 'minecraft:the_end': 'the End' })[
      d
    ] || dimShort(d);
  const DIM_ORDER = { 'minecraft:overworld': 0, 'minecraft:the_nether': 1, 'minecraft:the_end': 2 };
  // Sort by dimension then friendly name; label as "Nether · Crimson Forest".
  const sortByDim = (list) =>
    [...list].sort(
      (a, b) =>
        (DIM_ORDER[a.dimension] ?? 9) - (DIM_ORDER[b.dimension] ?? 9) ||
        prettyBiome(a.id).localeCompare(prettyBiome(b.id))
    );

  // ---- in-place chip/banner patching (mirrors the roster page — same
  // action, same UI, no page flash and no silent success) ----
  const CHIP_ON = {
    whitelist: ['border-grass-700', 'bg-grass-500/15', 'text-ok'],
    op: ['border-diamond-700', 'bg-diamond-400/15', 'text-link'],
    ban: ['border-danger/40', 'bg-redstone-500/15', 'text-danger'],
  };
  function setChip(role, on, label) {
    const chip = root.querySelector(`[data-role-toggle="${role}"]`);
    if (!chip) return;
    chip.dataset.on = on ? '1' : '0';
    chip.classList.remove(...Object.values(CHIP_ON).flat());
    if (on) chip.classList.add(...CHIP_ON[role]);
    if (label) chip.querySelector('[data-chip-label]').textContent = label;
    const tips = {
      whitelist: on ? 'Remove from whitelist' : 'Add to whitelist',
      op: on ? 'Remove operator status' : 'Make operator (level 4)',
      ban: on ? 'Pardon this player' : 'Ban this player',
    };
    chip.dataset.tip = tips[role];
  }
  function setBanBanner(reason) {
    root.querySelector('[data-ban-banner]')?.remove();
    if (reason === false) return;
    const banner = document.createElement('div');
    banner.dataset.banBanner = '';
    banner.className = 'notice notice-danger mt-3 text-xs text-danger';
    banner.textContent = `Banned: ${reason || 'no reason recorded'}`;
    root.querySelector('.card')?.appendChild(banner);
  }
  function setOffline() {
    const status = root.querySelector('[data-player-status]');
    if (status)
      status.innerHTML =
        '<span class="flex items-center gap-1.5 text-xs font-medium text-ink-faint"><span class="status-dot bg-stone-500"></span> Offline</span>';
    root.querySelector('[data-act="kick"]')?.remove();
  }

  // ---- role chips (whitelist / op / ban) ----
  root.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-role-toggle]');
    if (chip) {
      const kind = chip.dataset.roleToggle;
      const on = chip.dataset.on === '1';
      try {
        if (kind === 'whitelist') {
          await withBusy(chip, () => api('/whitelist', { name, on: !on }));
          setChip('whitelist', !on);
          toast(`${name} ${on ? 'removed from whitelist' : 'whitelisted'}`);
        } else if (kind === 'op') {
          const { result } = await withBusy(chip, () => api('/op', { name, on: !on }));
          if (result.note) toast(result.note, { kind: 'info', timeout: 8000 });
          setChip('op', !on, !on && result.opLevel ? `Op L${result.opLevel}` : 'Op');
          toast(`${name} ${on ? 'de-opped' : 'is now an operator'}`);
        } else if (kind === 'ban') {
          if (on) {
            const ok = await confirmDialog({
              title: `Pardon ${name}?`,
              message: 'The player will be able to join again.',
              confirmLabel: 'Pardon',
            });
            if (!ok) return;
            await withBusy(chip, () => api('/pardon', { name }));
            setChip('ban', false, 'Ban');
            setBanBanner(false);
            toast(`${name} pardoned`);
          } else {
            banModal();
          }
        }
      } catch (err) {
        fail(err);
      }
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'kick') kickModal();
    else if (act.dataset.act === 'teleport') teleportModal();
    // copy-uuid is handled by the global [data-copy] handler in app.js
  });

  // ---- ban (same labeled dialog as the roster page — one action, one UI) ----
  function banModal() {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Ban reason (recorded in the ban list)</label>
      <input class="input" data-f="reason" placeholder="Banned by an operator." maxlength="256">`;
    openModal({
      title: `Ban ${name}`,
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Ban player',
          kind: 'danger',
          busyLabel: 'Banning…',
          onClick: async ({ body }) => {
            const reason = body.querySelector('[data-f="reason"]').value.trim();
            try {
              await api('/ban', { name, reason: reason || undefined });
              setChip('ban', true, 'Banned');
              setBanBanner(reason);
              toast(`${name} banned`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }

  // ---- kick ----
  function kickModal() {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `<div><label class="label">Kick message (optional)</label><input class="input" data-f="message" maxlength="120" placeholder="Back in a bit…"></div>`;
    openModal({
      title: `Kick ${name}`,
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Kick',
          kind: 'danger',
          busyLabel: 'Kicking…',
          onClick: async ({ body }) => {
            try {
              await api('/kick', { name, message: body.querySelector('[data-f="message"]').value.trim() || undefined });
              setOffline(); // no stale pulsing "Online" + re-clickable Kick
              toast(`${name} kicked.`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }

  // ---- teleport (coords / biome / to-player / random / structure) ----
  let biomesP = null,
    structuresP = null,
    rosterP = null;
  const loadBiomes = () =>
    (biomesP ||= fetch(`/api/servers/${serverId}/players/biomes`)
      .then((r) => r.json())
      .then((d) => d.biomes || [])
      .catch(() => []));
  const loadStructures = () =>
    (structuresP ||= fetch(`/api/servers/${serverId}/players/structures`)
      .then((r) => r.json())
      .then((d) => d.structures || [])
      .catch(() => []));
  const loadRoster = () =>
    (rosterP ||= fetch(`/api/servers/${serverId}/players`)
      .then((r) => r.json())
      .then((d) => d.players || [])
      .catch(() => []));

  function teleportModal() {
    const content = document.createElement('div');
    content.className = 'space-y-4 text-sm';
    content.innerHTML = `
      <div class="seg w-full" role="tablist">
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="coords">Coordinates</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="biome">Biome</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="player">To player</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="rtp">Random</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="structure">Structure</button>
      </div>
      <div data-tp-panel="coords" class="space-y-3">
        <div class="grid grid-cols-3 gap-2">
          <div><label class="label">X</label><input class="input" type="number" data-f="x" placeholder="0"></div>
          <div><label class="label">Y</label><input class="input" type="number" data-f="y" placeholder="surface"></div>
          <div><label class="label">Z</label><input class="input" type="number" data-f="z" placeholder="0"></div>
        </div>
        <div><label class="label">Dimension</label>
          <select class="input" data-f="dimension" data-label="Dimension">
            <option value="">Current dimension</option>
            <option value="minecraft:overworld">Overworld</option>
            <option value="minecraft:the_nether">The Nether</option>
            <option value="minecraft:the_end">The End</option>
          </select></div>
        <p class="text-xs text-ink-faint">Leave Y empty to land safely on the highest ground.</p>
      </div>
      <div data-tp-panel="biome" class="hidden space-y-3">
        <label class="label">Biome</label>
        <select class="input" data-f="biome" data-label="Biome"><option value="">Loading biomes…</option></select>
      </div>
      <div data-tp-panel="player" class="hidden space-y-3">
        <label class="label">Target player (online)</label>
        <select class="input" data-f="target" data-label="Target player"><option value="">Loading…</option></select>
      </div>
      <div data-tp-panel="rtp" class="hidden space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div><label class="label">Min distance</label><input class="input" type="number" data-f="minDistance" value="500" min="0"></div>
          <div><label class="label">Max distance</label><input class="input" type="number" data-f="maxDistance" value="5000" min="16"></div>
        </div>
        <div><label class="label">Around</label>
          <select class="input" data-f="center" data-label="Around">
            <option value="player">The player's current position</option>
            <option value="origin">World center (0, 0)</option>
          </select></div>
      </div>
      <div data-tp-panel="structure" class="hidden space-y-3">
        <label class="label">Structure</label>
        <select class="input" data-f="structure" data-label="Structure"><option value="">Loading structures…</option></select>
        <div class="grid grid-cols-2 items-end gap-2">
          <div><label class="label">Search radius</label><input class="input" type="number" data-f="structMaxDistance" value="5000" min="16"></div>
          <label class="flex items-center gap-2 pb-2"><input type="checkbox" class="msm-check" data-f="structRandom" checked> Surprise me</label>
        </div>
      </div>`;

    let mode = 'coords';
    let inflight = false;
    const tabs = content.querySelectorAll('[data-tp-mode]');
    const setMode = (next) => {
      mode = next;
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tpMode === mode)));
      content
        .querySelectorAll('[data-tp-panel]')
        .forEach((p) => p.classList.toggle('hidden', p.dataset.tpPanel !== mode));
      if (mode === 'biome') fillSelect(content.querySelector('[data-f="biome"]'), loadBiomes(), prettyBiome);
      if (mode === 'structure')
        fillSelect(content.querySelector('[data-f="structure"]'), loadStructures(), prettyBiome);
      if (mode === 'player') fillTargets(content.querySelector('[data-f="target"]'));
    };
    tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.tpMode)));
    setMode('coords');

    function fillSelect(sel, promise, label) {
      if (!sel || sel.dataset.loaded) return;
      promise.then((items) => {
        // items are {id, dimension}; label options as "Nether · Crimson Forest".
        const list = sortByDim(items);
        sel.innerHTML = list.length
          ? list.map((e) => `<option value="${e.id}">${dimShort(e.dimension)} · ${label(e.id)}</option>`).join('')
          : '<option value="">None available — start the server</option>';
        sel.dataset.loaded = '1';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    function fillTargets(sel) {
      if (!sel || sel.dataset.loaded) return;
      loadRoster().then((list) => {
        const online = list.filter((p) => p.online && p.name !== name);
        sel.innerHTML = online.length
          ? online.map((p) => `<option value="${p.name}">${p.name}</option>`).join('')
          : '<option value="">No other players online</option>';
        sel.dataset.loaded = '1';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    openModal({
      title: `Teleport ${name}`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Teleport',
          kind: 'primary',
          busyLabel: 'Searching…',
          onClick: async ({ body }) => {
            if (inflight) {
              toast('Hold on — the previous teleport is still searching.', { kind: 'error' });
              return false;
            }
            const f = (k) => body.querySelector(`[data-f="${k}"]`).value;
            let payload;
            if (mode === 'coords') {
              if ([f('x'), f('z')].some((v) => v.trim() === '')) {
                toast('Enter X and Z (Y optional)', { kind: 'error' });
                return false;
              }
              payload = { mode, player: name, x: Number(f('x')), z: Number(f('z')) };
              if (f('y').trim() !== '') payload.y = Number(f('y'));
              if (f('dimension')) payload.dimension = f('dimension');
            } else if (mode === 'biome') {
              if (!f('biome')) {
                toast('Pick a biome', { kind: 'error' });
                return false;
              }
              payload = { mode, player: name, biome: f('biome') };
            } else if (mode === 'rtp') {
              payload = {
                mode,
                player: name,
                minDistance: Number(f('minDistance')) || 500,
                maxDistance: Number(f('maxDistance')) || 5000,
                center: f('center') || 'player',
              };
            } else if (mode === 'structure') {
              if (!f('structure')) {
                toast('Pick a structure', { kind: 'error' });
                return false;
              }
              payload = {
                mode,
                player: name,
                structure: f('structure'),
                random: body.querySelector('[data-f="structRandom"]').checked,
                maxDistance: Number(f('structMaxDistance')) || 5000,
              };
            } else {
              if (!f('target')) {
                toast('No target player available', { kind: 'error' });
                return false;
              }
              payload = { mode, player: name, target: f('target') };
            }
            inflight = true;
            try {
              const { result } = await api('/teleport', payload);
              const at = (r) => `${r.x}, ${r.z}${r.dimension ? ` in ${dimLong(r.dimension)}` : ''}`;
              toast(
                mode === 'biome'
                  ? `${name} sent to ${prettyBiome(result.biome)} at ${at(result)}`
                  : mode === 'rtp'
                    ? `${name} randomly teleported ${result.distance} blocks out to ${at(result)}`
                    : mode === 'structure'
                      ? `${name} sent to a ${prettyBiome(result.structure)} at ${at(result)}`
                      : `${name} teleported`
              );
            } catch (err) {
              fail(err);
              return false;
            } finally {
              inflight = false;
            }
          },
        },
      ],
    });
  }
}
