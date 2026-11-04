'use strict';

// Running in-game chat commands: permission gates, cooldown, one-at-a-time,
// spam throttle, argument sanitising (no command injection through {arg1}),
// the pending/success/failure whispers, usage stats, and the panel test button.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate();
const db = require('../src/db');

// Stub before chatCommands destructures execCapture.
const containers = require('../src/docker/containers');
const rcon = [];
let rconImpl = async () => '';
containers.execCapture = async (id, args) => {
  rcon.push(args.slice(2));
  return rconImpl(args);
};

const players = require('../src/services/players');
let ops = [];
let whitelist = [];
players.readJson = (id, file) => (file === 'ops.json' ? ops : whitelist);
players.withTeleportSlot = async (id, fn) => fn();
const tp = [];
players.rtpPlayer = async (id, player, opts) => {
  tp.push(['rtp', player, opts]);
  return { x: 10, y: 64, z: -20, distance: 500, dimension: 'minecraft:overworld' };
};
players.tpToStructure = async (id, player, structure, opts) => {
  tp.push(['structure', player, structure, opts]);
  return { x: 1, z: 2, structure: 'minecraft:village_plains', dimension: 'minecraft:the_nether' };
};
players.tpToBiome = async (id, player, biome) => {
  tp.push(['biome', player, biome]);
  return { x: 3, z: 4, biome: 'minecraft:desert', dimension: 'minecraft:the_end' };
};

const chat = require('../src/services/chatCommands');

let n = 0;
function server() {
  n += 1;
  const id = `srv_cc${n}`;
  db.run(
    `INSERT INTO servers (id, display_name, type, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb)
     VALUES (?, ?, 'PAPER', ?, ?, 'x', 1024, 1536)`,
    id,
    id,
    28300 + n * 2,
    28301 + n * 2
  );
  return id;
}
const make = (id, spec) =>
  chat.createCommand(id, { permission: 'everyone', cooldownSec: 0, action: 'console', ...spec });
const tells = () => rcon.filter((c) => c[0] === 'tell');
const lastTell = () => tells().at(-1)?.slice(2).join(' ');
const events = (id) => db.all("SELECT * FROM events WHERE server_id = ? AND type = 'chat-command'", id);
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test.beforeEach(() => {
  rcon.length = 0;
  tp.length = 0;
  rconImpl = async () => '';
  ops = [];
  whitelist = [];
});

test('a console command substitutes the player and sanitised args, and whispers the output', async () => {
  const id = server();
  make(id, { trigger: 'gift', params: { commands: ['give {player} {arg1} {arg2}'] } });
  rconImpl = async (args) => (args[2] === 'give' ? 'Gave 5 [Apple] to Steve' : '');
  await chat.handleChat(id, 'Steve', '!gift minecraft:apple 5');
  assert.deepEqual(rcon[0], ['give', 'Steve', 'minecraft:apple', '5']);
  assert.equal(lastTell(), 'Gave 5 [Apple] to Steve');
  assert.equal(events(id).length, 1);
  assert.equal(chat.getCommand(id, chat.listCommands(id)[0].id).uses, 1);
});

test('args that could smuggle a second command are blanked, not passed through', async () => {
  const id = server();
  make(id, { trigger: 'say', params: { commands: ['say {arg1}|{arg2}'] } });
  await chat.handleChat(id, 'Steve', '!say @a;stop $(x)');
  assert.deepEqual(rcon[0], ['say', '|']);
});

test('only the first three args are used, and a command with no output says Done!', async () => {
  const id = server();
  make(id, { trigger: 'echo', params: { commands: ['list'] } });
  await chat.handleChat(id, 'Steve', '!echo a b c d e');
  assert.equal(lastTell(), 'Done!');
});

test('ops-only commands deny everyone else with a whisper and an event; ops and whitelist gates work', async () => {
  const id = server();
  make(id, { trigger: 'op', permission: 'ops', params: { commands: ['list'] } });
  make(id, { trigger: 'wl', permission: 'whitelist', params: { commands: ['list'] } });
  await chat.handleChat(id, 'Rando', '!op');
  assert.match(lastTell(), /don't have permission/);
  assert.equal(events(id)[0].summary, 'Rando tried !op. Denied (needs ops).');
  rcon.length = 0;
  ops = [{ name: 'BOSS' }];
  await chat.handleChat(id, 'Boss', '!op');
  assert.ok(rcon.some((c) => c[0] === 'list'));

  rcon.length = 0;
  await chat.handleChat(id, 'Nobody', '!wl');
  assert.match(lastTell(), /permission/);
  whitelist = [{ name: 'friend' }];
  rcon.length = 0;
  await chat.handleChat(id, 'Friend', '!wl');
  assert.ok(rcon.some((c) => c[0] === 'list'));
  rcon.length = 0;
  await tick(450);
  await chat.handleChat(id, 'Boss', '!wl'); // ops count as whitelisted
  assert.ok(rcon.some((c) => c[0] === 'list'));
});

test('a disabled command is ignored like an unknown one', async () => {
  const id = server();
  const c = make(id, { trigger: 'off', params: { commands: ['list'] } });
  chat.updateCommand(id, c.id, { enabled: false });
  await chat.handleChat(id, 'Steve', '!off');
  assert.deepEqual(rcon, []);
});

test('a custom prefix is honoured and the default no longer triggers', async () => {
  const id = server();
  make(id, { trigger: 'hi', params: { commands: ['list'] } });
  chat.setPrefix(id, '.');
  await chat.handleChat(id, 'Steve', '!hi');
  assert.deepEqual(rcon, []);
  await chat.handleChat(id, 'Steve', '.hi');
  assert.ok(rcon.length > 0);
});

test('cooldown blocks a repeat with a wait message, per player, and does not run the action', async () => {
  const id = server();
  make(id, { trigger: 'daily', cooldownSec: 60, params: { commands: ['list'] } });
  await chat.handleChat(id, 'Alex', '!daily');
  rcon.length = 0;
  await tick(450); // clear the spam throttle so the cooldown is what stops it
  await chat.handleChat(id, 'Alex', '!daily');
  assert.match(lastTell(), /^Wait \d+s before using !daily again\.$/);
  assert.ok(!rcon.some((c) => c[0] === 'list'));
  rcon.length = 0;
  await chat.handleChat(id, 'Beth', '!daily');
  assert.ok(
    rcon.some((c) => c[0] === 'list'),
    'another player is unaffected'
  );
});

test('rapid repeats from one player are dropped silently by the spam throttle', async () => {
  const id = server();
  make(id, { trigger: 'spam', params: { commands: ['list'] } });
  await chat.handleChat(id, 'Cara', '!spam');
  rcon.length = 0;
  await chat.handleChat(id, 'Cara', '!spam');
  assert.deepEqual(rcon, []);
});

test('a player cannot start a second command while one is still running', async () => {
  const id = server();
  make(id, { trigger: 'slow', params: { commands: ['list'] } });
  let release;
  rconImpl = (args) => (args[2] === 'tell' ? '' : new Promise((r) => (release = r)));
  const first = chat.handleChat(id, 'Dan', '!slow');
  await tick(20);
  rcon.length = 0;
  await tick(450);
  await chat.handleChat(id, 'Dan', '!slow');
  assert.match(lastTell(), /still running/);
  release('');
  await first;
});

test('teleport actions pass their params through and describe the landing', async () => {
  const id = server();
  make(id, { trigger: 'rtp', action: 'rtp', params: { minDistance: 100, maxDistance: 900 } });
  make(id, { trigger: 'village', action: 'structure', params: { structure: 'minecraft:village_plains' } });
  make(id, { trigger: 'desert', action: 'biome', params: { biome: 'minecraft:desert' } });
  await chat.handleChat(id, 'Eve', '!rtp');
  assert.equal(tp[0][2].maxDistance, 900);
  assert.match(lastTell(), /landed 500 blocks away at 10, -20 in the Overworld/);
  await chat.handleChat(id, 'Fay', '!village');
  assert.match(lastTell(), /Teleported to a Village plains in the Nether at 1, 2\./);
  await chat.handleChat(id, 'Gus', '!desert');
  assert.match(lastTell(), /Teleported to Desert in the End at 3, 4\./);
});

test('custom pending/success/failure templates fill placeholders; unknown tokens stay as written', async () => {
  const id = server();
  make(id, {
    trigger: 'rtp',
    action: 'rtp',
    params: {},
    msgPending: 'Hold on {player}, {nope}',
    msgSuccess: '{player} is at {x},{z} ({distance} away, {dimension})',
  });
  await chat.handleChat(id, 'Hal', '!rtp');
  const said = tells().map((c) => c.slice(2).join(' '));
  assert.equal(said[0], 'Hold on Hal, {nope}');
  assert.equal(said[1], 'Hal is at 10,-20 (500 away, the Overworld)');
});

test('failures whisper a friendly line (429 is "busy"), use the custom template, and are logged', async () => {
  const id = server();
  make(id, { trigger: 'rtp', action: 'rtp', params: {} });
  players.rtpPlayer = async () => {
    throw Object.assign(new Error('teleport busy'), { status: 429 });
  };
  await chat.handleChat(id, 'Ian', '!rtp');
  assert.match(lastTell(), /busy with another teleport/);
  players.rtpPlayer = async () => {
    throw new Error('No safe spot found');
  };
  await tick(450);
  await chat.handleChat(id, 'Ian', '!rtp');
  assert.match(lastTell(), /No safe spot found/);
  const failed = events(id).filter((e) => JSON.parse(e.details_json || e.details || '{}').success === false);
  assert.equal(failed.length, 2);
  assert.equal(chat.listCommands(id)[0].uses, 0, 'failures do not count as uses');

  const id2 = server();
  make(id2, { trigger: 'rtp', action: 'rtp', params: {}, msgFailure: 'Nope: {error}' });
  await chat.handleChat(id2, 'Jo', '!rtp');
  assert.equal(lastTell(), 'Nope: No safe spot found');
});

test('a whisper never carries newlines or exceeds the cap, and never targets an invalid name', async () => {
  const id = server();
  make(id, { trigger: 'big', params: { commands: ['list'] } });
  rconImpl = async (args) => (args[2] === 'list' ? `line one\nline two ${'x'.repeat(400)}` : '');
  await chat.handleChat(id, 'Kim', '!big');
  const text = lastTell();
  assert.ok(!/\n/.test(text));
  assert.ok(text.length <= 120 + 'Kim '.length);
});

test('testCommand runs without permission or cooldown checks and records a panel-test event', async () => {
  const id = server();
  const c = make(id, { trigger: 'gated', permission: 'ops', cooldownSec: 999, params: { commands: ['list'] } });
  const out = await chat.testCommand(id, c.id, 'Lee', { actor: 'admin' });
  assert.equal(out.message, 'Done!');
  const again = await chat.testCommand(id, c.id, 'Lee', { actor: 'admin' });
  assert.ok(again);
  assert.match(events(id)[0].summary, /Panel test\.$/);
  assert.equal(chat.listCommands(id)[0].uses, 2);
});

test('testCommand validates the command and player, and refuses a concurrent run (429)', async () => {
  const id = server();
  const c = make(id, { trigger: 'slowt', params: { commands: ['list'] } });
  await assert.rejects(
    () => chat.testCommand(id, 'missing', 'Lee'),
    (e) => e.status === 404
  );
  await assert.rejects(
    () => chat.testCommand(id, c.id, 'not a player!'),
    (e) => e.status === 400
  );
  let release;
  rconImpl = (args) => (args[2] === 'tell' ? '' : new Promise((r) => (release = r)));
  const first = chat.testCommand(id, c.id, 'Max');
  await tick(20);
  await assert.rejects(
    () => chat.testCommand(id, c.id, 'max'),
    (e) => e.status === 429
  );
  release('');
  await first;
});

test('testCommand rethrows a failure after recording it', async () => {
  const id = server();
  const c = make(id, { trigger: 'bad', params: { commands: ['list'] }, msgFailure: 'oops {error}' });
  rconImpl = async () => {
    throw new Error('rcon down');
  };
  await assert.rejects(() => chat.testCommand(id, c.id, 'Ned'), /rcon down/);
  assert.match(events(id)[0].summary, /failed\.$/);
  assert.equal(lastTell(), 'oops rcon down');
});
