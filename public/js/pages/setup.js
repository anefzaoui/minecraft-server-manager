// First-run onboarding wizard: welcome → system checks → create admin →
// optional config (public domain + CurseForge key) → done.
import { toast } from '../lib/toast.js';
import { withBusy } from '../lib/loading.js';
import { fillTimezoneSelect, fillCountrySelect } from '../lib/tzPicker.js';

const wizard = document.getElementById('setup-wizard');
if (wizard) init();

function init() {
  const sections = [...wizard.querySelectorAll('[data-step]')];
  const dots = [...wizard.querySelectorAll('[data-dot]')];
  let step = 0;
  let checksLoaded = false;
  let localizationLoaded = false;

  function goTo(i) {
    step = Math.max(0, Math.min(sections.length - 1, i));
    sections.forEach((s) => (s.hidden = Number(s.dataset.step) !== step));
    dots.forEach((d, di) => d.classList.toggle('bg-grass-500', di <= step));
    dots.forEach((d, di) => d.classList.toggle('bg-line', di > step));
    if (step === 1 && !checksLoaded) loadChecks();
    if (step === 3 && !localizationLoaded) loadLocalization();
    const focusable = sections[step].querySelector('input, button, a');
    if (focusable) focusable.focus();
  }

  wizard.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) goTo(step + 1);
    else if (e.target.closest('[data-back]')) goTo(step - 1);
    else if (e.target.closest('[data-recheck]')) loadChecks();
  });

  // ---- Step 1: system checks ----
  const ICONS = {
    pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0 text-ok"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0 text-warn"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    fail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0 text-danger"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
  };
  const list = document.getElementById('checks-list');

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const gb = (b) => (b ? `${(b / 1024 ** 3).toFixed(1)} GB` : null);

  function row(level, title, detail) {
    const el = document.createElement('div');
    el.className = 'flex items-start gap-2.5 rounded-md border border-line bg-raised p-2.5';
    el.innerHTML = `${ICONS[level] || ICONS.warn}<div class="min-w-0"><div class="text-sm font-medium">${esc(title)}</div><div class="text-xs text-ink-faint">${detail}</div></div>`;
    return el;
  }

  async function loadChecks() {
    list.innerHTML =
      '<div class="flex items-center gap-2 py-6 text-sm text-ink-faint"><span class="size-4 animate-spin rounded-full border-2 border-line border-t-grass-500"></span> Running checks…</div>';
    let checks;
    try {
      const res = await fetch('/setup/checks', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'checks failed');
      checks = data.checks;
      checksLoaded = true;
    } catch (err) {
      list.innerHTML = `<div class="rounded-md border border-danger/40 bg-redstone-500/10 p-3 text-sm text-danger">Could not run checks: ${esc(err.message)}</div>`;
      return;
    }

    list.innerHTML = '';

    // Docker
    const d = checks.docker;
    const dDetail = d.available
      ? `${esc(d.version)} · ${esc(d.os || 'Docker')} · ${d.ncpu ?? '?'} CPUs${gb(d.memTotal) ? ` · ${gb(d.memTotal)} RAM` : ''}`
      : `Not reachable — server create/start/stop stay disabled until Docker is running. The panel works fine meanwhile.${d.installed === false ? ' Docker doesn’t appear to be installed.' : ' Start Docker Desktop, then re-check.'}`;
    list.appendChild(row(d.level, 'Docker', dDetail));

    // Node
    const n = checks.node;
    list.appendChild(
      row(n.level, 'Node.js', `${esc(n.version)}${n.level === 'fail' ? ` — need ${esc(n.required)} or newer` : ''}`)
    );

    // Data dir
    const dd = checks.dataDir;
    list.appendChild(
      row(
        dd.level,
        'Data directory',
        dd.level === 'pass' ? `${esc(dd.path)} — writable` : `${esc(dd.path)} — NOT writable. Fix folder permissions.`
      )
    );

    // Session secret
    const s = checks.sessionSecret;
    const sDetail =
      s.level === 'pass'
        ? 'A strong secret is set (auto-generated and saved to your data dir if you didn’t set SESSION_SECRET). It signs sessions and encrypts stored keys.'
        : 'Weak SESSION_SECRET — use at least 16 random characters, or leave it blank to let the panel generate one. Rotating it later invalidates stored server passwords.';
    list.appendChild(row(s.level, 'Session secret', sDetail));
  }

  // ---- Step 2: create admin ----
  const adminForm = document.getElementById('setup-admin');
  const adminError = document.getElementById('admin-error');
  adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminError.classList.add('hidden');
    const btn = adminForm.querySelector('button[type="submit"]');
    await withBusy(btn, 'Creating…', async () => {
      let data;
      try {
        const res = await fetch('/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('su-user').value.trim(),
            password: document.getElementById('su-pass').value,
          }),
        });
        data = await res.json();
      } catch (err) {
        adminError.textContent = `Network error: ${err.message}`;
        adminError.classList.remove('hidden');
        return;
      }
      if (!data.ok) {
        adminError.textContent = data.error || 'Could not create the account.';
        adminError.classList.remove('hidden');
        return;
      }
      // Admin created and signed in — advance (no going back past this point).
      goTo(3);
    });
  });

  // ---- Step 3: optional config (domain + CurseForge key), both authed now ----
  document.getElementById('su-domain-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const publicHost = document.getElementById('su-domain').value.trim();
    await withBusy(btn, 'Saving…', async () => {
      const data = await post('/api/settings', { publicHost });
      if (data) toast(publicHost ? `Public domain set to ${data.publicHost}.` : 'Public domain cleared.');
    });
  });

  document.getElementById('su-cf-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const key = document.getElementById('su-cf').value.trim();
    if (!key) {
      toast('Paste a CurseForge key first, or skip this.', { kind: 'error' });
      return;
    }
    await withBusy(btn, 'Checking…', async () => {
      const data = await post('/api/keys/curseforge', { key });
      if (data) {
        toast('Key verified with CurseForge and saved (encrypted).');
        document.getElementById('su-cf').value = '';
      }
    });
  });

  // ---- Step 3: time zone & region (auto-detected, editable) ----
  async function loadLocalization() {
    localizationLoaded = true;
    const tzSel = document.getElementById('su-tz');
    const ccSel = document.getElementById('su-country');
    let loc = {
      timezone: '',
      country: '',
      systemTimezone: '',
      systemCountry: '',
      timezoneAuto: true,
      countryAuto: true,
    };
    try {
      const res = await fetch('/api/settings/localization', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (data.ok) loc = data.localization;
    } catch {
      /* fall back to system defaults below */
    }
    fillTimezoneSelect(tzSel, loc.timezoneAuto ? 'auto' : loc.timezone, loc.systemTimezone);
    fillCountrySelect(ccSel, loc.countryAuto ? 'auto' : loc.country, loc.systemCountry);
  }

  document.getElementById('su-loc-save').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await withBusy(btn, 'Saving…', async () => {
      const data = await post('/api/settings/localization', {
        timezone: document.getElementById('su-tz').value,
        country: document.getElementById('su-country').value,
      });
      if (data) toast(`Time zone set to ${data.localization.timezone}.`);
    });
  });

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

  goTo(0);
}
