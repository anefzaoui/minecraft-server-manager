'use strict';

// Native Bedrock has its own player identity and permission model.  Keep it
// separate from the Java player service: Bedrock identities are gamertags or
// XUIDs, not Mojang UUID profiles, and BDS owns the allowlist/permission data.

const httpError = require('../utils/httpError');
const serverRuntime = require('./serverRuntime');
const { sendConsoleCommandParts } = require('./consoleCommands');

const XUID_RE = /^\d{10,20}$/;
const GAMERTAG_RE = /^[\p{L}\p{N} _.-]{1,16}$/u;
const LEVELS = new Set(['visitor', 'member', 'operator']);

function assertIdentity(identity) {
  const value = String(identity || '').trim();
  if (!XUID_RE.test(value) && !GAMERTAG_RE.test(value)) {
    throw httpError(400, 'Enter a valid Xbox gamertag or XUID.');
  }
  return value;
}

function assertBedrock(server) {
  if (!serverRuntime.supports(server, 'bedrockPlayerPermissions')) {
    throw httpError(400, 'Bedrock player permissions are only available for Native Bedrock servers.');
  }
}

async function setAllowlisted(server, serverId, identity, on) {
  assertBedrock(server);
  const player = assertIdentity(identity);
  await sendConsoleCommandParts(server, serverId, ['allowlist', on ? 'add' : 'remove', player]);
  return { identity: player, allowlisted: Boolean(on) };
}

async function setPermission(server, serverId, identity, permission) {
  assertBedrock(server);
  const player = assertIdentity(identity);
  const level = String(permission || '').toLowerCase();
  if (!LEVELS.has(level)) throw httpError(400, 'Permission must be visitor, member, or operator.');
  await sendConsoleCommandParts(server, serverId, ['permission', 'set', player, level]);
  return { identity: player, permission: level };
}

module.exports = { LEVELS, assertIdentity, setAllowlisted, setPermission };
