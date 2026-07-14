// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Player-inventory NBT normalization. Pure functions: id/name validation,
// item-stack normalization across the pre-1.20.5 'tag' and 1.20.5+ 'components'
// formats, and generic nested-inventory (backpack/shulker) detection.

const httpError = require('../../utils/httpError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_RE = /^[A-Za-z0-9_]{1,16}$/;
// Item ids travel through RCON — restrict to registry-shaped ids so nothing
// can smuggle command fragments.
const ITEM_RE = /^([a-z0-9_.-]+:)?[a-z0-9_./-]{1,120}$/;

function assertUuid(uuid) {
  const u = String(uuid || '').toLowerCase();
  if (!UUID_RE.test(u)) throw httpError(400, 'Invalid player UUID');
  return u;
}

function assertName(name) {
  if (!NAME_RE.test(String(name)))
    throw httpError(400, 'Invalid player name (letters, digits and _ only, max 16 chars)');
  return String(name);
}

function assertItemId(item) {
  const id = String(item || '')
    .toLowerCase()
    .trim();
  if (!ITEM_RE.test(id)) throw httpError(400, 'Invalid item id (e.g. minecraft:diamond_sword)');
  return id;
}

// ---------------------------------------------------------------------------
// Item normalization — both the pre-1.20.5 'tag' compound and the 1.20.5+
// 'components' format. Unknown structures degrade to { slot, id, count }.

/** Flatten a Minecraft text component (JSON string, plain string, object, or array) to plain text. */
function textComponentToString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const raw = value.trim();
    if (raw.startsWith('{') || raw.startsWith('[') || raw.startsWith('"')) {
      try {
        return textComponentToString(JSON.parse(raw));
      } catch {
        /* not JSON — legacy plain name */
      }
    }
    // Legacy plain string (possibly with § color codes).
    const text = raw.replace(/§./g, '').trim();
    return text || null;
  }
  if (Array.isArray(value)) {
    const text = value.map((v) => textComponentToString(v) || '').join('');
    return text || null;
  }
  if (typeof value === 'object') {
    const own = typeof value.text === 'string' ? value.text : '';
    const extra = Array.isArray(value.extra) ? value.extra.map((v) => textComponentToString(v) || '').join('') : '';
    const text = (own + extra).replace(/§./g, '').trim();
    return text || null;
  }
  return String(value);
}

/** [{id, lvl}] from either enchantment container shape, or null. */
function normalizeEnchants(value) {
  if (!value) return null;
  const out = [];
  if (Array.isArray(value)) {
    // Pre-1.20.5: tag.Enchantments = [{id: 'minecraft:sharpness', lvl: 5}]
    for (const e of value) {
      if (e && e.id !== undefined) out.push({ id: String(e.id), lvl: Number(e.lvl ?? e.level ?? 1) });
    }
  } else if (typeof value === 'object') {
    // 1.20.5–1.21.4: {levels: {'minecraft:sharpness': 5}}; 1.21.5+: {'minecraft:sharpness': 5}
    const levels = value.levels && typeof value.levels === 'object' ? value.levels : value;
    for (const [id, lvl] of Object.entries(levels)) {
      if (typeof lvl === 'number' || typeof lvl === 'bigint') out.push({ id, lvl: Number(lvl) });
    }
  }
  return out.length ? out : null;
}

/**
 * Normalize one simplified-NBT item stack.
 * @returns {{slot:number|null, id:string, count:number, displayName?:string,
 *            enchants?:[{id:string,lvl:number}], damage?:number}|null}
 */
function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object' || raw.id === undefined) return null;
  const item = {
    slot: raw.Slot !== undefined ? Number(raw.Slot) : null,
    id: String(raw.id),
    count: Number(raw.count ?? raw.Count ?? 1),
  };
  try {
    let displayName = null;
    let enchants = null;
    let damage = null;

    if (raw.components && typeof raw.components === 'object') {
      // 1.20.5+ data components
      const c = raw.components;
      displayName = textComponentToString(c['minecraft:custom_name']);
      enchants =
        normalizeEnchants(c['minecraft:enchantments']) || normalizeEnchants(c['minecraft:stored_enchantments']);
      if (typeof c['minecraft:damage'] === 'number') damage = c['minecraft:damage'];
    } else if (raw.tag && typeof raw.tag === 'object') {
      // Pre-1.20.5 'tag' compound
      const t = raw.tag;
      if (t.display && t.display.Name !== undefined) displayName = textComponentToString(t.display.Name);
      enchants =
        normalizeEnchants(t.Enchantments) || normalizeEnchants(t.StoredEnchantments) || normalizeEnchants(t.ench); // <1.13 numeric-id list — ids kept as-is
      if (typeof t.Damage === 'number') damage = t.Damage;
    }

    if (displayName) item.displayName = displayName;
    if (enchants) item.enchants = enchants;
    if (damage !== null) item.damage = damage;
  } catch {
    // Unknown structure — id + count only.
  }
  return item;
}

// ---------------------------------------------------------------------------
// Nested inventories (backpacks, shulker boxes, bundles, …) — generic
// detection: any LIST of compounds inside an item's components/tag whose
// elements look like item stacks. Two element shapes are recognized:
//   direct:  {id, count|Count, Slot?}            (bundles, most mods)
//   wrapped: {slot?, item: {id, count}}          (minecraft:container, shulkers)

const NESTED_MAX_DEPTH = 3; // levels of item-lists (backpack in backpack in backpack)
const NESTED_MAX_PATH = 10; // path segments from the item root
const NESTED_KEY_RE = /^[A-Za-z0-9_:./ -]{1,80}$/;

/** The compound that actually holds id/count for a list element (or null). */
function nestedElementItem(el) {
  if (!el || typeof el !== 'object' || Array.isArray(el)) return null;
  if (typeof el.id === 'string') return el;
  if (el.item && typeof el.item === 'object' && typeof el.item.id === 'string') return el.item;
  return null;
}

/** True when a simplified-NBT array reads as a list of item stacks. */
function isItemList(arr) {
  if (!Array.isArray(arr) || !arr.length || arr.length > 256) return false;
  let stacks = 0;
  for (const el of arr) {
    if (!el || typeof el !== 'object' || Array.isArray(el)) return false;
    const item = nestedElementItem(el);
    if (item && item.id.includes(':') && (item.count !== undefined || item.Count !== undefined)) stacks += 1;
    else if (Object.keys(el).length) return false; // a non-item compound — not an inventory
  }
  return stacks > 0;
}

/** 'minecraft:container' -> 'Container', 'sophisticatedcore:inventory' -> 'Inventory'. */
function nestedLabel(pathSegs) {
  for (let i = pathSegs.length - 1; i >= 0; i--) {
    if (
      typeof pathSegs[i] === 'string' &&
      pathSegs[i] !== 'tag' &&
      pathSegs[i] !== 'components' &&
      pathSegs[i] !== 'item'
    ) {
      const base = pathSegs[i].split(':').pop().replace(/[_.]/g, ' ').trim();
      if (base) return base.charAt(0).toUpperCase() + base.slice(1);
    }
  }
  return 'Contents';
}

/**
 * Find every nested item list inside a simplified raw item stack.
 * @returns {[{path:(string|number)[], label:string, items:[{index, slot, ...normalized}]}]}
 *          path starts at the item root (e.g. ['components','minecraft:container']).
 */
function detectNestedInventories(raw) {
  const found = [];
  const visit = (node, pathSegs, depth) => {
    if (!node || typeof node !== 'object' || pathSegs.length > NESTED_MAX_PATH || found.length >= 20) return;
    if (Array.isArray(node)) {
      if (isItemList(node)) {
        if (depth >= NESTED_MAX_DEPTH) return;
        found.push({
          path: pathSegs,
          label: nestedLabel(pathSegs),
          items: node.map((el, index) => {
            const inner = nestedElementItem(el);
            const it = inner ? normalizeItem(inner) : null;
            const slot = el.slot ?? el.Slot ?? (inner ? inner.Slot : undefined);
            return it
              ? { index, ...it, slot: slot !== undefined ? Number(slot) : it.slot, wrapped: inner !== el }
              : { index, id: null, slot: slot !== undefined ? Number(slot) : null };
          }),
        });
        // Descend into the stacks themselves — backpack in a backpack.
        node.forEach((el, i) => visit(el, [...pathSegs, i], depth + 1));
        return;
      }
      node.forEach((el, i) => visit(el, [...pathSegs, i], depth));
      return;
    }
    for (const [key, value] of Object.entries(node)) visit(value, [...pathSegs, key], depth);
  };
  try {
    for (const rootKey of ['components', 'tag']) {
      if (raw && raw[rootKey] && typeof raw[rootKey] === 'object') visit(raw[rootKey], [rootKey], 0);
    }
  } catch {
    /* never let odd modded NBT break a read */
  }
  return found;
}

/** normalizeItem + nested sub-inventory detection (top-level stacks only). */
function normalizeItemDeep(raw) {
  const item = normalizeItem(raw);
  if (!item) return null;
  const nested = detectNestedInventories(raw);
  if (nested.length) item.nested = nested;
  return item;
}

module.exports = {
  assertUuid,
  assertName,
  assertItemId,
  textComponentToString,
  normalizeItem,
  normalizeItemDeep,
  detectNestedInventories,
  UUID_RE,
  NAME_RE,
  NESTED_MAX_PATH,
  NESTED_KEY_RE,
};
