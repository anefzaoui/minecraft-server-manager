'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const playerNotes = require('../src/services/playerNotes');
const app = require('./helpers/app');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

const UUID = '3f5f7c2a-8a4e-4a1a-9c1b-000000000001';

test('addNote/listNotes round-trip and only expose public fields', () => {
  const id = app.seedServer('notes1');
  const note = playerNotes.addNote(id, { uuid: UUID, name: 'Steve' }, '  reported for griefing  ', { actor: 'admin' });
  assert.ok(note.id.startsWith('pnote_'));
  assert.equal(note.name, 'Steve');
  assert.equal(note.note, 'reported for griefing'); // trimmed
  assert.equal(note.author, 'admin');
  assert.ok(note.createdAt);

  const list = playerNotes.listNotes(id, UUID);
  assert.equal(list.length, 1);
  assert.equal(list[0].note, 'reported for griefing');
  assert.equal(list[0].id, note.id);
});

test('addNote rejects empty and over-length notes', () => {
  const id = app.seedServer('notes2');
  assert.throws(() => playerNotes.addNote(id, { uuid: UUID, name: 'Steve' }, '   '), /Note cannot be empty/);
  assert.throws(() => playerNotes.addNote(id, { uuid: UUID, name: 'Steve' }, 'x'.repeat(1001)), /Note is too long/);
});

test('deleteNote removes a note and 404s for a missing one', () => {
  const id = app.seedServer('notes3');
  const note = playerNotes.addNote(id, { uuid: UUID, name: 'Steve' }, 'note to delete');
  playerNotes.deleteNote(id, note.id);
  assert.equal(playerNotes.listNotes(id, UUID).length, 0);
  assert.throws(() => playerNotes.deleteNote(id, 'pnote_missing'), /Note not found/);
});

test('listNotes returns empty for a player with no notes', () => {
  const id = app.seedServer('notes4');
  assert.deepEqual(playerNotes.listNotes(id, UUID), []);
});
