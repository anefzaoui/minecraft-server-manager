// Settings page: API key save/test + localization + users CRUD.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';
import { fillTimezoneSelect, fillCountrySelect } from '../lib/tzPicker.js';

const page = document.getElementById('settings-page');
if (page) init();

function init() {
  // ---- CurseForge key ----
  document.getElementById('set-cf-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capture before await - currentTarget is null afterwards
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
        if (res.cookieSecureWarning) {
          toast(
            'This panel is reachable over plain HTTP, so the login cookie can be read in transit. Put it behind HTTPS ' +
              'and set the secure-cookie option, as described in the README.',
            { kind: 'error', timeout: 12000 }
          );
        }
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
      // post() returns null (and toasts) on any failure - success is the only branch left.
      const res = await post('/api/keys/curseforge/test', {});
      if (res) toast('Stored key is valid.');
    });
  });

  // ---- Users ----
  document.getElementById('users-table')?.addEventListener('change', async (e) => {
    const select = e.target.closest('[data-user-role]');
    if (!select || select.dataset.reverting) return;
    const row = select.closest('[data-user-id]');
    select.disabled = true; // locks the enhanced trigger too (select.js mirrors it)
    try {
      const res = await post(`/api/users/${row.dataset.userId}/role`, { role: select.value });
      if (res) {
        select.dataset.prevRole = select.value;
        toast(`${row.dataset.username} is now ${select.value}.`);
      } else {
        // Revert in place - the old reload wiped the error toast before it
        // could be read. The change dispatch only resyncs the trigger label.
        select.dataset.reverting = '1';
        select.value = select.dataset.prevRole || select.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        delete select.dataset.reverting;
      }
    } finally {
      select.disabled = false;
    }
  });

  // Row menu items (Set Password / Reset 2FA / Delete) live in the per-row
  // overflow menu, which dropdown.js portals to <body> - so they're
  // document-delegated and carry their own data-user-id/data-username rather
  // than relying on closest('[data-user-id]') finding the row. The menu itself
  // is gone (dropdown.js removes it) by the time an async action here
  // resolves, so busy-state goes on the row's still-present kebab trigger.
  function menuTriggerFor(userId) {
    return document.querySelector(`[data-user-id="${CSS.escape(userId)}"] [data-menu]`);
  }

  document.addEventListener('click', async (e) => {
    const passBtn = e.target.closest('[data-user-password]');
    const totpResetBtn = e.target.closest('[data-user-totp-reset]');
    const delBtn = e.target.closest('[data-user-delete]');
    if (passBtn) {
      passwordModal(passBtn.dataset.userId, passBtn.dataset.username);
    } else if (totpResetBtn) {
      const { userId, username } = totpResetBtn.dataset;
      const ok = await confirmDialog({
        title: `Reset two-factor auth for ${username}?`,
        message:
          'Any in-progress sign-in is cancelled, and they must set up a new authenticator app the next time they sign in.',
        confirmLabel: 'Reset',
        danger: true,
      });
      if (!ok) return;
      await withBusy(menuTriggerFor(userId), async () => {
        const res = await post(`/api/users/${userId}/totp/disable`, {});
        if (res) {
          toast('Two-factor authentication reset.');
          setTimeout(() => location.reload(), 600);
        }
      });
    } else if (delBtn) {
      const { userId, username } = delBtn.dataset;
      const ok = await confirmDialog({
        title: `Delete user ${username}?`,
        message: 'They will be signed out and lose all access.',
        confirmLabel: 'Delete user',
        danger: true,
      });
      if (!ok) return;
      await withBusy(menuTriggerFor(userId), async () => {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          toast('User deleted.');
          document.querySelector(`[data-user-id="${CSS.escape(userId)}"]`)?.remove();
        } else {
          toast(data.error || friendlyError(res, { action: 'delete that user' }), { kind: 'error' });
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
          <option value="viewer">Viewer (read-only)</option>
          <option value="operator">Operator (manage servers)</option>
          <option value="admin">Admin (full access)</option>
        </select>
      </div>`;
    openModal({
      title: 'Add User',
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
      title: 'Set Password',
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
        toast(data.error || friendlyError(res, { action: 'save that change' }), { kind: 'error', timeout: 8000 });
        return null;
      }
      return data;
    } catch {
      toast(friendlyError(null, { action: 'save that change' }), { kind: 'error' });
      return null;
    }
  }
}
