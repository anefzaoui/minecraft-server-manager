// Commands tab: custom chat commands (!rtp2 …). CRUD modal with dynamic
// per-action panels, per-command test runs, prefix setting. Mutations hit
// /api/servers/:id/chat-commands and reload the tab.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';

const root = document.querySelector('[data-commands-root]');
if (root) init(root);

function init(root) {
  const serverId = root.dataset.serverId;
  const prefix = root.dataset.prefix || '!';
  const running = root.dataset.running === '1';

  let commands = [];
  try {
    commands = JSON.parse(document.getElementById('chat-commands-data').textContent) || [];
  } catch {
    /* island missing — actions still work */
  }

  async function api(method, path, body) {
    const res = await fetch(`/api/servers/${serverId}/chat-commands${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    return data;
  }

  function refresh(message) {
    toast(message);
    setTimeout(() => location.reload(), 700);
  }

  function fail(err) {
    toast(err.message || 'Something went wrong', { kind: 'error' });
  }

  function esc(s) {
    return String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  // "minecraft:snowy_plains" / "#minecraft:village" → "Snowy plains"
  function pretty(id) {
    const base = String(id).replace(/^#/, '').split(':').pop().split('/').pop().replace(/_/g, ' ');
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // ------------------------------------------------------------------ prefix
  const prefixInput = document.getElementById('cc-prefix');
  const prefixSave = document.getElementById('cc-prefix-save');
  if (prefixSave)
    prefixSave.addEventListener('click', async () => {
      const value = prefixInput.value.trim();
      if (!/^[!.#+?$%&*~^=-]{1,2}$/.test(value)) {
        toast('Prefix must be 1-2 characters from ! . # + ? $ % & * ~ ^ = - (never /)', { kind: 'error' });
        return;
      }
      try {
        await withBusy(prefixSave, 'Saving…', () => api('PUT', '/prefix', { prefix: value }));
        refresh(`Prefix set to "${value}" — commands now start with ${value}`);
      } catch (err) {
        fail(err);
      }
    });

  // ------------------------------------- structure/biome lists (lazy, cached)
  let structuresPromise = null;
  let biomesPromise = null;
  function loadStructures() {
    structuresPromise ||= fetch(`/api/servers/${serverId}/players/structures`)
      .then((r) => r.json())
      .then((d) => d.structures || [])
      .catch(() => []);
    return structuresPromise;
  }
  function loadBiomes() {
    biomesPromise ||= fetch(`/api/servers/${serverId}/players/biomes`)
      .then((r) => r.json())
      .then((d) => d.biomes || [])
      .catch(() => []);
    return biomesPromise;
  }

  // -------------------------------------------------------- add / edit modal
  function commandModal(existing) {
    const p = (existing && existing.params) || {};
    const content = document.createElement('div');
    content.className = 'space-y-4 text-sm';
    content.innerHTML = `
      <div class="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
        <div>
          <label class="label">Trigger</label>
          <div class="relative">
            <span class="pointer-events-none absolute inset-y-0 left-2.5 grid place-items-center font-mono text-ink-faint" data-f="prefix-preview">${esc(prefix)}</span>
            <input class="input pl-7 font-mono" data-f="trigger" maxlength="24" autocomplete="off" spellcheck="false" placeholder="rtp2" value="${esc(existing ? existing.trigger : '')}">
          </div>
        </div>
        <div>
          <label class="label">Description (optional)</label>
          <input class="input" data-f="description" maxlength="200" placeholder="Random teleport, 500-5000 blocks" value="${esc(existing ? existing.description : '')}">
        </div>
      </div>

      <div>
        <label class="label">Action</label>
        <select class="input" data-f="action" data-label="Action">
          <option value="rtp">Random teleport (panel RTP)</option>
          <option value="structure">Teleport to a structure</option>
          <option value="biome">Teleport to a biome</option>
          <option value="console">Run console commands</option>
        </select>
      </div>

      <div data-cc-panel="rtp" class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div><label class="label">Min distance</label><input class="input" type="number" data-f="minDistance" min="0" value="${Number(p.minDistance ?? 500)}"></div>
          <div><label class="label">Max distance</label><input class="input" type="number" data-f="maxDistance" min="16" value="${Number(p.maxDistance ?? 5000)}"></div>
        </div>
        <div>
          <label class="label">Around</label>
          <select class="input" data-f="center" data-label="Around">
            <option value="player">The player's current position</option>
            <option value="origin">World center (0, 0)</option>
          </select>
        </div>
        <p class="text-xs text-ink-faint">Panel-built RTP — picks a random ring point and lands the player safely on the surface; ocean picks are re-rolled automatically.</p>
      </div>

      <div data-cc-panel="structure" class="hidden space-y-3">
        <div>
          <label class="label">Structure</label>
          <select class="input" data-f="structure" data-label="Structure"><option value="">Loading structures…</option></select>
        </div>
        <div class="grid grid-cols-2 items-end gap-2">
          <div><label class="label">Search radius</label><input class="input" type="number" data-f="structMaxDistance" min="16" value="${Number(p.maxDistance ?? 5000)}"></div>
          <label class="flex items-center gap-2 pb-2"><input type="checkbox" class="msm-check" data-f="structRandom" ${p.random === false ? '' : 'checked'}> Surprise me (random one, not nearest)</label>
        </div>
      </div>

      <div data-cc-panel="biome" class="hidden space-y-3">
        <div>
          <label class="label">Biome</label>
          <select class="input" data-f="biome" data-label="Biome"><option value="">Loading biomes…</option></select>
          <p class="mt-1 text-xs text-ink-faint">Searches from the player's position via /locate biome and lands them on the surface.</p>
        </div>
      </div>

      <div data-cc-panel="console" class="hidden space-y-3">
        <div>
          <label class="label">Console commands (one per line, run in order)</label>
          <textarea class="input min-h-28 font-mono text-xs" data-f="commands" rows="4" spellcheck="false" placeholder="give {player} minecraft:golden_apple 1&#10;tell {player} Enjoy!">${esc(Array.isArray(p.commands) ? p.commands.join('\n') : '')}</textarea>
          <p class="mt-1 text-xs text-ink-faint">
            Placeholders: <code class="font-mono">{player}</code> = who typed it, <code class="font-mono">{arg1}</code>–<code class="font-mono">{arg3}</code> = words after the trigger
            (sanitized; blank when absent). Commands starting with stop / op / deop / ban / pardon / whitelist require the Ops permission level.
          </p>
        </div>
      </div>

      <div class="rounded-md border border-line p-3 space-y-3">
        <div class="text-sm font-medium">Messages whispered to the player <span class="font-normal text-ink-faint">(optional)</span></div>
        <div>
          <label class="label flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-gold-400"></span> While it runs</label>
          <input class="input" data-f="msgPending" maxlength="200" placeholder="Looking for a random location…" value="${esc(existing ? existing.msg_pending : '')}">
        </div>
        <div>
          <label class="label flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-grass-500"></span> On success</label>
          <input class="input" data-f="msgSuccess" maxlength="200" placeholder="Teleported {player} to {x}, {z} ({distance} blocks away)" value="${esc(existing ? existing.msg_success : '')}">
        </div>
        <div>
          <label class="label flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-redstone-500"></span> On failure</label>
          <input class="input" data-f="msgFailure" maxlength="200" placeholder="Couldn’t find a safe spot — try again in a moment. ({error})" value="${esc(existing ? existing.msg_failure : '')}">
        </div>
        <p class="text-xs text-ink-faint" data-cc-placeholders></p>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="label">Who can use it</label>
          <select class="input" data-f="permission" data-label="Who can use it">
            <option value="everyone">Everyone</option>
            <option value="whitelist">Whitelisted players</option>
            <option value="ops">Ops only</option>
          </select>
        </div>
        <div>
          <label class="label">Cooldown (seconds per player)</label>
          <input class="input" type="number" data-f="cooldownSec" min="0" max="86400" value="${Number(existing ? existing.cooldown_sec : 30)}">
          <p class="mt-1 text-xs text-ink-faint">0 = no cooldown</p>
        </div>
      </div>

      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="enabled" ${!existing || existing.enabled ? 'checked' : ''}> Enabled</label>`;

    const f = (k) => content.querySelector(`[data-f="${k}"]`);
    if (existing) f('action').value = existing.action;
    if (p.center) f('center').value = p.center;
    if (existing) f('permission').value = existing.permission;

    function syncPanels() {
      const action = f('action').value;
      content
        .querySelectorAll('[data-cc-panel]')
        .forEach((el) => el.classList.toggle('hidden', el.dataset.ccPanel !== action));
      if (action === 'structure') fillSelect(f('structure'), loadStructures(), p.structure);
      if (action === 'biome') fillSelect(f('biome'), loadBiomes(), p.biome);
      updatePlaceholderHint();
    }
    f('action').addEventListener('change', syncPanels);

    const DIM_SHORT = {
      'minecraft:overworld': 'Overworld',
      'minecraft:the_nether': 'Nether',
      'minecraft:the_end': 'End',
    };
    const DIM_ORDER = { 'minecraft:overworld': 0, 'minecraft:the_nether': 1, 'minecraft:the_end': 2 };
    const dimShort = (d) =>
      DIM_SHORT[d] ||
      String(d || '')
        .split(':')
        .pop();

    function fillSelect(sel, promise, selected) {
      if (sel.dataset.loaded) return;
      // items are {id, dimension}; label options "Nether · Crimson Forest", grouped by dimension.
      promise.then((items) => {
        if (!items.length) {
          sel.innerHTML = '<option value="">No list available — start the server</option>';
        } else {
          const list = [...items].sort(
            (a, b) =>
              (DIM_ORDER[a.dimension] ?? 9) - (DIM_ORDER[b.dimension] ?? 9) || pretty(a.id).localeCompare(pretty(b.id))
          );
          sel.innerHTML = list
            .map((e) => `<option value="${esc(e.id)}">${esc(dimShort(e.dimension))} · ${esc(pretty(e.id))}</option>`)
            .join('');
          if (selected && list.some((e) => e.id === selected)) sel.value = selected;
          else if (!selected && sel.dataset.f === 'structure') {
            const village = list.find((e) => /village/.test(e.id));
            if (village) sel.value = village.id;
          }
          sel.dataset.loaded = '1';
        }
        sel.dispatchEvent(new Event('change', { bubbles: true })); // resync the enhanced trigger
      });
    }

    function collect() {
      const trigger = f('trigger').value.trim().toLowerCase();
      if (!/^[a-z0-9_-]{1,24}$/.test(trigger)) {
        toast('Triggers are 1-24 letters, digits, - or _', { kind: 'error' });
        return null;
      }
      const action = f('action').value;
      const permission = f('permission').value;
      let params;
      if (action === 'rtp') {
        params = {
          minDistance: Number(f('minDistance').value) || 0,
          maxDistance: Number(f('maxDistance').value) || 5000,
          center: f('center').value || 'player',
        };
        if (params.maxDistance <= params.minDistance) {
          toast('Max distance must be greater than min distance', { kind: 'error' });
          return null;
        }
      } else if (action === 'structure') {
        if (!f('structure').value) {
          toast('Pick a structure', { kind: 'error' });
          return null;
        }
        params = {
          structure: f('structure').value,
          random: f('structRandom').checked,
          maxDistance: Number(f('structMaxDistance').value) || 5000,
        };
      } else if (action === 'biome') {
        if (!f('biome').value) {
          toast('Pick a biome', { kind: 'error' });
          return null;
        }
        params = { biome: f('biome').value };
      } else {
        const lines = f('commands')
          .value.split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        if (!lines.length) {
          toast('Add at least one console command', { kind: 'error' });
          return null;
        }
        params = { commands: lines };
      }
      return {
        trigger,
        description: f('description').value.trim(),
        action,
        params,
        permission,
        cooldownSec: Math.max(0, Number(f('cooldownSec').value) || 0),
        enabled: f('enabled').checked,
        // '' clears a message (falls back to the built-in default).
        msgPending: f('msgPending').value.trim(),
        msgSuccess: f('msgSuccess').value.trim(),
        msgFailure: f('msgFailure').value.trim(),
      };
    }

    // Which {placeholders} the success message can use depends on the action.
    const SUCCESS_TOKENS = {
      rtp: '{player} {x} {z} {distance} {dimension}',
      structure: '{player} {structure} {x} {z} {dimension}',
      biome: '{player} {biome} {x} {z} {dimension}',
      console: '{player} {arg1}–{arg3}',
    };
    function updatePlaceholderHint() {
      const el = content.querySelector('[data-cc-placeholders]');
      if (!el) return;
      const action = f('action').value;
      el.innerHTML =
        `Placeholders — while running: <code class="font-mono">{player}</code> <code class="font-mono">{arg1}</code>–<code class="font-mono">{arg3}</code> · ` +
        `on success: ${(SUCCESS_TOKENS[action] || '{player}')
          .split(' ')
          .map((t) => `<code class="font-mono">${esc(t)}</code>`)
          .join(' ')} · ` +
        `on failure: <code class="font-mono">{error}</code>`;
    }

    openModal({
      title: existing ? `Edit ${prefix}${existing.trigger}` : 'Add chat command',
      content,
      size: 'lg',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: existing ? 'Save' : 'Create',
          kind: 'primary',
          busyLabel: 'Saving…',
          onClick: async () => {
            const body = collect();
            if (!body) return false;
            try {
              if (existing) await api('PATCH', `/${existing.id}`, body);
              else await api('POST', '/', body);
              refresh(`${prefix}${body.trigger} ${existing ? 'saved' : 'created'}`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });

    syncPanels();
  }

  for (const id of ['cc-add', 'cc-add-empty']) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => commandModal(null));
  }

  // ------------------------------------------------------------- row actions
  root.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-cc-row]');
    if (!row) return;
    const cmd = commands.find((c) => c.id === row.dataset.id);
    if (!cmd) return;

    if (e.target.closest('[data-cc-edit]')) {
      commandModal(cmd);
    } else if (e.target.closest('[data-cc-delete]')) {
      const ok = await confirmDialog({
        title: `Delete ${prefix}${cmd.trigger}?`,
        message: 'Players will no longer be able to use it. This cannot be undone.',
        confirmLabel: 'Delete',
      });
      if (!ok) return;
      try {
        await withBusy(e.target.closest('[data-cc-delete]'), async () => {
          await api('DELETE', `/${cmd.id}`);
          refresh(`${prefix}${cmd.trigger} deleted`);
        });
      } catch (err) {
        fail(err);
      }
    } else if (e.target.closest('[data-cc-test]')) {
      testModal(cmd);
    }
  });

  // ---------------------------------------------------------- enable toggles
  root.addEventListener('change', async (e) => {
    const toggle = e.target.closest('[data-cc-toggle]');
    if (!toggle) return;
    const row = e.target.closest('[data-cc-row]');
    const cmd = commands.find((c) => c.id === row?.dataset.id);
    if (!cmd) return;
    toggle.disabled = true; // keep the toggle visual — just lock it in flight
    try {
      await api('PATCH', `/${cmd.id}`, { enabled: toggle.checked });
      cmd.enabled = toggle.checked;
      toast(`${prefix}${cmd.trigger} ${toggle.checked ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toggle.checked = !toggle.checked;
      fail(err);
    } finally {
      toggle.disabled = false;
    }
  });

  // -------------------------------------------------------------------- test
  function testModal(cmd) {
    if (!running) {
      toast('Start the server to test commands', { kind: 'error' });
      return;
    }
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <div>
        <label class="label">Run as player (must be online for teleports)</label>
        <input class="input" data-f="player" maxlength="16" autocomplete="off" spellcheck="false" placeholder="AverageLupo" value="${esc(localStorage.getItem('cc-test-player') || '')}">
      </div>
      <p class="text-xs text-ink-faint">Runs <code class="font-mono">${esc(prefix + cmd.trigger)}</code> right now — permission and cooldown checks are skipped, the result is whispered to the player in game.</p>`;
    openModal({
      title: `Test ${prefix}${cmd.trigger}`,
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Run now',
          kind: 'primary',
          busyLabel: 'Running…',
          onClick: async ({ body }) => {
            const player = body.querySelector('[data-f="player"]').value.trim();
            if (!/^[A-Za-z0-9_]{1,16}$/.test(player)) {
              toast('Enter a valid player name', { kind: 'error' });
              return false;
            }
            localStorage.setItem('cc-test-player', player);
            try {
              const { message } = await api('POST', `/${cmd.id}/test`, { player });
              refresh(message || `${prefix}${cmd.trigger} ran for ${player}`);
            } catch (err) {
              fail(err);
              return false;
            }
          },
        },
      ],
    });
  }
}
