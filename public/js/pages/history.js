// History tab: crash-report cards (viewer modal, copy trace, download) wired
// via data attributes rendered by history.hbs, plus client-side event filtering
// and captured-log excerpt viewing.

import { openModal } from '../lib/modal.js';
import { toast } from '../lib/toast.js';
import { withBusy } from '../lib/loading.js';

const root = document.querySelector('[data-history-server]');
if (root) init(root.dataset.historyServer);

function init(serverId) {
  // ---- Crash cards -----------------------------------------------------
  for (const card of document.querySelectorAll('[data-crash-card]')) {
    const crash = { id: card.dataset.crashId, filename: card.dataset.crashFile };
    card.querySelectorAll('[data-crash-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Each action fetches the report text first — spin the button meanwhile.
        const action = btn.dataset.crashAction;
        if (action === 'view') withBusy(btn, () => openViewer(serverId, crash, card));
        else if (action === 'copy') withBusy(btn, () => copyTrace(serverId, crash));
        else if (action === 'download') withBusy(btn, () => download(serverId, crash));
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
          if (!res.ok) throw new Error(`Could not load the captured log (${res.status})`);
          const text = await res.text();
          const pre = document.createElement('pre');
          pre.className =
            'console max-h-[65vh] overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed';
          pre.textContent = text || '(empty excerpt)';
          openModal({
            title: 'Captured log excerpt',
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
  if (!res.ok) throw new Error(`Could not load report (${res.status})`);
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

async function openViewer(serverId, crash, card) {
  let text;
  try {
    text = await fetchText(serverId, crash);
  } catch (err) {
    toast(err.message, { kind: 'error' });
    return;
  }

  // Server marked it viewed as a side effect of the text fetch — drop the badge.
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
        label: 'Copy stacktrace',
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

/** Build the highlighted, section-collapsible report view (DOM only — no innerHTML of report text). */
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
      if (isImportant(line)) div.className = 'font-semibold text-redstone-400';
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
    summary.className = 'cursor-pointer select-none font-semibold text-diamond-400';
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
