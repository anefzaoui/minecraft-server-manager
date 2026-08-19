'use strict';

// Parses `rcon-cli list` output. Paper 26.2 changed the phrasing from
// "There are N of a max of M players online:" to
// "There are N out of maximum M players online." — accept both so the two
// callers (liveCache boot-status polling, players.listOnlineNames) never
// drift out of sync with each other again.

const { PLAYER_NAME_RE } = require('./playerName');

// The trailing period only counts as punctuation when it's followed by
// whitespace or end-of-string — otherwise a Bedrock name's leading "."
// (e.g. ".Steve" landing right after the colon with no space) would get
// eaten as the optional period instead of staying in the name capture.
const LIST_RE = /There are (\d+) (?:of a max of|out of maximum) (\d+) players online:?(?:\.(?=\s|$))?\s*(.*)/i;

/**
 * @param {string} text - ANSI/§-stripped `rcon-cli list` output.
 * @returns {{online: number, max: number, names: string[]} | null} null if the
 *   text doesn't match any known phrasing (caller decides how to treat that).
 */
function parsePlayerList(text) {
  const m = LIST_RE.exec(text);
  if (!m) return null;
  return {
    online: Number(m[1]),
    max: Number(m[2]),
    names: m[3]
      ? m[3]
          .split(',')
          .map((n) => n.trim())
          .filter((n) => PLAYER_NAME_RE.test(n))
      : [],
  };
}

module.exports = { parsePlayerList };
