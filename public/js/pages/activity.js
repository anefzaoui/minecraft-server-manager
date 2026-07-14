// Activity page: filter selects auto-apply, excerpt viewer modal.
// Pagination and exports are plain links rendered server-side.

import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { setBusy } from '../lib/loading.js';

const form = document.getElementById('activity-filters');
if (form) {
  // Changing a filter select applies immediately (search still uses Apply/Enter).
  form.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('change', () => form.submit());
  });
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-event-excerpt]');
  if (!btn) return;
  const id = btn.dataset.eventId;
  const restore = setBusy(btn); // icon-sized button — spinner only
  try {
    const res = await fetch(`/api/events/${id}/excerpt`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `No captured log (${res.status})`);
    }
    const text = await res.text();
    const content = document.createElement('div');
    const pre = document.createElement('pre');
    pre.className = 'console max-h-[60vh] overflow-y-auto whitespace-pre-wrap p-3 text-[11px] leading-relaxed';
    pre.textContent = text;
    content.appendChild(pre);
    openModal({
      title: `Captured log — ${btn.dataset.eventType || `event #${id}`}`,
      content,
      size: 'lg',
      actions: [{ label: 'Close', kind: 'ghost' }],
    });
  } catch (err) {
    toast(err.message, { kind: 'error', timeout: 8000 });
  } finally {
    restore();
  }
});
