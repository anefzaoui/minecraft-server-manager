'use strict';

// ANSI/terminal escape handling. rcon-cli and mc-image-helper colorize their
// output; anything that PARSES that text must strip the escapes first, or
// "\x1b[0m" ends up displayed as a player named "[0m".

const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
// Some log pipelines lose the ESC byte and leave bare "[0;39m" fragments.
const BARE_SGR_RE = /\[[0-9;]{1,8}m/g;

function stripAnsi(text) {
  return String(text ?? '')
    .replace(ANSI_RE, '')
    .replace(BARE_SGR_RE, '');
}

/** Strip ANSI + Minecraft § codes — for parsing player names etc. */
function cleanText(text) {
  return stripAnsi(text).replace(/§[0-9a-fk-orA-FK-OR]/g, '');
}

module.exports = { stripAnsi, cleanText, ANSI_RE };
