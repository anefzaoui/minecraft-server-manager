'use strict';

// Parses `rcon-cli list` output. Three phrasings are known:
//   "There are N of a max of M players online:"   (modern vanilla/Paper)
//   "There are N out of maximum M players online." (Paper 26.2)
//   "There are N/M players online:"                (1.7.10-era Forge - every
//                                                   GTNH server speaks this)
// Accept all of them, so the two callers (liveCache boot-status polling,
// players.listOnlineNames) share one regex instead of copies that can
// silently drift apart, as happened here. This only unifies the parsing: a null return still means "couldn't
// read player counts", and each caller decides for itself what that implies
// (liveCache treats a successful-but-unparseable rcon reply as "server's up,
// counts unknown"; listOnlineNames treats it as "couldn't ask" and, when
// asked to, throws rather than guessing).

const { PLAYER_NAME_RE } = require('./playerName');

// The trailing period only counts as punctuation when it's followed by
// whitespace, end-of-string, or another period - otherwise a Bedrock name's
// leading "." (e.g. ".Steve" landing right after the colon with no space)
// would get eaten as the optional period instead of staying in the name
// capture. The extra-period case is the 26.2 mirror of that: "online..Steve"
// is the sentence period plus Bedrock ".Steve", so the first "." is consumed
// and the second stays with the name. A lone "online.Steve" is genuinely
// ambiguous (sentence period + Java "Steve", or no period + Bedrock
// ".Steve") - we keep the Bedrock reading since not consuming the period is
// the conservative parse.
const LIST_RE =
  /There are (\d+)(?: (?:of a max of|out of maximum) |\/)(\d+) players online:?(?:\.(?=\s|$|\.))?\s*(.*)/i;

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
