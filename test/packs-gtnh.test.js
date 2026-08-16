'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app'); // migrates the DB + gives us seedServer()
const db = require('../src/db');
const packs = require('../src/services/packs');

test('applyPack stores the java cap and channel on the pin', async () => {
  const id = app.seedServer('srv_gtnhpin');
  await packs.applyPack(
    id,
    {
      platform: 'gtnh',
      projectRef: 'gtnh',
      projectName: 'GT New Horizons',
      versionId: '2.8.4',
      versionName: '2.8.4',
      mcVersion: '1.7.10',
      maxJavaVersion: 25,
      channel: 'stable',
    },
    { actor: 'test', force: true }
  );
  const pin = db.get('SELECT * FROM server_packs WHERE server_id = ?', id);
  assert.equal(pin.platform, 'gtnh');
  assert.equal(pin.max_java_version, 25);
  assert.equal(pin.channel, 'stable');
});

test('applyPack leaves the new columns null for other platforms', async () => {
  const id = app.seedServer('srv_mrpin');
  await packs.applyPack(
    id,
    {
      platform: 'modrinth',
      projectRef: 'sop',
      projectName: 'Simply Optimized',
      versionId: 'abc123',
      versionName: '1.0.0',
      mcVersion: '1.21.1',
    },
    { actor: 'test', force: true }
  );
  const pin = db.get('SELECT * FROM server_packs WHERE server_id = ?', id);
  assert.equal(pin.max_java_version, null);
  assert.equal(pin.channel, null);
});
