// Settings page: API key save/test + localization + users CRUD.
import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';
import { fillTimezoneSelect, fillCountrySelect } from '../lib/tzPicker.js';

const page = document.getElementById('settings-page');
if (page) init();

function init() {
  // ---- CurseForge key ----
  document.getElementById('set-cf-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capture before await — currentTarget is null afterwards
    const key = document.getElementById('set-cf-key').value.trim();
    if (!key) {
      toast('Paste a key first.', { kind: 'error' });
      return;
    }
    await withBusy(btn, 'Saving…', async () => {
      const res = await post('/api/keys/curseforge', { key });
      if (res) {
        toast('Key verified with CurseForge and saved (encrypted).');
        document.getElementById('set-cf-key').value = '';
      }
    });
  });
  // ---- Public domain ----
  document.getElementById('set-domain-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const publicHost = document.getElementById('set-domain').value.trim();
    await withBusy(btn, 'Saving…', async () => {
      const res = await post('/api/settings', { publicHost });
      if (res) {
        document.getElementById('set-domain').value = res.publicHost || '';
        toast(res.publicHost ? `Public domain set to ${res.publicHost}.` : 'Public domain cleared.');
      }
    });
  });

  // ---- Localization (timezone + country) ----
  const tzSel = document.getElementById('set-tz');
  const ccSel = document.getElementById('set-country');
  const locNote = document.getElementById('set-loc-note');
  if (tzSel && ccSel) {
    (async () => {
      let loc = {
        timezoneAuto: true,
        countryAuto: true,
        timezone: '',
        country: '',
        systemTimezone: '',
        systemCountry: '',
      };
      try {
        const res = await fetch('/api/settings/localization', { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (data.ok) loc = data.localization;
      } catch {
        /* fall back to auto */
      }
      fillTimezoneSelect(tzSel, loc.timezoneAuto ? 'auto' : loc.timezone, loc.systemTimezone);
      fillCountrySelect(ccSel, loc.countryAuto ? 'auto' : loc.country, loc.systemCountry);
      if (locNote) locNote.textContent = `Currently: ${loc.timezone} · ${loc.locale || ''}`;
    })();

    document.getElementById('set-loc-save')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      await withBusy(btn, 'Saving…', async () => {
        const res = await post('/api/settings/localization', { timezone: tzSel.value, country: ccSel.value });
        if (res) {
          if (locNote)
            locNote.textContent = `Currently: ${res.localization.timezone} · ${res.localization.locale || ''}`;
          toast(`Time zone set to ${res.localization.timezone}. Reload to apply everywhere.`);
        }
      });
    });
  }

  document.getElementById('set-cf-test')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await withBusy(btn, 'Checking…', async () => {
      const res = await post('/api/keys/curseforge/test', {});
      if (res)
        toast(res.ok === false ? res.error : 'Stored key is valid.', { kind: res.ok === false ? 'error' : 'success' });
    });
  });

  // ---- Users ----
  document.getElementById('users-table')?.addEventListener('change', async (e) => {
    const select = e.target.closest('[data-user-role]');
    if (!select) return;
    const row = select.closest('[data-user-id]');
    select.disabled = true; // lock the control in flight — keeps the select visual
    try {
      const res = await post(`/api/users/${row.dataset.userId}/role`, { role: select.value });
      if (res) toast(`${row.dataset.username} is now ${select.value}.`);
      else location.reload();
    } finally {
      select.disabled = false;
    }
  });

  document.getElementById('users-table')?.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-user-id]');
    if (!row) return;
    const delBtn = e.target.closest('[data-user-delete]');
    if (e.target.closest('[data-user-password]')) {
      passwordModal(row.dataset.userId, row.dataset.username);
    } else if (delBtn) {
      const ok = await confirmDialog({
        title: `Delete user ${row.dataset.username}?`,
        message: 'They will be signed out and lose all access.',
        confirmLabel: 'Delete user',
        danger: true,
      });
      if (!ok) return;
      await withBusy(delBtn, async () => {
        const res = await fetch(`/api/users/${row.dataset.userId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) {
          toast('User deleted.');
          row.remove();
        } else {
          toast(data.error || 'Delete failed', { kind: 'error' });
        }
      });
    }
  });

  document.getElementById('user-add')?.addEventListener('click', () => {
    const content = document.createElement('div');
    content.className = 'space-y-3';
    content.innerHTML = `
      <div><label class="label">Username</label><input class="input" id="nu-name" autocomplete="off"></div>
      <div><label class="label">Password</label><input class="input" id="nu-pass" type="password" autocomplete="new-password"><p class="help">At least 8 characters.</p></div>
      <div><label class="label">Role</label>
        <select class="input" id="nu-role" data-label="Role">
          <option value="viewer">viewer — read-only</option>
          <option value="operator">operator — manage servers</option>
          <option value="admin">admin — everything</option>
        </select>
      </div>`;
    openModal({
      title: 'Add user',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Create user',
          kind: 'primary',
          busyLabel: 'Creating…',
          onClick: async () => {
            const body = {
              username: content.querySelector('#nu-name').value.trim(),
              password: content.querySelector('#nu-pass').value,
              role: content.querySelector('#nu-role').value,
            };
            const res = await post('/api/users', body);
            if (!res) return false;
            toast(`User ${body.username} created.`);
            setTimeout(() => location.reload(), 600);
          },
        },
      ],
    });
  });

  function passwordModal(userId, username) {
    const content = document.createElement('div');
    // Build with textContent for the (user-controlled) username so it can't inject markup.
    const label = document.createElement('label');
    label.className = 'label';
    label.textContent = `New password for ${username}`;
    content.appendChild(label);
    content.insertAdjacentHTML(
      'beforeend',
      '<input class="input" id="pw-new" type="password" autocomplete="new-password"><p class="help">At least 8 characters.</p>'
    );
    openModal({
      title: 'Set password',
      size: 'sm',
      content,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Set password',
          kind: 'primary',
          busyLabel: 'Saving…',
          onClick: async () => {
            const res = await post(`/api/users/${userId}/password`, {
              password: content.querySelector('#pw-new').value,
            });
            if (!res) return false;
            toast('Password updated.');
          },
        },
      ],
    });
  }

  async function post(url, body) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        toast(data.error || `Request failed (${res.status})`, { kind: 'error', timeout: 8000 });
        return null;
      }
      return data;
    } catch (err) {
      toast(`Network error: ${err.message}`, { kind: 'error' });
      return null;
    }
  }
}
