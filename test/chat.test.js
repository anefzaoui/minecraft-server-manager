'use strict';

require('./helpers/env'); // sets DATA_DIR/SESSION_SECRET before any src/ module loads

const test = require('node:test');
const assert = require('node:assert');
const chat = require('../src/services/chat');

test('buildComponent sets only the chosen style props', () => {
  assert.deepEqual(chat.buildComponent({ text: 'hi' }), { text: 'hi' });
  assert.deepEqual(chat.buildComponent({ text: 'hi', color: 'gold', bold: true }), {
    text: 'hi',
    color: 'gold',
    bold: true,
  });
  assert.deepEqual(chat.buildComponent({ text: 'x', bold: false, italic: true }), { text: 'x', italic: true });
});

test('buildComponent drops an unknown color and produces valid, escaped tellraw JSON', () => {
  assert.deepEqual(chat.buildComponent({ text: 'x', color: 'chartreuse' }), { text: 'x' });
  const json = JSON.stringify(chat.buildComponent({ text: 'say "hi"\\', color: 'red', underlined: true }));
  const parsed = JSON.parse(json);
  assert.equal(parsed.text, 'say "hi"\\');
  assert.equal(parsed.color, 'red');
  assert.equal(parsed.underlined, true);
});

test('normalizeTarget accepts selectors and names but rejects entity selectors', () => {
  assert.equal(chat.normalizeTarget('@a'), '@a');
  assert.equal(chat.normalizeTarget('Steve_123'), 'Steve_123');
  assert.throws(() => chat.normalizeTarget('@e[type=cow]'));
  assert.throws(() => chat.normalizeTarget('bad name!'));
  assert.throws(() => chat.normalizeTarget('waytoolongusername_123'));
});

test('normalizeTarget accepts Bedrock (Geyser/Floodgate) names with a leading . or *', () => {
  assert.equal(chat.normalizeTarget('.Steve'), '.Steve');
  assert.equal(chat.normalizeTarget('*Alex'), '*Alex');
});

test('normalizeMessageText preserves deliberate recipe rows only when requested', () => {
  assert.equal(chat.normalizeMessageText('one\ntwo'), 'one two');
  assert.equal(chat.normalizeMessageText('one\r\n\r\n\r\ntwo', true), 'one\n\ntwo');
});

test('deliveryLines turns recipe rows into separate tellraw payloads only when requested', () => {
  assert.deepEqual(chat.deliveryLines('title\n[1][ ][1]\n[1][ ][1]', true), ['title', '[1][ ][1]', '[1][ ][1]']);
  assert.deepEqual(chat.deliveryLines('ordinary\nmessage'), ['ordinary\nmessage']);
});
