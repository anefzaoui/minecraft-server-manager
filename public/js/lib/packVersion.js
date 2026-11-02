// Pack version picker: switch a server's modpack to any listed version, newer
// or older, through POST /api/servers/:id/pack/upgrade (pre-update backup,
// rebuild, health-checked boot, rollback offered if it does not come up).
// Shared by the server Overview pack card and the Modpacks details popup.
//
//   GET /api/servers/:id/pack/versions → { current, recorded, mcVersion,
//     versions: [{ id, name, type, mcVersion, mcRelation, current }] }
//   mcRelation 'older' is refused by the server (an older game can't load the
//   world), 'newer' needs allowVersionChange: true (it converts the world).

import { toast } from './toast.js';
import { friendlyError } from './errors.js';
import { confirmDialog } from './confirm.js';
import { runTask } from './progress.js';
import { openModal } from './modal.js';
import { escapeHtml } from './format.js';

/**
 * Open the picker for a server's pack, or (versionId given) go straight to
 * confirming that version. Reloads the page once a switch succeeds.
 */
export async function changePackVersion({ serverId, serverName, versionId = null }) {
  const list = await loadVersions(serverId);
  if (!list) return;
  const picked = versionId ? list.versions.find((v) => v.id === versionId) : await pickVersion(list);
  if (!picked) {
    if (versionId) toast("That version is not in the pack's version list any more.", { kind: 'error' });
    return;
  }
  if (picked.mcRelation === 'older') {
    toast(olderReason(picked, list), { kind: 'error', timeout: 9000 });
    return;
  }
  if (!(await confirmSwitch({ serverName, list, picked }))) return;
  await runSwitch({ serverId, serverName, list, picked, allowVersionChange: picked.mcRelation === 'newer' });
}

async function loadVersions(serverId) {
  const loading = openModal({
    title: 'Loading pack versions…',
    size: 'sm',
    content: '<p class="text-sm text-ink-faint">Fetching the version list from the platform…</p>',
  });
  try {
    const res = await fetch(`/api/servers/${encodeURIComponent(serverId)}/pack/versions`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || friendlyError(res, { action: 'load the pack versions' }));
    return data;
  } catch (err) {
    toast(err.message || friendlyError(null, { action: 'load the pack versions' }), { kind: 'error', timeout: 9000 });
    return null;
  } finally {
    loading.close();
  }
}

function olderReason(v, list) {
  return `${v.name} runs Minecraft ${v.mcVersion}, which is older than this world (${list.mcVersion}). Minecraft cannot load a world on an older version.`;
}

/** The picker modal. Resolves with the chosen version entry, or null. */
function pickVersion(list) {
  return new Promise((resolve) => {
    let chosen = null;
    const content = document.createElement('div');
    content.className = 'space-y-4 text-sm';
    const current = list.current
      ? `<p>Pinned now: <b>${escapeHtml(list.current.name)}</b>${list.mcVersion ? ` on Minecraft ${escapeHtml(list.mcVersion)}` : ''}.</p>`
      : '<p>No pack version is recorded for this server yet. Pick the one it should run, and the panel pins it.</p>';
    content.innerHTML = `
      ${current}
      <div>
        <label class="label" for="pv-version">Pack version</label>
        <select class="input" id="pv-version"></select>
      </div>
      <p class="text-xs text-ink-faint">A backup is taken before the switch. Versions for an older Minecraft version than this world are unavailable, because Minecraft cannot load the world on them.</p>`;

    const sel = content.querySelector('#pv-version');
    for (const v of list.versions) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.name}${v.type && v.type !== 'release' ? ` (${v.type})` : ''}`;
      const notes = [];
      if (v.mcVersion) notes.push(`Minecraft ${v.mcVersion}`);
      if (v.current) notes.push('installed now');
      else if (v.mcRelation === 'newer') notes.push('converts the world');
      else if (v.mcRelation === 'older') notes.push('older than this world');
      if (notes.length) opt.dataset.desc = notes.join(' · ');
      opt.disabled = v.mcRelation === 'older';
      sel.appendChild(opt);
    }
    const first = list.versions.find((v) => !v.current && v.mcRelation !== 'older');
    sel.value = (first || list.versions.find((v) => v.current) || {}).id || '';

    openModal({
      title: `Change ${list.projectName || 'Pack'} Version`,
      content,
      onClose: () => resolve(chosen),
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        {
          label: 'Continue',
          kind: 'primary',
          onClick: () => {
            const v = list.versions.find((x) => x.id === sel.value);
            if (!v || v.current) {
              toast('Pick a version other than the one installed now.', { kind: 'warn' });
              return false;
            }
            chosen = v;
          },
        },
      ],
    });
  });
}

function confirmSwitch({ serverName, list, picked }) {
  const from = list.current ? list.current.name : 'its current version';
  if (picked.mcRelation === 'newer') {
    return confirmDialog({
      title: `Move ${serverName} to Minecraft ${picked.mcVersion}?`,
      message: `${picked.name} runs Minecraft ${picked.mcVersion}, and this world is on ${list.mcVersion}. Starting it converts the world to Minecraft ${picked.mcVersion} for good.`,
      detail:
        'The panel takes an automatic backup first, and that backup is the only way back to the old world. Your custom mods are preserved.',
      confirmLabel: 'Convert and Switch',
      danger: true,
    });
  }
  const currentIndex = list.versions.findIndex((v) => v.current);
  const goingBack = currentIndex !== -1 && list.versions.indexOf(picked) > currentIndex;
  return confirmDialog({
    title: `Switch to ${picked.name}?`,
    message: `${serverName} moves from ${from} to ${picked.name}. The panel takes an automatic backup first, applies the version, and starts the server back up, watching that it comes back healthy.`,
    detail: goingBack
      ? 'Going back to an older pack version can drop blocks and items from mods it does not have. If it does not come up, you can roll back with one click, and the backup stays in the Backups tab.'
      : 'Your custom mods are preserved, and you can roll back with one click if it does not come up. The server is briefly offline during the swap.',
    confirmLabel: 'Switch Version',
  });
}

async function runSwitch({ serverId, serverName, list, picked, allowVersionChange }) {
  try {
    const result = await runTask({
      title: `Switching ${list.projectName || 'the pack'} to ${picked.name}…`,
      start: async () =>
        (
          await postJSON(`/api/servers/${encodeURIComponent(serverId)}/pack/upgrade`, {
            versionId: picked.id,
            allowVersionChange,
          })
        ).taskId,
    });
    if (result && result.requiresVersionConfirm) {
      // The list had no Minecraft version to compare against; the server did.
      const ok = await confirmSwitch({
        serverName,
        list: { ...list, mcVersion: result.fromMcVersion },
        picked: { ...picked, mcVersion: result.toMcVersion, mcRelation: 'newer' },
      });
      if (ok) await runSwitch({ serverId, serverName, list, picked, allowVersionChange: true });
      return;
    }
    if (result && result.ok === false) {
      if (result.rollbackAvailable) await offerRollback(serverId, serverName, result.error);
      else toast(result.error || 'The server did not come back healthy.', { kind: 'error', timeout: 12000 });
      return;
    }
    toast(`Pack version changed: ${result.from} → ${result.to}.`);
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'The version change could not be completed. Please try again.', {
      kind: 'error',
      timeout: 12000,
    });
  }
}

/** After a failed pack switch: restore the pre-update backup and re-pin the previous version. */
export async function offerRollback(serverId, serverName, errorMessage) {
  const ok = await confirmDialog({
    title: 'The new version did not start. Roll back?',
    message: errorMessage || 'The server did not come back healthy after the version change.',
    detail: 'Rolling back restores the automatic pre-update backup and pins the previous pack version.',
    confirmLabel: 'Roll Back',
    danger: true,
  });
  if (!ok) return;
  try {
    const result = await runTask({
      title: `Rolling back ${serverName}…`,
      start: async () => (await postJSON(`/api/servers/${encodeURIComponent(serverId)}/pack/rollback`, {})).taskId,
    });
    toast(`Rolled back to ${result && result.version ? result.version : 'the previous version'}.`);
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    if (err.dismissed) return; // progress hidden - the task tray takes over
    toast(err.message || 'The rollback could not be completed. Please try again.', { kind: 'error', timeout: 12000 });
  }
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || friendlyError(res, { action: 'start that task' }));
  return data;
}
