'use strict';

// The recovery route is the public seam: it must carry its task reporter into
// the backup service so Native Bedrock restores show the same live progress as
// every other restore.
require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');

const backupsPath = require.resolve('../src/services/backups');
const originalBackups = require.cache[backupsPath];
let restoreCall = null;

require.cache[backupsPath] = {
  id: backupsPath,
  filename: backupsPath,
  loaded: true,
  exports: {
    restoreBackup: async (...args) => {
      restoreCall = args;
      args[2].task.step('Extracting Native Bedrock backup…');
      return { ok: true };
    },
  },
};

const app = require('./helpers/app');
const db = require('../src/db');

let cookie;

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  db.run(
    `INSERT INTO servers (id, display_name, type, runtime, mc_version, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES ('srv_bedrock_restore', 'Bedrock restore', 'BEDROCK', 'bedrock', 'LATEST', 19132, 0, '', 1024, 1536)`
  );
});

test.after(async () => {
  await app.stop();
  if (originalBackups) require.cache[backupsPath] = originalBackups;
  else delete require.cache[backupsPath];
});

test('an operator restoring a Native Bedrock backup receives live recovery progress', async () => {
  const response = await app.req('POST', '/api/servers/srv_bedrock_restore/backups/bk_bedrock_restore/restore', { cookie });

  assert.equal(response.status, 202);
  for (let i = 0; i < 20 && !restoreCall; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(restoreCall?.[0], 'srv_bedrock_restore');
  assert.equal(restoreCall?.[1], 'bk_bedrock_restore');
  assert.equal(typeof restoreCall?.[2]?.task?.step, 'function');

  for (let i = 0; i < 20; i += 1) {
    const task = await app.req('GET', `/api/tasks/${response.json.taskId}`, { cookie });
    if (task.json?.task?.state === 'done') {
      assert.equal(task.json.task.step, 'Extracting Native Bedrock backup…');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('restore task did not finish');
});
