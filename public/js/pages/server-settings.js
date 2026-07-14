// Server Settings tab: collect fields, PATCH the server, surface recreate flag,
// live heap/container headroom feedback, blueprint export/clone, icon upload.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { runTask } from '../lib/progress.js';
import { attachMotdEditor, toSectionCodes } from '../lib/motd.js';
import { setBusy } from '../lib/loading.js';

const root = document.querySelector('[data-settings-server]');
if (root) init(root.dataset.settingsServer);

function init(serverId) {
  let icon = root.dataset.settingsIcon;
  let accent = root.dataset.settingsAccent;
  const tags = new Set(JSON.parse(root.dataset.settingsTags || '[]'));

  // Visual MOTD editor (shared lib)
  const motdInput = document.getElementById('st-motd');
  if (motdInput) {
    attachMotdEditor(motdInput, {
      preview: document.getElementById('st-motd-preview'),
      getName: () => document.getElementById('st-name')?.value.trim() || 'My Server',
    });
  }

  // Icon + accent pickers
  bindPicker(
    '[data-pick-icon]',
    (btn) => {
      icon = btn.dataset.pickIcon;
    },
    'border-grass-500'
  );
  bindPicker(
    '[data-pick-accent]',
    (btn) => {
      accent = btn.dataset.pickAccent;
    },
    'border-white/70'
  );

  function bindPicker(selector, onPick, activeBorder) {
    const buttons = [...root.querySelectorAll(selector)];
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('border-2', activeBorder));
        buttons.forEach((b) => b.classList.add('border', 'border-line'));
        btn.classList.remove('border', 'border-line');
        btn.classList.add('border-2', activeBorder);
        onPick(btn);
      });
    }
  }

  // Tag chips
  const tagInput = document.getElementById('st-tag-input');
  const tagWrap = document.getElementById('st-tags');
  function renderTags() {
    tagWrap.querySelectorAll('[data-tag]').forEach((el) => el.remove());
    for (const t of tags) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.tag = t;
      chip.innerHTML = `${escapeHtml(t)} <button class="text-ink-faint hover:text-redstone-400" aria-label="Remove tag">✕</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        tags.delete(t);
        renderTags();
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
      headroomBox.className = base + 'border-redstone-800/50 bg-redstone-900/15 text-redstone-300';
      headroomBox.textContent = `Container limit (${cmem} MB) is at or below the heap (${heap} MB) — the JVM will be OOM-killed on start. Raise the limit or lower the heap.`;
    } else if (cmem < heap * 1.25) {
      headroomBox.className = base + 'border-gold-800/50 bg-gold-900/15 text-gold-300';
      headroomBox.textContent = `Tight headroom: container limit is only ${pctAbove}% above the heap. Java needs off-heap room — aim for 25% or more.`;
    } else {
      headroomBox.className = base + 'border-grass-800/50 bg-grass-900/15 text-grass-300';
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
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="embed"> Embed overlay files in the archive <span class="text-xs text-ink-faint">— bigger file, fully portable</span></label>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="world"> Include the active world <span class="text-xs text-ink-faint">— can be large</span></label>`;
    openModal({
      title: 'Export as blueprint',
      content,
      size: 'sm',
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Export',
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
      <p class="text-xs text-ink-faint">Also available any time on the <a class="text-diamond-400 hover:underline" href="/blueprints">Blueprints page</a>.</p>`;
    content.querySelector('[data-bp-name]').textContent = bp.name || 'exported';
    content.querySelector('[data-bp-dl]').href = `/api/blueprints/${encodeURIComponent(bp.id)}/download`;
    openModal({ title: 'Blueprint exported', content, size: 'sm', actions: [{ label: 'Done', kind: 'ghost' }] });
  }

  // ------------------------------------------------------------------ clone
  document.getElementById('st-clone')?.addEventListener('click', async () => {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <p class="text-xs text-ink-faint">Creates a copy of this server with fresh ports (blueprint export + import).</p>
      <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="msm-check" data-f="world"> Also copy the active world</label>`;
    openModal({
      title: 'Clone server',
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
    // ({taskId}) once the task infrastructure lands — handle both.
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
  document.getElementById('st-discard')?.addEventListener('click', () => location.reload());

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
    const saveBtn = e.currentTarget; // capture before await — currentTarget is null afterwards
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
    // MOTD lives in env: merge over the server's current env (from the data
    // island) so nothing else is lost; § codes are what vanilla renders.
    if (motdInput) {
      let env = {};
      try {
        env = JSON.parse(root.dataset.settingsEnv || '{}');
      } catch {
        /* island absent */
      }
      const newMotd = toSectionCodes(motdInput.value);
      if ((env.MOTD || '') !== newMotd) {
        body.env = { ...env, MOTD: newMotd };
      }
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
          ? 'Saved — resource changes apply when you Recreate (button appears in the header).'
          : 'Saved.'
      );
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      toast(`Network error: ${err.message}`, { kind: 'error' });
    } finally {
      restore();
    }
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
