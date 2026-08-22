// Server Settings tab: collect fields, PATCH the server, surface recreate flag,
// live heap/container headroom feedback, blueprint export/clone, icon upload.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { runTask } from '../lib/progress.js';
import { attachMotdEditor, toSectionCodes } from '../lib/motd.js';
import { setBusy } from '../lib/loading.js';
import { initDockerSettings } from '../lib/dockerSettings.js';

const root = document.querySelector('[data-settings-server]');
if (root) init(root.dataset.settingsServer);

function init(serverId) {
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
    if (!res.ok || !data.ok) throw new Error(data.error || 'Preview failed');
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
  if (advPanel) {
    const currentEnv = parseSettingsEnv();
    advPanel.querySelectorAll('[data-catalog-key][data-catalog-scope="env"]').forEach((el) => {
      const key = el.dataset.catalogKey;
      const has = Object.prototype.hasOwnProperty.call(currentEnv, key);
      if (el.dataset.catalogType === 'boolean') {
        el.checked = has ? currentEnv[key] === 'true' : el.dataset.catalogDefault === 'true';
      } else if (has) {
        el.value = currentEnv[key];
      }
    });
  }

  function parseSettingsEnv() {
    try {
      return JSON.parse(root.dataset.settingsEnv || '{}');
    } catch {
      return {};
    }
  }

  // Icon + accent pickers - selection lives in aria-pressed; .swatch CSS
  // draws the theme-aware ring, so JS only flips the attribute.
  bindPicker('[data-pick-icon]', (btn) => {
    icon = btn.dataset.pickIcon;
  });
  bindPicker('[data-pick-accent]', (btn) => {
    accent = btn.dataset.pickAccent;
  });

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
      headroomBox.textContent = `Container limit (${cmem} MB) is at or below the heap (${heap} MB) - the JVM will be OOM-killed on start. Raise the limit or lower the heap.`;
    } else if (cmem < heap * 1.25) {
      headroomBox.className = base + 'border-warn/40 bg-gold-500/10 text-warn';
      headroomBox.textContent = `Tight headroom: container limit is only ${pctAbove}% above the heap. Java needs off-heap room - aim for 25% or more.`;
    } else {
      headroomBox.className = base + 'border-ok/40 bg-grass-500/10 text-ok';
      headroomBox.textContent = `Healthy headroom: container limit is ${pctAbove}% above the heap.`;
    }
  }
  heapEl?.addEventListener('input', updateHeadroom);
  cmemEl?.addEventListener('input', updateHeadroom);
  updateHeadroom();

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
          toast(data.error || 'Icon upload failed', { kind: 'error', timeout: 8000 });
          return;
        }
        toast('Custom icon uploaded.');
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        toast(`Network error: ${err.message}`, { kind: 'error' });
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
      <p class="text-xs text-ink-faint">Exports this server's setup as a reusable blueprint in the library.</p>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="config" checked> Include config directories</label>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="embed"> Embed overlay files in the archive <span class="text-xs text-ink-faint">- bigger file, fully portable</span></label>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="world"> Include the active world <span class="text-xs text-ink-faint">- can be large</span></label>`;
    openModal({
      title: 'Export as Blueprint',
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Export blueprint',
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
      <p class="text-xs text-ink-faint">Creates a copy of this server with fresh ports (blueprint export + import).</p>
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
      title: 'Cloning Server…',
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
        toast(err.message || 'Clone failed', { kind: 'error', timeout: 9000 });
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
        title: 'Discard Changes?',
        message: 'Everything edited on this tab since the last save is thrown away.',
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
    if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  document.getElementById('st-save')?.addEventListener('click', async (e) => {
    const saveBtn = e.currentTarget; // capture before await - currentTarget is null afterwards
    const heapMb = Number(document.getElementById('st-heap').value);
    const body = {
      name: document.getElementById('st-name').value.trim(),
      description: document.getElementById('st-desc').value,
      notes: document.getElementById('st-notes').value,
      icon,
      accent,
      tags: [...tags],
      heapMb,
      containerMemoryMb: Number(document.getElementById('st-cmem').value),
      cpus: Number(document.getElementById('st-cpu').value),
      diskQuotaGb: Number(document.getElementById('st-quota').value),
      updatePolicy: root.querySelector('input[name="up"]:checked')?.value || 'manual',
      autoStart: document.getElementById('st-autostart')?.checked ?? false,
      autoRestart: document.getElementById('st-autorestart')?.checked ?? true,
    };
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
    // MOTD + every advanced-settings field live in env: merge all changes over
    // the server's current env (from the data island) in one pass so nothing
    // else is lost, and only send env at all if something actually changed.
    // Clearing a field back to empty removes the override (reverts to the
    // image default) rather than sending an empty string.
    {
      const current = parseSettingsEnv();
      const merged = { ...current };
      let envChanged = false;

      if (motdInput) {
        const newMotd = toSectionCodes(motdInput.value);
        if ((current.MOTD || '') !== newMotd) {
          merged.MOTD = newMotd;
          envChanged = true;
        }
      }

      if (advPanel) {
        advPanel.querySelectorAll('[data-catalog-key][data-catalog-scope="env"]').forEach((el) => {
          const key = el.dataset.catalogKey;
          const had = Object.prototype.hasOwnProperty.call(current, key);
          if (el.dataset.catalogType === 'boolean') {
            const value = el.checked ? 'true' : 'false';
            const before = had ? current[key] : el.dataset.catalogDefault === 'true' ? 'true' : 'false';
            if (value !== before) {
              merged[key] = value;
              envChanged = true;
            }
          } else {
            const value = el.value.trim();
            if (!value) {
              if (had) {
                delete merged[key];
                envChanged = true;
              }
            } else if (value !== (had ? current[key] : '')) {
              merged[key] = value;
              envChanged = true;
            }
          }
        });
      }

      if (envChanged) body.env = merged;
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
        toast(data.error || 'Save failed', { kind: 'error', timeout: 8000 });
        return;
      }
      toast(
        data.needsRecreate
          ? 'Saved - resource changes apply when you Recreate (button appears in the header).'
          : 'Saved.'
      );
      dirty = false; // saved - leaving must not warn
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      toast(`Network error: ${err.message}`, { kind: 'error' });
    } finally {
      restore();
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
