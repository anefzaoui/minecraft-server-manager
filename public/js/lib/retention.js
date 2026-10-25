// Backup retention form, shared by the Settings page card (panel-wide policy)
// and a server's Backups tab (its own limits). Save previews what the new limits
// would remove right now; when that's anything, the admin picks: remove those
// backups now, or keep them until the next backup trims them as usual. Nothing
// is deleted before that choice, and Remove Now deletes only what was shown.
//
// initRetentionForm(form, { previewUrl, saveUrl, applyUrl, scope, onSaved })
//   form:  element holding the [data-retention-key] inputs (each with a short
//          data-name for messages) and a [data-retention-save] button. An input
//          with data-inherit (a server's own limits) may be left blank: it then
//          follows the panel-wide value and is sent as null.
//   scope: 'panel' (default) or 'server', for the dialog's wording.
// Only fields changed since the page loaded are sent, so a stale tab never
// rewrites values someone else saved meanwhile.

import { toast } from './toast.js';
import { friendlyError } from './errors.js';
import { openModal } from './modal.js';
import { setBusy } from './loading.js';
import { fmtBytes } from './format.js';
import { formatDate } from './datetime.js';

async function postJson(url, body, action) {
  let res;
  let data;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    throw new Error(friendlyError(null, { action }));
  }
  if (!res.ok || data.ok === false) throw new Error(data.error || friendlyError(res, { action }));
  return data;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Words for each backup reason, in the order a person cares about them.
const REASONS = [
  ['scheduled', 'scheduled'],
  ['manual', 'manual'],
  ['pre-update', 'pre-update'],
  ['pre-restore', 'safety'],
];
const SHOWN_SERVERS = 8;

/** One line per affected server: what would go, how big, how old, and whether it was over already. */
function breakdownList(byServer = []) {
  const list = document.createElement('ul');
  list.className = 'space-y-1.5 rounded-sm border border-line bg-inset p-2.5 text-xs';
  for (const srv of byServer.slice(0, SHOWN_SERVERS)) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'font-semibold text-ink';
    name.textContent = srv.name;
    const kinds = REASONS.filter(([r]) => srv.byReason[r])
      .map(([r, word]) => `${srv.byReason[r]} ${word}`)
      .join(', ');
    const detail = document.createElement('span');
    detail.className = 'text-ink-soft';
    detail.textContent = `: ${kinds}, ${fmtBytes(srv.bytes)}, oldest from ${formatDate(srv.oldest)}.`;
    li.append(name, detail);
    if (srv.alreadyOver) {
      const note = document.createElement('span');
      note.className = 'block text-ink-faint';
      note.textContent = 'Some of these were already over the limit before this change.';
      li.append(note);
    }
    list.append(li);
  }
  if (byServer.length > SHOWN_SERVERS) {
    const more = document.createElement('li');
    more.className = 'text-ink-faint';
    more.textContent = `And ${plural(byServer.length - SHOWN_SERVERS, 'more server', 'more servers')}.`;
    list.append(more);
  }
  return list;
}

export function initRetentionForm(form, { previewUrl, saveUrl, applyUrl, scope = 'panel', onSaved = () => {} }) {
  const saveBtn = form.querySelector('[data-retention-save]');
  const inputs = [...form.querySelectorAll('[data-retention-key]')];
  const onServer = scope === 'server';

  // What the page rendered (or last saved): only fields that differ are sent.
  const snapshot = () => {
    for (const el of inputs) el.dataset.saved = el.value.trim();
  };
  snapshot();

  // Save stays disabled while the dialog is open AND while one of its actions
  // runs - closing the dialog mid-delete must not re-enable it.
  let dialogOpen = false;
  let working = false;
  const syncSave = () => {
    saveBtn.disabled = dialogOpen || working;
  };

  for (const el of inputs) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!saveBtn.disabled) saveBtn.click();
      }
    });
  }

  /** The changed fields, {} when nothing changed, or null (after saying why) when one is invalid. */
  function collect() {
    const body = {};
    for (const el of inputs) {
      const name = el.dataset.name || 'This value';
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      const canBlank = 'inherit' in el.dataset;
      // A typo like "1-" reads as an empty value; it must not pass as "blank".
      if (el.validity && el.validity.badInput) {
        toast(`${name} must be a whole number from ${min} to ${max}.`, { kind: 'error', timeout: 8000 });
        el.focus();
        return null;
      }
      const raw = el.value.trim();
      if (raw === el.dataset.saved) continue;
      const key = el.dataset.retentionKey;
      if (raw === '' && canBlank) {
        body[key] = null; // follow the panel-wide value
        continue;
      }
      const n = Number(raw);
      if (raw === '' || !Number.isInteger(n) || n < min || n > max) {
        const blank = canBlank ? ', or blank to use the panel-wide value' : '';
        toast(`${name} must be a whole number from ${min} to ${max}${blank}.`, { kind: 'error', timeout: 8000 });
        el.focus();
        return null;
      }
      body[key] = n;
    }
    return body;
  }

  async function save(body) {
    await postJson(saveUrl, body, 'save the retention settings');
    snapshot();
  }

  saveBtn.addEventListener('click', async () => {
    const body = collect();
    if (!body) return;
    if (!Object.keys(body).length) {
      toast('Nothing to save. These are already the saved values.', { kind: 'info' });
      return;
    }
    const restore = setBusy(saveBtn, 'Checking…');
    let preview;
    try {
      preview = await postJson(previewUrl, body, 'check the retention settings');
      if (!preview.backups) {
        await save(body);
        toast('Retention saved. No existing backups are over the new limits.');
        onSaved();
        return;
      }
    } catch (err) {
      toast(err.message, { kind: 'error', timeout: 9000 });
      return;
    } finally {
      restore();
    }
    askHowToApply(body, preview);
  });

  function askHowToApply(body, preview) {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    const lead = document.createElement('p');
    const where = preview.servers > 1 ? ` across ${plural(preview.servers, 'server', 'servers')}` : '';
    lead.textContent = `With these limits, ${plural(preview.backups, 'existing backup is', 'existing backups are')} over the limit${where} (${fmtBytes(preview.bytes)}).`;
    const how = document.createElement('p');
    how.className = 'text-ink-soft';
    how.textContent = onServer
      ? 'Remove Now deletes those backups right away. From Next Backup keeps them for now, and this server trims its backups the next time it makes one, as it always has.'
      : 'Remove Now deletes those backups right away. From Next Backup keeps them for now, and each server trims its backups the next time it makes one, as it always has.';
    content.append(lead, breakdownList(preview.byServer), how);
    const nextTime = onServer
      ? "Retention saved. Older backups are trimmed after this server's next backup."
      : "Retention saved. Older backups are trimmed after each server's next backup.";

    // Runs one dialog action with Save held disabled until it finishes.
    const guarded = (fn) => async () => {
      working = true;
      syncSave();
      try {
        return await fn();
      } finally {
        working = false;
        syncSave();
      }
    };

    dialogOpen = true;
    syncSave();
    openModal({
      title: 'Remove old backups now?',
      content,
      size: 'md', // three actions: sm wraps them onto two rows
      onClose: () => {
        dialogOpen = false;
        syncSave();
      },
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'From Next Backup',
          busyLabel: 'Saving…',
          onClick: guarded(async () => {
            try {
              await save(body);
            } catch (err) {
              toast(err.message, { kind: 'error', timeout: 9000 });
              return false;
            }
            toast(nextTime);
            onSaved();
          }),
        },
        {
          label: 'Remove Now',
          kind: 'danger',
          busyLabel: 'Removing…',
          onClick: guarded(async () => {
            try {
              await save(body);
            } catch (err) {
              toast(err.message, { kind: 'error', timeout: 9000 });
              return false;
            }
            try {
              // Only the backups the preview listed; anything newer waits for the next backup.
              const out = await postJson(applyUrl, { ids: preview.ids }, 'remove the old backups');
              const busy = out.skipped
                ? ` ${plural(out.skipped, 'server was', 'servers were')} busy and will trim after the next backup.`
                : '';
              toast(`Retention saved. ${plural(out.deleted, 'backup', 'backups')} removed.${busy}`);
              onSaved();
            } catch (err) {
              // Saved either way; only the immediate cleanup didn't happen. No
              // onSaved (it may reload the page) so this stays readable.
              toast(`Retention saved, but the old backups were not removed yet. ${err.message}`, {
                kind: 'error',
                timeout: 12000,
              });
            }
          }),
        },
      ],
    });
  }
}
