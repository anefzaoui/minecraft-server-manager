// @ts-nocheck — dynamic tellraw JSON component building (incremental typing).
'use strict';

// Admin chat: send styled messages to players over RCON — `tellraw` (per-target,
// full styling) or `say` (plain broadcast). The component builder and target
// validation are pure + exported for tests.

const { execCapture, inspectStatus } = require('../docker/containers');
const { cleanText } = require('../utils/ansi');
const { recordEvent } = require('../events');
const httpError = require('../utils/httpError');

// The 16 vanilla text colors → hex (also drives the UI swatches).
const COLORS = {
  black: '#000000',
  dark_blue: '#0000AA',
  dark_green: '#00AA00',
  dark_aqua: '#00AAAA',
  dark_red: '#AA0000',
  dark_purple: '#AA00AA',
  gold: '#FFAA00',
  gray: '#AAAAAA',
  dark_gray: '#555555',
  blue: '#5555FF',
  green: '#55FF55',
  aqua: '#55FFFF',
  red: '#FF5555',
  light_purple: '#FF55FF',
  yellow: '#FFFF55',
  white: '#FFFFFF',
};
const FORMATS = ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'];

/** Build a tellraw JSON text component from text + style — pure, only sets chosen props. */
function buildComponent(opts = {}) {
  const c = { text: String(opts.text ?? '') };
  if (opts.color && Object.prototype.hasOwnProperty.call(COLORS, opts.color)) c.color = opts.color;
  for (const f of FORMATS) if (opts[f]) c[f] = true;
  return c;
}

/** Validate a tellraw target: @a/@p/@r/@s or a Java username. Blocks entity selectors. */
function normalizeTarget(target) {
  const t = String(target || '@a').trim();
  if (['@a', '@p', '@r', '@s'].includes(t)) return t;
  if (/^[A-Za-z0-9_]{1,16}$/.test(t)) return t;
  throw httpError(400, 'Invalid recipient — pick Everyone or a valid player name');
}

async function assertRunning(serverId) {
  const info = await inspectStatus(serverId);
  if (!info.exists || !(info.status === 'running' || info.status === 'unhealthy')) {
    throw httpError(409, 'Start the server before sending chat');
  }
}

/** Send an admin chat message. Returns the sent message (for the panel's chat log). */
async function sendChat(serverId, opts = {}) {
  const text = String(opts.text || '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (!text) throw httpError(400, 'Message text is required');
  if (text.length > 512) throw httpError(400, 'Message is too long (512 chars max)');
  const mode = opts.mode === 'say' ? 'say' : 'tellraw';
  const actor = opts.actor || 'system';
  await assertRunning(serverId);

  let target = '@a';
  let cmd;
  if (mode === 'say') {
    cmd = ['say', text];
  } else {
    target = normalizeTarget(opts.target);
    cmd = ['tellraw', target, JSON.stringify(buildComponent({ ...opts, text }))];
  }

  const out = cleanText(await execCapture(serverId, ['rcon-cli', ...cmd]));
  if (out.trim() && /Unknown or incomplete|Incorrect argument|Expected|No player was found|<--\[HERE\]/i.test(out)) {
    throw httpError(502, `The server rejected the message: ${out.split('\n')[0]}`);
  }

  recordEvent({
    serverId,
    actor,
    type: 'chat-sent',
    summary: `Chat (${mode}) → ${target}: ${text.slice(0, 80)}`,
    details: { mode, target, color: opts.color || null, text: text.slice(0, 300) },
  });
  return {
    mode,
    target,
    text,
    color: opts.color && COLORS[opts.color] ? opts.color : null,
    bold: !!opts.bold,
    italic: !!opts.italic,
    underlined: !!opts.underlined,
    strikethrough: !!opts.strikethrough,
    obfuscated: !!opts.obfuscated,
  };
}

module.exports = { sendChat, buildComponent, normalizeTarget, COLORS, FORMATS };
