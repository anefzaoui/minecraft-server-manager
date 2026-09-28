// Shared backups behavior - used by BOTH the global /backups page and the
// per-server Backups tab. Contract (document-level delegation):
//   rows:    [data-backup-row] with data-backup-id, data-server-id,
//            data-server-name, data-file, data-size, data-reason
//            (+ data-local="1" and data-remotes JSON on the global page)
//   actions: [data-backup-action="restore"|"download"|"delete"|"upload"]
//            inside a row
//   create:  [data-backup-create] with data-server-id (+ optional
//            data-server-name) anywhere on the page
// Create + restore are long operations: the API returns {taskId} and the
// progress modal (runTask) polls it.

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { confirmDialog } from '../lib/confirm.js';
import { openModal } from '../lib/modal.js';
import { fmtBytes } from '../lib/format.js';
import { runTask } from '../lib/progress.js';
import { setBusy } from '../lib/loading.js';

document.addEventListener('click', async (e) => {
  const createBtn = e.target.closest('[data-backup-create]');
  if (createBtn) {
    e.preventDefault();
    return createBackup(createBtn.dataset.serverId, createBtn.dataset.serverName || 'server');
  }

  const btn = e.target.closest('[data-backup-action]');
  if (!btn) return;
  const row = btn.closest('[data-backup-row]');
  if (!row) return;
  e.preventDefault();
  const { backupId, serverId, serverName, file, size, reason } = row.dataset;
  const action = btn.dataset.backupAction;

  if (action === 'download') {
    location.href = `/api/backups/${backupId}/download`;
    return;
  }

  if (action === 'rename') {
    const content = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'label';
    label.setAttribute('for', 'bk-rename-name');
    label.textContent = 'Archive name';
    const input = document.createElement('input');
    input.className = 'input font-mono';
    input.id = 'bk-rename-name';
    input.maxLength = 120;
    input.value = file;
    const help = document.createElement('p');
    help.className = 'help';
    help.textContent = 'Changes the displayed name and the file you download. Restore and retention are unaffected.';
    content.append(label, input, help);
    openModal({
      title: 'Rename Backup',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Rename',
          kind: 'primary',
          busyLabel: 'Renaming…',
          onClick: async () => {
            const name = input.value.trim();
            if (!name) {
              toast('Enter a name first.', { kind: 'error' });
              return false;
            }
            try {
              const res = await talk(`/api/backups/${encodeURIComponent(backupId)}`, 'PATCH', { filename: name });
              row.dataset.file = res.backup.filename;
              const text = row.querySelector('.truncate.font-mono');
              if (text) {
                text.textContent = res.backup.filename;
                text.title = res.backup.filename;
              }
              toast('Backup renamed.');
            } catch (err) {
              toast(err.message || 'That backup could not be renamed.', { kind: 'error', timeout: 8000 });
              return false;
            }
          },
        },
      ],
    });
    return;
  }

  if (action === 'restore') {
    // Local archives can be gone while an offsite copy survives: offer the
    // download-then-restore path instead of failing. Rows without the global
    // page's data attributes always take the plain local path.
    let destinationId;
    const remotes = parseRemotes(row);
    const local = row.dataset.local;
    if (local !== undefined && local !== '1') {
      const done = remotes.filter((r) => r.status === 'done');
      if (!done.length) {
        toast('This archive is missing both locally and offsite. Nothing to restore.', { kind: 'error' });
        return;
      }
      destinationId = done.length === 1 ? done[0].destinationId : await pickRemote(done, 'Restore from');
      if (!destinationId) return;
    }
    const fromRemote = destinationId
      ? `\nFrom offsite: ${(remotes.find((r) => r.destinationId === destinationId) || {}).destinationName || ''}`
      : '';
    const ok = await confirmDialog({
      title: `Restore this backup?`,
      message: `${serverName || 'The server'} is stopped first, a safety backup of the current state is taken, then the server's files are replaced with this archive.${fromRemote}`,
      detail: `${file}\n${fmtBytes(size)} · ${reason || 'manual'}`,
      confirmLabel: 'Restore Backup',
      danger: true,
    });
    if (!ok) return;
    try {
      await runTask({
        title: `Restoring ${file}…`,
        start: async () => {
          const res = await postJSON(`/api/servers/${serverId}/backups/${backupId}/restore`, {
            destinationId: destinationId || undefined,
          });
          return res.taskId;
        },
      });
      toast('Backup restored. Start the server when you are ready.');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      if (err.dismissed) return; // progress hidden - the task tray takes over
      toast(err.message || 'That backup could not be restored. Please try again.', { kind: 'error', timeout: 9000 });
    }
    return;
  }

  if (action === 'upload') {
    const dests = await fetchTargets();
    if (!dests) return;
    if (!dests.length) {
      toast('No offsite destinations yet. Add one at the top of the Backups page.', { kind: 'info' });
      return;
    }
    const picked = dests.length === 1 ? dests[0].id : await pickRemote(dests.map(targetToRemote), 'Upload to');
    if (!picked) return;
    try {
      const target = dests.find((d) => d.id === picked);
      await runTask({
        title: `Uploading ${file} to ${target ? target.name : 'offsite storage'}…`,
        start: async () => {
          const res = await postJSON(`/api/remotes/${picked}/upload/${backupId}`, {});
          return res.taskId;
        },
      });
      toast(`Uploaded ${file}.`);
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      if (err.dismissed) return; // progress hidden - the task tray takes over
      toast(err.message || 'That backup could not be uploaded. Please try again.', { kind: 'error', timeout: 9000 });
    }
    return;
  }

  if (action === 'delete') {
    const remoteDone = parseRemotes(row).filter((r) => r.status === 'done').length;
    const ok = await confirmDialog({
      title: 'Delete this backup?',
      message:
        'The archive is removed permanently.' +
        (remoteDone ? ` Its ${remoteDone} offsite ${remoteDone === 1 ? 'copy is' : 'copies are'} removed too.` : ''),
      detail: `${file}\n${fmtBytes(size)} will be freed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const restore = setBusy(btn);
    try {
      const res = await fetch(`/api/backups/${backupId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false)
        throw new Error(data.error || friendlyError(res, { action: 'delete that backup' }));
      toast(`Backup deleted (${fmtBytes(data.freedBytes)} freed).`);
      row.remove();
      refreshTotal();
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 9000 });
    } finally {
      restore();
    }
  }
});

async function createBackup(serverId, serverName) {
  if (!serverId) return;
  try {
    const result = await runTask({
      title: `Backing up ${serverName}…`,
      start: async () => {
        const res = await postJSON(`/api/servers/${serverId}/backups`, {});
        return res.taskId;
      },
    });
    toast(
      `Backup created: ${result && result.filename ? result.filename : 'done'}${result && result.size ? ` (${fmtBytes(result.size)})` : ''}.`
    );
    setTimeout(() => location.reload(), 800);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'That backup could not be created. Please try again.', { kind: 'error', timeout: 9000 });
  }
}

// ---- Global page filters (no-ops on the server tab) ----
const serverFilter = document.getElementById('backups-filter-server');
const reasonFilter = document.getElementById('backups-filter-reason');
if (serverFilter || reasonFilter) {
  const apply = () => {
    const sid = serverFilter ? serverFilter.value : '';
    const reason = reasonFilter ? reasonFilter.value : '';
    let visible = 0;
    document.querySelectorAll('#backups-table [data-backup-row]').forEach((row) => {
      const match = (!sid || row.dataset.serverId === sid) && (!reason || row.dataset.reason === reason);
      row.classList.toggle('hidden', !match);
      if (match) visible += 1;
    });
    // Filters can hide every row - say so instead of showing a bare header.
    document.getElementById('backups-no-match')?.classList.toggle('hidden', visible > 0);
    refreshTotal();
  };
  serverFilter?.addEventListener('change', apply);
  reasonFilter?.addEventListener('change', apply);
}

// ---- Offsite destinations (global Backups page, admin card) ----
(() => {
  const zone = document.querySelector('[data-remotes]');
  if (!zone) return;

  const PROVIDERS = {
    nextcloud: { label: 'Nextcloud', oauth: false },
    dropbox: { label: 'Dropbox', oauth: true },
    gdrive: { label: 'Google Drive', oauth: true },
  };

  zone.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-dest-card]');
    const addBtn = e.target.closest('[data-remote-add]');
    if (addBtn) return destForm(null);
    if (!card) return;
    const id = card.dataset.destId;
    if (e.target.closest('[data-remote-test]')) return testDest(id, e.target.closest('[data-remote-test]'));
    if (e.target.closest('[data-remote-auth]')) return authorize(id);
    if (e.target.closest('[data-remote-edit]')) return destForm(card);
    if (e.target.closest('[data-remote-delete]')) {
      const ok = await confirmDialog({
        title: `Delete "${cardName(card)}"?`,
        message: 'The destination is removed. Remote copies already uploaded are left in place.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      try {
        await talk(`/api/remotes/${id}`, 'DELETE', {});
        toast('Destination deleted. Remote copies were left in place.');
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        toast(err.message, { kind: 'error' });
      }
    }
  });

  zone.addEventListener('change', async (e) => {
    const toggle = e.target.closest('[data-remote-auto]');
    if (!toggle) return;
    const card = toggle.closest('[data-dest-card]');
    try {
      await talk(`/api/remotes/${card.dataset.destId}`, 'PATCH', { autoUpload: toggle.checked });
      toast(`Auto-upload ${toggle.checked ? 'on' : 'off'} for "${cardName(card)}".`);
    } catch (err) {
      toggle.checked = !toggle.checked;
      toast(err.message, { kind: 'error' });
    }
  });

  const cardName = (card) => (card.querySelector('b') ? card.querySelector('b').textContent : 'destination');

  async function testDest(id, btn) {
    const restore = setBusy(btn, 'Testing…');
    try {
      const res = await fetch(`/api/remotes/${id}/test`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Connection test failed.');
      toast(data.detail || 'Connected.');
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 9000 });
    } finally {
      restore();
    }
  }

  async function authorize(id) {
    try {
      const res = await fetch(`/api/remotes/${id}/oauth/start`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.url) throw new Error(data.error || 'Authorization could not start.');
      location.href = data.url;
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 9000 });
    }
  }

  // Add + edit share one modal; OAuth providers save first, then Authorize
  // from the card (the provider redirects back here afterwards).
  function destForm(card) {
    const editing = Boolean(card);
    const current = editing
      ? { name: cardName(card), provider: card.dataset.provider, autoUpload: false }
      : { name: '', provider: 'nextcloud', autoUpload: false };
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    content.innerHTML = `
      <div>
        <label class="label" for="rem-name">Name</label>
        <input class="input" id="rem-name" autocomplete="off" maxlength="80">
      </div>
      <div>
        <label class="label" for="rem-provider">Provider</label>
        <select class="input" id="rem-provider" data-label="Provider">
          ${Object.entries(PROVIDERS)
            .map(([v, p]) => `<option value="${v}">${p.label}</option>`)
            .join('')}
        </select>
      </div>
      <div data-rem-fields></div>
      <label class="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" class="msm-check mt-0.5 shrink-0" data-rem-auto>
        <span>Auto-upload new backups here <span class="text-ink-faint">(off keeps everything local unless uploaded per archive)</span></span>
      </label>
      <p class="help" data-rem-oauth-note></p>`;
    const nameEl = content.querySelector('#rem-name');
    const providerEl = content.querySelector('#rem-provider');
    const fieldsEl = content.querySelector('[data-rem-fields]');
    const autoEl = content.querySelector('[data-rem-auto]');
    const noteEl = content.querySelector('[data-rem-oauth-note]');
    nameEl.value = current.name;
    providerEl.value = current.provider;
    providerEl.disabled = editing;
    if (editing) providerEl.title = 'The provider cannot be changed after creation.';
    // Blank fields keep their stored values (the server merges); non-secret
    // values are not shown back, so only fill what the card knows.
    if (editing) autoEl.checked = card.dataset.auto === '1';

    const paint = () => {
      const p = providerEl.value;
      if (p === 'nextcloud') {
        fieldsEl.innerHTML = `
          <div><label class="label" for="rem-url">Server URL</label>
          <input class="input font-mono" id="rem-url" placeholder="https://cloud.example.com" autocomplete="off"></div>
          <div class="mt-3"><label class="label" for="rem-username">Username</label>
          <input class="input" id="rem-username" autocomplete="off"></div>
          <div class="mt-3"><label class="label" for="rem-password">App password${editing ? ' (blank keeps the saved one)' : ''}</label>
          <input class="input font-mono" id="rem-password" type="password" autocomplete="new-password"></div>
          <div class="mt-3"><label class="label" for="rem-folder">Folder</label>
          <input class="input" id="rem-folder" value="Minecraft-Backups" autocomplete="off"></div>`;
        noteEl.textContent =
          'Use a Nextcloud app password (Profile → Security → Devices & sessions), not your login password.';
      } else {
        const isDropbox = p === 'dropbox';
        fieldsEl.innerHTML = `
          <div><label class="label" for="rem-client-id">OAuth client ID${editing ? ' (blank keeps the saved one)' : ''}</label>
          <input class="input font-mono" id="rem-client-id" autocomplete="off"></div>
          <div class="mt-3"><label class="label" for="rem-client-secret">OAuth client secret${editing ? ' (blank keeps the saved one)' : ''}</label>
          <input class="input font-mono" id="rem-client-secret" type="password" autocomplete="new-password"></div>
          <div class="mt-3"><label class="label" for="rem-folder">Folder</label>
          <input class="input" id="rem-folder" value="Minecraft-Backups" autocomplete="off"></div>`;
        noteEl.textContent = isDropbox
          ? 'Create the app at dropbox.com/developers (scoped access, App folder), then Authorize from the card. Register this callback URL: '
          : 'Create the OAuth client at console.cloud.google.com (Web application), then Authorize from the card. Register this callback URL: ';
        const code = document.createElement('code');
        code.className = 'code-inline';
        code.textContent = `${location.origin}/remotes/oauth/callback`;
        noteEl.append(document.createElement('br'), code);
      }
    };
    providerEl.addEventListener('change', paint);
    paint();

    openModal({
      title: editing ? 'Edit Destination' : 'Add Destination',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: editing ? 'Save' : 'Add',
          kind: 'primary',
          onClick: async () => {
            const provider = providerEl.value;
            const config = {};
            const folderVal = content.querySelector('#rem-folder')?.value.trim() || '';
            if (folderVal) config.folder = folderVal;
            const secret = {};
            if (provider === 'nextcloud') {
              config.url = content.querySelector('#rem-url')?.value.trim() || '';
              config.username = content.querySelector('#rem-username')?.value.trim() || '';
              const pw = content.querySelector('#rem-password')?.value || '';
              if (pw) secret.password = pw;
              else if (!editing) {
                toast('Enter the app password.', { kind: 'error' });
                return false;
              }
            } else {
              const cid = content.querySelector('#rem-client-id')?.value.trim() || '';
              const csc = content.querySelector('#rem-client-secret')?.value || '';
              if (cid) config.clientId = cid;
              else if (!editing) {
                toast('Enter the OAuth client ID.', { kind: 'error' });
                return false;
              }
              if (csc) secret.clientSecret = csc;
              else if (!editing) {
                toast('Enter the OAuth client secret.', { kind: 'error' });
                return false;
              }
            }
            const body = {
              name: nameEl.value.trim(),
              autoUpload: autoEl.checked,
              ...(editing ? {} : { provider }),
              config,
              ...(Object.keys(secret).length ? { secret } : {}),
            };
            if (!body.name) {
              toast('Give the destination a name first.', { kind: 'error' });
              return false;
            }
            try {
              if (editing) await talk(`/api/remotes/${card.dataset.destId}`, 'PATCH', body);
              else {
                const created = await talk('/api/remotes', 'POST', body);
                if (!created || !created.destination) throw new Error('That destination could not be created.');
              }
              toast(editing ? 'Destination saved.' : 'Destination added. Authorize it from the card if needed.');
              setTimeout(() => location.reload(), 700);
            } catch (err) {
              toast(err.message, { kind: 'error', timeout: 9000 });
              return false;
            }
          },
        },
      ],
    });
  }
})();

/** Recompute the "Total: X in N archives" line from the visible rows. */
function refreshTotal() {
  const totalEl = document.getElementById('backups-total');
  if (!totalEl) return;
  const rows = [...document.querySelectorAll('#backups-table [data-backup-row]:not(.hidden)')];
  const bytes = rows.reduce((n, r) => n + (Number(r.dataset.size) || 0), 0);
  totalEl.textContent = `Total: ${fmtBytes(bytes)} in ${rows.length} archive${rows.length === 1 ? '' : 's'}`;
}

async function postJSON(url, body) {
  return talk(url, 'POST', body);
}

/** Offsite copies attached to a row by the global page (absent on server tabs). */
function parseRemotes(row) {
  try {
    const list = JSON.parse(row.dataset.remotes || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Destinations a non-admin with backup rights may upload to (no secrets). */
async function fetchTargets() {
  try {
    const res = await fetch('/api/remotes/targets');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'Destinations could not be loaded.');
    return data.destinations || [];
  } catch (err) {
    toast(err.message || 'Destinations could not be loaded.', { kind: 'error' });
    return null;
  }
}

const targetToRemote = (d) => ({ destinationId: d.id, destinationName: d.name, status: 'done' });

/** Pick one entry from a list of {destinationId, destinationName}. Null = cancel. */
async function pickRemote(entries, title) {
  const content = document.createElement('div');
  content.className = 'space-y-2';
  for (const e of entries) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn w-full justify-start';
    btn.textContent = e.destinationName;
    btn.dataset.pick = e.destinationId;
    content.appendChild(btn);
  }
  return new Promise((resolve) => {
    const modal = openModal({
      title,
      content,
      actions: [{ label: 'Cancel', kind: 'ghost' }],
      onClose: () => resolve(null),
    });
    content.addEventListener('click', (ev) => {
      const pick = ev.target.closest('[data-pick]');
      if (!pick) return;
      const id = pick.dataset.pick;
      modal.close();
      resolve(id);
    });
  });
}

/** fetch helper: returns the parsed JSON or throws with the server's error. */
async function talk(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false)
    throw new Error(data.error || friendlyError(res, { action: 'start that backup task' }));
  return data;
}
