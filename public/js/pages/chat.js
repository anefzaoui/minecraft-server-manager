// Admin chat: send styled tellraw/say messages with a live in-game preview.
// History is server-side (chat-sent events) and replayed on load.
import { toast } from '../lib/toast.js';
import { setBusy } from '../lib/loading.js';
import { formatTime } from '../lib/datetime.js';

// The 16 vanilla text colors → hex (mirrors src/services/chat.js).
const COLORS = {
  black: '#000000',
  dark_blue: '#0000AA',
  dark_green: '#00AA00',
  dark_aqua: '#00AAAA',
  dark_red: '#AA0000',
  dark_purple: '#AA00AA',
  gold: '#FFAA00',
  gray: '#AAAAAA',
  dark_gray: '#555555',
  blue: '#5555FF',
  green: '#55FF55',
  aqua: '#55FFFF',
  red: '#FF5555',
  light_purple: '#FF55FF',
  yellow: '#FFFF55',
  white: '#FFFFFF',
};

const STYLES = [
  ['bold', 'B', 'Bold', 'font-bold'],
  ['italic', 'I', 'Italic', 'italic'],
  ['underlined', 'U', 'Underline', 'underline'],
  ['strikethrough', 'S', 'Strikethrough', 'line-through'],
  ['obfuscated', '▓', 'Obfuscated (scrambles in-game)', ''],
];

const STYLE_BTN_CLASS =
  'grid size-7 place-items-center rounded-sm border border-line bg-inset text-xs transition ' +
  'hover:border-line-strong aria-pressed:border-grass-500 aria-pressed:bg-grass-600/15 aria-pressed:text-ok ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-diamond-400 disabled:opacity-50';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const OBF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789#$%&?';

const root = document.querySelector('[data-chat-server]');
if (root) init(root.dataset.chatServer);

function init(serverId) {
  const log = document.getElementById('chat-log');
  const input = document.getElementById('chat-input');
  const targetSel = document.getElementById('chat-target');
  const targetWrap = root.querySelector('[data-chat-target-wrap]');
  const colorsBox = document.getElementById('chat-colors');
  const formatsBox = document.getElementById('chat-formats');
  const modeBox = document.getElementById('chat-mode');
  const stylesBox = root.querySelector('[data-chat-styles]');
  const previewRow = root.querySelector('[data-chat-preview-row]');
  const previewEl = root.querySelector('[data-chat-preview]');
  const sendBtn = document.getElementById('chat-send');
  let mode = 'tellraw';
  let color = '';

  // ---- §k obfuscation: scramble registered spans in-game style ----
  const obfuscated = new Set();
  let obfTimer = null;
  const scramble = (text) =>
    [...text].map((c) => (c === ' ' ? ' ' : OBF_CHARS[Math.floor(Math.random() * OBF_CHARS.length)])).join('');
  function obfuscate(span, text) {
    span.dataset.obf = text;
    span.title = text; // the real content stays reachable
    span.textContent = scramble(text);
    if (REDUCED_MOTION) return; // one static scramble, no animation
    obfuscated.add(span);
    if (!obfTimer) {
      obfTimer = setInterval(() => {
        for (const el of obfuscated) {
          if (!el.isConnected) {
            obfuscated.delete(el);
            continue;
          }
          el.textContent = scramble(el.dataset.obf);
        }
        if (!obfuscated.size) {
          clearInterval(obfTimer);
          obfTimer = null;
        }
      }, 80);
    }
  }

  // Perceived-dark colors get a faint glow in the dark preview trough — black
  // text on the near-black console otherwise reads as "didn't send".
  function isDark(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r ** 2.2 + 0.7152 * g ** 2.2 + 0.0722 * b ** 2.2 < 0.13;
  }

  /** Render text + tellraw style flags into a styled span (live preview). */
  function styledSpan(m) {
    const span = document.createElement('span');
    span.textContent = m.text;
    if (m.color && COLORS[m.color]) {
      span.style.color = COLORS[m.color];
      if (isDark(COLORS[m.color])) span.style.textShadow = '0 0 4px rgb(255 255 255 / 0.55)';
    }
    if (m.bold) span.style.fontWeight = '700';
    if (m.italic) span.style.fontStyle = 'italic';
    const deco = [];
    if (m.underlined) deco.push('underline');
    if (m.strikethrough) deco.push('line-through');
    if (deco.length) span.style.textDecoration = deco.join(' ');
    if (m.obfuscated) obfuscate(span, m.text);
    return span;
  }

  // ---- Message log ----
  function appendMessage(m, { autoScroll = true } = {}) {
    log.querySelector('[data-chat-empty]')?.remove();
    const line = document.createElement('div');
    line.className = 'py-0.5';
    const time = document.createElement('span');
    time.className = 'mr-2 text-stone-500';
    time.textContent = formatTime(m.ts || Date.now());
    const prefix = document.createElement('span');
    prefix.className = 'mr-2 text-stone-400';
    prefix.textContent = m.mode === 'say' ? '[Server]' : `→ ${m.target}`;
    if (m.actor) prefix.title = `Sent by ${m.actor}`;
    line.append(time, prefix, styledSpan(m));
    // Stick to the bottom only when already reading the bottom — never yank
    // someone who scrolled up into history.
    const nearBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
    log.appendChild(line);
    if (autoScroll && nearBottom) log.scrollTop = log.scrollHeight;
  }

  // Replay persisted history (oldest first), then jump to the latest.
  try {
    const history = JSON.parse(document.getElementById('chat-history')?.textContent || '[]');
    for (const m of history) appendMessage(m, { autoScroll: false });
    if (history.length) log.scrollTop = log.scrollHeight;
  } catch {
    /* corrupt island — start with the empty state */
  }

  // ---- Build the formatting toolbar ----
  const noneBtn = document.createElement('button');
  noneBtn.type = 'button';
  noneBtn.className = 'swatch swatch-none';
  noneBtn.dataset.color = '';
  noneBtn.dataset.tip = 'Default (no color)';
  noneBtn.setAttribute('aria-pressed', 'true'); // selected from the start
  colorsBox.appendChild(noneBtn);
  for (const [name, hex] of Object.entries(COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.background = hex;
    b.dataset.color = name;
    b.dataset.tip = name.replace(/_/g, ' ');
    b.setAttribute('aria-pressed', 'false');
    colorsBox.appendChild(b);
  }

  for (const [key, glyph, label, cls] of STYLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `${STYLE_BTN_CLASS} ${cls}`;
    b.textContent = glyph;
    b.dataset.format = key;
    b.dataset.tip = label;
    b.setAttribute('aria-pressed', 'false');
    formatsBox.appendChild(b);
  }

  colorsBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    color = b.dataset.color;
    colorsBox.querySelectorAll('[data-color]').forEach((el) => el.setAttribute('aria-pressed', String(el === b)));
    updatePreview();
  });

  formatsBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-format]');
    if (!b) return;
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    updatePreview();
  });

  modeBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode;
    modeBox.querySelectorAll('[data-mode]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el === b));
    });
    // Say is a plain broadcast — no target, no styling. Real `disabled` (the
    // enhanced select trigger follows automatically), dimmed as a group.
    const plain = mode === 'say';
    stylesBox.querySelectorAll('button').forEach((el) => {
      el.disabled = plain;
    });
    stylesBox.classList.toggle('opacity-60', plain);
    targetSel.disabled = plain;
    targetWrap.classList.toggle('opacity-60', plain);
    updatePreview();
  });

  function currentFormats() {
    const f = {};
    formatsBox.querySelectorAll('[data-format]').forEach((el) => {
      if (el.getAttribute('aria-pressed') === 'true') f[el.dataset.format] = true;
    });
    return f;
  }

  // ---- Live preview: exactly what lands in-game, styled before sending ----
  function updatePreview() {
    const text = input.value.trim();
    previewRow.hidden = !text;
    previewEl.replaceChildren();
    if (!text) return;
    if (mode === 'say') {
      const tag = document.createElement('span');
      tag.className = 'mr-2 text-stone-400';
      tag.textContent = '[Server]';
      previewEl.append(tag, document.createTextNode(text));
    } else {
      previewEl.append(styledSpan({ text, color, ...currentFormats() }));
    }
  }
  input.addEventListener('input', updatePreview);

  async function send() {
    if (sendBtn.dataset.busy) return; // Enter path must respect in-flight state
    if (root.dataset.chatRunning !== '1') return;
    const text = input.value.trim();
    if (!text) return;
    const restore = setBusy(sendBtn);
    try {
      const res = await fetch(`/api/servers/${serverId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, target: targetSel.value, text, color, ...currentFormats() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Message failed to send');
      appendMessage(data);
      input.value = '';
      updatePreview();
      input.focus();
    } catch (err) {
      toast(err.message, { kind: 'error' });
    } finally {
      restore();
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });
  sendBtn.addEventListener('click', send);
}
