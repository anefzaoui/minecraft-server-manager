// History tab: crash-report cards (viewer modal, copy trace, download) wired
// via data attributes rendered by history.hbs, plus client-side event filtering
// and captured-log excerpt viewing.

import { openModal } from '../lib/modal.js';
import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { withBusy } from '../lib/loading.js';
import { confirmDialog } from '../lib/confirm.js';

const root = document.querySelector('[data-history-server]');
if (root) init(root.dataset.historyServer);

function init(serverId) {
  // ---- Crash cards -----------------------------------------------------
  for (const card of document.querySelectorAll('[data-crash-card]')) {
    const crash = { id: card.dataset.crashId, filename: card.dataset.crashFile };
    card.querySelectorAll('[data-crash-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Each action fetches the report text first - spin the button meanwhile.
        const action = btn.dataset.crashAction;
        if (action === 'view') withBusy(btn, () => openViewer(serverId, crash, card));
        else if (action === 'copy') withBusy(btn, () => copyTrace(serverId, crash));
        else if (action === 'download') withBusy(btn, () => download(serverId, crash));
        else if (action === 'share') withBusy(btn, () => shareToMclogs(serverId, crash, card));
        else if (action === 'insights') withBusy(btn, () => showInsights(serverId, crash, card));
      });
    });
  }

  // ---- Event list filters ------------------------------------------------
  const search = document.getElementById('hist-search');
  const typeSel = document.getElementById('hist-type');
  const actorSel = document.getElementById('hist-actor');
  const noMatch = document.getElementById('hist-no-match');
  const rows = [...document.querySelectorAll('[data-event-row]')];

  // Populate the type/actor dropdowns from what is actually rendered.
  if (rows.length) {
    const addOptions = (select, values) => {
      if (!select) return;
      for (const v of values) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      }
    };
    addOptions(typeSel, [...new Set(rows.map((r) => r.dataset.type))].sort());
    addOptions(actorSel, [...new Set(rows.map((r) => r.dataset.actor))].sort());
  }

  function applyFilter() {
    const q = (search?.value || '').trim().toLowerCase();
    const type = typeSel?.value || '';
    const actor = actorSel?.value || '';
    let visible = 0;
    for (const row of rows) {
      const show =
        (!q || row.textContent.toLowerCase().includes(q)) &&
        (!type || row.dataset.type === type) &&
        (!actor || row.dataset.actor === actor);
      row.classList.toggle('hidden', !show);
      if (show) visible += 1;
    }
    if (noMatch) noMatch.classList.toggle('hidden', visible > 0 || !rows.length);
  }
  search?.addEventListener('input', applyFilter);
  typeSel?.addEventListener('change', applyFilter);
  actorSel?.addEventListener('change', applyFilter);

  // ---- Captured log excerpts ----------------------------------------------
  document.querySelectorAll('[data-event-log]').forEach((btn) => {
    btn.addEventListener('click', () =>
      withBusy(btn, async () => {
        try {
          const res = await fetch(`/api/events/${btn.dataset.eventId}/excerpt`);
          if (!res.ok) throw new Error(friendlyError(res, { action: 'load the captured log' }));
          const text = await res.text();
          const pre = document.createElement('pre');
          pre.className =
            'console max-h-[65vh] overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed';
          pre.textContent = text || '(empty excerpt)';
          openModal({
            title: 'Captured Log Excerpt',
            size: 'lg',
            content: pre,
            actions: [
              {
                label: 'Copy',
                kind: 'ghost',
                onClick: () => {
                  copyToClipboard(text, 'Excerpt copied to clipboard.');
                  return false;
                },
              },
              { label: 'Close', kind: 'primary' },
            ],
          });
        } catch (err) {
          toast(err.message, { kind: 'error' });
        }
      })
    );
  });
}

async function fetchText(serverId, crash) {
  const res = await fetch(`/api/servers/${serverId}/crashes/${crash.id}/text`);
  if (!res.ok) throw new Error(friendlyError(res, { action: 'load that crash report' }));
  return res.text();
}

async function copyToClipboard(text, message) {
  if (await window.CD.copyText(text)) toast(message);
}

/** First stacktrace block: the throwable line plus its at/Caused by frames. */
function extractTrace(text) {
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex((l) => /^\s+at\s/.test(l));
  if (first === -1) return text.slice(0, 4000);
  const start = first > 0 && /^\S/.test(lines[first - 1]) ? first - 1 : first;
  let end = first;
  while (end < lines.length && /^(\s+(at\s|\.\.\.)|Caused by:|\s*$)/.test(lines[end])) {
    if (!lines[end].trim() && end + 1 < lines.length && !/^(\s+(at\s|\.\.\.)|Caused by:)/.test(lines[end + 1])) break;
    end++;
  }
  return lines.slice(start, end).join('\n').trimEnd();
}

async function copyTrace(serverId, crash) {
  try {
    await copyToClipboard(extractTrace(await fetchText(serverId, crash)), 'Stack trace copied to clipboard.');
  } catch (err) {
    toast(err.message, { kind: 'error' });
  }
}

async function download(serverId, crash, preloaded) {
  try {
    const text = preloaded || (await fetchText(serverId, crash));
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = crash.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    toast(err.message, { kind: 'error' });
  }
}

// ---- mclo.gs sharing + insights (both PUBLISH the report - always confirmed) ----

/** Swap the Share button for a permanent paste link once a report is shared. */
function markShared(card, url) {
  if (!card || card.dataset.crashMclogs) return;
  card.dataset.crashMclogs = url;
  const shareBtn = card.querySelector('[data-crash-action="share"]');
  if (shareBtn) {
    const a = document.createElement('a');
    a.className = 'btn btn-ghost btn-sm';
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = url;
    a.textContent = 'mclo.gs paste';
    shareBtn.replaceWith(a);
  }
}

async function confirmPublish(crash, { analyzing = false } = {}) {
  return confirmDialog({
    title: analyzing ? 'Analyze with mclo.gs?' : 'Share to mclo.gs?',
    message: `${crash.filename} will be uploaded to mclo.gs as a PUBLIC paste - anyone with the link can read it.`,
    detail: analyzing
      ? "mclo.gs then runs its automated analysis (known problems + suggested fixes) over the paste. Crash reports can include player names and mod lists - don't share what you wouldn't post on a forum."
      : "Mod authors and support channels usually ask for exactly this link. Crash reports can include player names and mod lists - don't share what you wouldn't post on a forum.",
    confirmLabel: analyzing ? 'Publish & analyze' : 'Publish paste',
  });
}

async function shareToMclogs(serverId, crash, card) {
  if (!(await confirmPublish(crash))) return;
  try {
    const res = await fetch(`/api/servers/${serverId}/crashes/${crash.id}/share`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'share that crash report' }));
    markShared(card, data.url);
    await copyToClipboard(data.url, `Shared: ${data.url} (copied to clipboard)`);
  } catch (err) {
    toast(err.message, { kind: 'error', timeout: 9000 });
  }
}

async function showInsights(serverId, crash, card) {
  const alreadyShared = Boolean(card && card.dataset.crashMclogs);
  if (!alreadyShared && !(await confirmPublish(crash, { analyzing: true }))) return;
  let data;
  try {
    const res = await fetch(`/api/servers/${serverId}/crashes/${crash.id}/insights`, { method: 'POST' });
    data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'analyze that crash report' }));
  } catch (err) {
    toast(err.message, { kind: 'error', timeout: 9000 });
    return;
  }
  const ins = data.insights;
  markShared(card, ins.url);

  const content = document.createElement('div');
  content.className = 'space-y-3 text-sm';
  const meta = document.createElement('p');
  meta.className = 'text-xs text-ink-faint';
  meta.textContent = [ins.type, ins.version].filter(Boolean).join(' · ') || 'Automated analysis by mclo.gs';
  content.appendChild(meta);

  if (!ins.problems.length) {
    const p = document.createElement('p');
    p.className = 'text-ink-soft';
    p.textContent =
      'mclo.gs found no known problems in this report. The paste link below is still handy for support channels.';
    content.appendChild(p);
  }
  for (const problem of ins.problems) {
    const box = document.createElement('div');
    box.className = 'rounded-md border border-warn/40 bg-raised p-2.5';
    const title = document.createElement('div');
    title.className = 'font-medium text-warn';
    title.textContent = problem.message + (problem.counter > 1 ? ` (×${problem.counter})` : '');
    box.appendChild(title);
    for (const s of problem.solutions) {
      const li = document.createElement('div');
      li.className = 'mt-1 pl-3 text-xs text-ink-soft';
      li.textContent = `→ ${s}`;
      box.appendChild(li);
    }
    content.appendChild(box);
  }
  if (ins.information.length) {
    const dl = document.createElement('div');
    dl.className = 'grid gap-x-4 gap-y-0.5 text-xs text-ink-faint sm:grid-cols-2';
    for (const i of ins.information) {
      const row = document.createElement('div');
      row.textContent = `${i.label}: ${i.value}`;
      dl.appendChild(row);
    }
    content.appendChild(dl);
  }

  openModal({
    title: ins.title || 'mclo.gs analysis',
    size: 'lg',
    content,
    actions: [
      {
        label: 'Open paste',
        kind: 'ghost',
        onClick: () => {
          window.open(ins.url, '_blank', 'noopener');
          return false;
        },
      },
      { label: 'Close', kind: 'primary' },
    ],
  });
}

async function openViewer(serverId, crash, card) {
  let text;
  try {
    text = await fetchText(serverId, crash);
  } catch (err) {
    toast(err.message, { kind: 'error' });
    return;
  }

  // Server marked it viewed as a side effect of the text fetch - drop the badge.
  card?.querySelectorAll('.badge').forEach((b) => {
    if (b.textContent.trim() === 'new') b.remove();
  });

  openModal({
    title: crash.filename,
    size: 'lg',
    content: renderReport(text),
    actions: [
      {
        label: 'Copy full report',
        kind: 'ghost',
        onClick: () => {
          copyToClipboard(text, 'Full report copied to clipboard.');
          return false;
        },
      },
      {
        label: 'Copy stack trace',
        kind: 'ghost',
        onClick: () => {
          copyToClipboard(extractTrace(text), 'Stack trace copied to clipboard.');
          return false;
        },
      },
      {
        label: 'Download',
        kind: 'primary',
        onClick: () => {
          download(serverId, crash, text);
          return false;
        },
      },
    ],
  });
}

/** Build the highlighted, section-collapsible report view (DOM only - no innerHTML of report text). */
function renderReport(text) {
  const isSectionStart = (l) => /^--\s.+\s--$/.test(l.trim()) || /^A detailed walkthrough/.test(l);
  const lines = text.split(/\r?\n/);

  // Split into head + sections
  const sections = [];
  let current = { title: null, lines: [] };
  for (const line of lines) {
    if (isSectionStart(line)) {
      sections.push(current);
      current = { title: line.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  const wrap = document.createElement('div');
  const pre = document.createElement('pre');
  pre.className = 'console max-h-[65vh] overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed';

  const isImportant = (l) => /^Description:/.test(l) || /^\S[\w.$ ]*(Exception|Error)(:|\b)/.test(l);
  const appendLines = (parent, sectionLines) => {
    for (const line of sectionLines) {
      const div = document.createElement('div');
      if (isImportant(line)) div.className = 'font-semibold text-danger';
      div.textContent = line || ' ';
      parent.appendChild(div);
    }
  };

  for (const s of sections) {
    if (s.title === null) {
      appendLines(pre, s.lines); // head block, always visible
      continue;
    }
    const details = document.createElement('details');
    // The huge system-details / walkthrough blocks start collapsed.
    details.open = !/System Details|detailed walkthrough/i.test(s.title);
    const summary = document.createElement('summary');
    summary.className = 'cursor-pointer select-none font-semibold text-link';
    summary.textContent = s.title;
    details.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'pl-3';
    appendLines(body, s.lines);
    details.appendChild(body);
    pre.appendChild(details);
  }

  wrap.appendChild(pre);
  return wrap;
}
