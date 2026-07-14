// Map tab: enable/disable BlueMap.
import { toast } from '../lib/toast.js';
import { confirmDialog } from '../lib/confirm.js';
import { setBusy } from '../lib/loading.js';

document.addEventListener('click', async (e) => {
  const enableBtn = e.target.closest('[data-map-enable]');
  const disableBtn = e.target.closest('[data-map-disable]');
  if (!enableBtn && !disableBtn) return;
  const id = (enableBtn || disableBtn).dataset.serverId;

  if (enableBtn) {
    const restore = setBusy(enableBtn, 'Installing…');
    toast('Installing BlueMap and allocating the map port…', { kind: 'info' });
    try {
      const res = await fetch(`/api/servers/${id}/map/enable`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast('Live map enabled — restart the server to bring it up.');
        setTimeout(() => location.reload(), 900);
      } else {
        toast(data.error || 'Could not enable the map', { kind: 'error', timeout: 9000 });
      }
    } finally {
      restore();
    }
  } else {
    const ok = await confirmDialog({
      title: 'Disable the live map?',
      message: 'Removes BlueMap from this server. Rendered map tiles stay on disk until you delete them from Files.',
      confirmLabel: 'Disable',
      danger: true,
    });
    if (!ok) return;
    const restore = setBusy(disableBtn, 'Disabling…');
    try {
      const res = await fetch(`/api/servers/${id}/map/disable`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        toast('Map disabled — applies on next restart.');
        setTimeout(() => location.reload(), 900);
      } else {
        toast(data.error || 'Failed', { kind: 'error' });
      }
    } finally {
      restore();
    }
  }
});
