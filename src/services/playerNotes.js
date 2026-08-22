'use strict';

// Sticky moderator notes per player (per server) - context that survives a
// pardon, e.g. "reported for griefing 3x". See db/migrations/011_player_notes.js.

const { nanoid } = require('nanoid');
const db = require('../db');
const httpError = require('../utils/httpError');
const { recordEvent } = require('../events');

const MAX_NOTE_LENGTH = 1000;

function publicNote(n) {
  return { id: n.id, name: n.name, uuid: n.uuid, note: n.note, author: n.author, createdAt: n.created_at };
}

function listNotes(serverId, uuid) {
  return db
    .all('SELECT * FROM player_notes WHERE server_id = ? AND uuid = ? ORDER BY created_at DESC', serverId, uuid)
    .map(publicNote);
}

function addNote(serverId, { uuid, name }, note, { actor = 'system' } = {}) {
  note = String(note || '').trim();
  if (!note) throw httpError(400, 'Note cannot be empty');
  if (note.length > MAX_NOTE_LENGTH) throw httpError(400, `Note is too long (max ${MAX_NOTE_LENGTH} characters)`);
  const id = `pnote_${nanoid(10)}`;
  db.run(
    'INSERT INTO player_notes (id, server_id, uuid, name, note, author) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    serverId,
    uuid,
    name,
    note,
    actor
  );
  recordEvent({ serverId, actor, type: 'player-note-added', summary: `Note added for ${name}`, details: { name, uuid } });
  return publicNote(db.get('SELECT * FROM player_notes WHERE id = ?', id));
}

function deleteNote(serverId, id, { actor = 'system' } = {}) {
  const row = db.get('SELECT * FROM player_notes WHERE id = ? AND server_id = ?', id, serverId);
  if (!row) throw httpError(404, 'Note not found');
  db.run('DELETE FROM player_notes WHERE id = ?', id);
  recordEvent({
    serverId,
    actor,
    type: 'player-note-deleted',
    summary: `Note removed for ${row.name}`,
    details: { name: row.name, uuid: row.uuid },
  });
}

module.exports = { listNotes, addNote, deleteNote };
