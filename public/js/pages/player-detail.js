// Per-player page actions: whitelist / op / ban toggles, kick, and the full
// teleport modal. Uses the same /api/servers/:id/players endpoints as the roster.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';
import { escapeHtml } from '../lib/format.js';
import { t } from '../lib/i18n.js';

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
    if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'complete that action' }));
    return data;
  }
  const fail = (err) => toast(err.message || 'Something went wrong. Please try again.', { kind: 'error' });
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

  // ---- in-place chip/banner patching (mirrors the roster page - same
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
  function setBanBanner(reason, expires) {
    root.querySelector('[data-ban-banner]')?.remove();
    if (reason === false) return;
    const banner = document.createElement('div');
    banner.dataset.banBanner = '';
    banner.className = 'notice notice-danger mt-3 text-xs';
    const text = document.createElement('div');
    text.innerHTML = '<b class="text-danger">Banned:</b> ';
    text.append(`${reason || 'No reason recorded'}${expires ? ` · expires ${expires}` : ''}.`);
    banner.innerHTML =
      '<svg class="icon size-4 mt-0.5 shrink-0 text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>';
    banner.appendChild(text);
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
          toast(`${name} ${on ? 'removed from the whitelist' : 'added to the whitelist'}.`);
        } else if (kind === 'op') {
          const { result } = await withBusy(chip, () => api('/op', { name, on: !on }));
          if (result.note) toast(result.note, { kind: 'info', timeout: 8000 });
          setChip('op', !on, !on && result.opLevel ? `Op L${result.opLevel}` : 'Op');
          toast(`${name} ${on ? 'is no longer an operator' : 'is now an operator'}.`);
        } else if (kind === 'ban') {
          if (on) {
            const ok = await confirmDialog({
              title: t('players_modal.pardon_title', { name }),
              message: t('players_modal.pardon_message'),
              confirmLabel: t('players_modal.pardon_button'),
            });
            if (!ok) return;
            await withBusy(chip, () => api('/pardon', { name }));
            setChip('ban', false, 'Ban');
            setBanBanner(false);
            toast(t('players_modal.pardon_success', { name }));
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
    else if (act.dataset.act === 'delete-player') {
      const ok = await confirmDialog({
        title: t('players_modal.delete_player_title', { name }),
        message: t('players_modal.delete_player_message'),
        confirmLabel: t('common.delete'),
        danger: true,
      });
      if (!ok) return;
      try {
        await withBusy(act, async () => {
          const res = await fetch(`${base}/${encodeURIComponent(name)}`, { method: 'DELETE' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok === false)
            throw new Error(data.error || friendlyError(res, { action: 'delete that player' }));
        });
        location.href = `/servers/${serverId}/players`;
      } catch (err) {
        fail(err);
      }
    }
    // copy-uuid is handled by the global [data-copy] handler in app.js
  });

  // ---- ban (same labeled dialog as the roster page - one action, one UI) ----
  function banModal() {
    const content = document.createElement('div');
    content.className = 'space-y-3';
    content.innerHTML = `
      <div>
        <label class="label">${escapeHtml(t('players_modal.ban_reason_label'))}</label>
        <input class="input" data-f="reason" placeholder="${escapeHtml(t('players_modal.ban_reason_placeholder'))}" maxlength="256">
      </div>
      <div>
        <label class="label">${escapeHtml(t('players_modal.ban_duration_label'))}</label>
        <select class="input" data-f="duration" data-label="${escapeHtml(t('players_modal.ban_duration_aria'))}">
          <option value="">${escapeHtml(t('players_modal.ban_perm'))}</option>
          <option value="3600000">${escapeHtml(t('players_modal.ban_1h'))}</option>
          <option value="86400000">${escapeHtml(t('players_modal.ban_1d'))}</option>
          <option value="259200000">${escapeHtml(t('players_modal.ban_3d'))}</option>
          <option value="604800000">${escapeHtml(t('players_modal.ban_7d'))}</option>
          <option value="2592000000">${escapeHtml(t('players_modal.ban_30d'))}</option>
        </select>
        <p class="mt-2 text-xs text-ink-faint">${escapeHtml(t('players_modal.ban_temp_note'))}</p>
      </div>`;
    openModal({
      title: t('players_modal.ban_title', { name }),
      content,
      size: 'sm',
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('players_modal.ban_button'),
          kind: 'danger',
          busyLabel: t('players_modal.ban_busy'),
          onClick: async ({ body }) => {
            const reason = body.querySelector('[data-f="reason"]').value.trim();
            const duration = body.querySelector('[data-f="duration"]').value;
            try {
              const { result } = await api('/ban', {
                name,
                reason: reason || undefined,
                durationMs: duration ? Number(duration) : undefined,
              });
              setChip('ban', true, 'Banned');
              setBanBanner(reason, result.banExpires);
              toast(
                result.banExpires
                  ? t('players_modal.ban_success_until', { name, expires: result.banExpires })
                  : t('players_modal.ban_success', { name })
              );
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }

  // ---- moderator notes ----
  const notesList = root.querySelector('[data-notes-list]');
  const notesEmpty = root.querySelector('[data-notes-empty]');
  const notesAddBtn = root.querySelector('[data-notes-add]');

  function renderNotes(notes) {
    if (!notesList) return;
    notesList.innerHTML = '';
    if (notesEmpty) notesEmpty.classList.toggle('hidden', notes.length > 0);
    for (const n of notes) {
      const row = document.createElement('div');
      row.className = 'flex items-start justify-between gap-2 rounded-md bg-inset p-2 text-sm';
      row.dataset.noteId = n.id;
      const text = document.createElement('div');
      text.className = 'min-w-0';
      const p = document.createElement('p');
      p.className = 'whitespace-pre-wrap break-words';
      p.textContent = n.note;
      const meta = document.createElement('p');
      meta.className = 'mt-1 text-xs text-ink-faint';
      meta.textContent = `${n.author} · ${n.createdAt}`;
      text.append(p, meta);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-ghost btn-sm text-danger shrink-0';
      del.setAttribute('aria-label', t('players_modal.notes_delete_aria'));
      del.innerHTML =
        '<svg class="icon size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
      del.addEventListener('click', async () => {
        try {
          await withBusy(del, async () => {
            const res = await fetch(`${base}/notes/${n.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'delete that note' }));
            row.remove();
            if (notesList && !notesList.children.length && notesEmpty) notesEmpty.classList.remove('hidden');
          });
        } catch (err) {
          fail(err);
        }
      });
      row.append(text, del);
      notesList.appendChild(row);
    }
  }

  function loadNotes() {
    fetch(`${base}/notes?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => renderNotes(d.notes || []))
      .catch(() => renderNotes([]));
  }
  if (notesList) loadNotes();

  if (notesAddBtn)
    notesAddBtn.addEventListener('click', () => {
      const content = document.createElement('div');
      content.innerHTML = `<label class="label">${escapeHtml(t('players_modal.notes_label'))}</label><textarea class="input" data-f="note" rows="3" maxlength="1000"></textarea>`;
      openModal({
        title: t('players_modal.notes_title', { name }),
        content,
        size: 'sm',
        actions: [
          { label: t('common.cancel'), kind: 'ghost' },
          {
            label: t('players_modal.notes_add'),
            kind: 'primary',
            busyLabel: t('players_modal.notes_adding'),
            onClick: async ({ body }) => {
              const note = body.querySelector('[data-f="note"]').value.trim();
              if (!note) return false;
              try {
                await api('/notes', { name, note });
                loadNotes();
                toast(t('players_modal.notes_add') + '.');
              } catch (err) {
                fail(err);
                return false;
              }
            },
          },
        ],
      });
    });

  // ---- kick ----
  function kickModal() {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `<div><label class="label">${escapeHtml(t('players_modal.kick_message_label'))}</label><input class="input" data-f="message" maxlength="120" placeholder="${escapeHtml(t('players_modal.kick_placeholder'))}"></div>`;
    openModal({
      title: t('players_modal.kick_title', { name }),
      content,
      size: 'sm',
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('players_modal.kick_button'),
          kind: 'danger',
          busyLabel: t('players_modal.kick_busy'),
          onClick: async ({ body }) => {
            try {
              await api('/kick', { name, message: body.querySelector('[data-f="message"]').value.trim() || undefined });
              setOffline(); // no stale pulsing "Online" + re-clickable Kick
              toast(t('players_modal.kick_success', { name }));
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
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="coords">${escapeHtml(t('players_modal.tp_tab_coords'))}</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="biome">${escapeHtml(t('players_modal.tp_tab_biome'))}</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="player">${escapeHtml(t('players_modal.tp_tab_player'))}</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="rtp">${escapeHtml(t('players_modal.tp_tab_rtp'))}</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="structure">${escapeHtml(t('players_modal.tp_tab_structure'))}</button>
      </div>
      <div data-tp-panel="coords" class="space-y-3">
        <div class="grid grid-cols-3 gap-2">
          <div><label class="label">X</label><input class="input" type="number" data-f="x" placeholder="0"></div>
          <div><label class="label">Y</label><input class="input" type="number" data-f="y" placeholder="surface"></div>
          <div><label class="label">Z</label><input class="input" type="number" data-f="z" placeholder="0"></div>
        </div>
        <div><label class="label">Dimension</label>
          <select class="input" data-f="dimension" data-label="Dimension">
            <option value="">${escapeHtml(t('players_modal.tp_dim_current'))}</option>
            <option value="minecraft:overworld">${escapeHtml(t('players_modal.tp_dim_overworld'))}</option>
            <option value="minecraft:the_nether">${escapeHtml(t('players_modal.tp_dim_nether'))}</option>
            <option value="minecraft:the_end">${escapeHtml(t('players_modal.tp_dim_end'))}</option>
          </select></div>
        <p class="text-xs text-ink-faint">${escapeHtml(t('players_modal.tp_coords_hint'))}</p>
      </div>
      <div data-tp-panel="biome" class="hidden space-y-3">
        <label class="label">${escapeHtml(t('players_modal.tp_tab_biome'))}</label>
        <select class="input" data-f="biome" data-label="Biome"><option value="">${escapeHtml(t('players_modal.tp_loading_biomes'))}</option></select>
      </div>
      <div data-tp-panel="player" class="hidden space-y-3">
        <label class="label">${escapeHtml(t('players_modal.tp_tab_player'))}</label>
        <select class="input" data-f="target" data-label="Target player"><option value="">${escapeHtml(t('players_modal.tp_loading_players'))}</option></select>
      </div>
      <div data-tp-panel="rtp" class="hidden space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div><label class="label">${escapeHtml(t('players_modal.tp_min_dist'))}</label><input class="input" type="number" data-f="minDistance" value="500" min="0"></div>
          <div><label class="label">${escapeHtml(t('players_modal.tp_max_dist'))}</label><input class="input" type="number" data-f="maxDistance" value="5000" min="16"></div>
        </div>
        <div><label class="label">${escapeHtml(t('players_modal.tp_around'))}</label>
          <select class="input" data-f="center" data-label="Around">
            <option value="player">${escapeHtml(t('players_modal.tp_around_player'))}</option>
            <option value="origin">${escapeHtml(t('players_modal.tp_around_origin'))}</option>
          </select></div>
      </div>
      <div data-tp-panel="structure" class="hidden space-y-3">
        <label class="label">${escapeHtml(t('players_modal.tp_tab_structure'))}</label>
        <select class="input" data-f="structure" data-label="Structure"><option value="">${escapeHtml(t('players_modal.tp_loading_structures'))}</option></select>
        <div class="grid grid-cols-2 items-end gap-2">
          <div><label class="label">${escapeHtml(t('players_modal.tp_search_radius'))}</label><input class="input" type="number" data-f="structMaxDistance" value="5000" min="16"></div>
          <label class="flex items-center gap-2 pb-2"><input type="checkbox" class="msm-check" data-f="structRandom" checked> ${escapeHtml(t('players_modal.tp_surprise_me'))}</label>
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
          ? list
              .map(
                (e) =>
                  `<option value="${escapeHtml(e.id)}">${escapeHtml(dimShort(e.dimension))} · ${escapeHtml(label(e.id))}</option>`
              )
              .join('')
          : `<option value="">${escapeHtml(t('players_modal.tp_empty_biomes'))}</option>`;
        sel.dataset.loaded = '1';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    function fillTargets(sel) {
      if (!sel || sel.dataset.loaded) return;
      loadRoster().then((list) => {
        const online = list.filter((p) => p.online && p.name !== name);
        sel.innerHTML = online.length
          ? online.map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')
          : `<option value="">${escapeHtml(t('players_modal.tp_empty_players'))}</option>`;
        sel.dataset.loaded = '1';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    openModal({
      title: t('players_modal.teleport_title', { name }),
      content,
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('players_modal.tp_button'),
          kind: 'primary',
          busyLabel: t('players_modal.tp_searching'),
          onClick: async ({ body }) => {
            if (inflight) {
              toast(t('players_modal.tp_inflight'), { kind: 'error' });
              return false;
            }
            const f = (k) => body.querySelector(`[data-f="${k}"]`).value;
            let payload;
            if (mode === 'coords') {
              if ([f('x'), f('z')].some((v) => v.trim() === '')) {
                toast(t('players_modal.tp_err_coords'), { kind: 'error' });
                return false;
              }
              payload = { mode, player: name, x: Number(f('x')), z: Number(f('z')) };
              if (f('y').trim() !== '') payload.y = Number(f('y'));
              if (f('dimension')) payload.dimension = f('dimension');
            } else if (mode === 'biome') {
              if (!f('biome')) {
                toast(t('players_modal.tp_err_biome'), { kind: 'error' });
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
                toast(t('players_modal.tp_err_structure'), { kind: 'error' });
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
                toast(t('players_modal.tp_err_player'), { kind: 'error' });
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
                  ? `${name} sent to ${prettyBiome(result.biome)} at ${at(result)}.`
                  : mode === 'rtp'
                    ? `${name} randomly teleported ${result.distance} blocks out to ${at(result)}.`
                    : mode === 'structure'
                      ? `${name} sent to a ${prettyBiome(result.structure)} at ${at(result)}.`
                      : t('players_modal.tp_success', { name })
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
