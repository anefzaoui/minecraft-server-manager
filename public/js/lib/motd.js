// Visual MOTD editor: color/format toolbar, live Minecraft-style preview, and
// a clickable preset gallery. Attach to any text input via attachMotdEditor.
//
// Editing uses friendly &-codes; call toSectionCodes() on the value before
// sending it to the server — vanilla only renders real §-codes, and storing
// "&a…" raw shows the literal characters in the client server list.

import { openModal } from './modal.js';

export const MC_COLORS = [
  ['0', '#000000', 'Black'],
  ['1', '#0000AA', 'Dark Blue'],
  ['2', '#00AA00', 'Dark Green'],
  ['3', '#00AAAA', 'Dark Aqua'],
  ['4', '#AA0000', 'Dark Red'],
  ['5', '#AA00AA', 'Dark Purple'],
  ['6', '#FFAA00', 'Gold'],
  ['7', '#AAAAAA', 'Gray'],
  ['8', '#555555', 'Dark Gray'],
  ['9', '#5555FF', 'Blue'],
  ['a', '#55FF55', 'Green'],
  ['b', '#55FFFF', 'Aqua'],
  ['c', '#FF5555', 'Red'],
  ['d', '#FF55FF', 'Light Purple'],
  ['e', '#FFFF55', 'Yellow'],
  ['f', '#FFFFFF', 'White'],
];

const FORMATS = [
  ['l', 'B', 'Bold', 'font-bold'],
  ['o', 'I', 'Italic', 'italic'],
  ['n', 'U', 'Underline', 'underline'],
  ['m', 'S', 'Strikethrough', 'line-through'],
  ['k', '▓', 'Obfuscated (scrambles in-game)', ''],
  ['r', '⟲', 'Reset formatting', ''],
];

export const MOTD_PRESETS = [
  '&a&lWelcome to {server}&r&7 — have fun, be kind!',
  '&b&l>>> &f&l{server} &b&l<<<&r\n&7Season 3 — fresh world',
  '&6⛏ &e{server} &8| &fSurvival &8| &fFriends only',
  '&c&lHARDCORE&r &8— &7one life, no mercy',
  '&d✿ &5{server} &d✿&r\n&7cozy vibes only',
  '&2&lModded &a{server}&r\n&7bring RAM — 100+ mods',
  '&9&m----------&r &b&lSkyBlock &9&m----------',
  '&e☀ &fOnline day & night &8| &7low-lag survival',
  '&7[&a1.21&7] &fVanilla+ &8| &cNo grief &8| &b/wild',
  '&4&l⚠ &cUnder construction&r &7— back soon',
  '&f❄ &b{server} Winter Event &f❄&r\n&7double XP weekends',
  '&5&k!!&r &d{server} &5&k!!&r\n&7you never know what happens',
  '&6&lEpic Realm&r\n&7a fresh world awaits',
  '&a→ &fFirst time? &e/spawn &fthen &e/help',
];

/** & or § codes → styled DOM (writes into el). */
export function renderMotdInto(el, text) {
  el.innerHTML = '';
  let color = '#AAAAAA';
  let bold = false,
    italic = false,
    underline = false,
    strike = false,
    obf = false;
  const flush = (buf) => {
    if (!buf) return;
    const s = document.createElement('span');
    s.textContent = buf;
    s.style.color = color;
    if (bold) s.style.fontWeight = '700';
    if (italic) s.style.fontStyle = 'italic';
    const deco = [underline && 'underline', strike && 'line-through'].filter(Boolean).join(' ');
    if (deco) s.style.textDecoration = deco;
    if (obf) s.classList.add('animate-pulse');
    el.appendChild(s);
  };
  let buf = '';
  const colorMap = Object.fromEntries(MC_COLORS.map(([c, hex]) => [c, hex]));
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '&' || ch === '§') && i + 1 < text.length) {
      flush(buf);
      buf = '';
      const code = text[++i].toLowerCase();
      if (colorMap[code]) {
        color = colorMap[code];
        bold = italic = underline = strike = obf = false;
      } else if (code === 'l') bold = true;
      else if (code === 'o') italic = true;
      else if (code === 'n') underline = true;
      else if (code === 'm') strike = true;
      else if (code === 'k') obf = true;
      else if (code === 'r') {
        color = '#AAAAAA';
        bold = italic = underline = strike = obf = false;
      } else buf += ch + text[i]; // unknown code — show literally
    } else if (ch === '\\' && text[i + 1] === 'n') {
      flush(buf);
      buf = '';
      el.appendChild(document.createElement('br'));
      i++;
    } else if (ch === '\n') {
      flush(buf);
      buf = '';
      el.appendChild(document.createElement('br'));
    } else {
      buf += ch;
    }
  }
  flush(buf);
  if (!el.childNodes.length) {
    const s = document.createElement('span');
    s.className = 'text-ink-faint';
    s.textContent = 'A Minecraft Server';
    el.appendChild(s);
  }
}

/** &-codes → real §-codes for server.properties / the MOTD env var. */
export function toSectionCodes(text) {
  return text.replace(/&([0-9a-fk-orA-FK-OR])/g, '§$1');
}

/** §-codes → &-codes for editing. */
export function toAmpCodes(text) {
  return String(text || '').replace(/§([0-9a-fk-orA-FK-OR])/g, '&$1');
}

/**
 * Attach the visual editor to an input.
 * opts: { preview: Element, getName: () => string } — getName fills {server}
 * in presets. Returns { refresh() }.
 */
export function attachMotdEditor(input, { preview, getName = () => 'My Server' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'mt-1.5 flex flex-wrap items-center gap-1';

  // Color swatches — .swatch borders are theme-aware; the old white ring was
  // invisible around the White/Yellow swatches on the light theme's white card.
  // size-6 override: align with the format buttons on one toolbar baseline.
  for (const [code, hex, label] of MC_COLORS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch size-6';
    b.style.background = hex;
    b.dataset.tip = `${label} (&${code})`;
    b.addEventListener('click', () => insert(`&${code}`));
    wrap.appendChild(b);
  }
  const sep = document.createElement('span');
  sep.className = 'mx-1 h-4 w-px bg-line-strong';
  wrap.appendChild(sep);

  // Format buttons
  for (const [code, glyph, label, cls] of FORMATS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `grid size-6 place-items-center rounded-sm border border-line bg-inset text-xs ${cls} transition hover:border-line-strong`;
    b.textContent = glyph;
    b.dataset.tip = `${label} (&${code})`;
    b.addEventListener('click', () => insert(`&${code}`));
    wrap.appendChild(b);
  }

  // Newline + presets
  const nl = document.createElement('button');
  nl.type = 'button';
  nl.className =
    'grid h-6 place-items-center rounded-sm border border-line bg-inset px-1.5 text-xs transition hover:border-line-strong';
  nl.textContent = '↵';
  nl.dataset.tip = 'Second line (MOTDs have two lines)';
  nl.addEventListener('click', () => insert('\\n'));
  wrap.appendChild(nl);

  const presetsBtn = document.createElement('button');
  presetsBtn.type = 'button';
  presetsBtn.className = 'btn btn-ghost btn-sm ml-auto';
  presetsBtn.textContent = 'Examples';
  presetsBtn.addEventListener('click', showPresets);
  wrap.appendChild(presetsBtn);

  input.insertAdjacentElement('afterend', wrap);

  function insert(code) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + code + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + code.length;
    refresh();
  }

  function refresh() {
    if (preview) renderMotdInto(preview, input.value);
  }

  function showPresets() {
    const content = document.createElement('div');
    content.className = 'space-y-2';
    const hint = document.createElement('p');
    hint.className = 'help';
    hint.textContent =
      'Click any example to use it — {server} becomes your server name. Tweak it afterwards with the toolbar.';
    content.appendChild(hint);
    const modal = openModal({ title: 'MOTD examples', content, size: 'md' });
    for (const preset of MOTD_PRESETS) {
      const filled = preset.replaceAll('{server}', getName() || 'My Server');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'console block w-full cursor-pointer py-2 text-left text-sm transition hover:border-grass-600';
      renderMotdInto(row, filled);
      row.addEventListener('click', () => {
        input.value = filled;
        refresh();
        modal.close();
        input.focus();
      });
      content.appendChild(row);
    }
  }

  input.addEventListener('input', refresh);
  refresh();
  return { refresh };
}
