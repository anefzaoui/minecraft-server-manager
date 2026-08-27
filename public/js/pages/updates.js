// Updates page: Check-all (task-backed) + per-row upgrades.
//   Pack rows (data-version-id): safe upgrade flow via POST
//   /api/servers/:id/pack/upgrade → {taskId}; a failure that left a rollback
//   path RESOLVES the task with {ok:false, rollbackAvailable:true} so we can
//   offer one-click rollback.
//   Overlay-mod/datapack/resourcepack/plugin rows (data-content-id): POST
//   /api/servers/:id/mods/update.
//   Docker image rows (data-image-upgrade): POST /api/servers/:id/image/upgrade.
//   Standalone MC-version/loader-build rows (data-target-version and/or
//   data-target-build): POST /api/servers/:id/mcversion/upgrade.

import { toast } from '../lib/toast.js';
import { confirmDialog } from '../lib/confirm.js';
import { runTask } from '../lib/progress.js';
import { withBusy } from '../lib/loading.js';

document.getElementById('updates-check-all')?.addEventListener('click', async () => {
  try {
    const result = await runTask({
      title: 'Checking for Updates',
      start: async () => (await postJSON('/api/updates/check', {})).taskId,
    });
    const n = result && result.findings ? result.findings.length : 0;
    toast(
      n
        ? `Update check finished: ${n} ${n === 1 ? 'update' : 'updates'} available.`
        : 'Update check finished: everything up to date.'
    );
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'Update check failed', { kind: 'error', timeout: 9000 });
  }
});

document.getElementById('updates-table')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-update-upgrade]');
  if (!btn) return;
  const row = btn.closest('[data-update-row]');
  if (!row) return;
  const {
    serverId,
    serverName,
    subject,
    current,
    latest,
    versionId,
    contentId,
    imageUpgrade,
    targetVersion,
    targetBuild,
    envKey,
  } = row.dataset;

  if (versionId) {
    await upgradePack(row, { serverId, serverName, subject, current, latest, versionId });
  } else if (contentId) {
    await upgradeMod(row, btn, { serverId, subject, current, latest, contentId });
  } else if (imageUpgrade) {
    await upgradeImage(row, { serverId, serverName, current, latest });
  } else if (targetVersion || targetBuild) {
    await upgradeMcVersion(row, { serverId, serverName, current, latest, targetVersion, targetBuild, envKey });
  }
});

async function upgradePack(row, { serverId, serverName, subject, current, latest, versionId }) {
  const ok = await confirmDialog({
    title: `Upgrade ${subject}?`,
    message: `${serverName}: ${current} → ${latest}. Safe flow: pre-update backup → stop → re-pin → recreate → start → monitor. If the server does not come up healthy you get one-click rollback.`,
    detail: 'Your custom mods are preserved. The server is briefly offline during the swap.',
    confirmLabel: 'Upgrade now',
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: `Upgrading ${subject} on ${serverName}`,
      start: async () => (await postJSON(`/api/servers/${serverId}/pack/upgrade`, { versionId })).taskId,
    });
    if (result && result.ok === false) {
      await offerRollback(serverId, serverName, result.error);
      return;
    }
    toast(`Upgraded: ${result.from} → ${result.to}.`);
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'Upgrade failed', { kind: 'error', timeout: 12000 });
  }
}

async function offerRollback(serverId, serverName, errorMessage) {
  const ok = await confirmDialog({
    title: 'Upgrade Failed - Roll Back?',
    message: errorMessage || 'The server did not come up healthy after the upgrade.',
    detail: 'Rollback restores the pre-update backup and re-pins the previous pack version.',
    confirmLabel: 'Roll back',
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: `Rolling Back ${serverName}`,
      start: async () => (await postJSON(`/api/servers/${serverId}/pack/rollback`, {})).taskId,
    });
    toast(`Rolled back to ${result && result.version ? result.version : 'the previous version'}.`);
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'Rollback failed', { kind: 'error', timeout: 12000 });
  }
}

async function upgradeMod(row, btn, { serverId, subject, current, latest, contentId }) {
  const ok = await confirmDialog({
    title: `Update ${subject}?`,
    message: `${current} → ${latest}. The old file is replaced; enabled/disabled state is preserved.`,
    confirmLabel: 'Update mod',
  });
  if (!ok) return;
  toast(`Updating ${subject}…`, { kind: 'info' });
  try {
    await withBusy(btn, 'Updating…', async () => {
      const data = await postJSON(`/api/servers/${serverId}/mods/update`, { contentId });
      toast(`${data.installed.name} updated to ${data.installed.version || latest}.`);
      const tbody = row.closest('tbody');
      row.remove();
      // Last row gone → re-render for the "everything up to date" empty state.
      if (tbody && !tbody.querySelector('[data-update-row]')) setTimeout(() => location.reload(), 900);
    });
  } catch (err) {
    toast(err.message || 'Mod update failed', { kind: 'error', timeout: 9000 });
  }
}

async function upgradeImage(row, { serverId, serverName, current, latest }) {
  const ok = await confirmDialog({
    title: 'Update Container Image?',
    message: `${serverName}: ${current} → ${latest}. Recreates the container with the newer image.`,
    detail: 'Your world and files are untouched - only the container is swapped. The server is briefly offline.',
    confirmLabel: 'Update now',
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: `Updating Container Image on ${serverName}`,
      start: async () => (await postJSON(`/api/servers/${serverId}/image/upgrade`, {})).taskId,
    });
    if (result && result.ok === false) {
      toast(result.error || 'Image update failed', { kind: 'error', timeout: 12000 });
      return;
    }
    toast('Container image updated.');
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'Image update failed', { kind: 'error', timeout: 12000 });
  }
}

async function upgradeMcVersion(row, { serverId, serverName, current, latest, targetVersion, targetBuild, envKey }) {
  const message = targetVersion
    ? `${serverName}: Minecraft ${current} → ${latest}. A backup is taken first - the world upgrade is permanent.`
    : `${serverName}: ${current} → ${latest}. Recreates the container with the new build.`;
  const ok = await confirmDialog({
    title: targetVersion ? 'Update Minecraft Version?' : 'Update Loader Build?',
    message,
    detail: 'The server is briefly offline while it recreates.',
    confirmLabel: 'Update now',
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: `Updating ${serverName}`,
      start: async () =>
        (
          await postJSON(`/api/servers/${serverId}/mcversion/upgrade`, {
            targetVersion: targetVersion || undefined,
            targetLoaderBuild: targetBuild || undefined,
            envKey: targetBuild ? envKey : undefined,
          })
        ).taskId,
    });
    toast(`Updated: ${result.from} → ${result.to}.`);
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'Update failed', { kind: 'error', timeout: 12000 });
  }
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
