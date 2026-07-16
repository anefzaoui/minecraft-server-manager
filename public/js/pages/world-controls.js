// World quick-controls rail (rendered by world-controls.hbs on every server
// tab): time, weather, gamerules, difficulty, plus a live in-game clock. The
// clock ticks locally (20 ticks/s) between RCON resyncs so it stays honest
// even right after a /time set intervention.
import { toast } from '../lib/toast.js';
import { setBusy } from '../lib/loading.js';

const root = document.querySelector('[data-world-controls]');
if (root) init(root.dataset.worldControls, root.dataset.running === '1');

function init(serverId, running) {
  const stateLine = root.querySelector('[data-wc-state]');
  const clockBox = root.querySelector('[data-wc-clock-box]');
  const clockEl = root.querySelector('[data-wc-clock]');
  const phaseEl = root.querySelector('[data-wc-phase]');
  const dayWrap = root.querySelector('[data-wc-day-wrap]');
  const dayEl = root.querySelector('[data-wc-day]');

  // ------------------------------------------------------------- game clock
  let ticks = null; // current daytime ticks (0-23999), advanced locally
  let day = null;
  let frozen = false; // daylight cycle paused — stop the local ticking
  let lastSyncTicks = null;

  function phaseOf(t) {
    return t < 6000 ? 'Morning' : t < 12000 ? 'Afternoon' : t < 13800 ? 'Sunset' : t < 22200 ? 'Night' : 'Sunrise';
  }
  function clockOf(t) {
    const h24 = Math.floor(t / 1000 + 6) % 24;
    const m = Math.floor(((t % 1000) / 1000) * 60);
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }
  function renderClock() {
    if (ticks === null) return;
    clockBox.classList.remove('hidden');
    clockBox.classList.add('flex');
    clockEl.textContent = clockOf(ticks);
    phaseEl.textContent = frozen ? `${phaseOf(ticks)} (clock paused)` : phaseOf(ticks);
    if (day) {
      dayWrap.classList.remove('hidden');
      dayEl.textContent = day;
    }
  }

  async function refreshState() {
    if (!running) return;
    try {
      const res = await fetch(`/api/servers/${serverId}/world/state`);
      const data = await res.json();
      if (!data.ok || !data.running) {
        stateLine.textContent = 'World state unavailable — is the server still starting?';
        return;
      }
      const s = data.state;
      if (typeof s.timeTicks === 'number') {
        // Frozen? Trust the gamerule when the server reports it; otherwise
        // (26.x uses /time pause, not a gamerule) infer it: two syncs with the
        // exact same tick means the clock is not moving.
        if (s.doDaylightCycle === false) frozen = true;
        else if (s.doDaylightCycle === true) frozen = false;
        else frozen = lastSyncTicks !== null && s.timeTicks === lastSyncTicks;
        lastSyncTicks = s.timeTicks;
        ticks = s.timeTicks;
        if (s.day) day = s.day;
        renderClock();
        stateLine.classList.add('hidden');
      } else {
        // Say what is actually known — "loaded" while the clock stays hidden
        // asserted a success the user can't see.
        stateLine.textContent = 'Connected — this server version does not report the world clock.';
      }
      // Reflect gamerule states on the toggle chips: aria-pressed carries the
      // state (the CSS chip[aria-pressed] rule styles it), data-tip explains it.
      root.querySelectorAll('[data-wc-toggle]').forEach((chip) => {
        const value = s[chip.dataset.rule];
        chip.dataset.on = value ? '1' : '0';
        chip.setAttribute('aria-pressed', String(value === true));
        if (value !== undefined) chip.dataset.tip = value ? 'ON — click to turn off' : 'OFF — click to turn on';
      });
    } catch {
      stateLine.classList.remove('hidden');
      stateLine.textContent = 'World state unavailable.';
    }
  }

  async function quick(action, el) {
    const restore = setBusy(el); // spinner in place of the chip content
    try {
      const res = await fetch(`/api/servers/${serverId}/world/quick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Command failed');
      toast(data.label);
      // Interventions change the clock/pause state — resync right away and
      // reset freeze inference so the next sync doesn't misread a /time set.
      if (action === 'daycycle-on') frozen = false;
      if (action === 'daycycle-off') frozen = true;
      lastSyncTicks = null;
      await refreshState();
    } catch (err) {
      toast(err.message, { kind: 'error' });
    } finally {
      restore();
    }
  }

  root.addEventListener('click', (e) => {
    const direct = e.target.closest('[data-wc]');
    if (direct) {
      quick(direct.dataset.wc, direct);
      return;
    }
    const chip = e.target.closest('[data-wc-toggle]');
    if (chip) {
      const turnOn = chip.dataset.on !== '1';
      quick(`${chip.dataset.wcToggle}-${turnOn ? 'on' : 'off'}`, chip);
    }
  });

  refreshState();
  if (running) {
    // Local tick: one real second ≈ 20 game ticks. Resync over RCON every 20s.
    setInterval(() => {
      if (frozen || ticks === null || document.hidden) return;
      ticks += 20;
      if (ticks >= 24000) {
        ticks -= 24000;
        if (day) day += 1;
      }
      renderClock();
    }, 1000);
    setInterval(() => {
      if (!document.hidden) refreshState();
    }, 20000);
  }
}
