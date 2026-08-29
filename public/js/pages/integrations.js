// Integrations tab: Discord webhook config, invite helper, public status page.
import { toast } from '../lib/toast.js';
import { setBusy, withBusy } from '../lib/loading.js';

const root = document.getElementById('ig-root');
if (root) init();

function init() {
  const serverId = root.dataset.serverId;
  const invite = JSON.parse(root.dataset.invite || '{}');

  // ---- Dirty hints: the enable toggles LOOK live but only apply on Save —
  // flag the pending state so flipping one and leaving isn't a silent no-op.
  function bindDirty(key, controls) {
    const hint = root.querySelector(`[data-ig-dirty="${key}"]`);
    if (!hint) return () => {};
    for (const el of controls) el?.addEventListener('change', () => hint.classList.remove('hidden'));
    return () => hint.classList.add('hidden');
  }
  const cleanDc = bindDirty('dc', [
    document.getElementById('ig-dc-enabled'),
    document.getElementById('ig-dc-url'),
    ...root.querySelectorAll('[data-dc-event]'),
  ]);
  const cleanSp = bindDirty('sp', [document.getElementById('ig-sp-enabled'), document.getElementById('ig-sp-slug')]);
  const cleanWz = bindDirty('wz', [
    document.getElementById('ig-wz-enabled'),
    document.getElementById('ig-wz-name'),
    document.getElementById('ig-wz-url'),
    document.getElementById('ig-wz-model'),
    document.getElementById('ig-wz-key'),
    document.getElementById('ig-wz-key-clear'),
    document.getElementById('ig-wz-retention'),
    document.getElementById('ig-wz-prompt'),
    document.getElementById('ig-wz-welcome-enabled'),
    document.getElementById('ig-wz-welcome-message'),
    document.getElementById('ig-wz-checkin-minutes'),
    document.getElementById('ig-wz-checkin-message'),
    document.getElementById('ig-wz-conversation-minutes'),
    document.getElementById('ig-wz-powers-enabled'),
    document.getElementById('ig-wz-dry-run'),
    document.getElementById('ig-wz-testers'),
    document.getElementById('ig-wz-controllers'),
    document.getElementById('ig-wz-gifts'),
    document.getElementById('ig-wz-gift-max'),
    document.getElementById('ig-wz-power-cooldown'),
    ...root.querySelectorAll('[data-wz-power]'),
  ]);

  function wizardConnection() {
    return {
      baseUrl: document.getElementById('ig-wz-url')?.value.trim() || '',
      model: document.getElementById('ig-wz-model')?.value.trim() || '',
      apiKey: document.getElementById('ig-wz-key')?.value || undefined,
    };
  }

  function lineList(id) {
    return (document.getElementById(id)?.value || '')
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  document.getElementById('ig-wz-models-load')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await withBusy(btn, 'Loading…', async () => {
      const res = await api(`/api/servers/${serverId}/wizard/models`, 'POST', wizardConnection());
      if (!res.ok) return;
      const datalist = document.getElementById('ig-wz-models');
      datalist.replaceChildren(
        ...res.data.models.map((name) => Object.assign(document.createElement('option'), { value: name }))
      );
      toast(
        res.data.models.length ? `Found ${res.data.models.length} model(s).` : 'Connected, but no models were listed.',
        {
          kind: res.data.models.length ? 'success' : 'info',
        }
      );
    });
  });

  document.getElementById('ig-wz-test')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const conn = wizardConnection();
    if (!conn.model) return toast('Enter or discover a model first.', { kind: 'error' });
    await withBusy(btn, 'Testing…', async () => {
      const res = await api(`/api/servers/${serverId}/wizard/test`, 'POST', conn);
      if (res.ok) {
        toast(`LLM replied: ${res.data.reply}`, { kind: 'success', timeout: 8000 });
      }
    });
  });

  document.getElementById('ig-wz-save')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const conn = wizardConnection();
    const body = {
      enabled: document.getElementById('ig-wz-enabled').checked,
      invocationName: document.getElementById('ig-wz-name').value.trim(),
      ...conn,
      clearApiKey: Boolean(document.getElementById('ig-wz-key-clear')?.checked),
      retentionDays: Number(document.getElementById('ig-wz-retention').value),
      systemPrompt: document.getElementById('ig-wz-prompt').value,
      welcomeEnabled: document.getElementById('ig-wz-welcome-enabled').checked,
      welcomeMessage: document.getElementById('ig-wz-welcome-message').value,
      checkinMinutes: Number(document.getElementById('ig-wz-checkin-minutes').value),
      checkinMessage: document.getElementById('ig-wz-checkin-message').value,
      conversationMinutes: Number(document.getElementById('ig-wz-conversation-minutes').value),
      powersEnabled: document.getElementById('ig-wz-powers-enabled').checked,
      powersDryRun: document.getElementById('ig-wz-dry-run').checked,
      powerTesters: lineList('ig-wz-testers'),
      powerControllers: lineList('ig-wz-controllers'),
      giftItems: lineList('ig-wz-gifts'),
      giftMaxCount: Number(document.getElementById('ig-wz-gift-max').value),
      powerCooldownSec: Number(document.getElementById('ig-wz-power-cooldown').value),
      powerFlags: Object.fromEntries(
        [...root.querySelectorAll('[data-wz-power]')].map((box) => [box.dataset.wzPower, box.checked])
      ),
    };
    await withBusy(btn, 'Saving…', async () => {
      const res = await api(`/api/servers/${serverId}/wizard`, 'POST', body);
      if (!res.ok) return;
      toast(
        res.data.wizard.enabled
          ? `Chatbot enabled. Players can say @${res.data.wizard.invocationName}.`
          : 'Chatbot settings saved; chatbot is disabled.'
      );
      document.getElementById('ig-wz-key').value = '';
      if (document.getElementById('ig-wz-key-clear')) document.getElementById('ig-wz-key-clear').checked = false;
      cleanWz();
    });
  });

  document.getElementById('ig-wz-transcripts')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await withBusy(btn, 'Loading…', async () => {
      const res = await api(`/api/servers/${serverId}/wizard/transcripts?limit=250`, 'GET');
      if (!res.ok) return;
      const list = document.getElementById('ig-wz-transcript-list');
      list.replaceChildren();
      for (const row of res.data.transcripts) {
        const line = document.createElement('div');
        line.className = 'border-b border-line py-2 last:border-0';
        const meta = document.createElement('div');
        meta.className = 'mb-1 text-ink-faint';
        meta.textContent = `${row.created_at} · ${row.speaker}`;
        const content = document.createElement('div');
        content.className = row.role === 'error' ? 'text-danger' : 'whitespace-pre-wrap text-ink-soft';
        content.textContent = row.content;
        line.append(meta, content);
        list.appendChild(line);
      }
      if (!res.data.transcripts.length) list.textContent = 'No retained chatbot conversations for this server.';
      list.classList.remove('hidden');
    });
  });

  document.getElementById('ig-wz-power-audit')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await withBusy(btn, 'Loading…', async () => {
      const res = await api(`/api/servers/${serverId}/wizard/powers/audit?limit=100`, 'GET');
      if (!res.ok) return;
      const list = document.getElementById('ig-wz-power-audit-list');
      list.replaceChildren();
      for (const event of res.data.events) {
        const line = document.createElement('div');
        line.className = 'border-b border-line py-2 last:border-0';
        const meta = document.createElement('div');
        meta.className = 'mb-1 text-ink-faint';
        meta.textContent = `${event.created_at} · ${event.actor}`;
        const summary = document.createElement('div');
        summary.className = 'text-ink-soft';
        summary.textContent = event.summary;
        line.append(meta, summary);
        list.appendChild(line);
      }
      if (!res.data.events.length) list.textContent = 'No chatbot power attempts have been recorded for this server.';
      list.classList.remove('hidden');
    });
  });

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
        cleanDc();
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
        cleanSp();
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
  // copyText's last-resort fallback shows its own "copy manually" modal, so a
  // false return needs no extra toast — but a missing global must not throw.
  if (window.CD?.copyText && (await window.CD.copyText(text))) toast(message);
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
