// Admin chat: a console-style panel for sending styled tellraw/say messages.
import { toast } from '../lib/toast.js';
import { setBusy } from '../lib/loading.js';

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

const root = document.querySelector('[data-chat-server]');
if (root) init(root.dataset.chatServer);

function init(serverId) {
  const log = document.getElementById('chat-log');
  const input = document.getElementById('chat-input');
  const targetSel = document.getElementById('chat-target');
  const colorsBox = document.getElementById('chat-colors');
  const formatsBox = document.getElementById('chat-formats');
  const modeBox = document.getElementById('chat-mode');
  const stylesBox = root.querySelector('[data-chat-styles]');
  const sendBtn = document.getElementById('chat-send');
  let mode = 'tellraw';
  let color = '';

  // ---- Build the color swatches (laid out like the icon pickers) ----
  for (const [name, hex] of Object.entries(COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-7 rounded-md border-2 border-line transition hover:border-line-strong';
    b.style.background = hex;
    b.dataset.color = name;
    b.title = name.replace(/_/g, ' ');
    colorsBox.appendChild(b);
  }

  colorsBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    color = b.dataset.color;
    colorsBox.querySelectorAll('[data-color]').forEach((el) => {
      const on = el === b;
      el.classList.toggle('ring-2', on);
      el.classList.toggle('ring-grass-400', on);
      el.classList.toggle('border-grass-500', on && el.dataset.color === '');
    });
  });

  formatsBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-format]');
    if (!b) return;
    const on = b.dataset.on !== '1';
    b.dataset.on = on ? '1' : '';
    b.classList.toggle('border-grass-500', on);
    b.classList.toggle('text-ok', on);
  });

  modeBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode;
    modeBox.querySelectorAll('[data-mode]').forEach((el) => {
      el.setAttribute('aria-pressed', String(el === b));
    });
    // Say is a plain broadcast — no target, no styling.
    const plain = mode === 'say';
    stylesBox.classList.toggle('pointer-events-none', plain);
    stylesBox.classList.toggle('opacity-40', plain);
    targetSel.disabled = plain;
  });

  function currentFormats() {
    const f = {};
    formatsBox.querySelectorAll('[data-format]').forEach((el) => {
      if (el.dataset.on === '1') f[el.dataset.format] = true;
    });
    return f;
  }

  function appendMessage(m) {
    log.querySelector('[data-chat-empty]')?.remove();
    const line = document.createElement('div');
    line.className = 'py-0.5';
    const prefix = document.createElement('span');
    prefix.className = 'text-ink-faint';
    prefix.textContent = `→ ${m.mode === 'say' ? '[Server]' : m.target}  `;
    const span = document.createElement('span');
    span.textContent = m.text;
    if (m.color && COLORS[m.color]) span.style.color = COLORS[m.color];
    if (m.bold) span.style.fontWeight = '700';
    if (m.italic) span.style.fontStyle = 'italic';
    const deco = [];
    if (m.underlined) deco.push('underline');
    if (m.strikethrough) deco.push('line-through');
    if (deco.length) span.style.textDecoration = deco.join(' ');
    line.append(prefix, span);
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  async function send() {
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
