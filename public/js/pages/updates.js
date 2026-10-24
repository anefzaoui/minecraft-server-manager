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
//   Any row: Ignore / Un-ignore via POST /api/updates/ignore ({subjectType,
//   serverId, contentId?, ignore}) - an ignored row stays visible but greyed.

import { toast } from '../lib/toast.js';
import { friendlyError } from '../lib/errors.js';
import { confirmDialog } from '../lib/confirm.js';
import { runTask } from '../lib/progress.js';
import { withBusy } from '../lib/loading.js';
import { t } from '../lib/i18n.js';

document.getElementById('updates-check-all')?.addEventListener('click', async () => {
  try {
    const result = await runTask({
      title: t('updates_page.checking_title'),
      start: async () => (await postJSON('/api/updates/check', {})).taskId,
    });
    const n = result && result.findings ? result.findings.length : 0;
    toast(n ? t('updates_page.check_finished_count', { count: n }) : t('updates_page.check_finished_none'));
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || t('updates_page.check_failed_toast'), {
      kind: 'error',
      timeout: 9000,
    });
  }
});

document.getElementById('updates-table')?.addEventListener('click', async (e) => {
  const ignoreBtn = e.target.closest('[data-update-ignore], [data-update-unignore]');
  if (ignoreBtn) {
    const row = ignoreBtn.closest('[data-update-row]');
    if (row) await toggleIgnore(row, ignoreBtn, ignoreBtn.hasAttribute('data-update-ignore'));
    return;
  }
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

// Drop a row once its update has been applied - the entry is no longer pending.
// When it was the last one, reload so the "everything up to date" empty state
// renders in place of the now-empty table.
function dropUpdateRow(row) {
  const tbody = row.closest('tbody');
  row.remove();
  if (tbody && !tbody.querySelector('[data-update-row]')) setTimeout(() => location.reload(), 900);
}

// Ignore / un-ignore one row. subjectType tells the API which store to use
// (content → per-mod flag, everything else → update_checks.ignored_version).
async function toggleIgnore(row, btn, ignore) {
  const { serverId, subjectType, contentId, subject, latest } = row.dataset;
  try {
    await withBusy(btn, ignore ? t('updates_page.ignoring_btn') : t('updates_page.unignoring_btn'), () =>
      postJSON('/api/updates/ignore', {
        subjectType: subjectType || (contentId ? 'content' : ''),
        serverId,
        contentId: contentId || undefined,
        ignore,
      })
    );
    toast(
      ignore ? t('updates_page.ignore_toast', { latest, subject }) : t('updates_page.unignore_toast', { subject }),
      { kind: 'success' }
    );
    setTimeout(() => location.reload(), 700);
  } catch (err) {
    toast(err.message || friendlyError(err), { kind: 'error', timeout: 9000 });
  }
}

async function upgradePack(row, { serverId, serverName, subject, current, latest, versionId }) {
  const ok = await confirmDialog({
    title: t('updates_page.upgrade_pack_title', { subject }),
    message: t('updates_page.upgrade_pack_msg', { server: serverName, current, latest }),
    detail: t('updates_page.upgrade_pack_detail'),
    confirmLabel: t('updates_page.upgrade_now_btn'),
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: t('updates_page.upgrading_pack_title', { subject, server: serverName }),
      start: async () => (await postJSON(`/api/servers/${serverId}/pack/upgrade`, { versionId })).taskId,
    });
    if (result && result.ok === false) {
      await offerRollback(serverId, serverName, result.error);
      return;
    }
    toast(t('updates_page.upgraded_toast', { from: result.from, to: result.to }));
    dropUpdateRow(row);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || t('updates_page.upgrade_failed_toast'), { kind: 'error', timeout: 12000 });
  }
}

async function offerRollback(serverId, serverName, errorMessage) {
  const ok = await confirmDialog({
    title: t('updates_page.rollback_title'),
    message: errorMessage || t('updates_page.rollback_default_msg'),
    detail: t('updates_page.rollback_detail'),
    confirmLabel: t('updates_page.rollback_btn'),
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: t('updates_page.rolling_back_title', { server: serverName }),
      start: async () => (await postJSON(`/api/servers/${serverId}/pack/rollback`, {})).taskId,
    });
    toast(t('updates_page.rolled_back_toast', { version: (result && result.version) || 'the previous version' }));
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || t('updates_page.rollback_failed_toast'), { kind: 'error', timeout: 12000 });
  }
}

async function upgradeMod(row, btn, { serverId, subject, current, latest, contentId }) {
  const ok = await confirmDialog({
    title: t('updates_page.update_mod_title', { subject }),
    message: t('updates_page.update_mod_msg', { current, latest }),
    confirmLabel: t('updates_page.update_mod_btn'),
  });
  if (!ok) return;
  toast(t('updates_page.updating_mod_toast', { subject }), { kind: 'info' });
  try {
    await withBusy(btn, t('common.loading'), async () => {
      const data = await postJSON(`/api/servers/${serverId}/mods/update`, { contentId });
      toast(
        t('updates_page.mod_updated_toast', { name: data.installed.name, version: data.installed.version || latest })
      );
      dropUpdateRow(row);
    });
  } catch (err) {
    toast(err.message || t('updates_page.mod_update_failed_toast'), { kind: 'error', timeout: 9000 });
  }
}

async function upgradeImage(row, { serverId, serverName, current, latest }) {
  const ok = await confirmDialog({
    title: t('updates_page.update_image_title'),
    message: t('updates_page.update_image_msg', { server: serverName, current, latest }),
    detail: t('updates_page.update_image_detail'),
    confirmLabel: t('updates_page.upgrade_now_btn'),
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: t('updates_page.updating_image_title', { server: serverName }),
      start: async () => (await postJSON(`/api/servers/${serverId}/image/upgrade`, {})).taskId,
    });
    if (result && result.ok === false) {
      toast(result.error || t('updates_page.image_update_failed_toast'), {
        kind: 'error',
        timeout: 12000,
      });
      return;
    }
    toast(t('updates_page.image_updated_toast'));
    dropUpdateRow(row);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || t('updates_page.image_update_failed_toast'), {
      kind: 'error',
      timeout: 12000,
    });
  }
}

async function upgradeMcVersion(row, { serverId, serverName, current, latest, targetVersion, targetBuild, envKey }) {
  const message = targetVersion
    ? t('updates_page.update_mc_msg', { server: serverName, current, latest })
    : t('updates_page.update_loader_msg', { server: serverName, current, latest });
  const ok = await confirmDialog({
    title: targetVersion ? t('updates_page.update_mc_title') : t('updates_page.update_loader_title'),
    message,
    detail: t('updates_page.update_rebuild_detail'),
    confirmLabel: t('updates_page.upgrade_now_btn'),
  });
  if (!ok) return;
  await runMcUpgrade(row, { serverId, serverName, targetVersion, targetBuild, envKey });
}

async function runMcUpgrade(row, { serverId, serverName, targetVersion, targetBuild, envKey, force = false }) {
  try {
    const result = await runTask({
      title: t('updates_page.updating_server_title', { server: serverName }),
      start: async () =>
        (
          await postJSON(`/api/servers/${serverId}/mcversion/upgrade`, {
            targetVersion: targetVersion || undefined,
            targetLoaderBuild: targetBuild || undefined,
            envKey: targetBuild ? envKey : undefined,
            force: force || undefined,
          })
        ).taskId,
    });
    toast(t('updates_page.server_updated_toast', { from: result.from, to: result.to }));
    dropUpdateRow(row);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    const compat = err.data && err.data.compat;
    if (compat && !force) {
      return offerForce(row, { serverId, serverName, targetVersion, targetBuild, envKey }, compat, err.message);
    }
    toast(err.message || t('updates_page.image_update_failed_toast'), { kind: 'error', timeout: 12000 });
  }
}

/**
 * The mods can't follow this Minecraft version. Name them, point at the
 * server's own Versions tab, and let the update through only on a second,
 * explicit confirmation.
 */
async function offerForce(row, ctx, compat, message) {
  const names = (compat.missing || []).map((m) => m.name || m.file);
  const shown = names.slice(0, 8).join(', ');
  const rest = names.length > 8 ? ` and ${names.length - 8} more` : '';
  const detail = names.length
    ? t('updates_page.force_missing_detail', { target: compat.targetVersion, mods: `${shown}${rest}` })
    : t('updates_page.force_check_versions_detail');
  // Two different situations, and calling them both "your mods are not ready"
  // would be wrong: one is a known incompatibility, the other is the panel not
  // knowing yet.
  const known = compat.reason === 'blocked';
  const ok = await confirmDialog({
    title: known ? t('updates_page.force_mods_title') : t('updates_page.force_uncheck_title'),
    message: known ? t('updates_page.force_mods_msg', { message }) : t('updates_page.force_uncheck_msg', { message }),
    detail,
    confirmLabel: t('updates_page.update_anyway_btn'),
    danger: true,
  });
  if (!ok) return;
  await runMcUpgrade(row, { ...ctx, force: true });
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || friendlyError(res, { action: t('updates_page.action_update') }));
    // Structured refusals (e.g. a Minecraft version the mods can't follow)
    // carry their detail in the body - keep it for the caller to render.
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}
