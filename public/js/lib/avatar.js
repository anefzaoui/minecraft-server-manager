// Self-service profile picture: the topbar user-menu "Profile Picture" entry
// opens a picker (12 built-in presets, or upload your own) - self-scoped, same
// pattern as two-factor auth (lib/twoFactor.js), no password check needed since
// there's nothing sensitive here.

import { openModal } from './modal.js';
import { toast } from './toast.js';

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
  uploadBtn.textContent = 'Upload Image';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-ghost';
  removeBtn.textContent = 'Remove';
  uploadRow.append(uploadBtn, removeBtn);
  content.appendChild(uploadRow);

  const help = document.createElement('p');
  help.className = 'text-xs text-ink-faint';
  help.textContent = 'PNG, SVG or JPEG, up to 512 KB.';
  content.appendChild(help);

  uploadBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/svg+xml,image/jpeg';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 512 * 1024) {
        toast('Image must be 512 KB or smaller.', { kind: 'error' });
        return;
      }
      const form = new FormData();
      form.append('avatar', file);
      try {
        const uploadRes = await fetch('/api/account/avatar/upload', { method: 'POST', body: form });
        const data = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || data.ok === false) {
          toast(data.error || 'Upload failed', { kind: 'error', timeout: 8000 });
          return;
        }
        toast('Profile picture updated.');
        finish();
      } catch (err) {
        toast(`Network error: ${err.message}`, { kind: 'error' });
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

function escapeHtml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

async function get(url) {
  try {
    const res = await fetch(url);
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
      return false;
    }
    return true;
  } catch (err) {
    toast(`Network error: ${err.message}`, { kind: 'error' });
    return false;
  }
}

async function del(url) {
  try {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      toast(data.error || `Request failed (${res.status})`, { kind: 'error', timeout: 8000 });
      return false;
    }
    return true;
  } catch (err) {
    toast(`Network error: ${err.message}`, { kind: 'error' });
    return false;
  }
}
