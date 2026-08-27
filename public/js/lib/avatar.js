// Self-service profile picture: the topbar user-menu "Profile Picture" entry
// opens a picker (12 built-in presets, or upload your own) - self-scoped, same
// pattern as two-factor auth (lib/twoFactor.js), no password check needed since
// there's nothing sensitive here.

import { openModal } from './modal.js';
import { toast } from './toast.js';
import { friendlyError } from './errors.js';
import { escapeHtml } from './format.js';
import { openCropModal } from './imageCrop.js';

document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-open-avatar-picker]')) return;
  openPickerModal();
});

async function openPickerModal() {
  const trigger = document.querySelector('[data-menu="user-menu"]');
  const current = trigger?.dataset.userAvatar || '';

  const res = await get('/api/account/avatar/presets');
  if (!res) return;

  const content = document.createElement('div');
  content.className = 'space-y-4';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-4 gap-2';
  for (const preset of res.presets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch grid size-14 place-items-center bg-inset p-1.5';
    btn.dataset.tip = preset.label;
    btn.setAttribute('aria-pressed', String(current === `preset:${preset.key}`));
    btn.innerHTML = `<img src="${preset.url}" alt="${escapeHtml(preset.label)}" class="size-full object-contain">`;
    btn.addEventListener('click', async () => {
      const ok = await post('/api/account/avatar/preset', { key: preset.key });
      if (!ok) return;
      toast(`Profile picture set to ${preset.label}.`);
      finish();
    });
    grid.appendChild(btn);
  }
  content.appendChild(grid);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'flex items-center gap-2 border-t border-line pt-4';
  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'btn';
  uploadBtn.textContent = 'Upload image';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-ghost';
  removeBtn.textContent = 'Remove';
  uploadRow.append(uploadBtn, removeBtn);
  content.appendChild(uploadRow);

  const help = document.createElement('p');
  help.className = 'text-xs text-ink-faint';
  help.textContent = 'PNG, SVG, or JPEG. Your picture is cropped to a square, up to 512×512.';
  content.appendChild(help);

  uploadBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/svg+xml,image/jpeg';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      const maxRaw = isSvg ? 2 * 1024 * 1024 : 15 * 1024 * 1024;
      if (file.size > maxRaw) {
        toast(isSvg ? 'SVG must be 2 MB or smaller.' : 'Image must be 15 MB or smaller.', { kind: 'error' });
        return;
      }

      // Every custom upload is squared client-side; the server only ever sees
      // the cropped PNG/JPEG, already under its 512 KB limit.
      const cropped = await openCropModal(file);
      if (!cropped) return; // cancelled, or the image couldn't be decoded

      const form = new FormData();
      form.append('avatar', cropped.blob, cropped.filename);
      try {
        const uploadRes = await fetch('/api/account/avatar/upload', { method: 'POST', body: form });
        const data = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || data.ok === false) {
          toast(data.error || friendlyError(uploadRes, { action: 'upload that picture' }), {
            kind: 'error',
            timeout: 8000,
          });
          return;
        }
        toast('Profile picture updated.');
        finish();
      } catch {
        toast(friendlyError(null, { action: 'upload that picture' }), { kind: 'error' });
      }
    });
    input.click();
  });

  removeBtn.addEventListener('click', async () => {
    const ok = await del('/api/account/avatar');
    if (!ok) return;
    toast('Profile picture reset.');
    finish();
  });

  openModal({ title: 'Profile Picture', content, actions: [{ label: 'Close', kind: 'ghost' }] });
}

function finish() {
  setTimeout(() => location.reload(), 600);
}

async function get(url) {
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      toast(data.error || friendlyError(res, { action: 'load your profile picture options' }), {
        kind: 'error',
        timeout: 8000,
      });
      return null;
    }
    return data;
  } catch {
    toast(friendlyError(null, { action: 'load your profile picture options' }), { kind: 'error' });
    return null;
  }
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
      toast(data.error || friendlyError(res, { action: 'change your profile picture' }), {
        kind: 'error',
        timeout: 8000,
      });
      return false;
    }
    return true;
  } catch {
    toast(friendlyError(null, { action: 'change your profile picture' }), { kind: 'error' });
    return false;
  }
}

async function del(url) {
  try {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      toast(data.error || friendlyError(res, { action: 'reset your profile picture' }), {
        kind: 'error',
        timeout: 8000,
      });
      return false;
    }
    return true;
  } catch {
    toast(friendlyError(null, { action: 'reset your profile picture' }), { kind: 'error' });
    return false;
  }
}
