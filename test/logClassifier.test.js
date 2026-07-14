'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, isPvp, looksLikePlayer } = require('../src/analytics/logClassifier');

const P = '[12:34:56] [Server thread/INFO]: ';

test('classifies chat', () => {
  assert.deepEqual(classify(`${P}<Notch> hello world`), {
    time: '12:34:56',
    type: 'chat',
    player: 'Notch',
    target: '',
    message: 'hello world',
  });
});

test('classifies join and leave', () => {
  assert.equal(classify(`${P}Steve joined the game`).type, 'join');
  assert.equal(classify(`${P}Steve left the game`).type, 'leave');
});

test('secondary join (logged in with entity id) captures IP in target and is deduped', () => {
  const e = classify(`${P}Steve[/203.0.113.5:51900] logged in with entity id 42 at (1.0, 2.0, 3.0)`);
  assert.equal(e.type, 'join');
  assert.equal(e.target, '203.0.113.5');
  assert.equal(e.dedupe, true);
});

test('classifies advancement', () => {
  const e = classify(`${P}Steve has made the advancement [Stone Age]`);
  assert.equal(e.type, 'advancement');
  assert.equal(e.message, 'Stone Age');
});

test('PvP death records the killer as target; environmental death does not', () => {
  const pvp = classify(`${P}Steve was slain by Herobrine`);
  assert.equal(pvp.type, 'death');
  assert.equal(pvp.target, 'Herobrine');
  assert.equal(isPvp(pvp), true);

  const mobKill = classify(`${P}Steve was slain by zombie`);
  assert.equal(mobKill.target, '', 'a mob killer is not a PvP target');
  assert.equal(isPvp(mobKill), false);

  const fell = classify(`${P}Steve fell from a high place`);
  assert.equal(fell.type, 'death');
  assert.equal(fell.target, '');
});

test('strips ANSI, § codes and [Not Secure] prefix', () => {
  const e = classify(`${P}[Not Secure] <Notch> hi`);
  assert.equal(e.player, 'Notch');
  assert.equal(e.message, 'hi');
});

test('returns null for non-player lines', () => {
  assert.equal(classify(`${P}Starting minecraft server version 1.21`), null);
  assert.equal(classify(''), null);
  assert.equal(classify(null), null);
});

test('looksLikePlayer distinguishes names from mobs', () => {
  assert.equal(looksLikePlayer('Notch'), true);
  assert.equal(looksLikePlayer('zombie'), false);
  assert.equal(looksLikePlayer('a'), false); // too short
});
