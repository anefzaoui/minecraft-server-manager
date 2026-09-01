'use strict';

// mclo.gs integration: paste upload, insights mapping, and the crash-report
// share flow (explicit, remembered, never re-uploaded).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('./helpers/app');
const env = require('./helpers/env');
const db = require('../src/db');
const mclogs = require('../src/integrations/mclogs');
const crashes = require('../src/crashes');

const realFetch = globalThis.fetch;
let fetchLog = [];
function stubMclogs({ uploadOk = true } = {}) {
  fetchLog = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    fetchLog.push({ url, method: (init && init.method) || 'GET' });
    if (url.endsWith('/1/log')) {
      return Response.json(
        uploadOk
          ? { success: true, id: 'AbC123', url: 'https://mclo.gs/AbC123', raw: 'https://api.mclo.gs/1/raw/AbC123' }
          : { success: false, error: 'too large' }
      );
    }
    if (url.includes('/1/insights/')) {
      return Response.json({
        success: true,
        id: 'neoforge/server',
        type: 'NeoForge Server Log',
        version: '1.21.1',
        title: 'NeoForge 1.21.1',
        analysis: {
          problems: [
            {
              message: 'Mod X is outdated',
              counter: 3,
              entry: {},
              solutions: [{ message: 'Update Mod X to 2.0' }, { message: 'Or remove it' }],
            },
          ],
          information: [{ label: 'Java', value: '21' }],
        },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('setup', async () => {
  await app.start();
});

test('uploadLog posts form-encoded content and returns the paste', async () => {
  stubMclogs();
  const paste = await mclogs.uploadLog('---- Minecraft Crash Report ----');
  assert.deepEqual(paste, { id: 'AbC123', url: 'https://mclo.gs/AbC123', rawUrl: 'https://api.mclo.gs/1/raw/AbC123' });
  assert.equal(fetchLog[0].method, 'POST');
  await assert.rejects(mclogs.uploadLog('   '), /Nothing to upload/);
  stubMclogs({ uploadOk: false });
  await assert.rejects(mclogs.uploadLog('x'), /rejected the upload: too large/);
});

test('getInsights validates the paste id and maps the analysis', async () => {
  stubMclogs();
  await assert.rejects(mclogs.getInsights('../etc'), /Invalid mclo\.gs paste id/);
  const ins = await mclogs.getInsights('AbC123');
  assert.equal(ins.type, 'NeoForge Server Log');
  assert.equal(ins.problems.length, 1);
  assert.deepEqual(ins.problems[0].solutions, ['Update Mod X to 2.0', 'Or remove it']);
  assert.deepEqual(ins.information, [{ label: 'Java', value: '21' }]);
});

test('shareCrash uploads once, remembers the paste, and records the event', async () => {
  const sid = app.seedServer('srv_mclogs1');
  const dir = path.join(env.dir, 'servers', sid, 'crash-reports');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'crash-2026-09-01.txt'), 'Description: boom');
  db.run(
    `INSERT INTO crash_reports (id, server_id, filename, file_mtime, size_bytes, summary, exception, suspected_json)
     VALUES ('cr_ml1', ?, 'crash-2026-09-01.txt', '2026-09-01T00:00:00Z', 17, 'boom', 'Boom', '[]')`,
    sid
  );
  stubMclogs();
  const first = await crashes.shareCrash('cr_ml1', { actor: 'tester' });
  assert.equal(first.url, 'https://mclo.gs/AbC123');
  assert.equal(first.alreadyShared, false);
  const row = db.get("SELECT * FROM crash_reports WHERE id = 'cr_ml1'");
  assert.equal(row.mclogs_id, 'AbC123');
  assert.equal(row.mclogs_url, 'https://mclo.gs/AbC123');
  assert.ok(db.get("SELECT id FROM events WHERE type = 'crash-shared' AND server_id = ?", sid));

  // Second share: no second upload.
  fetchLog = [];
  const again = await crashes.shareCrash('cr_ml1', { actor: 'tester' });
  assert.equal(again.alreadyShared, true);
  assert.equal(fetchLog.length, 0);
});

test('crashInsights reuses the stored paste id', async () => {
  stubMclogs();
  const ins = await crashes.crashInsights('cr_ml1', { actor: 'tester' });
  assert.equal(ins.url, 'https://mclo.gs/AbC123');
  assert.equal(ins.problems[0].message, 'Mod X is outdated');
  // Only the insights endpoint was hit - the paste already existed.
  assert.deepEqual(
    fetchLog.map((f) => f.method),
    ['GET']
  );
});

test('teardown', async () => {
  await app.stop();
});
