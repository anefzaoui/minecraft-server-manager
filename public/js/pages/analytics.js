// Analytics tab: scoreboard with metric/window ranking, searchable activity
// timeline with type filters and cursor pagination, player profile drawer.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { withBusy } from '../lib/loading.js';

const root = document.querySelector('[data-analytics-server]');
if (root) init(root.dataset.analyticsServer);

const CROWN_SVG = `<svg class="icon size-3.5 shrink-0 text-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/></svg>`;

const BADGE = {
  chat: 'badge-info',
  join: 'badge-ok',
  leave: '',
  death: 'badge-danger',
  pvp: 'badge-danger',
  advancement: 'badge-warn',
  command: 'bg-inset text-ink-soft',
};

function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function fmtValue(metric, value) {
  if (metric === 'playtimeTicks') return fmtDuration(value / 20);
  if (metric === 'distanceCm') {
    return value >= 100_000 ? `${(value / 100_000).toFixed(1)} km` : `${Math.round(value / 100)} m`;
  }
  if (metric === 'damageDealt' || metric === 'damageTaken') {
    return `${Math.round(value / 10).toLocaleString()} hearts`;
  }
  return Number(value).toLocaleString();
}

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Honor the panel's configured timezone/locale (window.MSM), falling back to
  // the browser's. Event ts is stored as UTC, so this renders in the chosen zone.
  const m = window.MSM || {};
  const tz = m.timezone || undefined;
  const loc = m.locale || undefined;
  const today = new Date().toLocaleDateString(loc, { timeZone: tz }) === d.toLocaleDateString(loc, { timeZone: tz });
  return today
    ? d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz })
    : d.toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz });
}

function init(serverId) {
  const base = `/api/servers/${serverId}/analytics`;

  async function api(path, options) {
    try {
      const res = await fetch(base + path, options);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast(data.error || `Request failed (${res.status})`, { kind: 'error' });
        return null;
      }
      return data;
    } catch (err) {
      toast(`Network error: ${err.message}`, { kind: 'error' });
      return null;
    }
  }

  // ---- Scoreboard ----
  const metricSel = document.getElementById('an-metric');
  const windowSel = document.getElementById('an-window');
  const scoreBody = document.getElementById('an-scoreboard');

  async function loadScoreboard() {
    const metric = metricSel.value;
    const data = await api(`/scoreboard?metric=${metric}&window=${windowSel.value}`);
    scoreBody.innerHTML = '';
    if (!data) return;
    if (!data.rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td colspan="3" class="p-6 text-center text-ink-faint">No player stats yet — stats appear once someone plays on this server.</td>';
      scoreBody.appendChild(tr);
      return;
    }
    for (const row of data.rows) {
      const tr = document.createElement('tr');
      tr.className = 'cursor-pointer transition hover:bg-raised';
      tr.innerHTML = `
        <td class="text-ink-faint">${row.rank}</td>
        <td><span class="inline-flex items-center gap-1.5">${row.crown ? CROWN_SVG : ''}<span class="font-medium" data-name></span></span></td>
        <td class="text-right font-mono text-xs" data-value></td>`;
      tr.querySelector('[data-name]').textContent = row.name;
      tr.querySelector('[data-value]').textContent = fmtValue(metric, row.value);
      // Profile fetch happens before the drawer opens — spin the value cell.
      tr.addEventListener('click', () => openProfile(row.uuid, row.name, tr.querySelector('[data-value]')));
      scoreBody.appendChild(tr);
    }
  }

  // Enhanced selects (hidden native + trigger button): a content swap would
  // fight syncTrigger, so disable both during the reload instead.
  function busySelect(sel) {
    const next = sel.nextElementSibling;
    const trigger = next && next.classList.contains('msm-select') ? next : null;
    sel.disabled = true;
    if (trigger) trigger.disabled = true;
    return () => {
      sel.disabled = false;
      if (trigger) trigger.disabled = false;
    };
  }

  async function reloadScoreboard(sel) {
    const restore = busySelect(sel);
    try {
      await loadScoreboard();
    } finally {
      restore();
    }
  }

  metricSel.addEventListener('change', () => reloadScoreboard(metricSel));
  windowSel.addEventListener('change', () => reloadScoreboard(windowSel));

  // ---- Timeline ----
  const list = document.getElementById('an-timeline');
  const search = document.getElementById('an-search');
  const olderBtn = document.getElementById('an-older');
  const chips = [...document.querySelectorAll('[data-an-type]')];
  const state = { nextBefore: null };

  function selectedTypes() {
    return chips.filter((c) => c.checked).map((c) => c.dataset.anType);
  }

  function renderEvent(evt) {
    const li = document.createElement('li');
    li.className = 'flex flex-wrap items-baseline gap-2 p-2.5 text-sm';
    const badge = document.createElement('span');
    badge.className = `badge shrink-0 ${BADGE[evt.type] || 'bg-inset text-ink-soft'}`;
    badge.textContent = evt.type;
    const player = document.createElement('span');
    player.className = 'shrink-0 font-medium';
    player.textContent = evt.player;
    const message = document.createElement('span');
    message.className = 'min-w-0 flex-1 break-words text-ink-soft';
    if (evt.type === 'death') {
      // Death message already includes the player name.
      player.textContent = '';
      message.textContent = evt.message;
      if (evt.target) {
        const pvp = document.createElement('span');
        pvp.className = 'badge badge-danger ml-1.5';
        pvp.textContent = 'PvP';
        message.appendChild(pvp);
      }
    } else if (evt.type === 'join') {
      message.textContent = 'joined the game';
    } else if (evt.type === 'leave') {
      message.textContent = evt.message ? `left (${evt.message})` : 'left the game';
    } else if (evt.type === 'advancement') {
      message.textContent = `made the advancement [${evt.message}]`;
    } else {
      message.textContent = evt.message;
    }
    const time = document.createElement('span');
    time.className = 'ml-auto shrink-0 text-xs text-ink-faint';
    time.textContent = fmtTime(evt.ts);
    li.append(badge, player, message, time);
    return li;
  }

  async function loadTimeline({ reset = false } = {}) {
    const types = selectedTypes();
    if (!types.length) {
      // Nothing checked — render the empty state locally, no request needed.
      list.innerHTML = '';
      const li = document.createElement('li');
      li.className = 'p-6 text-center text-ink-faint';
      li.textContent = 'No event types selected — tick at least one filter above.';
      list.appendChild(li);
      state.nextBefore = null;
      olderBtn.classList.add('hidden');
      return;
    }
    const params = new URLSearchParams({ limit: '50' });
    if (types.length < chips.length) params.set('type', types.join(','));
    const q = search.value.trim();
    if (q) params.set('q', q);
    if (!reset && state.nextBefore) params.set('before', String(state.nextBefore));

    const data = await api(`/timeline?${params}`);
    if (!data) return;
    if (reset) list.innerHTML = '';
    if (!data.events.length && !list.children.length) {
      const li = document.createElement('li');
      li.className = 'p-6 text-center text-ink-faint';
      li.textContent = q
        ? 'No events match this search.'
        : 'No activity captured yet — events are recorded live while the server runs.';
      list.appendChild(li);
    }
    for (const evt of data.events) list.appendChild(renderEvent(evt));
    state.nextBefore = data.nextBefore;
    olderBtn.classList.toggle('hidden', !data.nextBefore);
    olderBtn.disabled = false;
  }

  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.nextBefore = null;
      loadTimeline({ reset: true });
    }, 300);
  });
  chips.forEach((chip) =>
    chip.addEventListener('change', async () => {
      state.nextBefore = null;
      // Checkboxes firing a fetch: disable the group during flight.
      const prev = chips.map((c) => c.disabled);
      chips.forEach((c) => {
        c.disabled = true;
      });
      try {
        await loadTimeline({ reset: true });
      } finally {
        chips.forEach((c, i) => {
          c.disabled = prev[i];
        });
      }
    })
  );
  olderBtn.addEventListener('click', () => withBusy(olderBtn, () => loadTimeline()));

  // ---- Refresh (backfill + stats ingest) ----
  document.getElementById('an-refresh').addEventListener('click', async (e) => {
    const data = await withBusy(e.currentTarget, 'Refreshing…', () => api('/ingest-now', { method: 'POST' }));
    if (!data) return;
    toast(`Refreshed: ${data.events} new events, ${data.snapshots} stat snapshots.`, { kind: 'success' });
    state.nextBefore = null;
    loadScoreboard();
    loadTimeline({ reset: true });
  });

  // ---- Player profile drawer ----
  async function openProfile(uuid, name, busyEl = null) {
    const data = await withBusy(busyEl, () => api(`/profile/${uuid}`));
    if (!data) return;
    const p = data.profile;
    const content = document.createElement('div');
    content.className = 'space-y-4';

    const style = document.createElement('div');
    style.innerHTML = '<h4 class="mb-2 text-sm font-semibold">Playstyle</h4>';
    const styleColors = {
      miner: 'bg-diamond-400',
      fighter: 'bg-redstone-500',
      explorer: 'bg-grass-500',
      builder: 'bg-gold-400',
    };
    for (const key of ['miner', 'fighter', 'explorer', 'builder']) {
      const pct = p.playstyle[key] || 0;
      const row = document.createElement('div');
      row.className = 'mb-2 text-xs';
      row.innerHTML = `
        <div class="mb-1 flex justify-between"><span class="capitalize">${key}</span><span class="text-ink-faint">${pct}%</span></div>
        <div class="meter"><div class="${styleColors[key]}" style="width:${pct}%"></div></div>`;
      style.appendChild(row);
    }
    content.appendChild(style);

    const grid = document.createElement('div');
    grid.innerHTML =
      '<h4 class="mb-2 text-sm font-semibold">Key stats <span class="font-normal text-ink-faint">(all time / last 7d)</span></h4>';
    const cells = document.createElement('div');
    cells.className = 'grid grid-cols-2 gap-2 sm:grid-cols-3';
    const keyStats = [
      ['Playtime', fmtDuration(p.stats.playtimeTicks / 20), fmtDuration(p.deltas['7d'].playtimeTicks / 20)],
      ['Deaths', p.stats.deaths.toLocaleString(), p.deltas['7d'].deaths.toLocaleString()],
      ['Mob kills', p.stats.mobKills.toLocaleString(), p.deltas['7d'].mobKills.toLocaleString()],
      ['Player kills', p.stats.playerKills.toLocaleString(), p.deltas['7d'].playerKills.toLocaleString()],
      ['Blocks mined', p.stats.blocksMinedTotal.toLocaleString(), p.deltas['7d'].blocksMinedTotal.toLocaleString()],
      ['Diamonds', p.stats.diamondsMined.toLocaleString(), p.deltas['7d'].diamondsMined.toLocaleString()],
      ['Distance', fmtValue('distanceCm', p.stats.distanceCm), fmtValue('distanceCm', p.deltas['7d'].distanceCm)],
      [
        'Damage dealt',
        fmtValue('damageDealt', p.stats.damageDealt),
        fmtValue('damageDealt', p.deltas['7d'].damageDealt),
      ],
      ['Jumps', p.stats.jumps.toLocaleString(), p.deltas['7d'].jumps.toLocaleString()],
    ];
    for (const [label, total, week] of keyStats) {
      const cell = document.createElement('div');
      cell.className = 'rounded-md border border-line bg-raised p-2.5';
      cell.innerHTML = `<div class="text-xs text-ink-faint"></div><div class="mt-0.5 text-sm font-semibold"></div><div class="text-[11px] text-ink-faint"></div>`;
      cell.children[0].textContent = label;
      cell.children[1].textContent = total;
      cell.children[2].textContent = `+${week} this week`;
      cells.appendChild(cell);
    }
    grid.appendChild(cells);
    content.appendChild(grid);

    const sessions = document.createElement('div');
    sessions.innerHTML = `<h4 class="mb-2 text-sm font-semibold">Recent sessions <span class="font-normal text-ink-faint">(${p.sessions.count} total)</span></h4>`;
    if (!p.sessions.recent.length) {
      const empty = document.createElement('p');
      empty.className = 'text-xs text-ink-faint';
      empty.textContent =
        'No sessions recorded yet — sessions are tracked from join/leave events while the panel runs.';
      sessions.appendChild(empty);
    } else {
      const ol = document.createElement('ol');
      ol.className = 'divide-y divide-line rounded-md border border-line';
      for (const s of p.sessions.recent) {
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between gap-2 p-2 text-xs';
        li.innerHTML = `<span data-when></span><span class="text-ink-faint" data-len></span>`;
        li.querySelector('[data-when]').textContent = fmtTime(s.startedAt);
        li.querySelector('[data-len]').textContent = s.open ? 'online now' : fmtDuration(s.durationSec);
        ol.appendChild(li);
      }
      sessions.appendChild(ol);
    }
    content.appendChild(sessions);

    openModal({
      title: `${p.name || name} — player profile`,
      content,
      size: 'lg',
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
  }

  loadScoreboard();
  loadTimeline({ reset: true });
}
