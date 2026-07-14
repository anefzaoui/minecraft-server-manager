// Integrations tab: Discord webhook config, invite helper, public status page.
import { toast } from '../lib/toast.js';
import { setBusy, withBusy } from '../lib/loading.js';

const root = document.getElementById('ig-root');
if (root) init();

function init() {
  const serverId = root.dataset.serverId;
  const invite = JSON.parse(root.dataset.invite || '{}');

  // ---- Discord ----
  document.getElementById('ig-dc-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capture before await — currentTarget is null afterwards
    const url = document.getElementById('ig-dc-url').value.trim();
    const body = {
      enabled: document.getElementById('ig-dc-enabled').checked,
      events: {},
    };
    for (const box of root.querySelectorAll('[data-dc-event]')) {
      body.events[box.dataset.dcEvent] = box.checked;
    }
    if (url) body.webhookUrl = url; // blank = keep the stored URL
    await withBusy(btn, 'Saving…', async () => {
      const res = await api(`/api/servers/${serverId}/integrations/discord`, 'POST', body);
      if (res.ok) {
        toast('Discord settings saved.');
        document.getElementById('ig-dc-url').value = '';
        document.getElementById('ig-dc-test').disabled = !res.data.discord.hasWebhook;
      }
    });
  });

  document.getElementById('ig-dc-test')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; // capture before await — currentTarget is null afterwards
    await withBusy(btn, 'Sending…', async () => {
      const res = await api(`/api/servers/${serverId}/integrations/discord/test`, 'POST');
      if (res.ok) toast('Test message sent — check your Discord channel.');
    });
  });

  // ---- Invite ----
  const addrSelect = document.getElementById('ig-addr');
  const hostInput = document.getElementById('ig-host');
  const textEl = document.getElementById('ig-invite-text');

  function chosenHost() {
    if (!addrSelect) return '';
    if (addrSelect.value === '__custom') return hostInput.value.trim();
    return addrSelect.value;
  }

  function renderInviteText() {
    const host = chosenHost();
    if (!host || !textEl) return;
    textEl.textContent = String(invite.inviteText || '').replace(/^Address: .*$/m, `Address: ${host}`);
  }

  addrSelect?.addEventListener('change', () => {
    hostInput.classList.toggle('hidden', addrSelect.value !== '__custom');
    renderInviteText();
  });
  hostInput?.addEventListener('input', renderInviteText);

  document.getElementById('ig-copy-invite')?.addEventListener('click', () => {
    if (addrSelect?.value === '__custom' && !hostInput.value.trim()) {
      toast('Enter the custom address first.', { kind: 'error' });
      return;
    }
    copy(textEl.textContent, 'Invite text copied — paste it to your friends.');
  });

  document.getElementById('ig-mrpack')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const host = chosenHost();
    if (!host) {
      toast('Pick or enter an address first — it gets baked into the pack.', { kind: 'error' });
      return;
    }
    toast('Building the client modpack…', { kind: 'info' });
    // Navigation download — the browser gives no completion event, so show
    // busy for the server-side build window and release after a beat.
    const restore = setBusy(btn, 'Building…');
    setTimeout(restore, 8000);
    location.href = `/api/servers/${serverId}/integrations/invite/modpack.mrpack?host=${encodeURIComponent(host)}`;
  });

  // ---- Status page ----
  document.getElementById('ig-sp-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const enabled = document.getElementById('ig-sp-enabled').checked;
    const slug = document.getElementById('ig-sp-slug').value.trim();
    // A valid slug is only mandatory when turning the page ON — turning it off
    // must work even for a page that never had a slug.
    if (enabled && !/^[a-z0-9-]{3,40}$/.test(slug)) {
      toast('Slug must be 3–40 lowercase letters, digits, or dashes.', { kind: 'error' });
      return;
    }
    const body = { enabled };
    if (/^[a-z0-9-]{3,40}$/.test(slug)) body.slug = slug;
    await withBusy(btn, 'Saving…', async () => {
      const res = await api(`/api/servers/${serverId}/integrations/status-page`, 'POST', body);
      if (res.ok) {
        toast(res.data.statusPage.enabled ? `Status page live at /status/${slug}` : 'Status page turned off.');
        setTimeout(() => location.reload(), 900);
      }
    });
  });

  document.getElementById('ig-sp-copy')?.addEventListener('click', () => {
    const link = document.getElementById('ig-sp-link');
    if (link) copy(new URL(link.getAttribute('href'), location.origin).href, 'Status page link copied.');
  });
}

async function copy(text, message) {
  if (await window.CD.copyText(text)) toast(message);
}

async function api(url, method, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      toast(data.error || `Request failed (${res.status})`, { kind: 'error', timeout: 8000 });
      return { ok: false, data };
    }
    return { ok: true, data };
  } catch (err) {
    toast(`Network error: ${err.message}`, { kind: 'error' });
    return { ok: false };
  }
}
