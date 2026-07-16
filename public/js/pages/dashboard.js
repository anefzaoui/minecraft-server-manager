// Dashboard: live card hydration (/api/servers/live), Docker status, sort
// (server-side via ?sort=), grid/list view toggle, and the create-tile fix for
// the text filter.

const grid = document.getElementById('server-grid');
const sortSel = document.getElementById('server-sort');

// Docker status hydrates on every dashboard, including the first-run empty state
// (which has no server grid, so init() below doesn't run).
hydrateDocker();

if (grid && sortSel) init();

function init() {
  // ---- Sort: server-side, driven by the URL ----
  sortSel.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('sort', sortSel.value);
    location.href = url.toString();
  });

  // ---- Grid / list view (persisted) ----
  const btnGrid = document.getElementById('view-grid');
  const btnList = document.getElementById('view-list');
  const applyView = (mode) => {
    grid.classList.toggle('md:grid-cols-2', mode === 'grid');
    grid.classList.toggle('xl:grid-cols-3', mode === 'grid');
    // view-list hides the stats/disk/tags blocks (CSS) — a real compact list,
    // not just the same cards stacked full-width.
    grid.classList.toggle('view-list', mode === 'list');
    btnGrid?.setAttribute('aria-pressed', String(mode === 'grid'));
    btnList?.setAttribute('aria-pressed', String(mode === 'list'));
    try {
      localStorage.setItem('msm-dash-view', mode);
    } catch {}
  };
  btnGrid?.addEventListener('click', () => applyView('grid'));
  btnList?.addEventListener('click', () => applyView('list'));
  let saved = 'grid';
  try {
    saved = localStorage.getItem('msm-dash-view') || 'grid';
  } catch {}
  applyView(saved === 'list' ? 'list' : 'grid');

  // ---- Filter fix: the shared filter hides every card, including the
  // "Create a server" tile. Document-level listeners run after the element's
  // own handler, so re-showing here always wins. ----
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'server-filter') {
      grid.querySelector('a[href="/servers/new"]')?.classList.remove('hidden');
    }
  });

  // ---- Live stats hydration every 10 s ----
  hydrate();
  setInterval(hydrate, 10000);
}

async function hydrateDocker() {
  const el = document.getElementById('docker-status');
  if (!el) return;
  try {
    const res = await fetch('/api/docker/status');
    const data = await res.json();
    const d = data.docker || {};
    if (d.available) {
      el.className = 'mt-1 flex items-center gap-2 text-sm font-semibold text-ok';
      el.innerHTML = '<span class="status-dot relative bg-grass-500 pulse"></span> ';
      el.append(`Connected${d.version ? ` · v${d.version}` : ''}`);
    } else {
      el.className = 'mt-1 flex items-center gap-2 text-sm font-semibold text-danger';
      el.innerHTML = '<span class="status-dot relative bg-redstone-500"></span> ';
      el.append('Unreachable');
      el.title = d.error || 'Docker is not reachable. Is Docker running?';
      // Surface the fix inline, not just in a tooltip — the reason is visible.
      const warn = document.getElementById('docker-warning');
      if (warn) {
        warn.classList.remove('hidden');
        warn.classList.add('flex');
        const reason = document.getElementById('docker-warning-reason');
        if (reason && d.error) reason.textContent = d.error;
      }
    }
  } catch {
    // No eternal "Checking…" — say we don't know, and retry shortly.
    el.className = 'mt-1 flex items-center gap-2 text-sm font-semibold text-ink-faint';
    el.innerHTML = '<span class="status-dot relative bg-stone-500"></span> ';
    el.append('Unknown — retrying…');
    setTimeout(hydrateDocker, 8000);
  }
}

// Client-side mirror of the server's STATUS_META (src/web/app.js) so live
// hydration can move the dot when a server crashes/stops between reloads.
const STATUS_META = {
  running: { label: 'Running', dot: 'bg-grass-500', text: 'text-ok', pulse: true },
  starting: { label: 'Starting', dot: 'bg-gold-500', text: 'text-warn', pulse: true },
  unhealthy: { label: 'Unhealthy', dot: 'bg-gold-500', text: 'text-warn', pulse: true },
  updating: { label: 'Updating', dot: 'bg-diamond-500', text: 'text-link', pulse: true },
  stopped: { label: 'Stopped', dot: 'bg-stone-500', text: 'text-ink-faint', pulse: false },
  crashed: { label: 'Crashed', dot: 'bg-redstone-500', text: 'text-danger', pulse: false },
  'over-quota': { label: 'Over quota', dot: 'bg-redstone-500', text: 'text-danger', pulse: false },
};

function applyStatus(card, status) {
  const meta = STATUS_META[status];
  if (!meta) return;
  const dot = card.querySelector('.status-dot');
  const wrap = dot?.parentElement;
  if (!dot || !wrap) return;
  if (wrap.dataset.status === status) return;
  wrap.dataset.status = status;
  wrap.className = `flex items-center gap-1.5 text-xs font-medium ${meta.text}`;
  dot.className = `status-dot relative ${meta.dot} ${meta.pulse ? 'pulse' : ''}`;
  // The label is the text node after the dot.
  for (const node of wrap.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
      node.nodeValue = ` ${meta.label}`;
      break;
    }
  }
}

async function hydrate() {
  let data;
  try {
    const res = await fetch('/api/servers/live');
    data = await res.json();
  } catch {
    return;
  }
  if (!data || !data.ok) return;
  for (const [id, live] of Object.entries(data.servers || {})) {
    const card = grid.querySelector(`a[href="/servers/${id}"]`);
    if (!card) continue;
    if (live.status) applyStatus(card, live.status);
    const cells = card.querySelectorAll('.grid.grid-cols-3 > div');
    if (cells.length !== 3) continue;
    const [playersCell, cpuCell, memCell] = [...cells].map((c) => c.children[1]);

    // A stopped/crashed server must not keep showing its last-known load.
    if (live.status && !['running', 'unhealthy'].includes(live.status)) {
      if (cpuCell) cpuCell.textContent = '—';
      if (memCell && !memCell.querySelector('span')) memCell.textContent = '—';
    }
    if (live.players && playersCell) {
      setLeadingText(playersCell, String(live.players.online));
      const maxSpan = playersCell.querySelector('span');
      if (maxSpan) maxSpan.textContent = `/${live.players.max}`;
      if (live.players.names && live.players.names.length) {
        playersCell.title = live.players.names.join(', ');
      }
    }
    if (cpuCell && live.cpuPct != null) cpuCell.textContent = `${live.cpuPct}%`;
    if (memCell && live.memUsedMb != null) {
      if (memCell.querySelector('span')) setLeadingText(memCell, String(live.memUsedMb));
      else memCell.textContent = `${live.memUsedMb} MB`;
    }
    if (live.startedAt) {
      const status = card.querySelector('.status-dot')?.parentElement;
      if (status) status.title = `Up ${fmtUptime(Date.now() - Date.parse(live.startedAt))}`;
    }
  }
}

function setLeadingText(el, text) {
  if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
    el.firstChild.nodeValue = text;
  } else {
    el.prepend(document.createTextNode(text));
  }
}

function fmtUptime(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
