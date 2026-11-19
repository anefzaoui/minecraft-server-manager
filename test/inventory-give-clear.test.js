'use strict';

// assertRconOk's 404 for "No player was found" used to be hardcoded to slot
// language ("That slot is no longer there…"), which is wrong for give/clear -
// neither RCON command touches a slot. Confirms the message stays player-shaped
// for those two entry points (commit f6dc715 regression).

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');

const containers = require('../src/docker/containers');
containers.inspectStatus = async () => ({ exists: true, status: 'running' });
containers.execCapture = async (serverId, cmd) => {
  // rcon-cli give/clear against a player who just disconnected.
  if (cmd.includes('give') || cmd.includes('clear')) return 'No player was found';
  return '';
};

const inventory = require('../src/services/inventory');

test('giveItem surfaces a player-shaped 404, not slot language, when the target is offline', async () => {
  await assert.rejects(
    () => inventory.giveItem('srv_give_clear', 'Steve', 'minecraft:diamond', 1),
    (err) => {
      assert.equal(err.status, 404);
      assert.match(err.message, /Steve is no longer online/);
      assert.doesNotMatch(err.message, /slot/i);
      return true;
    }
  );
});

test('clearItem surfaces a player-shaped 404, not slot language, when the target is offline', async () => {
  await assert.rejects(
    () => inventory.clearItem('srv_give_clear', 'Steve'),
    (err) => {
      assert.equal(err.status, 404);
      assert.match(err.message, /Steve is no longer online/);
      assert.doesNotMatch(err.message, /slot/i);
      return true;
    }
  );
});
