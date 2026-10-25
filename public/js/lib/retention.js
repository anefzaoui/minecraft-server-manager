// Backup retention form, shared by the Settings page card (panel-wide policy)
// and a server's Backups tab (its override). Save previews what the new limits
// would remove right now; when that's anything, the admin picks: remove those
// backups now, or keep them until each server's next backup trims them as
// usual. Nothing is deleted before that choice.
//
// initRetentionForm(form, { previewUrl, saveUrl, applyUrl, override, onSaved })
//   form: element holding the [data-retention-key] inputs inside [data-retention-fields],
//         a [data-retention-save] button and an optional [data-retention-inherit] note.
//   override: on a server, its "own limits" checkbox (unchecked = follow the
//         panel default, sent as { reset: true }).

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

export function initRetentionForm(form, { previewUrl, saveUrl, applyUrl, override = null, onSaved = () => {} }) {
  const saveBtn = form.querySelector('[data-retention-save]');
  const fields = form.querySelector('[data-retention-fields]');
  const inherit = form.querySelector('[data-retention-inherit]');

  const syncOverride = () => {
    if (!override) return;
    fields?.toggleAttribute('hidden', !override.checked);
    inherit?.toggleAttribute('hidden', override.checked);
  };
  override?.addEventListener('change', syncOverride);
  syncOverride();

  /** The request body, or null (after saying why) when a field is out of range. */
  function collect() {
    if (override && !override.checked) return { reset: true };
    const body = {};
    for (const el of form.querySelectorAll('[data-retention-key]')) {
      const n = Number(el.value);
      const min = Number(el.dataset.min);
      const max = Number(el.dataset.max);
      if (el.value.trim() === '' || !Number.isInteger(n) || n < min || n > max) {
        const label = form.querySelector(`label[for="${el.id}"]`)?.textContent || 'This field';
        toast(`${label} must be a whole number from ${min} to ${max}.`, { kind: 'error', timeout: 8000 });
        el.focus();
        return null;
      }
      body[el.dataset.retentionKey] = n;
    }
    return body;
  }

  async function save(body) {
    await postJson(saveUrl, body, 'save the retention settings');
  }

  saveBtn.addEventListener('click', async () => {
    const body = collect();
    if (!body) return;
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
    how.textContent =
      'Remove Now deletes them right away. From Next Backup keeps them for now, and each server trims its backups the next time it makes one, as it always has.';
    content.append(lead, how);
    openModal({
      title: 'Remove old backups now?',
      content,
      size: 'md', // three actions: sm wraps them onto two rows
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'From Next Backup',
          busyLabel: 'Saving…',
          onClick: async () => {
            try {
              await save(body);
            } catch (err) {
              toast(err.message, { kind: 'error', timeout: 9000 });
              return false;
            }
            toast("Retention saved. Older backups are trimmed after each server's next backup.");
            onSaved();
          },
        },
        {
          label: 'Remove Now',
          kind: 'danger',
          busyLabel: 'Removing…',
          onClick: async () => {
            try {
              await save(body);
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
            } catch (err) {
              // Saved either way; only the immediate cleanup didn't happen.
              toast(`Retention saved, but the old backups were not removed yet. ${err.message}`, {
                kind: 'error',
                timeout: 12000,
              });
            }
            onSaved();
          },
        },
      ],
    });
  }
}
