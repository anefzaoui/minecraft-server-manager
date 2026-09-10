'use strict';

// Structured log-line classifier for the activity timeline. Turns vanilla /
// modded server console lines into typed player events:
//   classify(line) -> null | { time, type, player, target, message, dedupe? }
// `time` is the HH:MM:SS from the log prefix (null when the line had none) so
// the ingester can rebuild a full timestamp. `dedupe: true` marks secondary
// variants of an event that also appears as a canonical line (the "logged in
// with entity id" join and the "lost connection" leave) so the ingester can
// collapse the pair into a single row.

const { NAME_PATTERN } = require('../utils/playerName');

// `[12:34:56] [Server thread/INFO]: ` and variants such as
// `[12:34:56] [Server thread/INFO] [minecraft/MinecraftServer]: `.
const PREFIX_RE = /^\[(\d{2}:\d{2}:\d{2})\] \[[^\]]+\](?: \[[^\]]+\])*:\s?/;

// Includes Bedrock/Geyser-Floodgate's leading "." (or "*") prefix - without
// it, every join/leave/chat/advancement/death line from a Bedrock player
// silently failed to match and just vanished from the activity feed.
const NAME = NAME_PATTERN;
// Same, but a 2-char minimum: this one's used to tell a real player apart
// from a single stray token in death-message parsing (`looksLikePlayer`),
// where a 1-char match is more likely noise than a legitimate short name.
const PLAYER_RE = /^[.*]?[A-Za-z0-9_]{2,16}$/;

const CHAT_RE = new RegExp(`^<(${NAME})> (.*)$`);
const SERVER_CHAT_RE = /^\[(?:Server|Rcon)\] (.*)$/;
const JOIN_RE = new RegExp(`^(${NAME}) joined the game$`);
const LOGGED_IN_RE = new RegExp(`^(${NAME})\\[\\/([^\\]]+)\\] logged in with entity id `);
const LEAVE_RE = new RegExp(`^(${NAME}) left the game$`);
const LOST_CONN_RE = new RegExp(`^(${NAME}) lost connection: (.*)$`);
const ADVANCEMENT_RE = new RegExp(
  `^(${NAME}) has (?:made the advancement|completed the challenge|reached the goal) \\[(.+)\\]$`
);

// Vanilla death messages that carry no meaningful killer token, or where the
// token after "by" is not an entity name. Checked before DEATH_BY_VERBS so
// e.g. "was killed by magic" never yields killer "magic".
const DEATH_PLAIN_VERBS = [
  'was killed by even more magic',
  'was killed by magic',
  'was struck by lightning',
  'was poked to death by a sweet berry bush',
  'was obliterated by a sonically-charged shriek',
  'was frozen to death',
  'froze to death',
  'burned to death',
  'went up in flames',
  'was burnt to a crisp',
  'tried to swim in lava',
  'discovered the floor was lava',
  'walked into the danger zone',
  'drowned',
  'suffocated in a wall',
  'was squished too much',
  'starved to death',
  'withered away',
  'hit the ground too hard',
  'fell from a high place',
  'fell off a ladder',
  'fell off some vines',
  'fell off some weeping vines',
  'fell off some twisting vines',
  'fell off scaffolding',
  'fell while climbing',
  'fell out of the world',
  'was doomed to fall',
  'experienced kinetic energy',
  'blew up',
  'went off with a bang',
  "was roasted in dragon's breath",
  'left the confines of this world',
  'walked into a cactus',
  'was stung to death',
  'was pricked to death',
  'died',
];

// Death messages where the next token names the killer (player or mob).
const DEATH_BY_VERBS = [
  'was shot by a skull from',
  'was slain by',
  'was shot by',
  'was blown up by',
  'was fireballed by',
  'was pummeled by',
  'was impaled by',
  'was skewered by',
  'was squashed by',
  'was spitballed by',
  'was killed trying to hurt',
  "didn't want to live in the same world as",
  'was killed by',
];

// Death-verb matching used to scan every verb (a linear startsWith per line),
// which is hot: every log line whose leading token is a player name paid the
// full ~90-verb scan. A single trie turns that into one walk over the message,
// preserving the exact sequential semantics below:
//   - any DEATH_PLAIN verb matching at a word boundary wins (return shape is
//     identical for every plain verb), else
//   - the lowest-array-index DEATH_BY verb matching at a boundary decides the
//     killer token (its length picks the word right after the verb).
function buildDeathTrie(plainVerbs, byVerbs) {
  const root = { c: {}, p: -1, b: -1 };
  const insert = (verb, kind, idx) => {
    let n = root;
    for (const ch of verb) {
      if (!n.c[ch]) n.c[ch] = { c: {}, p: -1, b: -1 };
      n = n.c[ch];
    }
    if (kind === 'p') n.p = idx;
    else n.b = idx;
  };
  plainVerbs.forEach((v, i) => insert(v, 'p', i));
  byVerbs.forEach((v, i) => insert(v, 'b', i));
  return root;
}
const DEATH_TRIE = buildDeathTrie(DEATH_PLAIN_VERBS, DEATH_BY_VERBS);

/**
 * Match a death-message tail (the part after the player token) against the
 * verb trie. Returns { kind: 'plain' } when any plain verb matches at a word
 * boundary, { kind: 'by', len } when a killer verb does (len = verb length to
 * slice the killer token from), or null on no match.
 */
function matchDeathTail(rest) {
  let node = DEATH_TRIE;
  let plainHit = false;
  let bestByIdx = Infinity;
  let bestByLen = -1;
  for (let i = 0; i < rest.length; i++) {
    node = node.c[rest[i]];
    if (!node) break;
    const atEnd = i === rest.length - 1;
    const isSpace = !atEnd && rest[i + 1] === ' ';
    // Plain verbs match at a word boundary (end of string or a following space),
    // mirroring `rest === verb || rest.startsWith(verb + ' ')`.
    if (atEnd || isSpace) {
      if (node.p >= 0) plainHit = true;
    }
    // Killer verbs only match when a killer token follows (a space after the
    // verb), mirroring `rest.startsWith(verb + ' ')` with a real tail.
    if (isSpace && node.b >= 0 && node.b < bestByIdx) {
      bestByIdx = node.b;
      bestByLen = i + 1;
    }
  }
  if (plainHit) return { kind: 'plain' };
  if (bestByIdx < Infinity) return { kind: 'by', len: bestByLen };
  return null;
}

// Single-word vanilla mob names as they appear in death messages (multi-word
// mobs like "Wither Skeleton" fail the player-name shape check anyway).
const MOB_NAMES = new Set([
  'zombie',
  'skeleton',
  'creeper',
  'spider',
  'slime',
  'witch',
  'blaze',
  'ghast',
  'enderman',
  'endermite',
  'silverfish',
  'guardian',
  'shulker',
  'husk',
  'stray',
  'vex',
  'vindicator',
  'evoker',
  'illusioner',
  'drowned',
  'phantom',
  'pillager',
  'ravager',
  'zoglin',
  'hoglin',
  'piglin',
  'wither',
  'warden',
  'wolf',
  'bee',
  'goat',
  'llama',
  'panda',
  'pufferfish',
  'fox',
  'dolphin',
  'breeze',
  'bogged',
  'creaking',
]);

function looksLikePlayer(name) {
  return PLAYER_RE.test(name) && !MOB_NAMES.has(name.toLowerCase());
}

/** Classify one console line. Returns null for anything non-player-facing. */
function classify(line) {
  if (!line) return null;
  // ANSI color escapes (docker log streams) and Minecraft formatting codes.
  let text = String(line)
    .replace(/\[[0-9;]*m/g, '')
    .replace(/§[0-9a-fk-or]/gi, '')
    .trim();

  let time = null;
  const prefix = text.match(PREFIX_RE);
  if (prefix) {
    time = prefix[1];
    text = text.slice(prefix[0].length).trim();
  }
  // 1.19+ marks unsigned chat (and rcon/console say) with this prefix.
  text = text.replace(/^\[Not Secure\] /, '');
  if (!text) return null;

  let m;
  if ((m = text.match(CHAT_RE))) {
    return { time, type: 'chat', player: m[1], target: '', message: m[2] };
  }
  if ((m = text.match(SERVER_CHAT_RE))) {
    return { time, type: 'chat', player: '[Server]', target: '', message: m[1] };
  }
  if ((m = text.match(JOIN_RE))) {
    return { time, type: 'join', player: m[1], target: '', message: '' };
  }
  if ((m = text.match(LOGGED_IN_RE))) {
    // Secondary join line; the IP (port stripped) goes to target, never message.
    return { time, type: 'join', player: m[1], target: m[2].replace(/:\d+$/, ''), message: '', dedupe: true };
  }
  if ((m = text.match(LEAVE_RE))) {
    return { time, type: 'leave', player: m[1], target: '', message: '' };
  }
  if ((m = text.match(LOST_CONN_RE))) {
    return { time, type: 'leave', player: m[1], target: '', message: m[2], dedupe: true };
  }
  if ((m = text.match(ADVANCEMENT_RE))) {
    return { time, type: 'advancement', player: m[1], target: '', message: m[2] };
  }

  // Death messages: "<player> <verb...>" where player is the first token.
  const space = text.indexOf(' ');
  if (space > 0) {
    const player = text.slice(0, space);
    const rest = text.slice(space + 1);
    if (PLAYER_RE.test(player)) {
      const hit = matchDeathTail(rest);
      if (hit && hit.kind === 'plain') {
        return { time, type: 'death', player, target: '', message: text };
      }
      if (hit && hit.kind === 'by') {
        const killer = rest.slice(hit.len + 1).split(/\s+/)[0] || '';
        // Only record target when the killer looks like a real player (PvP).
        return {
          time,
          type: 'death',
          player,
          target: looksLikePlayer(killer) ? killer : '',
          message: text,
        };
      }
    }
  }
  return null;
}

/** True when a (death) event was a player-vs-player kill. */
function isPvp(evt) {
  return Boolean(evt && evt.type === 'death' && evt.target && looksLikePlayer(evt.target));
}

module.exports = { classify, isPvp, looksLikePlayer };
