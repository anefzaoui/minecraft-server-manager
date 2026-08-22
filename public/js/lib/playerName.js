// Mirrors src/utils/playerName.js. Java usernames are 1-16 chars of
// [A-Za-z0-9_]; Bedrock players (Geyser/Floodgate) carry a leading "." (or
// sometimes "*") glued onto that name - accept it here too, or a Bedrock
// player's name gets rejected by every "add player"/manual-entry form before
// it ever reaches the API.
export const PLAYER_NAME_RE = /^[.*]?[A-Za-z0-9_]{1,16}$/;

export function isBedrockName(name) {
  return /^[.*]/.test(String(name ?? ''));
}
