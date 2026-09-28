// World quick-controls (rendered by world-controls.hbs on the World tab):
// time, weather, world border, number gamerules, gamerule toggles,
// difficulty, plus a live in-game clock. The clock ticks locally
// (20 ticks/s) between RCON resyncs so it stays honest even right after a
// /time set intervention.
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
  let frozen = false; // daylight cycle paused - stop the local ticking
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

  // Only ask the server to read the gamerules whose chips or inputs are
  // actually on screen - the "Show all world rules" section stays unqueried
  // until it is opened. Each read is an RCON round trip, so this keeps the
  // ~30s poll light.
  function visibleRules() {
    const seen = new Set();
    root.querySelectorAll('[data-wc-toggle]').forEach((chip) => {
      const rule = chip.dataset.rule;
      if (!rule || rule === 'pvp') return;
      const box = chip.closest('details');
      if (box && !box.open) return;
      seen.add(rule);
    });
    root.querySelectorAll('[data-wc-int]').forEach((input) => {
      if (input.dataset.wcInt) seen.add(input.dataset.wcInt);
    });
    return [...seen];
  }

  async function refreshState() {
    try {
      const rules = visibleRules();
      const qs = rules.length ? `?rules=${encodeURIComponent(rules.join(','))}` : '';
      const res = await fetch(`/api/servers/${serverId}/world/state${qs}`);
      const data = await res.json();
      // Offline: the server is stopped and these are the last-saved values read
      // from level.dat. Show them (the fieldset is disabled, so read-only) with
      // a clear note; a running server that just can't be reached lands here too.
      if (data.ok && data.offline) {
        renderOffline(data.state);
        return;
      }
      if (!data.ok || !data.running) {
        stateLine.classList.remove('hidden');
        stateLine.textContent = 'The world state is not available yet. The server may still be starting.';
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
        // 26.x doesn't expose doDaylightCycle as a readable gamerule (it moved to
        // /time pause|resume), so its chip would sit blank forever. Fall back to
        // the freeze inference the clock already computed.
        if (s.doDaylightCycle === undefined) s.doDaylightCycle = !frozen;
        renderClock();
        stateLine.classList.add('hidden');
      } else {
        // Say what is actually known - "loaded" while the clock stays hidden
        // asserted a success the user can't see.
        stateLine.textContent = 'Connected. This server version does not report the world clock.';
      }
      applyChips(s);
      applyDifficulty(s);
      applyInts(s);
      applyBorder(s);
      // Rules this Minecraft version does not have: hide their rows outright
      // (they are neither on, off, nor unread) so the card only shows what the
      // server can actually change.
      const unsupported = new Set(Array.isArray(data.unsupported) ? data.unsupported : []);
      root.querySelectorAll('[data-wc-toggle]').forEach((toggle) => {
        const row = toggle.closest('[data-wc-row]');
        if (row) row.classList.toggle('hidden', unsupported.has(toggle.dataset.rule));
        else toggle.hidden = unsupported.has(toggle.dataset.rule);
      });
      root.querySelectorAll('[data-wc-int-row]').forEach((row) => {
        row.classList.toggle('hidden', unsupported.has(row.dataset.wcIntRow));
      });
      // Some rules could not be read this cycle - say so instead of leaving
      // their chips looking authoritative. This holds on a running server too:
      // the clock lives in its own box, so this line doesn't hide it.
      if (data.degraded) {
        stateLine.classList.remove('hidden');
        stateLine.textContent = 'Some world settings could not be read just now. They will refresh on the next check.';
      }
    } catch {
      stateLine.classList.remove('hidden');
      stateLine.textContent = 'The world state is not available right now.';
    }
  }

  // Reflect gamerule states on the toggle switches: the checkbox drives the
  // visual, data-on remembers the last server-confirmed value (the click
  // handler sends the opposite), data-tip explains it.
  //
  // A rule missing from `s` was NOT read this cycle (collapsed "all rules"
  // section, a flaked RCON read, or a rule this server version doesn't expose).
  // Leaving the switch as-is and flagging its row "unknown" is honest; forcing
  // it off would both misreport the status and make the next click send the
  // wrong -on/-off action.
  function applyChips(s, { readonly = false } = {}) {
    root.querySelectorAll('[data-wc-toggle]').forEach((toggle) => {
      const value = s[toggle.dataset.rule];
      const row = toggle.closest('[data-wc-row]');
      if (value === undefined) {
        if (toggle.dataset.on === undefined && row) row.dataset.wcUnknown = '1';
        return;
      }
      if (row) delete row.dataset.wcUnknown;
      toggle.dataset.on = value ? '1' : '0';
      if (toggle instanceof HTMLInputElement) toggle.checked = value === true;
      if (toggle.dataset.rule === 'pvp') {
        toggle.dataset.tip = value
          ? 'On. Click to turn off (applies on the next restart).'
          : 'Off. Click to turn on (applies on the next restart).';
      } else {
        toggle.dataset.tip = readonly
          ? value
            ? 'On (last saved). Start the server to change it.'
            : 'Off (last saved). Start the server to change it.'
          : value
            ? 'On. Click to turn off.'
            : 'Off. Click to turn on.';
      }
    });
  }

  // Difficulty is a select now: reflect the live value as the selected option.
  function applyDifficulty(s) {
    if (!s.difficulty) return;
    const sel = root.querySelector('[data-wc-select="difficulty"]');
    if (sel && [...sel.options].some((o) => o.value === s.difficulty)) sel.value = s.difficulty;
  }

  // Number inputs show the live value. Never stomp what the person is typing:
  // a poll landing mid-edit would otherwise eat their digits.
  function applyInts(s) {
    root.querySelectorAll('[data-wc-int]').forEach((input) => {
      const value = s[input.dataset.wcInt];
      if (typeof value !== 'number') return;
      if (document.activeElement === input) return;
      if (input.value !== String(value)) input.value = String(value);
    });
  }

  function applyBorder(s) {
    const el = root.querySelector('[data-wc-border]');
    if (el) el.textContent = typeof s.borderDiameter === 'number' ? `${s.borderDiameter} blocks` : 'unknown';
  }

  // Stopped server: values came from level.dat. The clock is frozen at whatever
  // was last saved, so don't start the local ticking.
  function renderOffline(s) {
    frozen = true;
    if (typeof s.timeTicks === 'number') {
      ticks = s.timeTicks;
      if (s.day) day = s.day;
      renderClock();
      phaseEl.textContent = `${phaseOf(s.timeTicks)} · last saved`;
    }
    applyChips(s, { readonly: true });
    applyDifficulty(s);
    applyInts(s);
    stateLine.classList.remove('hidden');
    stateLine.textContent = 'Server offline, showing the last saved world settings. Start the server to change them.';
  }

  async function quick(action, el, params) {
    const restore = setBusy(el); // spinner in place of the chip content
    try {
      const res = await fetch(`/api/servers/${serverId}/world/quick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params ? { action, params } : { action }),
      });
      // A proxy 502/504 page or a 413 is not JSON - fall back to a plain message
      // instead of surfacing "Unexpected token '<'" to the user.
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'That command could not be run. Please try again.');
      toast(data.label);
      // PvP is a server.properties write, not a live command - flag that a
      // restart is needed before it actually changes anything in-game.
      if (action.startsWith('pvp-')) {
        root.querySelector('[data-wc-pvp-pending]')?.classList.remove('hidden');
      }
      // Interventions change the clock/pause state - resync right away and
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

  const val = (sel) => root.querySelector(sel)?.value.trim() || '';

  // Time / weather / difficulty selects. Difficulty shows the live value;
  // weather and time have no readable "current", so they reset to the prompt
  // after firing instead of pretending a selection is active.
  root.querySelectorAll('[data-wc-select]').forEach((sel) => {
    sel.addEventListener('change', () => {
      if (!sel.value) return;
      const kind = sel.dataset.wcSelect;
      if (kind === 'difficulty') quick(`difficulty-${sel.value}`, sel);
      else {
        quick(sel.value, sel);
        sel.value = '';
      }
    });
  });

  root.addEventListener('click', (e) => {
    const direct = e.target.closest('[data-wc]');
    if (direct) {
      quick(direct.dataset.wc, direct);
      return;
    }
    const custom = e.target.closest('[data-wc-custom]');
    if (custom) {
      if (custom.dataset.wcCustom === 'time-set') quick('time-set', custom, { ticks: val('[data-wc-ticks]') });
      return;
    }
    const intBtn = e.target.closest('[data-wc-int-set]');
    if (intBtn) {
      const rule = intBtn.dataset.wcIntSet;
      quick('gamerule-int', intBtn, { rule, value: val(`[data-wc-int="${rule}"]`) });
      return;
    }
    const borderBtn = e.target.closest('[data-wc-border-set],[data-wc-border-add],[data-wc-border-center]');
    if (borderBtn) {
      if (borderBtn.hasAttribute('data-wc-border-set')) {
        const params = { diameter: val('[data-wc-border-diameter]') };
        const seconds = val('[data-wc-border-seconds]');
        if (seconds) params.seconds = seconds;
        quick('border-set', borderBtn, params);
      } else if (borderBtn.hasAttribute('data-wc-border-add')) {
        quick('border-add', borderBtn, { delta: val('[data-wc-border-delta]') });
      } else {
        quick('border-center', borderBtn, { x: val('[data-wc-border-x]'), z: val('[data-wc-border-z]') });
      }
      return;
    }
    const chip = e.target.closest('[data-wc-toggle]');
    if (chip) {
      const turnOn = chip.dataset.on !== '1';
      quick(`${chip.dataset.wcToggle}-${turnOn ? 'on' : 'off'}`, chip);
    }
  });

  // Opening "Show all world rules" pulls in a batch of rules we haven't read
  // yet - refresh right away so their chips aren't blank.
  root.querySelector('[data-wc-all]')?.addEventListener('toggle', (e) => {
    if (e.target.open) refreshState();
  });

  refreshState();
  if (running) {
    // Local tick: one real second ≈ 20 game ticks. Resync over RCON every 30s.
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
    }, 30000);
  }
}
