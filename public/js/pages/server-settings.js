// Server Settings tab: collect fields, PATCH the server, surface recreate flag,
// live heap/container headroom feedback, blueprint export/clone, icon upload.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { runTask } from '../lib/progress.js';
import { attachMotdEditor, toSectionCodes } from '../lib/motd.js';
import { setBusy } from '../lib/loading.js';
import { initDockerSettings } from '../lib/dockerSettings.js';
import { wireCatalogConflicts } from '../lib/catalogConflicts.js';
import { escapeHtml } from '../lib/format.js';
import { changePackVersion } from '../lib/packVersion.js';
import { renderedValue, mergeEnvChanges, changedKeys, fitRange } from '../lib/settingsChanges.js';

const root = document.querySelector('[data-settings-server]');
if (root) init(root.dataset.settingsServer);

function init(serverId) {
  // Browsers put form values back when a page reloads (Firefox even after the
  // location.reload() every save here ends with), matching each control by its
  // position on the page. The controls here move between loads (the header's
  // Start, Stop and Apply Changes buttons come and go), so a value could land
  // in another setting: a CPU count in a memory slider, the view distance in
  // the world border (#113). So each control starts from what the server
  // rendered (and the markup asks the browser not to keep them: autocomplete="off").
  resetToRendered(root);

  let icon = root.dataset.settingsIcon;
  let accent = root.dataset.settingsAccent;
  const tags = new Set(JSON.parse(root.dataset.settingsTags || '[]'));

  // ---- Advanced Docker settings: name, network, extra ports/binds ----
  const initialDocker = {
    containerName: root.dataset.settingsDockerName || '',
    networkName: root.dataset.settingsDockerNetwork || '',
    extraPorts: JSON.parse(root.dataset.settingsDockerPorts || '[]'),
    extraBinds: JSON.parse(root.dataset.settingsDockerBinds || '[]'),
  };
  const dockerSettings = initDockerSettings({
    name: 'st-docker-name',
    network: 'st-docker-network',
    ports: 'st-docker-ports',
    binds: 'st-docker-binds',
    portAdd: 'st-docker-port-add',
    bindAdd: 'st-docker-bind-add',
    previewBtn: 'st-docker-preview',
  });
  dockerSettings.seed(initialDocker);
  dockerSettings.openPreview(async () => {
    const res = await fetch(`/api/servers/${serverId}/docker-spec`);
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'build the preview' }));
    return data.yaml;
  });

  // ---- dirty tracking: Save always works, but Discard/leave now warn instead
  // of silently dropping edits ----
  let dirty = false;
  const markDirty = () => {
    dirty = true;
  };
  root.addEventListener('input', markDirty);
  root.addEventListener('change', markDirty);
  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault(); // the browser's own unsaved-changes prompt
  });

  // Visual MOTD editor (shared lib)
  const motdInput = document.getElementById('st-motd');
  if (motdInput) {
    attachMotdEditor(motdInput, {
      preview: document.getElementById('st-motd-preview'),
      getName: () => document.getElementById('st-name')?.value.trim() || 'My Server',
    });
  }

  // ---- Advanced settings (full field catalog, same controls as the wizard) ----
  // Pre-fill every control with the server's ACTUAL current value (falling
  // back to the catalog default) - the wizard never needs this since it
  // starts blank, but here each field represents something really configured.
  const advPanel = document.getElementById('st-advanced');
  const catalogControls = advPanel
    ? [...advPanel.querySelectorAll('[data-catalog-key][data-catalog-scope="env"]')]
    : [];
  {
    const currentEnv = parseSettingsEnv();
    for (const el of catalogControls) {
      const value = renderedValue(
        { type: el.dataset.catalogType, default: el.dataset.catalogDefault },
        currentEnv,
        el.dataset.catalogKey
      );
      if (el.dataset.catalogType === 'boolean') el.checked = value === 'true';
      else if (el.dataset.catalogType !== 'enum' || value) el.value = value;
    }
  }
  // What every field read when the page loaded: Save sends only what differs
  // from it. Taken before the conflict check below, so a pair it turns off on
  // load (and says so) is saved like any other change.
  const initialEnvFields = readEnvFields();
  if (advPanel) wireCatalogConflicts(advPanel, { toast });

  function parseSettingsEnv() {
    try {
      return JSON.parse(root.dataset.settingsEnv || '{}');
    } catch {
      return {};
    }
  }

  // MOTD, the Initial heap and every advanced field, as the env values they
  // stand for. An emptied field reads as '' (its key is removed on save).
  function readEnvFields() {
    const out = {};
    if (motdInput) out.MOTD = { type: 'text', value: toSectionCodes(motdInput.value) };
    for (const el of catalogControls) {
      out[el.dataset.catalogKey] =
        el.dataset.catalogType === 'boolean'
          ? { type: 'boolean', value: el.checked ? 'true' : 'false' }
          : { type: el.dataset.catalogType, value: el.value.trim() };
    }
    // The Resources card's Initial heap is INIT_MEMORY in MB.
    const initHeap = document.getElementById('st-initheap');
    if (initHeap) {
      const v = initHeap.value.trim();
      out.INIT_MEMORY = { type: 'number', value: v ? String(Number(v)) : '' };
    }
    return out;
  }

  // Icon + accent pickers - selection lives in aria-pressed; .swatch CSS
  // draws the theme-aware ring, so JS only flips the attribute.
  bindPicker('[data-pick-icon]', (btn) => {
    icon = btn.dataset.pickIcon;
  });
  bindPicker('[data-pick-accent]', (btn) => {
    accent = btn.dataset.pickAccent;
    applyIconAccent();
  });

  // Icon swatches sit on a plate colored to match the chosen accent - keep
  // every swatch (not just the selected one) in sync so switching accents
  // previews live, matching how the icon actually renders once picked.
  function applyIconAccent() {
    root.querySelectorAll('[data-pick-icon]').forEach((btn) => {
      btn.style.background = accent;
    });
  }

  function bindPicker(selector, onPick) {
    const buttons = [...root.querySelectorAll(selector)];
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        onPick(btn);
        markDirty();
      });
    }
  }

  // A custom accent (set via API) matches no preset - give it its own selected
  // swatch so the current choice is always visible.
  (() => {
    const picker = document.getElementById('st-accent-picker');
    if (!picker) return;
    const preset = picker.querySelector(`[data-pick-accent="${CSS.escape(accent)}"]`);
    if (preset) {
      preset.setAttribute('aria-pressed', 'true');
    } else if (accent) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch size-9';
      btn.style.background = accent;
      btn.dataset.pickAccent = accent;
      btn.dataset.tip = 'Current (custom)';
      btn.setAttribute('aria-pressed', 'true');
      picker.prepend(btn);
      btn.addEventListener('click', () => {
        picker.querySelectorAll('[data-pick-accent]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        accent = btn.dataset.pickAccent;
      });
    }
  })();

  // Tag chips
  const tagInput = document.getElementById('st-tag-input');
  const tagWrap = document.getElementById('st-tags');
  function renderTags() {
    tagWrap.querySelectorAll('[data-tag]').forEach((el) => el.remove());
    for (const t of tags) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.tag = t;
      // A real icon button with a focus ring, not a bare few-pixel "✕" glyph.
      chip.innerHTML = `${escapeHtml(t)} <button type="button" class="icon-btn -mr-1 size-4 rounded-sm hover:text-danger" aria-label="Remove tag ${escapeHtml(t)}">
        <svg class="icon size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
      chip.querySelector('button').addEventListener('click', () => {
        tags.delete(t);
        renderTags();
        markDirty();
      });
      tagWrap.insertBefore(chip, tagInput);
    }
  }
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && tagInput.value.trim()) {
      tags.add(tagInput.value.trim().toLowerCase());
      tagInput.value = '';
      renderTags();
      e.preventDefault();
    }
  });
  renderTags();

  // The tab's own fields as the page loaded them; Save sends only the ones
  // that differ (the env fields have initialEnvFields above).
  const initialFields = readFields();
  function readFields() {
    const value = (id) => document.getElementById(id)?.value ?? '';
    const checked = (id) => String(document.getElementById(id)?.checked ?? '');
    return {
      name: value('st-name').trim(),
      description: value('st-desc'),
      notes: value('st-notes'),
      icon: icon || '',
      accent: accent || '',
      tags: JSON.stringify([...tags]),
      heapMb: value('st-heap'),
      containerMemoryMb: value('st-cmem'),
      cpus: value('st-cpu').trim(),
      diskQuotaGb: value('st-quota').trim(),
      updatePolicy: root.querySelector('input[name="up"]:checked')?.value || '',
      autoStart: checked('st-autostart'),
      autoRestart: checked('st-autorestart'),
      quotaStrict: checked('st-quota-strict'),
    };
  }

  // ------------------------------------------------- live headroom feedback
  const heapEl = document.getElementById('st-heap');
  const cmemEl = document.getElementById('st-cmem');
  const headroomBox = document.getElementById('st-headroom');
  function updateHeadroom() {
    if (!heapEl || !cmemEl || !headroomBox) return;
    const heap = Number(heapEl.value);
    const cmem = Number(cmemEl.value);
    const pctAbove = heap ? Math.round(((cmem - heap) / heap) * 100) : 0;
    const base = 'rounded-md border p-2.5 text-xs ';
    if (cmem <= heap) {
      headroomBox.className = base + 'border-danger/40 bg-redstone-500/10 text-danger';
      headroomBox.textContent = `The container limit (${cmem} MB) is at or below the Java heap (${heap} MB). The server will be killed for running out of memory on start. Raise the limit or lower the heap.`;
    } else if (cmem < heap * 1.25) {
      headroomBox.className = base + 'border-warn/40 bg-gold-500/10 text-warn';
      headroomBox.textContent = `Tight headroom: the container limit is only ${pctAbove}% above the Java heap. Java needs extra room beyond the heap, so aim for 25% or more.`;
    } else {
      headroomBox.className = base + 'border-ok/40 bg-grass-500/10 text-ok';
      headroomBox.textContent = `Healthy headroom: the container limit is ${pctAbove}% above the Java heap.`;
    }
  }
  heapEl?.addEventListener('input', updateHeadroom);
  cmemEl?.addEventListener('input', updateHeadroom);
  updateHeadroom();

  // -------------------------------------------------------------- game port
  // Self-contained (own check, "next free" and Save), and kept out of the
  // tab-wide dirty tracking. A change applies at once: a running server is
  // restarted on the new port (asked first), a stopped one gets a new
  // container on it.
  const portCard = root.querySelector('[data-port-card]');
  if (portCard) initPortCard(portCard);

  function initPortCard(card) {
    const input = document.getElementById('st-port');
    const help = document.getElementById('st-port-help');
    const nextBtn = document.getElementById('st-port-next');
    const saveBtn = document.getElementById('st-port-save');
    const current = Number(card.dataset.portCurrent); // live: what players reach now
    const running = 'portRunning' in card.dataset; // as the page saw it; the API checks Docker
    const defaultHelp = help.textContent;
    const setHelp = (text, cls = '') => {
      help.textContent = text;
      help.className = `help ${cls}`;
    };
    let leaving = false; // a save is reloading the page: don't warn
    for (const type of ['input', 'change']) card.addEventListener(type, (e) => e.stopPropagation());
    window.addEventListener('beforeunload', (e) => {
      if (!leaving && input.value.trim() !== String(current)) e.preventDefault();
    });
    const reload = (delayMs = 900) => {
      leaving = true;
      setTimeout(() => location.reload(), delayMs);
    };

    // A check answers only if nothing newer (more typing, Next Free, a save)
    // has spoken since it started - a late one must not overwrite a save's
    // outcome on the help line.
    let timer;
    let checkSeq = 0;
    const cancelChecks = () => {
      clearTimeout(timer);
      checkSeq += 1;
    };
    input.addEventListener('input', () => {
      cancelChecks();
      timer = setTimeout(check, 400);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn.click();
      }
    });
    async function check() {
      const seq = checkSeq;
      const port = Number(input.value);
      if (port === current) return setHelp(defaultHelp);
      if (!Number.isInteger(port)) return setHelp('Enter a whole number.', 'text-danger');
      try {
        const res = await fetch(`/api/servers/${serverId}/port/check?port=${port}`);
        const data = await res.json();
        if (seq !== checkSeq) return; // superseded - stale
        if (!res.ok || !data.ok) throw new Error(data.error);
        if (data.free) setHelp(`Port ${port} is free. RCON will use ${data.rcon}.`, 'text-ok');
        else if (data.reason === 'range') setHelp(`Pick a game port from ${data.min} to ${data.max}.`, 'text-danger');
        else setHelp(`Port ${port} or its RCON port ${data.rcon} is already in use. Pick another.`, 'text-danger');
      } catch {
        if (seq !== checkSeq) return;
        setHelp('Could not check the port right now.', 'text-ink-faint');
      }
    }

    nextBtn.addEventListener('click', async () => {
      const restore = setBusy(nextBtn, 'Finding…');
      try {
        const res = await fetch(`/api/servers/${serverId}/port/suggest`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          toast(data.error || friendlyError(res, { action: 'find a free port' }), { kind: 'error', timeout: 8000 });
          return;
        }
        cancelChecks();
        const next = data.ports.game;
        input.value = String(next);
        if (next === current) setHelp(`This server already uses the lowest free port, ${current}.`, 'text-ok');
        else setHelp(`Port ${next} is free. RCON will use ${data.ports.rcon}. Save to switch.`, 'text-ok');
      } catch {
        toast(friendlyError(null, { action: 'find a free port' }), { kind: 'error' });
      } finally {
        restore();
      }
    });

    saveBtn.addEventListener('click', () => save(Number(input.value)));

    /** Ask before a restart; false when the person says no. */
    async function confirmRestart(port) {
      const { confirmDialog } = await import('../lib/confirm.js');
      return confirmDialog({
        title: `Restart now to move players to port ${port}?`,
        message:
          'The world is saved first. Anyone online is disconnected and can rejoin on the new port once the server is back up, usually within a minute.',
        confirmLabel: 'Restart Now',
      });
    }

    async function putPort(port, restart) {
      try {
        const res = await fetch(`/api/servers/${serverId}/port`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ port, restart }),
        });
        return { res, data: await res.json().catch(() => ({})) };
      } catch {
        return { res: null, data: {} };
      }
    }

    // Applied at once. A running server is restarted on the new port only once
    // the person agreed (the API insists on `restart: true` for a server Docker
    // reports running, so a page that thought it stopped asks then). If the
    // restart can't bind the new port, the API puts it back on the old one.
    async function save(port) {
      cancelChecks();
      if (port === current) {
        toast(`The server already uses port ${port}.`, { kind: 'info' });
        return;
      }
      if (!Number.isInteger(port)) {
        setHelp('Enter a whole number.', 'text-danger');
        return;
      }
      let restart = false;
      if (running) {
        if (!(await confirmRestart(port))) return;
        restart = true;
      }
      const restore = setBusy(saveBtn, restart ? 'Restarting on the new port…' : 'Saving…');
      nextBtn.disabled = true;
      let { res, data } = await putPort(port, restart);
      if (res && res.status === 409 && data.code === 'NEEDS_CONFIRM') {
        // It is running after all: ask, then go again.
        restore();
        if (!(await confirmRestart(port))) {
          nextBtn.disabled = false;
          return;
        }
        setBusy(saveBtn, 'Restarting on the new port…');
        ({ res, data } = await putPort(port, true));
      }
      if (res && res.ok && data.ok) {
        toast(data.restarted ? `Restarted on port ${port}.` : `Port changed to ${port}. The server stays stopped.`);
        reload();
        return;
      }
      // Nothing changed: the server is still on its old port (the API puts it back
      // if the restart failed). Stay on the page so the reason stays readable.
      restore();
      nextBtn.disabled = false;
      if (!res || !('ok' in data)) {
        // No answer from the panel itself (a proxy timing out on this long
        // request, say): the change may still have gone through, so show where
        // the server really is. Any panel answer - 5xx included, like "that port
        // is already in use" - is definite and shown below.
        toast("Couldn't confirm the result. Reloading to show where the server is now.", { kind: 'error' });
        reload();
        return;
      }
      toast(data.error || friendlyError(res, { action: 'change the port' }), { kind: 'error', timeout: 12000 });
      if (restart && res.status >= 500) {
        // It failed after the server was stopped. The panel tried to put it back
        // on its old port, but that can fail too and leave it stopped: reload
        // once the reason has been read. The server's history keeps the reason.
        setHelp('Reloading to show whether the server is running again…', 'text-warn');
        reload(6000);
        return;
      }
      setHelp(
        data.code === 'PENDING_CHANGES'
          ? 'Use Apply Changes at the top of the page first, then save the port again.'
          : `The server is still on port ${current}.`,
        'text-warn'
      );
    }
  }

  // ------------------------------------------------------------ icon upload
  const iconUploadBtn = document.getElementById('st-icon-upload');
  iconUploadBtn?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/svg+xml,image/jpeg,image/webp';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) {
        toast('Icon must be 1 MB or smaller.', { kind: 'error' });
        return;
      }
      const form = new FormData();
      form.append('icon', file);
      const restore = setBusy(iconUploadBtn, 'Uploading…');
      try {
        const res = await fetch(`/api/servers/${serverId}/icon`, { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
          toast(data.error || friendlyError(res, { action: 'upload that icon' }), { kind: 'error', timeout: 8000 });
          return;
        }
        toast('Custom icon uploaded.');
        setTimeout(() => location.reload(), 700);
      } catch {
        toast(friendlyError(null, { action: 'upload that icon' }), { kind: 'error' });
      } finally {
        restore();
      }
    });
    input.click();
  });

  // ------------------------------------------------------- blueprint export
  document.getElementById('st-export-bp')?.addEventListener('click', () => {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <p class="text-xs text-ink-faint">Saves this server's setup as a reusable blueprint in the library.</p>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="config" checked> Include config directories</label>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="embed"> Embed custom mod files in the archive <span class="text-xs text-ink-faint">(bigger file, fully portable)</span></label>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="world"> Include the active world <span class="text-xs text-ink-faint">(can be large)</span></label>`;
    openModal({
      title: 'Export as Blueprint',
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Export Blueprint',
          kind: 'primary',
          busyLabel: 'Exporting…',
          onClick: async ({ body }) => {
            const checked = (k) => body.querySelector(`[data-f="${k}"]`).checked;
            try {
              const data = await postJson('/api/blueprints/export', {
                serverId,
                includeConfig: checked('config'),
                embedFiles: checked('embed'),
                includeWorld: checked('world'),
              });
              const bp = data.blueprint || {};
              offerDownload(bp);
            } catch (err) {
              toast(err.message, { kind: 'error', timeout: 8000 });
              return false;
            }
          },
        },
      ],
    });
  });

  function offerDownload(bp) {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <p>Blueprint <b data-bp-name></b> saved to the library.</p>
      <a class="btn btn-primary" data-bp-dl>Download .zip</a>
      <p class="text-xs text-ink-faint">Also available any time on the <a class="text-link hover:underline" href="/blueprints">Blueprints page</a>.</p>`;
    content.querySelector('[data-bp-name]').textContent = bp.name || 'exported';
    content.querySelector('[data-bp-dl]').href = `/api/blueprints/${encodeURIComponent(bp.id)}/download`;
    openModal({ title: 'Blueprint Exported', content, size: 'sm', actions: [{ label: 'Done', kind: 'ghost' }] });
  }

  // ------------------------------------------------------------------ clone
  document.getElementById('st-clone')?.addEventListener('click', async () => {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <p class="text-xs text-ink-faint">Creates a copy of this server with its own ports. It exports a blueprint and imports it as a new server.</p>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="world"> Also copy the active world</label>`;
    openModal({
      title: 'Clone Server',
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Clone',
          kind: 'primary',
          onClick: ({ body }) => {
            cloneServer(body.querySelector('[data-f="world"]').checked);
          },
        },
      ],
    });
  });

  function cloneServer(includeWorld) {
    // The clone route may respond synchronously ({server}) or with a task id
    // ({taskId}) once the task infrastructure lands - handle both.
    const DIRECT = Symbol('direct');
    let direct = null;
    runTask({
      title: 'Cloning server…',
      start: async () => {
        const data = await postJson('/api/blueprints/clone', { serverId, includeWorld });
        if (data.taskId) return data.taskId;
        direct = data;
        throw DIRECT;
      },
    })
      .then((result) => {
        finishClone(result && result.server ? result.server.id : result && result.serverId);
      })
      .catch((err) => {
        if (err === DIRECT) {
          finishClone(direct.server && direct.server.id);
          return;
        }
        if (err.dismissed) return; // progress hidden - the task tray takes over
        toast(err.message || 'That server could not be cloned. Please try again.', { kind: 'error', timeout: 9000 });
      });
  }

  function finishClone(newId) {
    toast('Server cloned.');
    setTimeout(() => {
      location.href = newId ? `/servers/${newId}` : '/';
    }, 700);
  }

  // ---------------------------------------------------------------- discard
  document.getElementById('st-discard')?.addEventListener('click', async () => {
    if (dirty) {
      const { confirmDialog } = await import('../lib/confirm.js');
      const ok = await confirmDialog({
        title: 'Discard changes?',
        message: 'Everything you have edited on this tab since the last save will be lost.',
        confirmLabel: 'Discard',
        danger: true,
      });
      if (!ok) return;
    }
    dirty = false;
    location.reload();
  });

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false)
      throw new Error(data.error || friendlyError(res, { action: 'complete that action' }));
    return data;
  }

  document.getElementById('st-save')?.addEventListener('click', async (e) => {
    const saveBtn = e.currentTarget; // capture before await - currentTarget is null afterwards
    // Only what changed since the page loaded is sent: an untouched control
    // never rewrites its setting, whatever it shows (#113).
    const now = readFields();
    const changed = new Set(changedKeys(initialFields, now));
    /** @type {Record<string, unknown>} */
    const body = {};
    for (const key of ['name', 'description', 'notes', 'icon', 'accent', 'updatePolicy']) {
      if (changed.has(key)) body[key] = now[key];
    }
    if (changed.has('tags')) body.tags = [...tags];
    for (const key of ['autoStart', 'autoRestart', 'quotaStrict']) {
      if (changed.has(key)) body[key] = now[key] === 'true';
    }
    // The heap and the container limit go together, since the API checks one
    // against the other; the one left alone goes as the server has it, not as
    // its slider rounded it to a step.
    if (changed.has('heapMb') || changed.has('containerMemoryMb')) {
      body.heapMb = Number(changed.has('heapMb') ? now.heapMb : renderedAttr('st-heap'));
      body.containerMemoryMb = Number(
        changed.has('containerMemoryMb') ? now.containerMemoryMb : renderedAttr('st-cmem')
      );
    }
    // An explicit "0" is a real value (no CPU limit, quota off).
    if (changed.has('cpus') && now.cpus !== '') body.cpus = Number(now.cpus);
    if (changed.has('diskQuotaGb') && now.diskQuotaGb !== '') body.diskQuotaGb = Number(now.diskQuotaGb);
    // Docker settings: only send a field that actually changed from what the
    // server rendered. Sending all 4 unconditionally would run the (Docker-
    // socket-hitting) validateOverrides check on every unrelated save - e.g. a
    // Docker hiccup would then block renaming the server, not just changing
    // its container settings. The card is admin-only markup: when absent,
    // collectOverrides would read every field as cleared and an unrelated save
    // would wipe (well, 403 on) the server's stored overrides - skip entirely.
    if (document.getElementById('st-docker-name')) {
      const nowDocker = dockerSettings.collectOverrides({ forUpdate: true });
      if (nowDocker.containerName !== initialDocker.containerName) body.containerName = nowDocker.containerName;
      if (nowDocker.networkName !== initialDocker.networkName) body.networkName = nowDocker.networkName;
      if (JSON.stringify(nowDocker.extraPorts) !== JSON.stringify(initialDocker.extraPorts)) {
        body.extraPorts = nowDocker.extraPorts;
      }
      if (JSON.stringify(nowDocker.extraBinds) !== JSON.stringify(initialDocker.extraBinds)) {
        body.extraBinds = nowDocker.extraBinds;
      }
    }
    // MOTD, the Initial heap and every advanced field live in env: the changed
    // ones are merged over the server's current env (from the data island), and
    // env is sent only when one of them changed. An emptied field removes its
    // key, which puts that setting back to its default.
    {
      const { env, changed: envChanged } = mergeEnvChanges(parseSettingsEnv(), initialEnvFields, readEnvFields());
      if (envChanged.length) body.env = env;
    }
    const restore = setBusy(saveBtn, 'Saving…');
    try {
      const res = await fetch(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast(data.error || friendlyError(res, { action: 'save your settings' }), { kind: 'error', timeout: 8000 });
        return;
      }
      toast(
        data.needsRecreate
          ? 'Saved. Resource changes take effect after you rebuild the container (the button appears in the header).'
          : 'Saved.'
      );
      dirty = false; // saved - leaving must not warn
      setTimeout(() => location.reload(), 900);
    } catch {
      toast(friendlyError(null, { action: 'save your settings' }), { kind: 'error' });
    } finally {
      restore();
    }
  });
}

/** The value attribute a control was rendered with (a slider's own value is rounded to its step). */
function renderedAttr(id) {
  return document.getElementById(id)?.getAttribute('value') ?? '';
}

/**
 * Every control in `scope` back to what the server rendered, whatever the
 * browser restored into it (see init). A slider whose setting lies outside
 * its usual range gets a range that holds it, and its readout shows the exact
 * setting until it is moved.
 * @param {Element} scope
 */
function resetToRendered(scope) {
  for (const el of scope.querySelectorAll('input, select, textarea')) {
    if (el instanceof HTMLSelectElement) {
      const i = [...el.options].findIndex((o) => o.defaultSelected);
      el.selectedIndex = i >= 0 ? i : 0;
    } else if (el instanceof HTMLTextAreaElement) {
      el.value = el.defaultValue;
    } else if (el instanceof HTMLInputElement) {
      if (el.type === 'file') continue;
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = el.defaultChecked;
      } else if (el.type === 'range') {
        const raw = (el.getAttribute('value') ?? '').trim();
        if (raw === '') {
          el.value = el.defaultValue;
          continue;
        }
        const { min, max } = fitRange({ min: Number(el.min), max: Number(el.max) }, Number(raw));
        el.min = String(min);
        el.max = String(max);
        el.value = raw;
        // app.js writes every readout from its slider once it runs (after this
        // page's script), so this one is written once the page has loaded.
        const out = el.dataset.out ? document.getElementById(el.dataset.out) : null;
        if (out) {
          let moved = false;
          el.addEventListener('input', () => (moved = true), { once: true });
          const show = () => {
            if (!moved)
              out.textContent =
                Number(raw) === 0 && el.dataset.zero ? el.dataset.zero : `${raw}${el.dataset.unit || ''}`;
          };
          if (document.readyState === 'complete') show();
          else document.addEventListener('DOMContentLoaded', show, { once: true });
        }
      } else {
        el.value = el.defaultValue;
      }
    }
  }
}

// Unpinned-pack warning: Pick a Version… pins the pack through the shared picker.
document.querySelector('[data-pack-change]')?.addEventListener('click', async (e) => {
  const { packChange: serverId, serverName } = e.currentTarget.dataset;
  await changePackVersion({ serverId, serverName });
});
