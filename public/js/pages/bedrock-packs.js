import { toast } from '../lib/toast.js';
import { openModal } from '../lib/modal.js';
import { confirmDialog } from '../lib/confirm.js';

const root = document.querySelector('[data-bedrock-packs-server]');
if (root) {
  const serverId = root.dataset.bedrockPacksServer;
  document.querySelector('[data-bedrock-pack-upload]')?.addEventListener('click', () => upload(serverId));
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-bedrock-pack-remove]');
    if (!button) return;
    const row = button.closest('[data-bedrock-pack]');
    if (
      !(await confirmDialog({
        title: 'Remove Bedrock pack?',
        message: 'This removes the pack from the server. Restart the server to apply the change.',
        confirmLabel: 'Remove',
        danger: true,
      }))
    )
      return;
    const response = await fetch(
      `/api/servers/${serverId}/bedrock-packs/${encodeURIComponent(row.dataset.packKind)}/${encodeURIComponent(row.dataset.packId)}`,
      { method: 'DELETE' }
    );
    const body = await response.json().catch(() => ({}));
    if (!body.ok) return toast(body.error || 'Could not remove the Bedrock pack.', { kind: 'error' });
    toast('Bedrock pack removed. Restart the server to apply the change.');
    location.reload();
  });
}

function upload(serverId) {
  const content = document.createElement('div');
  content.innerHTML =
    '<label class="label">Pack type</label><select class="input" id="bedrock-pack-kind"><option value="behavior">Behavior pack</option><option value="resource">Resource pack</option></select><label class="label mt-3">Pack archive</label><input class="input" id="bedrock-pack-file" type="file" accept=".mcpack,.zip,application/zip">';
  openModal({
    title: 'Upload Bedrock Pack',
    content,
    actions: [
      { label: 'Cancel', kind: 'ghost' },
      {
        label: 'Upload',
        kind: 'primary',
        busyLabel: 'Uploading…',
        onClick: async () => {
          const file = content.querySelector('#bedrock-pack-file').files[0];
          if (!file) {
            toast('Choose a pack archive first.', { kind: 'error' });
            return false;
          }
          const form = new FormData();
          form.set('file', file);
          form.set('kind', content.querySelector('#bedrock-pack-kind').value);
          const response = await fetch(`/api/servers/${serverId}/bedrock-packs`, { method: 'POST', body: form });
          const body = await response.json().catch(() => ({}));
          if (!body.ok) {
            toast(body.error || 'Could not install the Bedrock pack.', { kind: 'error' });
            return false;
          }
          toast(`${body.pack.name} installed. Restart the server to apply it.`);
          location.reload();
        },
      },
    ],
  });
}
