// Backup retention form, shared by the Settings page card (panel-wide policy)
// and a server's Backups tab (its own limits). Save previews what the new limits
// would remove right now; when that's anything, the admin picks: remove those
// backups now, or keep them until the next backup trims them as usual. Nothing
// is deleted before that choice.
//
// initRetentionForm(form, { previewUrl, saveUrl, applyUrl, scope, onSaved })
//   form:  element holding the [data-retention-key] inputs and a
//          [data-retention-save] button. An input with data-inherit (a server's
//          own limits) may be left blank: it then follows the panel-wide value
//          and is sent as null.
//   scope: 'panel' (default) or 'server', for the dialog's wording.

import { toast } from './toast.js';
import { friendlyError } from './errors.js';
import { openModal } from './modal.js';
import { setBusy } from './loading.js';
import { fmtBytes } from './format.js';

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

export function initRetentionForm(form, { previewUrl, saveUrl, applyUrl, scope = 'panel', onSaved = () => {} }) {
  const saveBtn = form.querySelector('[data-retention-save]');
  const onServer = scope === 'server';

  /** The request body, or null (after saying why) when a field is out of range. */
  function collect() {
    const body = {};
    for (const el of form.querySelectorAll('[data-retention-key]')) {
      const key = el.dataset.retentionKey;
      if (el.value.trim() === '' && 'inherit' in el.dataset) {
        body[key] = null; // follow the panel-wide value
        continue;
      }
      const n = Number(el.value);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      if (el.value.trim() === '' || !Number.isInteger(n) || n < min || n > max) {
        const label = form.querySelector(`label[for="${el.id}"]`)?.textContent || 'This field';
        const blank = 'inherit' in el.dataset ? ', or blank to use the panel value' : '';
        toast(`${label} must be a whole number from ${min} to ${max}${blank}.`, { kind: 'error', timeout: 8000 });
        el.focus();
        return null;
      }
      body[key] = n;
    }
    return body;
  }

  saveBtn.addEventListener('click', async () => {
    const body = collect();
    if (!body) return;
    const restore = setBusy(saveBtn, 'Checking…');
    let preview;
    try {
      preview = await postJson(previewUrl, body, 'check the retention settings');
      if (!preview.backups) {
        await postJson(saveUrl, body, 'save the retention settings');
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
    // Disabled until the dialog closes, so a second click can't stack another.
    saveBtn.disabled = true;
    askHowToApply(body, preview, () => {
      saveBtn.disabled = false;
    });
  });

  function askHowToApply(body, preview, onClose) {
    const content = document.createElement('div');
    content.className = 'space-y-3 text-sm';
    const lead = document.createElement('p');
    const where = preview.servers > 1 ? ` across ${plural(preview.servers, 'server', 'servers')}` : '';
    lead.textContent = `With these limits, ${plural(preview.backups, 'existing backup is', 'existing backups are')} over the limit${where} (${fmtBytes(preview.bytes)}).`;
    const how = document.createElement('p');
    how.className = 'text-ink-soft';
    how.textContent = onServer
      ? 'Remove Now deletes them right away. From Next Backup keeps them for now, and this server trims its backups the next time it makes one, as it always has.'
      : 'Remove Now deletes them right away. From Next Backup keeps them for now, and each server trims its backups the next time it makes one, as it always has.';
    content.append(lead, how);
    const nextTime = onServer
      ? "Retention saved. Older backups are trimmed after this server's next backup."
      : "Retention saved. Older backups are trimmed after each server's next backup.";

    openModal({
      title: 'Remove old backups now?',
      content,
      size: 'md', // three actions: sm wraps them onto two rows
      onClose,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'From Next Backup',
          busyLabel: 'Saving…',
          onClick: async () => {
            try {
              await postJson(saveUrl, body, 'save the retention settings');
            } catch (err) {
              toast(err.message, { kind: 'error', timeout: 9000 });
              return false;
            }
            toast(nextTime);
            onSaved();
          },
        },
        {
          label: 'Remove Now',
          kind: 'danger',
          busyLabel: 'Removing…',
          onClick: async () => {
            try {
              await postJson(saveUrl, body, 'save the retention settings');
            } catch (err) {
              toast(err.message, { kind: 'error', timeout: 9000 });
              return false;
            }
            try {
              const out = await postJson(applyUrl, {}, 'remove the old backups');
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
          },
        },
      ],
    });
  }
}
