// Settings page: API key save/test + localization + users CRUD.
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';
import { withBusy } from '../lib/loading.js';
import { fillTimezoneSelect, fillCountrySelect } from '../lib/tzPicker.js';
import { t } from '../lib/i18n.js';

const page = document.getElementById('settings-page');
const selfEl = document.getElementById('settings-self');
const selfUserId = selfEl ? JSON.parse(selfEl.textContent) : null;
if (page) init();

function init() {
  // ---- CurseForge key ----
  document.getElementById('set-cf-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capture before await - currentTarget is null afterwards
    const key = document.getElementById('set-cf-key').value.trim();
    if (!key) {
      toast(t('setup_wizard.cf_key_prompt'), { kind: 'error' });
      return;
    }
    await withBusy(btn, t('common.saving'), async () => {
      const res = await post('/api/keys/curseforge', { key });
      if (res) {
        toast(t('setup_wizard.cf_key_saved'));
        document.getElementById('set-cf-key').value = '';
      }
    });
  });
  // ---- Public domain ----
  document.getElementById('set-domain-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const publicHost = document.getElementById('set-domain').value.trim();
    await withBusy(btn, t('common.saving'), async () => {
      const res = await post('/api/settings', { publicHost });
      if (res) {
        document.getElementById('set-domain').value = res.publicHost || '';
        toast(
          res.publicHost ? t('setup_wizard.domain_saved', { domain: res.publicHost }) : t('setup_wizard.domain_cleared')
        );
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
      await withBusy(btn, t('common.saving'), async () => {
        const res = await post('/api/settings/localization', { timezone: tzSel.value, country: ccSel.value });
        if (res) {
          if (locNote)
            locNote.textContent = `Currently: ${res.localization.timezone} · ${res.localization.locale || ''}`;
          toast(t('settings.tz_saved', { tz: res.localization.timezone }));
        }
      });
    });

    document.getElementById('set-lang-save')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const langSel = document.getElementById('set-lang');
      if (!langSel) return;
      await withBusy(btn, t('common.saving'), async () => {
        const res = await post('/api/account/language', { language: langSel.value });
        if (res) {
          toast(t('settings.language.saved'));
          window.location.reload();
        }
      });
    });
  }

  document.getElementById('set-cf-test')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await withBusy(btn, t('common.checking'), async () => {
      // post() returns null (and toasts) on any failure - success is the only branch left.
      const res = await post('/api/keys/curseforge/test', {});
      if (res) toast(t('settings.stored_key_valid'));
    });
  });

  // ---- Public API (/api/v1) ----
  document.getElementById('public-api-enabled')?.addEventListener('change', async (e) => {
    const el = e.currentTarget;
    const enabled = el.checked;
    el.disabled = true;
    try {
      const res = await post('/api/settings/public-api', { enabled });
      if (res) {
        toast(res.enabled ? t('settings.public_api_enabled') : t('settings.public_api_disabled'));
      } else {
        el.checked = !enabled; // revert - post() already toasted why
      }
    } finally {
      el.disabled = false;
    }
  });

  document.getElementById('api-token-add')?.addEventListener('click', () => {
    let servers = [];
    try {
      servers = JSON.parse(document.getElementById('api-token-servers')?.textContent || '[]');
    } catch {
      /* no server picker */
    }
    const content = document.createElement('div');
    content.className = 'space-y-3';
    content.innerHTML = `
      <div><label class="label" for="at-label">${escapeHtml(t('settings.token_modal.name_label'))}</label>
        <input class="input" id="at-label" autocomplete="off" placeholder="${escapeHtml(t('settings.token_modal.name_placeholder'))}">
        <p class="help">${escapeHtml(t('settings.token_modal.name_help'))}</p></div>
      <div><span class="label">${escapeHtml(t('settings.token_modal.scope_label'))}</span>
        <label class="flex items-center gap-2 text-sm"><input type="radio" name="at-scope" value="all" checked> ${escapeHtml(t('settings.token_modal.scope_all'))}</label>
        <label class="flex items-center gap-2 text-sm"><input type="radio" name="at-scope" value="some"> ${escapeHtml(t('settings.token_modal.scope_some'))}</label>
      </div>
      <div><label class="label" for="at-servers">${escapeHtml(t('settings.token_modal.servers_label'))}</label>
        <select class="input" id="at-servers" multiple size="6" disabled>
          ${servers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div><label class="label" for="at-expires">${escapeHtml(t('settings.token_modal.expires_label'))}</label>
        <input class="input" id="at-expires" type="datetime-local">
        <p class="help">${escapeHtml(t('settings.token_modal.expires_help'))}</p></div>`;
    const scopeRadios = content.querySelectorAll('input[name="at-scope"]');
    const serverSel = content.querySelector('#at-servers');
    scopeRadios.forEach((r) =>
      r.addEventListener('change', () => {
        serverSel.disabled = content.querySelector('input[name="at-scope"]:checked').value !== 'some';
      })
    );
    openModal({
      title: t('settings.token_modal.new_key_title'),
      content,
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('common.create'),
          kind: 'primary',
          busyLabel: t('common.creating'),
          onClick: async () => {
            const scopeAll = content.querySelector('input[name="at-scope"]:checked').value === 'all';
            const serverIds = scopeAll ? [] : [...serverSel.selectedOptions].map((o) => o.value);
            const expiresRaw = content.querySelector('#at-expires').value;
            const body = {
              label: content.querySelector('#at-label').value.trim(),
              scopeAll,
              serverIds,
              expiresAt: expiresRaw ? new Date(expiresRaw).toISOString() : undefined,
            };
            const res = await post('/api/api-tokens', body);
            if (!res) return false;
            revealTokenModal(res.token.token);
          },
        },
      ],
    });
  });

  function revealTokenModal(token) {
    const content = document.createElement('div');
    content.className = 'space-y-3';

    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-2';
    const field = document.createElement('input');
    field.className = 'input min-w-0 flex-1 font-mono';
    field.readOnly = true;
    field.value = token;
    field.addEventListener('focus', () => field.select());
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn';
    copyBtn.textContent = t('common.copy');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(token);
        copyBtn.textContent = t('common.copied');
        toast(t('settings.token_modal.copied_toast'));
        setTimeout(() => (copyBtn.textContent = t('common.copy')), 1500);
      } catch {
        field.focus();
        toast(t('settings.token_modal.copy_fail_toast'), { kind: 'error' });
      }
    });
    row.append(field, copyBtn);
    content.appendChild(row);

    content.insertAdjacentHTML(
      'beforeend',
      `<p class="notice notice-danger">${escapeHtml(t('settings.token_modal.reveal_notice'))}</p>`
    );
    openModal({
      title: t('settings.token_modal.reveal_title'),
      size: 'sm',
      content,
      actions: [{ label: t('common.done'), kind: 'primary', onClick: () => setTimeout(() => location.reload(), 300) }],
    });
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

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
    const tokenRevokeBtn = e.target.closest('[data-token-revoke]');
    if (tokenRevokeBtn) {
      const { tokenId, label } = tokenRevokeBtn.dataset;
      const ok = await confirmDialog({
        title: t('settings.confirm_cancel_key_title', { label }),
        message: t('settings.confirm_cancel_key_msg'),
        confirmLabel: t('settings.cancel_key'),
        danger: true,
      });
      if (!ok) return;
      await withBusy(tokenRevokeBtn, async () => {
        const res = await fetch(`/api/api-tokens/${tokenId}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          toast(t('settings.key_cancelled'));
          document.querySelector(`#api-tokens-table tr[data-token-id="${CSS.escape(tokenId)}"]`)?.remove();
        } else {
          toast(data.error || friendlyError(res, { action: 'cancel that key' }), { kind: 'error' });
        }
      });
      return;
    }
    if (passBtn) {
      passwordModal(passBtn.dataset.userId, passBtn.dataset.username);
    } else if (totpResetBtn) {
      const { userId, username } = totpResetBtn.dataset;
      const ok = await confirmDialog({
        title: t('settings.confirm_reset_2fa_title', { username }),
        message: t('settings.confirm_reset_2fa_msg'),
        confirmLabel: t('settings.reset_2fa'),
        danger: true,
      });
      if (!ok) return;
      await withBusy(menuTriggerFor(userId), async () => {
        const res = await post(`/api/users/${userId}/totp/disable`, {});
        if (res) {
          toast(t('settings.two_factor_reset'));
          setTimeout(() => location.reload(), 600);
        }
      });
    } else if (delBtn) {
      const { userId, username } = delBtn.dataset;
      const ok = await confirmDialog({
        title: t('settings.confirm_delete_user_title', { username }),
        message: t('settings.confirm_delete_user_msg'),
        confirmLabel: t('settings.delete_user'),
        danger: true,
      });
      if (!ok) return;
      await withBusy(menuTriggerFor(userId), async () => {
        const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (data.ok) {
          toast(t('settings.user_deleted'));
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
      <div><label class="label">${escapeHtml(t('settings.user_modal.username_label'))}</label><input class="input" id="nu-name" autocomplete="off"></div>
      <div><label class="label">${escapeHtml(t('settings.user_modal.password_label'))}</label><input class="input" id="nu-pass" type="password" autocomplete="new-password"><p class="help">${escapeHtml(t('settings.user_modal.password_min_len'))}</p></div>
      <div><label class="label">${escapeHtml(t('settings.user_modal.role_label'))}</label>
        <select class="input" id="nu-role" data-label="${escapeHtml(t('settings.user_modal.role_label'))}">
          <option value="viewer">${escapeHtml(t('settings.user_modal.role_viewer'))}</option>
          <option value="operator">${escapeHtml(t('settings.user_modal.role_operator'))}</option>
          <option value="admin">${escapeHtml(t('settings.user_modal.role_admin'))}</option>
        </select>
      </div>`;
    openModal({
      title: t('settings.user_modal.add_modal_title'),
      content,
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: t('settings.user_modal.create_user_btn'),
          kind: 'primary',
          busyLabel: t('common.creating'),
          onClick: async () => {
            const body = {
              username: content.querySelector('#nu-name').value.trim(),
              password: content.querySelector('#nu-pass').value,
              role: content.querySelector('#nu-role').value,
            };
            const res = await post('/api/users', body);
            if (!res) return false;
            toast(t('settings.user_created', { username: body.username }));
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
    const isSelf = userId === selfUserId;
    label.textContent = isSelf
      ? t('settings.user_modal.set_own_password_label')
      : t('settings.user_modal.set_user_password_label', { username });
    content.appendChild(label);
    content.insertAdjacentHTML(
      'beforeend',
      `<input class="input" id="pw-new" type="password" autocomplete="new-password"><p class="help">${escapeHtml(t('settings.user_modal.password_min_len'))}</p>`
    );
    // Re-verify the acting admin's own password before any password mutation
    // (mirrors the account 2FA routes) - a hijacked-but-live admin session can't
    // silently take over accounts / itself without knowing the real password.
    const curLabel = document.createElement('label');
    curLabel.className = 'label mt-3';
    curLabel.textContent = t('settings.user_modal.confirm_current_password');
    content.appendChild(curLabel);
    content.insertAdjacentHTML(
      'beforeend',
      '<input class="input" id="pw-current" type="password" autocomplete="current-password">'
    );
    openModal({
      title: isSelf
        ? t('settings.user_modal.change_own_password_title')
        : t('settings.user_modal.set_user_password_title'),
      size: 'sm',
      content,
      actions: [
        { label: t('common.cancel'), kind: 'ghost' },
        {
          label: isSelf ? t('settings.user_modal.change_password_btn') : t('settings.user_modal.set_password_btn'),
          kind: 'primary',
          busyLabel: t('common.saving'),
          onClick: async () => {
            const res = await post(`/api/users/${userId}/password`, {
              password: content.querySelector('#pw-new').value,
              currentPassword: content.querySelector('#pw-current').value,
            });
            if (!res) return false;
            if (res.signedOutAll) {
              toast(t('settings.password_updated_sign_in'), { timeout: 4000 });
              setTimeout(() => {
                location.href = '/login';
              }, 800);
            } else {
              toast(t('settings.password_updated'));
            }
            return false;
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

  // ---- Panel self-update check ("Update MSM") ----
  const msmUpdateBtn = document.getElementById('msm-update-btn');
  const msmUpdateOut = document.getElementById('msm-update-out');
  if (msmUpdateBtn) {
    msmUpdateBtn.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (msmUpdateOut) msmUpdateOut.textContent = '';
      await withBusy(btn, 'Checking…', async () => {
        let data;
        try {
          const res = await fetch('/api/settings/panel-update?refresh=1', { headers: { Accept: 'application/json' } });
          data = await res.json().catch(() => ({}));
          if (!res.ok || data.ok === false) {
            toast(data.error || friendlyError(res, { action: 'check for a panel update' }), {
              kind: 'error',
              timeout: 8000,
            });
            return;
          }
        } catch {
          toast(friendlyError(null, { action: 'check for a panel update' }), { kind: 'error', timeout: 8000 });
          return;
        }
        const u = data.update || {};
        if (!msmUpdateOut) return;
        const esc = (s) =>
          String(s).replace(
            /[&<>"']/g,
            (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
          );
        if (u.error && !u.latest) {
          msmUpdateOut.innerHTML = `<p class="help mt-2 text-danger">Could not check GitHub right now: ${esc(u.error)}</p>`;
          return;
        }
        if (u.isNewer && u.latest && u.latest.htmlUrl) {
          msmUpdateOut.innerHTML = `
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="chip">Update available: v${esc(u.latest.version)}</span>
              <a class="btn" href="${esc(u.latest.htmlUrl)}" target="_blank" rel="noopener noreferrer">Update MSM</a>
            </div>
            <p class="help mt-1">You are running v${esc(u.current)}. Download the release and follow its install instructions.</p>`;
        } else if (u.latest) {
          msmUpdateOut.textContent = `You are on the latest release (v${u.current}).`;
        } else {
          msmUpdateOut.textContent = `Running v${u.current}.`;
        }
      });
    });
  }

  // ---- Defaults for new servers ----
  const dfltSave = document.getElementById('dflt-save');
  if (dfltSave) {
    const note = document.getElementById('dflt-note');
    const FIELDS = [
      ['dflt-heap', 'heapMb'],
      ['dflt-container', 'containerMemoryMb'],
      ['dflt-cpus', 'cpus'],
      ['dflt-quota', 'diskQuotaGb'],
      ['dflt-warnpct', 'quotaWarnPct'],
      ['dflt-critpct', 'quotaCriticalPct'],
    ];
    const inputs = Object.fromEntries(FIELDS.map(([id, key]) => [key, document.getElementById(id)]));
    const apply = (res) => {
      if (!res) return;
      for (const [key, el] of Object.entries(inputs)) el.value = res.defaults[key];
      const customized = FIELDS.some(([, key]) => Number(inputs[key].value) !== Number(inputs[key].dataset.default));
      note.textContent = customized
        ? 'Custom defaults are set. The wizard and new servers use these.'
        : 'Using the built-in defaults from .env and this machine.';
    };
    dfltSave.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      await withBusy(btn, t('common.saving'), async () => {
        const body = Object.fromEntries(FIELDS.map(([, key]) => [key, inputs[key].value]));
        const res = await post('/api/settings/defaults', body);
        if (res) {
          apply(res);
          toast(t('settings.defaults_saved'));
        }
      });
    });
    document.getElementById('dflt-restore').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const ok = await confirmDialog({
        title: t('settings.confirm_restore_defaults_title'),
        message: t('settings.confirm_restore_defaults_msg'),
        confirmLabel: t('settings.restore_defaults'),
        danger: true,
      });
      if (!ok) return;
      await withBusy(btn, t('common.saving'), async () => {
        const res = await post('/api/settings/defaults', { reset: true });
        if (res) {
          apply(res);
          toast(t('settings.defaults_restored'));
        }
      });
    });
  }

  // ---- Sign-in lockouts ----
  const lockBody = document.getElementById('lockouts-body');
  const clearAllBtn = document.getElementById('lockouts-clear-all');
  if (lockBody) {
    const esc = (s) =>
      String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const renderLockouts = (list) => {
      if (!list.length) {
        lockBody.textContent = 'No accounts are locked out right now.';
        clearAllBtn.classList.add('hidden');
        return;
      }
      clearAllBtn.classList.remove('hidden');
      lockBody.innerHTML = `
        <div class="overflow-x-auto"><table class="table-base table-stack"><thead><tr>
          <th>Account</th><th>Scope</th><th>Address</th><th>Fails</th><th>Clears in</th><th class="text-right"></th>
        </tr></thead><tbody>${list
          .map(
            (l) => `<tr>
              <td data-th="Account" class="font-medium">${esc(l.username)}</td>
              <td data-th="Scope">${l.scope === 'account' ? 'Whole account' : 'This address'}</td>
              <td data-th="Address" class="font-mono text-xs">${esc(l.ip || '-')}</td>
              <td data-th="Fails" class="tabular-nums">${l.count}</td>
              <td data-th="Clears in" class="tabular-nums">${l.minutesLeft} min</td>
              <td data-th="" class="text-right"><button class="btn btn-ghost btn-sm" data-unlock data-username="${esc(l.username)}" ${l.ip ? `data-ip="${esc(l.ip)}"` : ''}>Unlock</button></td>
            </tr>`
          )
          .join('')}</tbody></table></div>`;
    };
    const load = async () => {
      try {
        const res = await fetch('/api/auth/lockouts', { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (res.ok && data.ok) renderLockouts(data.lockouts);
        else lockBody.textContent = 'Could not load the lockout list.';
      } catch {
        lockBody.textContent = 'Could not load the lockout list.';
      }
    };
    lockBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-unlock]');
      if (!btn) return;
      await withBusy(btn, 'Unlocking…', async () => {
        const res = await post('/api/auth/lockouts/clear', { username: btn.dataset.username, ip: btn.dataset.ip });
        if (res) {
          toast(`Unlocked "${btn.dataset.username}".`);
          renderLockouts(res.lockouts);
        }
      });
    });
    clearAllBtn?.addEventListener('click', async (e) => {
      const ok = await confirmDialog({
        title: t('settings.confirm_clear_locks_title'),
        message: t('settings.confirm_clear_locks_msg'),
        confirmLabel: t('settings.clear_all_locks'),
      });
      if (!ok) return;
      await withBusy(e.currentTarget, t('common.saving'), async () => {
        const res = await post('/api/auth/lockouts/clear', { all: true });
        if (res) {
          toast(`Cleared ${res.removed} lock${res.removed === 1 ? '' : 's'}.`);
          renderLockouts(res.lockouts);
        }
      });
    });
    load();
  }
}
