// Live console: WebSocket log stream + RCON command bar with history.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { setBusy, withBusy } from '../lib/loading.js';
import { fmtBytes, escapeHtml } from '../lib/format.js';

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
  // Reconnect cadence after a clean stream end (server stopped) - see the close
  // handler for why this can't share the exponential backoff above.
  const STOPPED_RETRY_MS = 5000;
  // Server-rendered initial lines show instantly; the WS resends the same tail
  // on connect, so the first 'log' batch replaces them instead of duplicating.
  let clearedInitial = false;
  log.scrollTop = log.scrollHeight;

  // ---- "Announce as" label: attribute panel console commands in game chat ----
  document.getElementById('console-label-save')?.addEventListener('click', (e) =>
    withBusy(e.currentTarget, 'Saving…', async () => {
      const label = document.getElementById('console-label').value.trim();
      try {
        const res = await fetch(`/api/servers/${serverId}/console-label`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          toast(data.error || friendlyError(res, { action: 'save that label' }), { kind: 'error' });
          return;
        }
        toast(
          data.label
            ? `Console commands now announce as "[${data.label}]" in chat.`
            : 'Console announcements turned off.'
        );
      } catch {
        toast(friendlyError(null, { action: 'save that label' }), { kind: 'error' });
      }
    })
  );

  // ---- Rotated game-log files (logs/*.log.gz next to latest.log) ----
  (async () => {
    const box = document.querySelector('[data-console-logfiles]');
    if (!box) return;
    try {
      const res = await fetch(`/api/servers/${serverId}/logs/game`);
      const data = await res.json().catch(() => ({}));
      // latest.log is already a menu item; list only the rotated history here.
      const rotated = (data.files || []).filter((f) => f.file !== 'latest.log');
      if (!res.ok || !rotated.length) return;
      box.querySelector('[data-console-logfiles-count]').textContent = `(${rotated.length})`;
      box.querySelector('[data-console-logfiles-list]').innerHTML = rotated
        .map(
          (f) => `
        <a class="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-inset" download
           href="/api/servers/${serverId}/logs/game/${encodeURIComponent(f.file)}">
          <span class="min-w-0 truncate font-mono">${escapeHtml(f.file)}</span>
          <span class="shrink-0 text-ink-faint">${fmtBytes(f.size)}</span>
        </a>`
        )
        .join('');
      box.hidden = false;
    } catch {
      /* offline / no logs dir yet - leave the section hidden */
    }
  })();

  const filters = { INFO: true, WARN: true, ERROR: true };
  const filterInput = document.getElementById('console-filter');

  // The panel opens a short-lived RCON connection every poll cycle, so the
  // server logs this pair of lines every ~20s. They classify as INFO, so the
  // level checkboxes can't isolate them - hence a dedicated toggle. Kept tight
  // so panel-issued "[rcon]: …" command output is never matched. The last entry
  // catches the plugin echo ("[Essentials] Rcon issued server command: /…", and
  // the plain "[Server] …" core variant) for the read-only polls the panel runs
  // on a timer: `list` for player counts, and `time query …` / bare `gamerule
  // <name>` reads while the World Controls page is open. Scoped to those forms
  // so a state-changing command you type (time set, gamerule x true, …) shows.
  // Every pattern is anchored to the log-line body right after the
  // "[thread/LEVEL]: " prefix (optionally a "[Plugin] " tag), so a player
  // saying "Thread RCON Client started" in chat ("<Steve> ...") never matches.
  const RCON_NOISE = [
    /\]:\s*Thread RCON Client\b.*\b(started|shutting down)\b/i,
    /\]:\s*Thread RCON Listener started\b/i,
    /\]:\s*RCON running on \b/i,
    /\]:\s*(?:\[[^\]]+\]\s*)?Rcon issued server command:\s*\/?(list|time query \w+|gamerule \S+)\s*$/i,
  ];
  let hideRconNoise = true;
  try {
    hideRconNoise = localStorage.getItem('msm-console-hide-rcon') !== '0';
  } catch {
    /* private mode / storage disabled - keep the default */
  }

  function classify(text) {
    if (/\/(ERROR|FATAL)\]/.test(text)) return 'ERROR';
    if (/\/WARN\]/.test(text)) return 'WARN';
    return 'INFO';
  }

  // ANSI SGR → colored spans (mc-image-helper and rcon-cli colorize output).
  // Where the brand ramps cover an ANSI hue (red/green/yellow/grays/white)
  // the values come from them; blue/magenta/cyan keep neutral defaults - ANSI
  // semantics beat palette purity for log readability, and the brand has no
  // blue or purple ramp to borrow from.
  const ANSI_COLORS = {
    30: '#555e68', // stone-600
    31: '#f87171', // redstone-400
    32: '#59c53e', // grass-400
    33: '#f3ca56', // gold-300
    34: '#60a5fa',
    35: '#c084fc',
    36: '#3cc5c7', // diamond-400
    37: '#d3d7db', // stone-200
    90: '#6a747f', // stone-500
    91: '#fca5a5', // redstone-300
    92: '#7fd965', // grass-300
    93: '#f7e090', // gold-200
    94: '#93c5fd',
    95: '#d8b4fe',
    96: '#6ce0dd', // diamond-300
    97: '#f4f5f6', // stone-50
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
    // A command reply can arrive before any WS log batch (stopped server) -
    // the full-height placeholder would otherwise push it out of view.
    log.querySelector('[data-console-empty]')?.remove();
    const level = classify(text);
    const div = document.createElement('div');
    div.dataset.level = level;
    // Raw palette steps on purpose: the console is always dark, and the
    // semantic warn/danger tokens flip to 700-steps in light mode (invisible
    // here). See the .console note in input.css.
    if (level === 'WARN') div.className = 'text-gold-300';
    if (level === 'ERROR') div.className = 'text-redstone-400';
    renderAnsi(div, text);
    applyVisibility(div);
    log.appendChild(div);
    while (log.childElementCount > 3000) log.firstElementChild.remove();
    if (autoScroll) log.scrollTop = log.scrollHeight;
    syncNoMatch();
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
    const noisy = hideRconNoise && RCON_NOISE.some((re) => re.test(el.textContent));
    el.classList.toggle('hidden', !filters[el.dataset.level] || !match || noisy);
  }

  function refilter() {
    log.querySelectorAll('[data-level]').forEach(applyVisibility);
    syncNoMatch();
  }

  // Filters hiding every line left a silent black box, indistinguishable from
  // "no output" - say so instead.
  function syncNoMatch() {
    const lines = log.querySelectorAll('[data-level]');
    const anyVisible = [...lines].some((el) => !el.classList.contains('hidden'));
    let note = log.querySelector('[data-console-nomatch]');
    if (lines.length && !anyVisible) {
      if (!note) {
        note = document.createElement('div');
        note.dataset.consoleNomatch = '';
        note.className = 'py-2 text-center text-stone-500';
        note.textContent = 'No lines match the current filters.';
        log.appendChild(note);
      }
    } else if (note) {
      note.remove();
    }
  }

  // One visible marker while the stream is down - the log just stopping is
  // indistinguishable from a quiet server.
  let disconnectNote = null;
  // Set when the last close was a clean 'log-end' (server not running) rather
  // than a dropped socket - drives the slow reconnect cadence below.
  let streamEnded = false;
  function connect() {
    // Reconnecting after a clean stream end re-tails the container: the broker
    // replays the last lines, which are already on screen. Replace the log with
    // that batch instead of appending it again (and again, every poll) - and
    // keep the "server is stopped" note until real output arrives.
    const retailing = streamEnded;
    if (retailing) clearedInitial = false;
    streamEnded = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/console/${serverId}`);
    ws.addEventListener('open', () => {
      reconnectDelay = 1000;
      if (disconnectNote && !retailing) {
        disconnectNote.remove();
        disconnectNote = null;
      }
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
          disconnectNote = null; // wiped with the rest of the log
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
      } else if (msg.kind === 'log-end') {
        // The upstream docker log stream ended (server stopped / restarted).
        // The server keeps this socket open, so drive the reconnect ourselves -
        // on the slow "stopped" cadence, since retrying at once just re-tails a
        // container that produces no output until it starts again.
        streamEnded = true;
        ws.close();
      }
    });
    ws.addEventListener('close', () => {
      ackAllPending(); // no ack is coming - release busy send controls
      if (!disconnectNote) {
        disconnectNote = document.createElement('div');
        disconnectNote.className = 'text-gold-300';
        disconnectNote.textContent = streamEnded
          ? '[panel/WARN]: Server is stopped. Watching for it to start again…'
          : '[panel/WARN]: Log stream disconnected. Reconnecting…';
        log.appendChild(disconnectNote);
        if (autoScroll) log.scrollTop = log.scrollHeight;
      }
      // A clean stream end means the server is not running, but our WS server
      // still accepts the upgrade - so 'open' fires on every reconnect and
      // resets the backoff, leaving a ~1s loop that re-tails a stopped
      // container forever. Poll on a slow fixed cadence instead; keep the
      // exponential backoff for genuine drops (network blips, panel restart).
      if (streamEnded) {
        setTimeout(connect, STOPPED_RETRY_MS);
      } else {
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 15000);
      }
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

  const noiseToggle = document.getElementById('console-hide-rcon');
  if (noiseToggle) {
    noiseToggle.checked = hideRconNoise;
    noiseToggle.addEventListener('change', () => {
      hideRconNoise = noiseToggle.checked;
      try {
        localStorage.setItem('msm-console-hide-rcon', hideRconNoise ? '1' : '0');
      } catch {
        /* storage disabled - the toggle still works for this session */
      }
      refilter();
    });
  }
  // The server-rendered initial tail is visible until something filters it -
  // run one pass now so a stored "hide" preference applies before any WS line.
  refilter();

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
    // The UI advertises slash-less input (the decorative "/" prefix box) -
    // honor a habitual "/list" instead of sending it verbatim.
    command = command.replace(/^\//, '');
    ws.send(JSON.stringify({ kind: 'cmd', command }));
    if (history[history.length - 1] !== command) history.push(command); // no dupes back-to-back
    historyIdx = history.length;
    closeSuggestions();
  }

  const suggestionBox = root.querySelector('[data-console-suggestions]');
  const suggestionList = root.querySelector('[data-console-suggestion-list]');
  const commandHelp = root.querySelector('[data-console-command-help]');
  let suggestionTimer = null;
  let suggestionRequest = 0;
  let suggestionItems = [];
  let activeSuggestion = -1;

  function closeSuggestions() {
    if (!suggestionBox) return;
    suggestionBox.classList.add('hidden');
    input?.setAttribute('aria-expanded', 'false');
    input?.removeAttribute('aria-activedescendant');
    activeSuggestion = -1;
  }

  function setActiveSuggestion(index) {
    if (!suggestionItems.length) return;
    activeSuggestion = (index + suggestionItems.length) % suggestionItems.length;
    suggestionList.querySelectorAll('[role="option"]').forEach((option, i) => {
      option.setAttribute('aria-selected', i === activeSuggestion ? 'true' : 'false');
      if (i === activeSuggestion) {
        input?.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
    renderCommandHelp(suggestionItems[activeSuggestion]);
  }

  function renderCommandHelp(item) {
    if (!commandHelp) return;
    commandHelp.replaceChildren();
    const help = item?.help;
    if (!help) {
      commandHelp.classList.add('hidden');
      return;
    }
    const description = document.createElement('p');
    description.className = 'font-medium text-ink';
    description.textContent = help.description;
    commandHelp.append(description);

    if (help.usages?.length) {
      const heading = document.createElement('p');
      heading.className = 'mt-2 text-ink-faint';
      heading.textContent = 'Syntax';
      const usages = document.createElement('div');
      usages.className = 'mt-1 flex flex-col gap-1';
      for (const usage of help.usages) {
        const line = document.createElement('code');
        line.className = 'text-ink-soft';
        line.textContent = usage;
        usages.append(line);
      }
      commandHelp.append(heading, usages);
    }
    if (help.expected?.length) {
      const expected = document.createElement('p');
      expected.className = 'mt-2 text-ink-faint';
      expected.textContent = `Next: ${help.expected.map((arg) => `${arg.name} (${arg.description})`).join(', ')}`;
      commandHelp.append(expected);
    }
    if (help.catalogVersion) {
      const source = document.createElement('p');
      source.className = 'mt-2 text-[11px] text-ink-faint';
      source.textContent = `Vanilla command catalog for Minecraft ${help.catalogVersion}. Mod and plugin commands are not included.`;
      commandHelp.append(source);
    }
    commandHelp.classList.remove('hidden');
  }

  function renderSuggestions(data) {
    if (!suggestionBox || !suggestionList) return;
    suggestionList.replaceChildren();
    suggestionItems = (data.suggestions || []).map((item) => ({
      ...item,
      help: item.help
        ? { ...item.help, expected: data.expected }
        : data.help
          ? { ...data.help, expected: data.expected }
          : null,
    }));
    for (const [index, item] of suggestionItems.entries()) {
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `console-suggestion-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.className =
        'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-inset aria-selected:bg-inset';
      const value = document.createElement('span');
      value.className = 'font-mono text-ink';
      value.textContent = item.value;
      const detail = document.createElement('span');
      detail.className = 'truncate text-xs text-ink-faint';
      detail.textContent = item.description;
      option.append(value, detail);
      option.addEventListener('mouseenter', () => setActiveSuggestion(index));
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('click', () => completeSuggestion(index));
      suggestionList.append(option);
    }

    if (suggestionItems.length) setActiveSuggestion(0);
    else renderCommandHelp(data.help ? { help: { ...data.help, expected: data.expected } } : null);

    const hasHelp = data.help || (data.expected || []).length;
    if (!suggestionItems.length && !hasHelp) {
      closeSuggestions();
      return;
    }
    if (data.expected?.length && commandHelp && !data.help) {
      commandHelp.replaceChildren();
      const expected = document.createElement('p');
      expected.className = 'text-ink-faint';
      expected.textContent = `Expected: ${data.expected.map((arg) => `${arg.name} (${arg.description})`).join(', ')}`;
      commandHelp.append(expected);
      commandHelp.classList.remove('hidden');
    }
    suggestionBox.classList.remove('hidden');
    input?.setAttribute('aria-expanded', 'true');
  }

  function completeSuggestion(index) {
    const item = suggestionItems[index];
    if (!item || !input) return;
    const caret = input.selectionStart ?? input.value.length;
    const beforeCursor = input.value.slice(0, caret);
    const leadingSlash = beforeCursor.match(/^\s*\//)?.[0].length || 0;
    const replaceFrom = Math.min(beforeCursor.length, item.replaceFrom + leadingSlash);
    const suffix = input.value.slice(caret);
    const separator = /^\s/.test(suffix) ? '' : ' ';
    input.value = `${input.value.slice(0, replaceFrom)}${item.value}${separator}${suffix}`;
    input.setSelectionRange(input.value.length - suffix.length, input.value.length - suffix.length);
    input.focus();
    closeSuggestions();
  }

  async function fetchSuggestions() {
    if (!input || !input.value.trim()) return closeSuggestions();
    const caret = input.selectionStart ?? input.value.length;
    const typed = input.value.slice(0, caret);
    const request = ++suggestionRequest;
    try {
      const res = await fetch(`/api/servers/${serverId}/console-suggestions?input=${encodeURIComponent(typed)}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (request !== suggestionRequest || !res.ok || !data.ok) return;
      data.suggestions = (data.suggestions || []).map((item) => ({ ...item, replaceFrom: data.replaceFrom }));
      renderSuggestions(data);
    } catch {
      if (request === suggestionRequest) closeSuggestions();
    }
  }

  if (input) {
    input.addEventListener('input', () => {
      clearTimeout(suggestionTimer);
      suggestionTimer = setTimeout(fetchSuggestions, 100);
    });
    input.addEventListener('blur', () => setTimeout(closeSuggestions, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        send(input.value.trim(), sendBtn);
        input.value = '';
      } else if (e.key === 'ArrowUp') {
        if (!suggestionBox?.classList.contains('hidden') && suggestionItems.length) {
          setActiveSuggestion(activeSuggestion - 1);
          e.preventDefault();
        } else if (historyIdx > 0) {
          input.value = history[--historyIdx] || '';
          e.preventDefault();
        }
      } else if (e.key === 'ArrowDown') {
        if (!suggestionBox?.classList.contains('hidden') && suggestionItems.length) {
          setActiveSuggestion(activeSuggestion + 1);
          e.preventDefault();
        } else if (historyIdx < history.length) {
          input.value = history[++historyIdx] || '';
          e.preventDefault();
        }
      } else if (e.key === 'Tab' && !suggestionBox?.classList.contains('hidden') && suggestionItems.length) {
        e.preventDefault();
        completeSuggestion(activeSuggestion < 0 ? 0 : activeSuggestion);
      } else if (e.key === 'Escape' && !suggestionBox?.classList.contains('hidden')) {
        closeSuggestions();
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
}
