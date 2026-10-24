// Self-service two-factor auth: the topbar user-menu "Two-factor
// authentication" entry opens one of two flows - enroll (QR + confirm code +
// one-time backup codes) or manage (regenerate codes / disable), both gated
// by re-entering the current password on the server side.

import { openModal } from './modal.js';
import { toast } from './toast.js';
import { friendlyError } from './errors.js';
import { t } from './i18n.js';

document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-open-2fa]')) return;
  const trigger = document.querySelector('[data-menu="user-menu"]');
  if (trigger?.dataset.userTotpEnabled === '1') openManageModal(trigger);
  else openEnrollModal(trigger);
});

async function openEnrollModal(trigger) {
  const setup = await post('/api/account/totp/setup', {});
  if (!setup) return;

  const content = document.createElement('div');
  content.className = 'space-y-4';
  // qrDataUrl/secret are server-generated (not attacker-controlled today), but
  // they're set as DOM properties rather than interpolated into innerHTML so
  // that stays true even if this endpoint's response shape ever changes.
  content.innerHTML = `
    <p class="text-sm text-ink-soft">${t('two_factor.scan_intro')}</p>
    <div class="flex justify-center"><img alt="${t('two_factor.qr_alt')}" class="rounded-md border border-line" width="220" height="220"></div>
    <div>
      <label class="label">${t('two_factor.manual_entry')}</label>
      <div class="flex gap-2">
        <input class="input flex-1 font-mono text-xs" id="tf-secret" readonly>
        <button type="button" class="btn" id="tf-secret-copy">${t('common.copy')}</button>
      </div>
    </div>
    <div>
      <label class="label" for="tf-confirm-code">${t('two_factor.enter_code')}</label>
      <input class="input font-mono text-center text-lg tracking-[0.3em]" id="tf-confirm-code" inputmode="numeric" maxlength="6" placeholder="000000">
    </div>
    <div>
      <label class="label" for="tf-confirm-password">${t('two_factor.confirm_password')}</label>
      <input class="input" id="tf-confirm-password" type="password" autocomplete="current-password" placeholder="${t('two_factor.password_placeholder')}">
    </div>`;
  content.querySelector('img').src = setup.qrDataUrl;
  content.querySelector('#tf-secret').value = setup.secret;
  content.querySelector('#tf-secret-copy').dataset.copy = setup.secret;

  openModal({
    title: t('two_factor.enable_title'),
    content,
    actions: [
      { label: t('common.cancel'), kind: 'ghost' },
      {
        label: t('two_factor.enable_btn'),
        kind: 'primary',
        busyLabel: t('two_factor.verifying'),
        onClick: async () => {
          const code = content.querySelector('#tf-confirm-code').value.trim();
          const password = content.querySelector('#tf-confirm-password').value;
          const res = await post('/api/account/totp/confirm', { secret: setup.secret, code, password });
          if (!res) return false;
          if (trigger) trigger.dataset.userTotpEnabled = '1';
          toast(t('two_factor.enabled_toast'));
          // Reload once they've saved their codes - the users table (Settings)
          // and this dataset flag are both server-rendered/read at page-load,
          // so a stale page would still show "off" until refreshed.
          showBackupCodes(res.backupCodes, t('two_factor.backup_codes_save_title'), { reloadOnClose: true });
        },
      },
    ],
  });
}

function openManageModal(trigger) {
  const content = document.createElement('div');
  content.className = 'space-y-4';
  content.innerHTML = `
    <p class="text-sm text-ink-soft">${t('two_factor.manage_intro')}</p>
    <div>
      <label class="label" for="tf-mgmt-password">${t('two_factor.current_password')}</label>
      <input class="input" id="tf-mgmt-password" type="password" autocomplete="current-password">
    </div>`;

  openModal({
    title: t('two_factor.manage_title'),
    content,
    actions: [
      { label: t('common.close'), kind: 'ghost' },
      {
        label: t('two_factor.regenerate_codes'),
        busyLabel: t('two_factor.regenerating'),
        onClick: async () => {
          const password = content.querySelector('#tf-mgmt-password').value;
          const res = await post('/api/account/totp/backup-codes/regenerate', { password });
          if (!res) return false;
          showBackupCodes(res.backupCodes, t('two_factor.backup_codes_new_title'));
        },
      },
      {
        label: t('two_factor.disable_btn'),
        kind: 'danger',
        busyLabel: t('two_factor.disabling'),
        onClick: async () => {
          const password = content.querySelector('#tf-mgmt-password').value;
          const res = await post('/api/account/totp/disable', { password });
          if (!res) return false;
          if (trigger) trigger.dataset.userTotpEnabled = '';
          toast(t('two_factor.disabled_toast'));
          setTimeout(() => location.reload(), 600);
        },
      },
    ],
  });
}

function showBackupCodes(codes, title, { reloadOnClose = false } = {}) {
  const content = document.createElement('div');
  content.className = 'space-y-3';
  const list = document.createElement('div');
  list.className = 'grid grid-cols-2 gap-2 rounded-md bg-inset p-3 font-mono text-sm';
  for (const code of codes) {
    const span = document.createElement('span');
    span.textContent = code;
    list.appendChild(span);
  }
  const warn = document.createElement('p');
  warn.className = 'text-xs text-ink-faint';
  warn.textContent = t('two_factor.backup_codes_warning');
  // Relies on app.js's global [data-copy] click handler rather than duplicating
  // clipboard logic here.
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-sm';
  copyBtn.textContent = t('two_factor.copy_all');
  copyBtn.dataset.copy = codes.join('\n');
  content.append(list, warn, copyBtn);

  openModal({
    title,
    content,
    actions: [{ label: t('common.done') }],
    onClose: reloadOnClose ? () => location.reload() : undefined,
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
      toast(data.error || friendlyError(res, { action: 'update two-factor authentication' }), {
        kind: 'error',
        timeout: 8000,
      });
      return null;
    }
    return data;
  } catch {
    toast(friendlyError(null, { action: 'update two-factor authentication' }), { kind: 'error' });
    return null;
  }
}
