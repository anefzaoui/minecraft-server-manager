// Self-service two-factor auth: the topbar user-menu "Two-factor
// authentication" entry opens one of two flows — enroll (QR + confirm code +
// one-time backup codes) or manage (regenerate codes / disable), both gated
// by re-entering the current password on the server side.

import { openModal } from './modal.js';
import { toast } from './toast.js';

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
  content.innerHTML = `
    <p class="text-sm text-ink-soft">Scan this with your authenticator app (Google Authenticator, Authy, 1Password, …), or enter the code manually.</p>
    <div class="flex justify-center"><img src="${setup.qrDataUrl}" alt="2FA QR code" class="rounded-md border border-line" width="220" height="220"></div>
    <div>
      <label class="label">Manual entry code</label>
      <div class="flex gap-2">
        <input class="input flex-1 font-mono text-xs" id="tf-secret" value="${setup.secret}" readonly>
        <button type="button" class="btn" data-copy="${setup.secret}">Copy</button>
      </div>
    </div>
    <div>
      <label class="label" for="tf-confirm-code">Enter the 6-digit code from your app</label>
      <input class="input font-mono text-center text-lg tracking-[0.3em]" id="tf-confirm-code" inputmode="numeric" maxlength="6" placeholder="000000">
    </div>`;

  openModal({
    title: 'Enable two-factor authentication',
    content,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Enable',
        kind: 'primary',
        busyLabel: 'Verifying…',
        onClick: async () => {
          const code = content.querySelector('#tf-confirm-code').value.trim();
          const res = await post('/api/account/totp/confirm', { secret: setup.secret, code });
          if (!res) return false;
          if (trigger) trigger.dataset.userTotpEnabled = '1';
          toast('Two-factor authentication is now enabled.');
          showBackupCodes(res.backupCodes, 'Save your backup codes');
        },
      },
    ],
  });
}

function openManageModal(trigger) {
  const content = document.createElement('div');
  content.className = 'space-y-4';
  content.innerHTML = `
    <p class="text-sm text-ink-soft">Two-factor authentication is enabled on your account. Confirm your password to regenerate backup codes or turn it off.</p>
    <div>
      <label class="label" for="tf-mgmt-password">Current password</label>
      <input class="input" id="tf-mgmt-password" type="password" autocomplete="current-password">
    </div>`;

  openModal({
    title: 'Two-factor authentication',
    content,
    actions: [
      { label: 'Close', kind: 'ghost' },
      {
        label: 'Regenerate backup codes',
        busyLabel: 'Regenerating…',
        onClick: async () => {
          const password = content.querySelector('#tf-mgmt-password').value;
          const res = await post('/api/account/totp/backup-codes/regenerate', { password });
          if (!res) return false;
          showBackupCodes(res.backupCodes, 'New backup codes');
        },
      },
      {
        label: 'Disable 2FA',
        kind: 'danger',
        busyLabel: 'Disabling…',
        onClick: async () => {
          const password = content.querySelector('#tf-mgmt-password').value;
          const res = await post('/api/account/totp/disable', { password });
          if (!res) return false;
          if (trigger) trigger.dataset.userTotpEnabled = '';
          toast('Two-factor authentication disabled.');
        },
      },
    ],
  });
}

function showBackupCodes(codes, title) {
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
  warn.textContent =
    'Each code works once, to sign in if you lose access to your authenticator app. Save them somewhere safe — they will not be shown again.';
  // Relies on app.js's global [data-copy] click handler rather than duplicating
  // clipboard logic here.
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-sm';
  copyBtn.textContent = 'Copy all';
  copyBtn.dataset.copy = codes.join('\n');
  content.append(list, warn, copyBtn);

  openModal({ title, content, actions: [{ label: 'Done' }] });
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
