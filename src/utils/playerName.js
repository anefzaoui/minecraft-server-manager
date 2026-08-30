'use strict';

// Java usernames are 1-16 chars of [A-Za-z0-9_] (Mojang requires 3-16 for new
// accounts, but legacy/cracked names can be shorter, so this stays lenient -
// matches the historical behavior every caller here already relied on).
//
// Bedrock players joining through Geyser/Floodgate get a single
// non-alphanumeric prefix character glued onto that name - "." by default
// (Floodgate's `username-prefix` setting), sometimes "*" on alternate
// configs. Every username check in the app needs to accept that prefix, or a
// Bedrock player is invisible to whitelist/ops/bans/kicks/teleports/
// inventory/chat, silently drops out of the join/leave/chat activity feed,
// and their own player-detail page 404s.
//
// NAME_PATTERN is a raw string fragment (no anchors) for embedding inside a
// bigger pattern (e.g. logClassifier's `^(<name>) joined the game$`);
// PLAYER_NAME_RE is the anchored, ready-to-use form for standalone checks.
const NAME_PATTERN = '[.*]?[A-Za-z0-9_]{1,16}';
const PLAYER_NAME_RE = new RegExp(`^${NAME_PATTERN}$`);

function isValidPlayerName(name) {
  return PLAYER_NAME_RE.test(String(name ?? ''));
}

/** True when `name` carries a Bedrock (Geyser/Floodgate) prefix. */
function isBedrockName(name) {
  return /^[.*]/.test(String(name ?? ''));
}

module.exports = { NAME_PATTERN, PLAYER_NAME_RE, isValidPlayerName, isBedrockName };
