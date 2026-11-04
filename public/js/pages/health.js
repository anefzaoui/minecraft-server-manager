// Health page: dismiss one alert or clear them all. Dismissals are per user and
// never delete history. The page is server-rendered, so after any change it
// reloads to pick up the new counts, empty state, and any alerts beyond the
// first page.

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { withBusy } from '../lib/loading.js';

const page = document.getElementById('health-page');
if (page) init();

async function post(url, action) {
  try {
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok !== false) return true;
    toast(data.error || friendlyError(res, { action }), { kind: 'error' });
  } catch (err) {
    toast(friendlyError(err, { action }), { kind: 'error' });
  }
  return false;
}

function init() {
  page.addEventListener('click', (e) => {
    const clear = e.target.closest('[data-clear-all]');
    if (clear) {
      withBusy(clear, async () => {
        if (await post('/api/alerts/clear', 'clear the alerts')) location.reload();
      });
      return;
    }
    const dismiss = e.target.closest('[data-dismiss]');
    if (dismiss) {
      const id = dismiss.closest('[data-alert-id]').dataset.alertId;
      withBusy(dismiss, async () => {
        if (await post(`/api/alerts/${id}/dismiss`, 'dismiss that alert')) location.reload();
      });
    }
  });
}
