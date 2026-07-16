// Players tab: god-mode player management. Whitelist/op/ban toggles, kicks,
// IP bans, and the three-mode teleport modal. Mutations POST to the players
// API and reload the page section.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';

const root = document.querySelector('[data-players-root]');
if (root) init(root);

function init(root) {
  const serverId = root.dataset.serverId;
  const running = root.dataset.running === '1';
  let players = [];
  try {
    players = JSON.parse(document.getElementById('players-data').textContent) || [];
  } catch {
    /* island missing — actions still work */
  }

  async function api(path, body) {
    const res = await fetch(`/api/servers/${serverId}/players${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    return data;
  }

  // Full reload only where a re-render is genuinely the refresh (new player
  // rows) — role toggles patch their row in place instead of flashing the page.
  function refresh(message) {
    toast(message);
    setTimeout(() => location.reload(), 700);
  }

  function fail(err) {
    toast(err.message || 'Something went wrong', { kind: 'error' });
  }

  // ------------------------------------------------- in-place row patching
  const CHIP_ON = {
    whitelist: ['border-grass-700', 'bg-grass-500/15', 'text-ok'],
    op: ['border-diamond-700', 'bg-diamond-400/15', 'text-link'],
    ban: ['border-danger/40', 'bg-redstone-500/15', 'text-danger'],
  };
  const rowFor = (name) => root.querySelector(`[data-player-row][data-name="${CSS.escape(name)}"]`);

  function setChip(row, role, on, { label, tip } = {}) {
    const chip = row.querySelector(`[data-role-toggle="${role}"]`);
    if (!chip) return;
    chip.dataset.on = on ? '1' : '0';
    chip.classList.remove(...Object.values(CHIP_ON).flat());
    if (on) chip.classList.add(...CHIP_ON[role]);
    if (label) chip.querySelector('[data-chip-label]').textContent = label;
    if (tip) chip.dataset.tip = tip;
  }

  /** Patch a roster row after a role mutation; falls back to reload if the row vanished. */
  function patchRow(name, changes, message) {
    const row = rowFor(name);
    if (!row) return refresh(message); // filtered island drift — re-render is the safe refresh
    if ('whitelisted' in changes) {
      row.dataset.whitelisted = changes.whitelisted ? '1' : '0';
      setChip(row, 'whitelist', changes.whitelisted, {
        tip: changes.whitelisted ? 'Remove from whitelist' : 'Add to whitelist',
      });
    }
    if ('op' in changes) {
      row.dataset.op = changes.op ? '1' : '0';
      setChip(row, 'op', changes.op, {
        label: changes.op && changes.opLevel ? `Op L${changes.opLevel}` : 'Op',
        tip: changes.op ? 'Remove operator status' : 'Make operator (level 4)',
      });
    }
    if ('banned' in changes) {
      row.dataset.banned = changes.banned ? '1' : '0';
      setChip(row, 'ban', changes.banned, {
        label: changes.banned ? 'Banned' : 'Ban',
        tip: changes.banned ? 'Pardon this player' : 'Ban this player',
      });
      const details = row.querySelector('[data-ban-details]');
      if (details) {
        if (changes.banned) {
          const reason = changes.banReason || 'No reason recorded';
          details.innerHTML = '';
          const div = document.createElement('div');
          div.className = 'max-w-56 truncate text-danger';
          div.textContent = reason;
          div.title = reason;
          details.appendChild(div);
        } else {
          details.textContent = '—';
        }
      }
    }
    if ('online' in changes && !changes.online) {
      const status = row.querySelector('[data-player-status]');
      if (status) {
        row.dataset.online = '0';
        status.innerHTML =
          '<span class="flex items-center gap-1.5 text-xs font-medium text-ink-faint"><span class="status-dot bg-stone-500"></span> Offline</span>';
      }
      row.querySelector('[data-act="kick"]')?.remove();
    }
    applyFilter(); // the row may enter/leave the active filter
    if (message) toast(message);
  }

  // ------------------------------------------------------------------ filter
  const search = document.getElementById('players-search');
  const filter = document.getElementById('players-filter');
  const noMatch = document.getElementById('players-no-match');

  function applyFilter() {
    const q = (search?.value || '').trim().toLowerCase();
    const mode = filter?.value || 'all';
    let visible = 0;
    for (const row of root.querySelectorAll('[data-player-row]')) {
      const d = row.dataset;
      let show = !q || d.name.toLowerCase().includes(q);
      if (show && mode === 'online') show = d.online === '1';
      if (show && mode === 'whitelisted') show = d.whitelisted === '1';
      if (show && mode === 'ops') show = d.op === '1';
      if (show && mode === 'banned') show = d.banned === '1';
      row.classList.toggle('hidden', !show);
      if (show) visible += 1;
    }
    if (noMatch) noMatch.classList.toggle('hidden', visible > 0 || !root.querySelector('[data-player-row]'));
  }
  if (search) search.addEventListener('input', applyFilter);
  if (filter) filter.addEventListener('change', applyFilter);

  // --------------------------------------------------- whitelist enforcement
  const enforce = document.getElementById('players-wl-enforce');
  if (enforce)
    enforce.addEventListener('change', async () => {
      enforce.disabled = true; // keep the toggle visual — just lock it in flight
      try {
        await api('/whitelist-enforce', { on: enforce.checked });
        toast(`Whitelist enforcement ${enforce.checked ? 'on' : 'off'}${running ? '' : ' (applies on next start)'}`);
      } catch (err) {
        enforce.checked = !enforce.checked;
        fail(err);
      } finally {
        enforce.disabled = false;
      }
    });

  // ------------------------------------------------------------ role toggles
  // Delegated on document because dropdown.js portals row menus to <body>.
  document.addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-role-toggle]');
    if (toggle) {
      const name = toggle.dataset.name;
      const on = toggle.dataset.on !== '1';
      const role = toggle.dataset.roleToggle;
      try {
        if (role === 'whitelist') {
          await withBusy(toggle, async () => {
            await api('/whitelist', { name, on });
            patchRow(name, { whitelisted: on }, `${name} ${on ? 'whitelisted' : 'removed from whitelist'}`);
          });
        } else if (role === 'op') {
          await withBusy(toggle, async () => {
            const { result } = await api('/op', { name, on });
            if (result.note) toast(result.note, { kind: 'info', timeout: 8000 });
            patchRow(name, { op: on, opLevel: result.opLevel }, `${name} ${on ? 'is now an operator' : 'de-opped'}`);
          });
        } else if (role === 'ban') {
          if (on) banModal(name);
          else if (
            await confirmDialog({
              title: `Pardon ${name}?`,
              message: 'The player will be able to join again.',
              confirmLabel: 'Pardon',
            })
          ) {
            await withBusy(toggle, async () => {
              await api('/pardon', { name });
              patchRow(name, { banned: false }, `${name} pardoned`);
            });
          }
        }
      } catch (err) {
        fail(err);
      }
      return;
    }

    const act = e.target.closest('[data-act]');
    if (!act) return;
    const name = act.dataset.name;

    if (act.dataset.act === 'kick') kickModal(name);
    else if (act.dataset.act === 'teleport') teleportModal(name);
    else if (act.dataset.act === 'op-level') opLevelModal(name);
    else if (act.dataset.act === 'ban-reason') banModal(name);
    else if (act.dataset.act === 'copy-uuid') {
      window.CD.copyText(act.dataset.uuid).then((ok) => {
        if (ok) toast('UUID copied');
      });
    } else if (act.dataset.act === 'pardon-ip') {
      const ip = act.dataset.ip;
      confirmDialog({ title: `Unban ${ip}?`, confirmLabel: 'Unban' }).then(async (ok) => {
        if (!ok) return;
        try {
          await withBusy(act, async () => {
            await api('/pardon-ip', { ip });
            root.querySelector(`[data-banip-row="${CSS.escape(ip)}"]`)?.remove();
            if (!root.querySelector('[data-banip-row]')) {
              document.getElementById('banip-table')?.classList.add('hidden');
              document.getElementById('banip-empty')?.classList.remove('hidden');
            }
            toast(`IP ${ip} unbanned`);
          });
        } catch (err) {
          fail(err);
        }
      });
    }
  });

  // ------------------------------------------------------------- add player
  const addBtn = document.getElementById('players-add');
  if (addBtn)
    addBtn.addEventListener('click', () => {
      const content = document.createElement('div');
      content.className = 'space-y-3 text-sm';
      content.innerHTML = `
      <div>
        <label class="label">Player name</label>
        <input class="input" data-f="name" placeholder="Notch" autocomplete="off" spellcheck="false" maxlength="16">
        <p class="mt-1 text-xs text-ink-faint">Resolved to a UUID via the Mojang API — the player never needs to have joined.</p>
      </div>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="whitelist" checked> Add to whitelist</label>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="op"> Make operator (level 4)</label>`;
      openModal({
        title: 'Add player',
        content,
        actions: [
          { label: 'Cancel', kind: 'ghost' },
          {
            label: 'Add',
            kind: 'primary',
            busyLabel: 'Adding…',
            onClick: async ({ body }) => {
              const name = body.querySelector('[data-f="name"]').value.trim();
              const wl = body.querySelector('[data-f="whitelist"]').checked;
              const op = body.querySelector('[data-f="op"]').checked;
              if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
                toast('Enter a valid player name', { kind: 'error' });
                return false;
              }
              if (!wl && !op) {
                toast('Pick at least one role to grant', { kind: 'error' });
                return false;
              }
              try {
                if (wl) await api('/whitelist', { name, on: true });
                if (op) await api('/op', { name, on: true });
                refresh(`${name} added`);
              } catch (err) {
                fail(err);
                return false;
              }
            },
          },
        ],
      });
    });

  // ------------------------------------------------------------------- kick
  function kickModal(name) {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Kick message (shown to the player)</label>
      <input class="input" data-f="message" placeholder="Kicked by an operator." maxlength="256">`;
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
              patchRow(name, { online: false }, `${name} kicked`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }

  // -------------------------------------------------------------------- ban
  function banModal(name) {
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
              patchRow(name, { banned: true, banReason: reason }, `${name} banned`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }

  // --------------------------------------------------------------- op level
  function opLevelModal(name) {
    const content = document.createElement('div');
    content.innerHTML = `
      <label class="label">Permission level</label>
      <select class="input" data-f="level" data-label="Op permission level">
        <option value="1">1 — bypass spawn protection</option>
        <option value="2">2 — command blocks + most commands</option>
        <option value="3">3 — player management (kick, ban, op)</option>
        <option value="4" selected>4 — full access (stop, save-all)</option>
      </select>
      <p class="mt-2 text-xs text-ink-faint">Levels below 4 are stored in ops.json; a running server applies them after a restart.</p>`;
    openModal({
      title: `Op level for ${name}`,
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Apply',
          kind: 'primary',
          busyLabel: 'Applying…',
          onClick: async ({ body }) => {
            try {
              const { result } = await api('/op', {
                name,
                on: true,
                level: Number(body.querySelector('[data-f="level"]').value),
              });
              if (result.note) toast(result.note, { kind: 'info', timeout: 8000 });
              patchRow(name, { op: true, opLevel: result.opLevel }, `${name} opped at level ${result.opLevel}`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }

  // --------------------------------------------------------------- teleport
  function teleportModal(name) {
    const content = document.createElement('div');
    content.className = 'space-y-4 text-sm';
    content.innerHTML = `
      <div class="seg w-full" role="tablist">
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="coords">Coordinates</button>
        <button type="button" class="seg-btn flex-1 justify-center" role="tab" aria-selected="false" data-tp-mode="biome">Nearest biome</button>
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
        <p class="text-xs text-ink-faint">Leave Y empty to land safely on the highest ground. With an explicit Y the player gets 15s of Slow Falling as insurance.</p>
        <div>
          <label class="label">Dimension</label>
          <select class="input" data-f="dimension" data-label="Dimension">
            <option value="">Current dimension</option>
            <option value="minecraft:overworld">Overworld</option>
            <option value="minecraft:the_nether">The Nether</option>
            <option value="minecraft:the_end">The End</option>
          </select>
        </div>
      </div>

      <div data-tp-panel="biome" class="hidden space-y-3">
        <div>
          <label class="label">Biome</label>
          <select class="input" data-f="biome" data-label="Biome"><option value="">Loading biomes…</option></select>
          <p class="mt-1 text-xs text-ink-faint">Searches from the player's current position via /locate biome.</p>
        </div>
      </div>

      <div data-tp-panel="player" class="hidden space-y-3">
        <div>
          <label class="label">Target player</label>
          <select class="input" data-f="target" data-label="Target player"></select>
        </div>
      </div>

      <div data-tp-panel="rtp" class="hidden space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div><label class="label">Min distance</label><input class="input" type="number" data-f="minDistance" value="500" min="0"></div>
          <div><label class="label">Max distance</label><input class="input" type="number" data-f="maxDistance" value="5000" min="16"></div>
        </div>
        <div>
          <label class="label">Around</label>
          <select class="input" data-f="center" data-label="Around">
            <option value="player">The player's current position</option>
            <option value="origin">World center (0, 0)</option>
          </select>
        </div>
        <p class="text-xs text-ink-faint">Panel-built RTP — works on any server, version or modpack. Picks a random spot in the ring and lands on solid ground; ocean picks are retried automatically (up to 10 rolls).</p>
      </div>

      <div data-tp-panel="structure" class="hidden space-y-3">
        <div>
          <label class="label">Structure</label>
          <select class="input" data-f="structure" data-label="Structure"><option value="">Loading structures…</option></select>
        </div>
        <div class="grid grid-cols-2 items-end gap-2">
          <div><label class="label">Search radius</label><input class="input" type="number" data-f="structMaxDistance" value="5000" min="16"></div>
          <label class="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" class="msm-check" data-f="structRandom" checked> Surprise me (random one, not nearest)</label>
        </div>
        <p class="text-xs text-ink-faint">"Surprise me" searches from a random point in the radius — a different village every time. Lands safely on the surface next to it.</p>
      </div>`;

    let mode = 'coords';
    let tpInFlight = false; // locate searches take seconds — never stack them
    const tabs = content.querySelectorAll('[data-tp-mode]');
    function setMode(next) {
      mode = next;
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tpMode === mode)));
      content
        .querySelectorAll('[data-tp-panel]')
        .forEach((p) => p.classList.toggle('hidden', p.dataset.tpPanel !== mode));
    }
    tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.tpMode)));

    // Target-player options: everyone currently online except the traveller.
    const targetSel = content.querySelector('[data-f="target"]');
    const online = players.filter((p) => p.online && p.name !== name);
    if (online.length) {
      for (const p of online) {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        targetSel.appendChild(opt);
      }
    } else {
      targetSel.innerHTML = '<option value="">No other players online</option>';
    }

    const modal = openModal({
      title: `Teleport ${name}`,
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Teleport',
          kind: 'primary',
          busyLabel: 'Searching…',
          onClick: async ({ body }) => {
            if (tpInFlight) {
              toast('Hold on — the previous teleport is still searching.', { kind: 'error' });
              return false;
            }
            const f = (k) => body.querySelector(`[data-f="${k}"]`).value;
            let payload;
            if (mode === 'coords') {
              if ([f('x'), f('z')].some((v) => v.trim() === '')) {
                toast('Enter X and Z (Y is optional — empty lands on the surface)', { kind: 'error' });
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
            tpInFlight = true;
            try {
              const { result } = await api('/teleport', payload);
              const at = (r) => `${r.x}, ${r.z}${r.dimension ? ` in ${dimLong(r.dimension)}` : ''}`;
              toast(
                mode === 'biome'
                  ? `${name} sent to ${prettyBiome(result.biome)} at ${at(result)} (surface)`
                  : mode === 'rtp'
                    ? `${name} randomly teleported ${result.distance} blocks out to ${at(result)}`
                    : mode === 'structure'
                      ? `${name} sent to a ${prettyBiome(result.structure)} at ${at(result)} (surface)`
                      : `${name} teleported`
              );
            } catch (err) {
              fail(err);
              return false;
            } finally {
              tpInFlight = false;
            }
          },
        },
      ],
    });

    setMode('coords');

    // Populate the biome list lazily from the bundled vanilla registry.
    fetch(`/api/servers/${serverId}/players/biomes`)
      .then((r) => r.json())
      .then(({ biomes }) => {
        const sel = modal.body.querySelector('[data-f="biome"]');
        sel.innerHTML = dimOptions(biomes || []);
        sel.dispatchEvent(new Event('change', { bubbles: true })); // resync the enhanced trigger
      })
      .catch(() => toast('Could not load the biome list', { kind: 'error' }));

    // Structure list too — server-derived when available, vanilla bundle otherwise.
    fetch(`/api/servers/${serverId}/players/structures`)
      .then((r) => r.json())
      .then(({ structures }) => {
        const sel = modal.body.querySelector('[data-f="structure"]');
        if (!structures || !structures.length) {
          sel.innerHTML = '<option value="">No structure list available</option>';
        } else {
          sel.innerHTML = dimOptions(structures);
          const village = structures.find((s) => /village/.test(s.id));
          if (village) sel.value = village.id;
        }
        sel.dispatchEvent(new Event('change', { bubbles: true })); // resync the enhanced trigger
      })
      .catch(() => toast('Could not load the structure list', { kind: 'error' }));
  }

  // "minecraft:snowy_plains" / "#minecraft:village" → "Snowy plains" / "Village"
  function prettyBiome(id) {
    const base = String(id).replace(/^#/, '').split(':').pop().split('/').pop().replace(/_/g, ' ');
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
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
  // {id,dimension}[] → <option> list, grouped by dimension, labelled "Nether · Crimson Forest".
  function dimOptions(items) {
    return [...items]
      .sort(
        (a, b) =>
          (DIM_ORDER[a.dimension] ?? 9) - (DIM_ORDER[b.dimension] ?? 9) ||
          prettyBiome(a.id).localeCompare(prettyBiome(b.id))
      )
      .map((e) => `<option value="${e.id}">${dimShort(e.dimension)} · ${prettyBiome(e.id)}</option>`)
      .join('');
  }

  // ---------------------------------------------------------------- ban IPs
  const banIpBtn = document.getElementById('banip-add');
  const banIpIp = document.getElementById('banip-ip');
  const banIpReason = document.getElementById('banip-reason');

  function addBanIpRow(ip, reason) {
    const tr = document.createElement('tr');
    tr.dataset.banipRow = ip;
    const cells = [
      ['font-mono', ip],
      ['text-xs text-ink-soft', reason || '—'],
      ['text-xs text-ink-faint', 'just now'],
      ['text-xs text-ink-faint', 'panel'],
    ];
    for (const [cls, text] of cells) {
      const td = document.createElement('td');
      td.className = cls;
      td.textContent = text;
      tr.appendChild(td);
    }
    const actions = document.createElement('td');
    actions.className = 'text-right';
    actions.innerHTML = `<button class="btn btn-ghost btn-sm text-danger" data-act="pardon-ip" data-tip="Remove this IP ban">
      <svg class="icon size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
    actions.querySelector('button').dataset.ip = ip;
    tr.appendChild(actions);
    document.getElementById('banip-rows')?.appendChild(tr);
    document.getElementById('banip-table')?.classList.remove('hidden');
    document.getElementById('banip-empty')?.classList.add('hidden');
  }

  async function submitBanIp() {
    const ip = banIpIp.value.trim();
    const reason = banIpReason.value.trim();
    if (!ip) {
      toast('Enter an IP address', { kind: 'error' });
      banIpIp.focus();
      return;
    }
    try {
      await withBusy(banIpBtn, 'Banning…', async () => {
        await api('/ban-ip', { ip, reason: reason || undefined });
        addBanIpRow(ip, reason);
        banIpIp.value = '';
        banIpReason.value = '';
        toast(`IP ${ip} banned`);
      });
    } catch (err) {
      fail(err);
    }
  }
  if (banIpBtn) {
    banIpBtn.addEventListener('click', submitBanIp);
    // Enter anywhere in the two fields submits — there is no form to do it.
    for (const el of [banIpIp, banIpReason]) {
      el?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitBanIp();
        }
      });
    }
  }
}
