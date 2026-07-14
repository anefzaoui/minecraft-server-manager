// Live console: WebSocket log stream + RCON command bar with history.
import { toast } from '../lib/toast.js';
import { setBusy } from '../lib/loading.js';

const log = document.getElementById('console-log');
const input = document.getElementById('console-input');
const root = document.querySelector('[data-console-server]');
if (root && log) init(root.dataset.consoleServer);

function init(serverId) {
  const history = [];
  let historyIdx = -1;
  let autoScroll = true;
  let ws = null;
  let reconnectDelay = 1000;
  // Server-rendered initial lines show instantly; the WS resends the same tail
  // on connect, so the first 'log' batch replaces them instead of duplicating.
  let clearedInitial = false;
  log.scrollTop = log.scrollHeight;

  // ---- "Announce as" label: attribute panel console commands in game chat ----
  document.getElementById('console-label-save')?.addEventListener('click', async () => {
    const label = document.getElementById('console-label').value.trim();
    try {
      const res = await fetch(`/api/servers/${serverId}/console-label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        toast(data.error || 'Could not save the label', { kind: 'error' });
        return;
      }
      toast(
        data.label ? `Console commands now announce as "[${data.label}]" in chat.` : 'Console announcements turned off.'
      );
    } catch (err) {
      toast(`Network error: ${err.message}`, { kind: 'error' });
    }
  });

  const filters = { INFO: true, WARN: true, ERROR: true };
  const filterInput = document.getElementById('console-filter');

  function classify(text) {
    if (/\/(ERROR|FATAL)\]/.test(text)) return 'ERROR';
    if (/\/WARN\]/.test(text)) return 'WARN';
    return 'INFO';
  }

  // ANSI SGR → colored spans (mc-image-helper and rcon-cli colorize output).
  const ANSI_COLORS = {
    30: '#4b5563',
    31: '#f87171',
    32: '#4ade80',
    33: '#facc15',
    34: '#60a5fa',
    35: '#c084fc',
    36: '#22d3ee',
    37: '#d1d5db',
    90: '#6b7280',
    91: '#fca5a5',
    92: '#86efac',
    93: '#fde047',
    94: '#93c5fd',
    95: '#d8b4fe',
    96: '#67e8f9',
    97: '#f9fafb',
  };
  function renderAnsi(target, text) {
    // Tolerate both real escapes (\x1b[…m) and bare "[0;39m" fragments that
    // survive log demuxing with the ESC byte lost.
    const parts = text.split(/(?:\x1b|)?\[([0-9;]{1,12})m/);
    if (parts.length === 1) {
      target.textContent = text;
      return;
    }
    let color = null;
    let bold = false;
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        for (const code of parts[i].split(';').map(Number)) {
          if (code === 0 || code === 39) {
            color = null;
            bold = false;
          } else if (code === 1) bold = true;
          else if (ANSI_COLORS[code]) color = ANSI_COLORS[code];
        }
      } else if (parts[i]) {
        const span = document.createElement('span');
        span.textContent = parts[i];
        if (color) span.style.color = color;
        if (bold) span.style.fontWeight = '700';
        target.appendChild(span);
      }
    }
  }

  function appendLine(text) {
    const level = classify(text);
    const div = document.createElement('div');
    div.dataset.level = level;
    if (level === 'WARN') div.className = 'text-gold-300';
    if (level === 'ERROR') div.className = 'text-redstone-400';
    renderAnsi(div, text);
    applyVisibility(div);
    log.appendChild(div);
    while (log.childElementCount > 3000) log.firstElementChild.remove();
    if (autoScroll) log.scrollTop = log.scrollHeight;
  }

  function applyVisibility(el) {
    const q = filterInput ? filterInput.value.trim() : '';
    let match = true;
    if (q) {
      if (q.startsWith('/') && q.endsWith('/') && q.length > 2) {
        try {
          match = new RegExp(q.slice(1, -1), 'i').test(el.textContent);
        } catch {
          match = true;
        }
      } else {
        match = el.textContent.toLowerCase().includes(q.toLowerCase());
      }
    }
    el.classList.toggle('hidden', !filters[el.dataset.level] || !match);
  }

  function refilter() {
    log.querySelectorAll('[data-level]').forEach(applyVisibility);
  }

  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/console/${serverId}`);
    ws.addEventListener('open', () => {
      reconnectDelay = 1000;
    });
    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.kind === 'log') {
        if (!clearedInitial) {
          clearedInitial = true;
          log.innerHTML = '';
        }
        for (const line of msg.text.split(/\r?\n/)) if (line.trim()) appendLine(line);
      } else if (msg.kind === 'cmd-result') {
        ackPending();
        if (msg.error) appendLine(`[panel/ERROR]: ${msg.error}`);
        else if (msg.output) for (const line of msg.output.split(/\r?\n/)) appendLine(`[rcon]: ${line}`);
        else appendLine(`[rcon]: (no output) /${msg.command}`);
      } else if (msg.kind === 'error') {
        ackPending();
        appendLine(`[panel/WARN]: ${msg.message}`);
      }
    });
    ws.addEventListener('close', () => {
      ackAllPending(); // no ack is coming — release busy send controls
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    });
  }
  connect();

  // Pause auto-scroll when the user scrolls up; resume at bottom.
  log.addEventListener('scroll', () => {
    autoScroll = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
  });

  if (filterInput) filterInput.addEventListener('input', refilter);
  document.querySelectorAll('[data-level-filter]').forEach((cb) => {
    cb.addEventListener('change', () => {
      filters[cb.dataset.levelFilter] = cb.checked;
      refilter();
    });
  });

  // The send control stays busy until the RCON response (cmd-result/error) or
  // ws ack arrives. Entries self-remove; a failsafe timeout catches lost acks.
  const pendingAcks = [];
  function ackPending() {
    if (pendingAcks.length) pendingAcks[0]();
  }
  function ackAllPending() {
    while (pendingAcks.length) pendingAcks[0]();
  }

  const sendBtn = document.getElementById('console-send');

  function send(command, trigger) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast('Console not connected yet.', { kind: 'error' });
      return;
    }
    if (trigger) {
      const restore = setBusy(trigger);
      const entry = () => {
        clearTimeout(timer);
        restore();
        const i = pendingAcks.indexOf(entry);
        if (i !== -1) pendingAcks.splice(i, 1);
      };
      const timer = setTimeout(entry, 15000);
      pendingAcks.push(entry);
    }
    ws.send(JSON.stringify({ kind: 'cmd', command }));
    history.push(command);
    historyIdx = history.length;
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        send(input.value.trim(), sendBtn);
        input.value = '';
      } else if (e.key === 'ArrowUp') {
        if (historyIdx > 0) input.value = history[--historyIdx] || '';
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (historyIdx < history.length) input.value = history[++historyIdx] || '';
        e.preventDefault();
      }
    });
  }
  if (sendBtn)
    sendBtn.addEventListener('click', () => {
      if (input.value.trim()) {
        send(input.value.trim(), sendBtn);
        input.value = '';
      }
    });
  document.querySelectorAll('[data-quick-cmd]').forEach((chip) => {
    chip.addEventListener('click', () => send(chip.dataset.quickCmd, chip));
  });

  const dlBtn = document.getElementById('console-download');
  if (dlBtn)
    dlBtn.addEventListener('click', () => {
      window.open(`/api/servers/${serverId}/logs?tail=5000`, '_blank');
    });
}
