'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const chat = require('../src/services/chatCommands');
const app = require('./helpers/app');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

function freshServer(prefix) {
  return app.seedServer('ccmd_' + prefix);
}

test('validateSpec normalizes trigger, cooldown and messages', () => {
  const spec = chat.createCommand(freshServer('validate'), {
    trigger: '  Rtp2  ',
    description: 'Teleport me',
    action: 'rtp',
    params: { minDistance: 500, maxDistance: 5000 },
    permission: 'everyone',
    cooldownSec: 30,
    msgPending: 'Finding a spot',
    msgSuccess: 'Landed {distance} away',
  });
  assert.equal(spec.trigger, 'rtp2');
  assert.equal(spec.action, 'rtp');
  assert.equal(spec.cooldown_sec, 30);
  assert.equal(spec.params.maxDistance, 5000);
  assert.equal(spec.msg_success, 'Landed {distance} away');
  assert.equal(spec.enabled, true);
});

test('validateSpec rejects bad triggers, actions, permissions and cooldowns', () => {
  const id = freshServer('bad');
  assert.throws(
    () => chat.createCommand(id, { trigger: '', action: 'rtp', permission: 'everyone', cooldownSec: 0 }),
    /Triggers are 1 to 24/
  );
  assert.throws(
    () => chat.createCommand(id, { trigger: 'has space', action: 'rtp', permission: 'everyone', cooldownSec: 0 }),
    /Triggers are 1 to 24/
  );
  assert.throws(
    () => chat.createCommand(id, { trigger: 'ok', action: 'fly', permission: 'everyone', cooldownSec: 0 }),
    /Unknown action/
  );
  assert.throws(
    () => chat.createCommand(id, { trigger: 'ok', action: 'rtp', permission: 'mods', cooldownSec: 0 }),
    /Unknown permission/
  );
  assert.throws(
    () => chat.createCommand(id, { trigger: 'ok', action: 'rtp', permission: 'everyone', cooldownSec: -1 }),
    /Cooldown must be 0-86400/
  );
  assert.throws(
    () => chat.createCommand(id, { trigger: 'ok', action: 'rtp', permission: 'everyone', cooldownSec: 99999 }),
    /Cooldown must be 0-86400/
  );
});

test('rtp params enforce min<max and a distance cap', () => {
  const id = freshServer('rtp');
  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 'go',
        action: 'rtp',
        permission: 'everyone',
        cooldownSec: 0,
        params: { minDistance: 9000, maxDistance: 500 },
      }),
    /Max distance must be greater/
  );
  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 'go',
        action: 'rtp',
        permission: 'everyone',
        cooldownSec: 0,
        params: { minDistance: 500, maxDistance: 2000000 },
      }),
    /capped at 1,000,000/
  );
});

test('structure and biome validate params; console validates commands and ops-gating', () => {
  const id = freshServer('prm');
  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 's',
        action: 'structure',
        permission: 'everyone',
        cooldownSec: 0,
        params: { structure: 'nope' },
      }),
    /valid structure/
  );
  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 'b',
        action: 'biome',
        permission: 'everyone',
        cooldownSec: 0,
        params: { biome: 'nope' },
      }),
    /valid biome/
  );
  const s = chat.createCommand(id, {
    trigger: 's2',
    action: 'structure',
    permission: 'everyone',
    cooldownSec: 0,
    params: { structure: '#minecraft:village', random: false },
  });
  assert.equal(s.params.structure, '#minecraft:village');
  assert.equal(s.params.random, false);

  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 'c',
        action: 'console',
        permission: 'everyone',
        cooldownSec: 0,
        params: { commands: [] },
      }),
    /at least one console command/
  );
  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 'c',
        action: 'console',
        permission: 'everyone',
        cooldownSec: 0,
        params: { commands: ['stop'] },
      }),
    /only allowed when permission is set to Ops/
  );
  const cc = chat.createCommand(id, {
    trigger: 'c',
    action: 'console',
    permission: 'ops',
    cooldownSec: 0,
    params: { commands: ['/say hi'] },
  });
  assert.deepEqual(cc.params.commands, ['say hi']);
  const many = Array.from({ length: 11 }, (_, i) => `say ${i}`);
  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 'c9',
        action: 'console',
        permission: 'ops',
        cooldownSec: 0,
        params: { commands: many },
      }),
    /Max 10/
  );
});

test('duplicate trigger returns 409; getCommand/listCommands reflect rows', () => {
  const id = freshServer('dup');
  chat.createCommand(id, { trigger: 'rtp', action: 'rtp', permission: 'everyone', cooldownSec: 0 });
  assert.throws(
    () =>
      chat.createCommand(id, {
        trigger: 'RTP',
        action: 'biome',
        permission: 'everyone',
        cooldownSec: 0,
        params: { biome: 'minecraft:desert' },
      }),
    /already exists/
  );
  const list = chat.listCommands(id);
  assert.equal(list.length, 1);
  assert.equal(list[0].trigger, 'rtp');

  const got = chat.getCommand(id, list[0].id);
  assert.equal(got.action, 'rtp');
  assert.equal(chat.getCommand(id, 'missing'), null);
});

test('updateCommand rewrites fields and can toggle enabled without full revalidation', () => {
  const id = freshServer('upd');
  const created = chat.createCommand(id, { trigger: 'rtp', action: 'rtp', permission: 'everyone', cooldownSec: 0 });

  const toggled = chat.updateCommand(id, created.id, { enabled: false });
  assert.equal(toggled.enabled, false);

  const updated = chat.updateCommand(id, created.id, {
    trigger: 'biomeGo',
    action: 'biome',
    params: { biome: 'minecraft:desert' },
    permission: 'everyone',
    cooldownSec: 0,
  });
  assert.equal(updated.trigger, 'biomego');
  assert.equal(updated.params.biome, 'minecraft:desert');

  assert.throws(() => chat.updateCommand(id, 'missing', { enabled: true }), /not found/);
});

test('deleteCommand removes a command and 404s for missing', () => {
  const id = freshServer('del');
  const created = chat.createCommand(id, { trigger: 'rtp', action: 'rtp', permission: 'everyone', cooldownSec: 0 });
  assert.equal(chat.deleteCommand(id, created.id).deleted, true);
  assert.equal(chat.listCommands(id).length, 0);
  assert.throws(() => chat.deleteCommand(id, created.id), /not found/);
});

test('prefix defaults to ! and is settable/validated', () => {
  const id = freshServer('pfx');
  assert.equal(chat.getPrefix(id), '!');
  assert.equal(chat.setPrefix(id, '^^').prefix, '^^');
  assert.equal(chat.getPrefix(id), '^^');
  assert.throws(() => chat.setPrefix(id, '/'), /never \//);
  assert.throws(() => chat.setPrefix(id, '!!!'), /1-2 characters/);
});

test('actionSummary summarizes each action kind', () => {
  const id = freshServer('sum');
  const rtp = chat.createCommand(id, {
    trigger: 'a',
    action: 'rtp',
    permission: 'everyone',
    cooldownSec: 0,
    params: { minDistance: 200, maxDistance: 4000, center: 'origin' },
  });
  assert.equal(chat.actionSummary(rtp), 'rtp 200-4000 around 0,0');
  const st = chat.createCommand(id, {
    trigger: 'b',
    action: 'structure',
    permission: 'everyone',
    cooldownSec: 0,
    params: { structure: '#minecraft:village', random: false },
  });
  assert.equal(chat.actionSummary(st), 'structure minecraft:village (nearest)');
  const bi = chat.createCommand(id, {
    trigger: 'c',
    action: 'biome',
    permission: 'everyone',
    cooldownSec: 0,
    params: { biome: 'minecraft:desert' },
  });
  assert.equal(chat.actionSummary(bi), 'biome minecraft:desert');
  const cc = chat.createCommand(id, {
    trigger: 'd',
    action: 'console',
    permission: 'everyone',
    cooldownSec: 0,
    params: { commands: ['say hi', 'say bye'] },
  });
  assert.equal(chat.actionSummary(cc), 'console ×2');
});

test('handleChat ignores non-chat and unknown triggers, and denies without permission', async () => {
  const id = freshServer('hand');
  chat.createCommand(id, { trigger: 'rtp', action: 'rtp', permission: 'ops', cooldownSec: 0 });

  await chat.handleChat(id, 'Not_A_Valid__Player_Name__too_long', '!rtp');
  await chat.handleChat(id, 'Steve', '');
  await chat.handleChat(id, 'Steve', '!notatrigger');
  await chat.handleChat(id, 'Steve', '!rtp');
  await chat.handleChat(id, 'Steve', '!rtp');
});
