// Inventory tab: god-mode inventory editor. Every slot (main, hotbar, armor,
// offhand, ender chest, nested backpacks) is clickable: change count, replace,
// move/swap, delete, or place an item into an empty slot. The backend picks
// the mechanism automatically — live `item replace` commands while the player
// is online, direct .dat rewrites (with backups) while they are not. Plus the
// original forensics: item search, snapshots + diff, RCON give/clear.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { openItemBrowser } from '../lib/itemBrowser.js';
import { withBusy } from '../lib/loading.js';

const root = document.querySelector('[data-inventory-root]');
if (root) init(root);

function init(root) {
  const serverId = root.dataset.serverId;
  const running = root.dataset.running === '1';
  const base = `/api/servers/${serverId}/inventory`;

  let players = [];
  let currentUuid = null;
  let currentData = null;
  let editInfo = null; // {online, mechanism: 'rcon'|'file', nestedEditable}
  let selectedSnaps = []; // rel file paths, max 2

  const el = (id) => document.getElementById(id);
  const playerSel = el('inv-player');

  async function api(path, opts) {
    const res = await fetch(base + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    return data;
  }

  function fail(err) {
    toast(err.message || 'Something went wrong', { kind: 'error' });
  }

  function esc(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  // ------------------------------------------------------------- formatting
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function prettyId(id) {
    const b = String(id).split(':').pop().replace(/_/g, ' ');
    return b.charAt(0).toUpperCase() + b.slice(1);
  }

  function prettyEnchant(e) {
    return `${prettyId(e.id)} ${ROMAN[e.lvl] || e.lvl}`;
  }

  /** Short text stamp for a slot: "diamond_sword" -> "DS", "stone" -> "STO". */
  function abbrev(id) {
    const parts = String(id).split(':').pop().split('_').filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
    return parts
      .slice(0, 3)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }

  function itemTip(item, extra = '') {
    const bits = [];
    bits.push(item.displayName ? `"${item.displayName}" (${prettyId(item.id)})` : prettyId(item.id));
    if (item.count > 1) bits.push(`x${item.count}`);
    if (item.enchants && item.enchants.length) bits.push(item.enchants.map(prettyEnchant).join(', '));
    if (item.damage) bits.push(`Damage ${item.damage}`);
    if (extra) bits.push(extra);
    return bits.join(' · ');
  }

  function when(ts) {
    return ts ? new Date(ts).toLocaleString() : '—';
  }

  // ------------------------------------------------------------------ icons
  // Inline lucide paths (same set the server-side icon helper renders).
  const ICONS = {
    hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/>',
    replace:
      '<path d="M14 4a2 2 0 0 1 2-2"/><path d="M16 10a2 2 0 0 1-2-2"/><path d="M20 2a2 2 0 0 1 2 2"/><path d="M22 8a2 2 0 0 1-2 2"/><path d="m3 7 3 3 3-3"/><path d="M6 10V5a3 3 0 0 1 3-3h1"/><rect x="2" y="14" width="8" height="8" rx="2"/>',
    move: '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
    trash:
      '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    package:
      '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  };
  function icon(name, cls = 'size-3.5') {
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  }

  const ARMOR_PIECES = ['head', 'chest', 'legs', 'feet'];

  function slotName(container, slot) {
    if (container === 'armor') return `armor.${ARMOR_PIECES[slot]}`;
    if (container === 'offhand') return 'offhand';
    return `${container}.${slot}`;
  }

  // ------------------------------------------------------------------ slots
  /**
   * One slot cell. Passing `at` = {container, slot} makes it an editable
   * button (click -> action menu / place dialog).
   */
  function slotCell(item, { label = '', at = null, onPick = null } = {}) {
    const editable = Boolean(at || onPick);
    const cell = document.createElement(editable ? 'button' : 'div');
    if (editable) cell.type = 'button';
    // Main-grid cells are addressable so slot edits that outlive their modal
    // (delete, move) can spin the on-page cell while the request runs.
    if (at) cell.dataset.slotKey = `${at.container}:${at.slot}`;
    cell.className =
      'relative grid size-10 place-items-center rounded border text-[10px] font-semibold select-none ' +
      (editable
        ? 'cursor-pointer transition hover:ring-2 hover:ring-diamond-400/60 focus-visible:ring-2 focus-visible:ring-diamond-400 '
        : '');
    const hasNested = Boolean(item && item.nested && item.nested.length);
    if (!item) {
      cell.className += 'border-line bg-inset/40';
      if (label)
        cell.innerHTML = `<span class="text-[8px] uppercase tracking-wide text-ink-faint/60">${esc(label)}</span>`;
      cell.dataset.tip = editable
        ? `Empty ${label || slotName(at.container, at.slot)} — click to put an item here`
        : label
          ? `Empty ${label} slot`
          : '';
    } else {
      const named = Boolean(item.displayName);
      const enchanted = Boolean(item.enchants && item.enchants.length);
      cell.className += named
        ? 'border-gold-500 bg-gold-400/10 text-warn'
        : enchanted
          ? 'border-diamond-700 bg-diamond-400/10 text-link'
          : 'border-line-strong bg-inset text-ink';
      const where = label
        ? `${label} slot`
        : at
          ? slotName(at.container, at.slot)
          : item.slot !== null
            ? `Slot ${item.slot}`
            : '';
      cell.dataset.tip = itemTip(
        item,
        [where, hasNested ? 'has contents' : '', editable ? 'click to edit' : ''].filter(Boolean).join(' · ')
      );
      cell.innerHTML = `
        <span>${esc(abbrev(item.id))}</span>
        ${item.count > 1 ? `<span class="absolute bottom-0 right-0.5 text-[9px] font-bold">${esc(item.count)}</span>` : ''}
        ${enchanted ? '<span class="absolute left-0.5 top-0 text-[9px]">*</span>' : ''}
        ${hasNested ? '<span class="absolute left-0.5 bottom-0.5 size-1.5 rounded-full bg-grass-400" aria-hidden="true"></span>' : ''}`;
    }
    if (onPick) cell.addEventListener('click', () => onPick(item || null));
    else if (at) cell.addEventListener('click', () => (item ? openSlotMenu(at, item) : openPlaceFlow(at)));
    return cell;
  }

  function fillGrid(containerId, count, itemsBySlot, offset = 0, container = null) {
    const grid = el(containerId);
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      grid.appendChild(slotCell(itemsBySlot.get(offset + i) || null, container ? { at: { container, slot: i } } : {}));
    }
  }

  function renderInventory(data) {
    const bySlot = new Map();
    for (const item of data.inventory) bySlot.set(item.slot, item);
    fillGrid('inv-grid-main', 27, bySlot, 9, 'inventory'); // NBT slots 9-35
    fillGrid('inv-grid-hotbar', 9, bySlot, 0, 'hotbar'); // NBT slots 0-8

    const armorGrid = el('inv-grid-armor');
    armorGrid.innerHTML = '';
    const byPiece = {};
    for (const piece of data.armor) byPiece[piece.piece] = piece;
    ARMOR_PIECES.forEach((piece, i) => {
      armorGrid.appendChild(slotCell(byPiece[piece] || null, { label: piece, at: { container: 'armor', slot: i } }));
    });
    armorGrid.appendChild(slotCell(data.offhand || null, { label: 'offhand', at: { container: 'offhand', slot: 0 } }));

    const enderBySlot = new Map();
    for (const item of data.enderChest) enderBySlot.set(item.slot, item);
    fillGrid('inv-grid-ender', 27, enderBySlot, 0, 'enderchest');

    const mech = el('inv-mech');
    if (editInfo) {
      mech.innerHTML =
        editInfo.mechanism === 'rcon'
          ? `${icon('zap', 'size-3.5 text-warn')} <span>Player is online — edits run live via commands. Backpack contents are read-only until they leave.</span>`
          : `${icon('file', 'size-3.5 text-link')} <span>Editing the save file directly — a backup of the previous state is kept (last 3).</span>`;
    } else {
      mech.innerHTML = '';
    }

    const meta = el('inv-meta');
    const chips = [];
    if (data.pos) {
      chips.push(`Position: ${data.pos.x} / ${data.pos.y} / ${data.pos.z}`);
      if (data.pos.dimension) chips.push(prettyId(data.pos.dimension));
    }
    if (data.health !== null) chips.push(`Health: ${data.health}`);
    if (data.xpLevel !== null) chips.push(`XP level: ${data.xpLevel}`);
    chips.push(`Saved: ${when(data.lastModified)}`);
    meta.innerHTML = chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  }

  /** The on-page grid cell for a slot address (null-safe for setBusy/withBusy). */
  function slotEl(at) {
    return root.querySelector(`[data-slot-key="${at.container}:${at.slot}"]`);
  }

  // ------------------------------------------------------------ slot editing
  async function postEdit(path, payload, okMessage) {
    try {
      const { result } = await api(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast(result.note || okMessage(result));
      await loadInventory(true); // fresh -> live edits show up immediately
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }

  function menuButton(label, iconName, danger = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'flex w-full items-center gap-2.5 rounded-md border border-line px-3 py-2 text-left text-sm transition hover:bg-inset ' +
      (danger ? 'text-danger hover:border-danger/40' : 'hover:border-line-strong');
    btn.innerHTML = `${icon(iconName, 'size-4 shrink-0')} <span>${esc(label)}</span>`;
    return btn;
  }

  function itemHeader(item, where) {
    return `
      <div class="rounded-md border border-line bg-inset/50 p-3">
        <div class="font-semibold ${item.displayName ? 'text-warn' : ''}">${esc(item.displayName || prettyId(item.id))}</div>
        <div class="font-mono text-xs text-ink-faint">${esc(item.id)} · x${esc(item.count)} · ${esc(where)}</div>
        ${item.enchants && item.enchants.length ? `<div class="mt-1 text-xs text-link">${esc(item.enchants.map(prettyEnchant).join(', '))}</div>` : ''}
      </div>`;
  }

  /** Action menu for a filled slot. `nested` = {path, index} when editing inside a backpack. */
  function openSlotMenu(at, item, nested = null) {
    const where = nested ? `inside ${slotName(at.container, at.slot)}` : slotName(at.container, at.slot);
    const content = document.createElement('div');
    content.className = 'space-y-3';
    content.insertAdjacentHTML('beforeend', itemHeader(item, where));
    const list = document.createElement('div');
    list.className = 'space-y-1.5';
    content.appendChild(list);

    const modal = openModal({ title: nested ? 'Edit backpack item' : 'Edit slot', content, size: 'sm' });
    const add = (label, iconName, handler, danger = false) => {
      const btn = menuButton(label, iconName, danger);
      btn.addEventListener('click', () => {
        modal.close();
        handler();
      });
      list.appendChild(btn);
    };

    add('Change count', 'hash', () => openCountModal(at, item, nested));
    add('Replace item', 'replace', () => openPlaceFlow(at, { replacing: item, nested }));
    if (!nested) add('Move to another slot', 'move', () => openMoveModal(at, item));
    if (!nested && item.nested && item.nested.length) {
      for (const sub of item.nested) {
        const filled = sub.items.filter((i) => i.id).length;
        add(`${sub.label} (${filled} item${filled === 1 ? '' : 's'})`, 'package', () => openNestedModal(at, item, sub));
      }
    }
    add(
      'Delete',
      'trash',
      async () => {
        if (
          !(await confirmDialog({
            title: `Delete ${item.displayName || prettyId(item.id)}?`,
            message: `Removes ${item.count} × ${item.id} from ${where}. Take a snapshot first if you might want it back.`,
            confirmLabel: 'Delete item',
            danger: true, // without this the destructive confirm rendered as a green primary
          }))
        )
          return;
        // The menu modal is already closed — spin the on-page grid cell instead.
        withBusy(slotEl(at), () =>
          postEdit(
            `/player/${currentUuid}/slot`,
            { container: at.container, slot: at.slot, op: 'delete', ...(nested ? { nested } : {}) },
            (r) => `Deleted ${r.item} from ${r.slot}`
          )
        );
      },
      true
    );
  }

  /** Count + confirm dialog for op 'set' / 'count'. */
  function countDialog({ title, header = '', value = 1, confirmLabel, onSubmit }) {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      ${header}
      <div>
        <label class="label">Count (1-99)</label>
        <input class="input" data-f="count" type="number" min="1" max="99" value="${esc(value)}">
      </div>`;
    openModal({
      title,
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: confirmLabel,
          kind: 'primary',
          onClick: async ({ body }) => {
            const n = Math.trunc(Number(body.querySelector('[data-f="count"]').value));
            if (!Number.isInteger(n) || n < 1 || n > 99) {
              toast('Enter a count between 1 and 99', { kind: 'error' });
              return false;
            }
            return (await onSubmit(n, body)) ? undefined : false;
          },
        },
      ],
    });
  }

  function openCountModal(at, item, nested = null) {
    countDialog({
      title: 'Change count',
      header: itemHeader(item, slotName(at.container, at.slot)),
      value: item.count,
      confirmLabel: 'Set count',
      onSubmit: (n) =>
        postEdit(
          `/player/${currentUuid}/slot`,
          { container: at.container, slot: at.slot, op: 'count', count: n, ...(nested ? { nested } : {}) },
          (r) => `${r.item} in ${r.slot} set to ${r.count}`
        ),
    });
  }

  /** Place/replace flow: item browser -> count -> POST set. */
  function openPlaceFlow(at, { replacing = null, nested = null } = {}) {
    const ask = (picked) => {
      const id = picked ? picked.id : null;
      const header = picked
        ? `<div class="rounded-md border border-line bg-inset/50 p-3">
             <div class="font-semibold">${esc(picked.name)}</div>
             <div class="font-mono text-xs text-ink-faint">${esc(picked.id)} → ${esc(slotName(at.container, at.slot))}</div>
           </div>`
        : `<div>
             <label class="label">Item id</label>
             <input class="input font-mono" data-f="item" placeholder="minecraft:diamond" maxlength="130" autocomplete="off" spellcheck="false">
           </div>`;
      countDialog({
        title: replacing ? 'Replace item' : 'Put item here',
        header,
        value: 1,
        confirmLabel: replacing ? 'Replace' : 'Place',
        onSubmit: async (n, body) => {
          let itemId = id;
          if (!itemId) {
            const input = body.querySelector('[data-f="item"]');
            itemId = input ? input.value.trim() : '';
            if (!itemId) {
              toast('Enter an item id', { kind: 'error' });
              return false;
            }
          }
          return postEdit(
            `/player/${currentUuid}/slot`,
            {
              container: at.container,
              slot: at.slot,
              op: 'set',
              item: itemId,
              count: n,
              ...(nested ? { nested } : {}),
            },
            (r) => `${r.count}x ${r.item} placed in ${r.slot}`
          );
        },
      });
    };
    openItemBrowser({ serverId, onPick: ask, onManual: () => ask(null) });
  }

  /** Move/swap target picker: every container rendered as a clickable mini-grid. */
  function openMoveModal(from, item) {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.insertAdjacentHTML('beforeend', itemHeader(item, slotName(from.container, from.slot)));
    const hint =
      editInfo && editInfo.mechanism === 'rcon'
        ? 'Pick a target slot. While the player is online, occupied targets are rejected — swaps need them offline.'
        : 'Pick a target slot. Occupied targets swap the two items.';
    content.insertAdjacentHTML('beforeend', `<p class="text-xs text-ink-faint">${hint}</p>`);

    const modal = openModal({ title: 'Move to…', content, size: 'lg' });

    const doMove = async (to) => {
      if (to.container === from.container && to.slot === from.slot) {
        toast('That is the same slot', { kind: 'error' });
        return;
      }
      modal.close();
      // Picker modal is closed — spin the source cell in the on-page grid.
      await withBusy(slotEl(from), () =>
        postEdit(
          `/player/${currentUuid}/move`,
          { from: { container: from.container, slot: from.slot }, to },
          (r) => `${r.item} ${r.swapped ? 'swapped with' : 'moved to'} ${r.to}`
        )
      );
    };

    const section = (label, container, count, itemsBySlot, offset = 0, labels = null) => {
      const box = document.createElement('div');
      box.innerHTML = `<div class="mb-1 text-[11px] uppercase tracking-wider text-ink-faint">${esc(label)}</div>`;
      const grid = document.createElement('div');
      grid.className = 'grid w-max grid-cols-9 gap-1';
      for (let i = 0; i < count; i++) {
        const occupant = itemsBySlot.get(offset + i) || null;
        const isSource = container === from.container && i === from.slot;
        const cell = slotCell(occupant, {
          label: labels ? labels[i] : '',
          onPick: isSource
            ? () => toast('That is the source slot', { kind: 'error' })
            : () => doMove({ container, slot: i }),
        });
        if (isSource) cell.classList.add('ring-2', 'ring-gold-500');
        grid.appendChild(cell);
      }
      box.appendChild(grid);
      return box;
    };

    const bySlot = new Map();
    for (const it of currentData.inventory) bySlot.set(it.slot, it);
    const enderBySlot = new Map();
    for (const it of currentData.enderChest) enderBySlot.set(it.slot, it);
    const armorBySlot = new Map();
    for (const piece of currentData.armor) armorBySlot.set(ARMOR_PIECES.indexOf(piece.piece), piece);
    if (currentData.offhand) armorBySlot.set(4, currentData.offhand);

    const grids = document.createElement('div');
    grids.className = 'space-y-3';
    grids.appendChild(section('Hotbar', 'hotbar', 9, bySlot, 0));
    grids.appendChild(section('Inventory', 'inventory', 27, bySlot, 9));
    grids.appendChild(section('Ender chest', 'enderchest', 27, enderBySlot, 0));
    // Armor + offhand share one row; the last cell routes to the offhand container.
    const armorRow = section('Armor & offhand', 'armor', 4, armorBySlot, 0, ARMOR_PIECES);
    const offCell = slotCell(currentData.offhand || null, {
      label: 'offhand',
      onPick:
        from.container === 'offhand' && from.slot === 0
          ? () => toast('That is the source slot', { kind: 'error' })
          : () => doMove({ container: 'offhand', slot: 0 }),
    });
    if (from.container === 'offhand') offCell.classList.add('ring-2', 'ring-gold-500');
    armorRow.querySelector('.grid').appendChild(offCell);
    grids.appendChild(armorRow);
    content.appendChild(grids);
  }

  /** Expandable sub-inventory (backpack / shulker / bundle contents). */
  function openNestedModal(at, holder, sub) {
    const editable = Boolean(editInfo && editInfo.nestedEditable);
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.insertAdjacentHTML('beforeend', itemHeader(holder, `${sub.label} · ${slotName(at.container, at.slot)}`));
    if (!editable) {
      content.insertAdjacentHTML(
        'beforeend',
        '<p class="rounded-md border border-gold-500/40 bg-gold-400/5 p-2.5 text-xs text-warn">Read-only while the player is online — stop the server or kick the player to edit backpack contents.</p>'
      );
    }
    const grid = document.createElement('div');
    grid.className = 'grid w-max max-w-full grid-cols-9 gap-1';
    const modal = openModal({ title: sub.label, content, size: 'md' });
    for (const entry of sub.items) {
      if (!entry.id) {
        grid.appendChild(slotCell(null, {}));
        continue;
      }
      const cell = slotCell(
        entry,
        editable
          ? {
              onPick: () => {
                modal.close();
                openSlotMenu(at, entry, { path: sub.path, index: entry.index });
              },
            }
          : {}
      );
      grid.appendChild(cell);
    }
    content.appendChild(grid);
    content.insertAdjacentHTML(
      'beforeend',
      `<p class="text-xs text-ink-faint">${sub.items.filter((i) => i.id).length} stack(s)${editable ? ' — click one to edit it' : ''}. Deeper nested containers open from their own item menus after a reload.</p>`
    );
  }

  // ---------------------------------------------------------------- players
  async function loadPlayers() {
    const fixed = root.dataset.fixedUuid || '';
    try {
      const { players: list } = await api('/players');
      players = list;
    } catch (err) {
      if (!fixed) fail(err);
      players = [];
    }
    el('inv-loading')?.classList.add('hidden'); // the fetch decided which state shows
    // Player page: pinned to one player — skip the picker and load them directly.
    if (fixed) {
      el('inv-empty').classList.add('hidden');
      await selectPlayer(fixed);
      return;
    }
    playerSel.innerHTML = '';
    if (!players.length) {
      playerSel.innerHTML = '<option value="">No player data yet</option>';
      el('inv-empty').classList.remove('hidden');
      el('inv-view').classList.add('hidden');
      playerSel.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    el('inv-empty').classList.add('hidden');
    for (const p of players) {
      const opt = document.createElement('option');
      opt.value = p.uuid;
      opt.textContent = p.name || p.uuid;
      opt.dataset.desc = `saved ${when(p.lastModified)}`;
      playerSel.appendChild(opt);
    }
    await selectPlayer(players[0].uuid);
  }

  async function selectPlayer(uuid) {
    currentUuid = uuid;
    playerSel.value = uuid;
    playerSel.dispatchEvent(new Event('change', { bubbles: true })); // resync the enhanced trigger
    await Promise.all([loadInventory(), loadSnapshots()]);
  }

  async function loadInventory(fresh = false) {
    if (!currentUuid) return;
    try {
      const { player, edit } = await api(`/player/${currentUuid}${fresh ? '?fresh=1' : ''}`);
      currentData = player;
      editInfo = edit || null;
      renderInventory(player);
      el('inv-view').classList.remove('hidden');
    } catch (err) {
      currentData = null;
      editInfo = null;
      el('inv-view').classList.add('hidden');
      // On a single-player page, "no saved data yet" is expected, not an error.
      if (root.dataset.fixedUuid) el('inv-empty').classList.remove('hidden');
      else fail(err);
    }
  }

  playerSel.addEventListener('change', async () => {
    if (playerSel.value && playerSel.value !== currentUuid) {
      // The select is enhanced (hidden native + trigger button): a content
      // swap would fight syncTrigger, so disable both during the load instead.
      const trigger = playerSel.nextElementSibling;
      const t = trigger && trigger.classList.contains('msm-select') ? trigger : null;
      playerSel.disabled = true;
      if (t) t.disabled = true;
      try {
        await selectPlayer(playerSel.value);
      } finally {
        playerSel.disabled = false;
        if (t) t.disabled = false;
      }
    }
  });

  el('inv-refresh').addEventListener('click', (e) =>
    withBusy(e.currentTarget, async () => {
      await loadInventory(true); // flush online players to disk first
      toast('Inventory reloaded');
    })
  );

  // -------------------------------------------------------------- snapshots
  async function loadSnapshots() {
    const box = el('inv-snapshots');
    el('inv-diff').classList.add('hidden');
    selectedSnaps = [];
    updateDiffButton();
    if (!currentUuid) {
      box.innerHTML = '';
      return;
    }
    let snapshots = [];
    try {
      ({ snapshots } = await api(`/player/${currentUuid}/snapshots`));
    } catch (err) {
      fail(err);
    }
    if (!snapshots.length) {
      box.innerHTML =
        '<p class="text-sm text-ink-faint">No snapshots for this player yet — press Snapshot above, or wait for the automatic ones taken on joins and deaths.</p>';
      return;
    }
    box.innerHTML = `
      <div class="overflow-x-auto"><table class="table-base">
        <thead><tr><th class="w-8"></th><th>Taken</th><th>Trigger</th><th class="text-right">Size</th></tr></thead>
        <tbody>
          ${snapshots
            .map(
              (s) => `
            <tr>
              <td><input type="checkbox" class="msm-check" data-snap-file="${esc(s.file)}" aria-label="Select snapshot"></td>
              <td class="text-sm">${esc(when(s.ts))}</td>
              <td><span class="chip">${esc(s.reason)}</span></td>
              <td class="text-right text-xs text-ink-faint">${(s.size / 1024).toFixed(1)} KB</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table></div>`;
    box.querySelectorAll('[data-snap-file]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const file = cb.dataset.snapFile;
        if (cb.checked) {
          selectedSnaps.push(file);
          if (selectedSnaps.length > 2) {
            // Keep the two most recent picks — uncheck the oldest selection.
            const dropped = selectedSnaps.shift();
            const old = box.querySelector(`[data-snap-file="${CSS.escape(dropped)}"]`);
            if (old) old.checked = false;
          }
        } else {
          selectedSnaps = selectedSnaps.filter((f) => f !== file);
        }
        updateDiffButton();
      });
    });
  }

  function updateDiffButton() {
    el('inv-diff-go').disabled = selectedSnaps.length !== 2;
  }

  el('inv-snapshot').addEventListener('click', async (e) => {
    if (!currentUuid) return toast('Pick a player first', { kind: 'error' });
    await withBusy(e.currentTarget, 'Snapshotting…', async () => {
      try {
        await api(`/player/${currentUuid}/snapshot`, { method: 'POST' });
        toast('Snapshot saved');
        await loadSnapshots();
      } catch (err) {
        fail(err);
      }
    });
  });

  el('inv-diff-go').addEventListener('click', async (e) => {
    if (selectedSnaps.length !== 2) return;
    // Diff oldest -> newest so "added" means gained since the earlier snapshot.
    const [a, b] = [...selectedSnaps].sort((x, y) => snapTs(x) - snapTs(y));
    await withBusy(e.currentTarget, async () => {
      try {
        const { diff } = await api(`/diff?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
        renderDiff(diff);
      } catch (err) {
        fail(err);
      }
    });
  });

  function snapTs(file) {
    const m = /\/(\d+)-[a-z0-9_-]+\.json$/.exec(file);
    return m ? Number(m[1]) : 0;
  }

  function diffLine(entry, kind) {
    const name = entry.displayName
      ? `<span class="text-warn">"${esc(entry.displayName)}"</span> <span class="text-ink-faint">(${esc(prettyId(entry.id))})</span>`
      : esc(prettyId(entry.id));
    const qty =
      kind === 'changed'
        ? `<span class="font-mono text-xs">${entry.from} &rarr; ${entry.to}</span>`
        : `<span class="font-mono text-xs">x${entry.count}</span>`;
    return `<li class="flex items-center justify-between gap-3 rounded px-2 py-1 text-sm odd:bg-inset/50"><span class="min-w-0 truncate">${name}</span>${qty}</li>`;
  }

  function renderDiff(diff) {
    const box = el('inv-diff');
    const section = (title, cls, entries, kind) => `
      <div class="rounded-md border border-line p-3">
        <div class="mb-2 text-xs font-semibold uppercase tracking-wider ${cls}">${title} (${entries.length})</div>
        ${entries.length ? `<ul class="space-y-0.5">${entries.map((e) => diffLine(e, kind)).join('')}</ul>` : '<p class="text-xs text-ink-faint">Nothing here.</p>'}
      </div>`;
    box.innerHTML = `
      <div class="mb-2 text-xs text-ink-faint">
        Comparing <b class="text-ink-soft">${esc(when(diff.a.ts))}</b> (${esc(diff.a.reason)})
        &rarr; <b class="text-ink-soft">${esc(when(diff.b.ts))}</b> (${esc(diff.b.reason)}) — counts pooled across inventory, armor, offhand and ender chest.
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        ${section('Added', 'text-ok', diff.added, 'added')}
        ${section('Removed', 'text-danger', diff.removed, 'removed')}
        ${section('Changed', 'text-warn', diff.changed, 'changed')}
      </div>`;
    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ----------------------------------------------------------------- search
  async function runSearch() {
    // setBusy on an already-busy control is a no-op that still runs the fn —
    // the Enter path was double-firing the request during flight.
    if (el('inv-search-go').dataset.busy) return;
    const q = el('inv-search-q').value.trim();
    if (!q) return toast('Enter something to search for', { kind: 'error' });
    const box = el('inv-search-results');
    try {
      // Busy the Search button for both entry points (button click and Enter).
      const { results } = await withBusy(el('inv-search-go'), () => api(`/search?q=${encodeURIComponent(q)}`));
      el('inv-search-hint').classList.add('hidden');
      box.classList.remove('hidden');
      if (!results.length) {
        box.innerHTML = `<p class="py-4 text-center text-sm text-ink-faint">No items matching "${esc(q)}" in any player's storage.</p>`;
        return;
      }
      box.innerHTML = `
        <table class="table-base">
          <thead><tr><th>Player</th><th>Where</th><th>Slot</th><th>Item</th><th class="text-right">Count</th></tr></thead>
          <tbody>
            ${results
              .map(
                (r) => `
              <tr>
                <td class="text-sm">${esc(r.player.name || r.player.uuid)}</td>
                <td><span class="chip">${esc(whereLabel(r.where))}</span></td>
                <td class="font-mono text-xs">${r.slot === null ? '—' : esc(r.slot)}</td>
                <td class="text-sm">
                  ${r.displayName ? `<span class="text-warn">"${esc(r.displayName)}"</span> <span class="text-xs text-ink-faint">(${esc(r.id)})</span>` : `<span class="font-mono text-xs">${esc(r.id)}</span>`}
                </td>
                <td class="text-right font-mono text-xs">${esc(r.count)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    } catch (err) {
      fail(err);
    }
  }

  function whereLabel(where) {
    return { inventory: 'Inventory', enderChest: 'Ender chest', armor: 'Armor', offhand: 'Offhand' }[where] || where;
  }

  // The item-search card is absent on a single-player page (server-wide feature).
  el('inv-search-go')?.addEventListener('click', runSearch);
  el('inv-search-q')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  // ------------------------------------------------------------- give/clear
  function currentPlayerName() {
    const p = players.find((x) => x.uuid === currentUuid);
    return (p && p.name) || root.dataset.fixedName || '';
  }

  // Give flow: the button opens the JEI-style item browser (every vanilla +
  // modded item on this server); picking a row opens the small give dialog.
  // The old free-text path stays reachable via "enter id manually".
  // Server stopped -> the pick lands in the selected player's SAVE FILE
  // instead (first free slot), so god mode works either way.
  el('inv-give').addEventListener('click', () => {
    if (!running && !currentUuid) return toast('Pick a player with saved data first', { kind: 'error' });
    openItemBrowser({
      serverId,
      onPick: (item) => (running ? openGiveModal(item) : openAddModal(item)),
      onManual: () => (running ? openGiveModal(null) : openAddModal(null)),
    });
  });

  /** Offline give: add to the first free slot via the .dat (backup kept). */
  function openAddModal(item) {
    const header = item
      ? `<div class="rounded-md border border-line bg-inset/50 p-3">
           <div class="font-semibold">${esc(item.name)}</div>
           <div class="font-mono text-xs text-ink-faint">${esc(item.id)} → first free slot of ${esc(currentPlayerName() || currentUuid)}</div>
         </div>`
      : `<div>
           <label class="label">Item id</label>
           <input class="input font-mono" data-f="item" placeholder="minecraft:diamond" maxlength="130" autocomplete="off" spellcheck="false">
         </div>`;
    countDialog({
      title: item ? `Add ${item.name}` : 'Add item',
      header,
      value: 1,
      confirmLabel: 'Add to save file',
      onSubmit: async (n, body) => {
        let itemId = item ? item.id : null;
        if (!itemId) {
          const input = body.querySelector('[data-f="item"]');
          itemId = input ? input.value.trim() : '';
          if (!itemId) {
            toast('Enter an item id', { kind: 'error' });
            return false;
          }
        }
        return postEdit(
          `/player/${currentUuid}/add`,
          { item: itemId, count: n },
          (r) => `${r.count}x ${r.item} added to slot ${r.slot} (save file — backup kept)`
        );
      },
    });
  }

  /** Give dialog. `item` = {id, name} from the browser, or null for manual entry. */
  function openGiveModal(item) {
    const names = players.map((p) => p.name).filter(Boolean);
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      ${
        item
          ? `
        <div class="rounded-md border border-line bg-inset/50 p-3">
          <div class="font-semibold">${esc(item.name)}</div>
          <div class="font-mono text-xs text-ink-faint">${esc(item.id)}</div>
        </div>`
          : `
        <div>
          <label class="label">Item id</label>
          <input class="input font-mono" data-f="item" placeholder="minecraft:diamond" maxlength="130" autocomplete="off" spellcheck="false">
        </div>`
      }
      <div>
        <label class="label">Player (must be online)</label>
        <input class="input" data-f="player" maxlength="16" value="${esc(currentPlayerName())}"
               list="inv-give-players" autocomplete="off" spellcheck="false">
        <datalist id="inv-give-players">${names.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        ${names.length ? '<p class="mt-1 text-xs text-ink-faint">Pick a player with saved data, or type any online name.</p>' : ''}
      </div>
      <div>
        <label class="label">Count</label>
        <input class="input" data-f="count" type="number" min="1" max="6400" value="1">
      </div>`;
    openModal({
      title: item ? `Give ${item.name}` : 'Give item',
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Give',
          kind: 'primary',
          onClick: async ({ body }) => {
            const f = (k) => {
              const input = body.querySelector(`[data-f="${k}"]`);
              return input ? input.value.trim() : '';
            };
            const itemId = item ? item.id : f('item');
            if (!/^[A-Za-z0-9_]{1,16}$/.test(f('player'))) {
              toast('Enter a valid player name', { kind: 'error' });
              return false;
            }
            if (!itemId) {
              toast('Enter an item id', { kind: 'error' });
              return false;
            }
            try {
              const { result } = await api('/give', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player: f('player'), item: itemId, count: Number(f('count')) || 1 }),
              });
              toast(`Gave ${result.player} ${result.count} x ${item ? item.name : result.item}`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }

  el('inv-clear').addEventListener('click', () => {
    if (!running) return;
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <div>
        <label class="label">Player (must be online)</label>
        <input class="input" data-f="player" maxlength="16" value="${esc(currentPlayerName())}" autocomplete="off" spellcheck="false">
      </div>
      <div>
        <label class="label">Item id (leave empty to clear everything)</label>
        <input class="input font-mono" data-f="item" placeholder="minecraft:tnt" maxlength="130" autocomplete="off" spellcheck="false">
      </div>`;
    openModal({
      title: 'Clear items',
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Clear',
          kind: 'danger',
          onClick: async ({ body }) => {
            const f = (k) => body.querySelector(`[data-f="${k}"]`).value.trim();
            const player = f('player');
            const item = f('item');
            if (!/^[A-Za-z0-9_]{1,16}$/.test(player)) {
              toast('Enter a valid player name', { kind: 'error' });
              return false;
            }
            if (
              !item &&
              !(await confirmDialog({
                title: `Clear the ENTIRE inventory of ${player}?`,
                message:
                  'Every item they carry will be deleted. This cannot be undone — take a snapshot first if you might need it back.',
                confirmLabel: 'Clear everything',
                danger: true, // the most destructive dialog on the tab must not look like a positive action
              }))
            )
              return false;
            try {
              const { result } = await api('/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item ? { player, item } : { player }),
              });
              toast(
                result.nothingRemoved
                  ? `Nothing to remove from ${result.player}`
                  : `Cleared ${result.item || 'all items'} from ${result.player}`
              );
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  });

  // ------------------------------------------------------------------- boot
  loadPlayers();
}
