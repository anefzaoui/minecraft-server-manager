'use strict';

// Native Bedrock has its own player identity and permission model.  Keep it
// separate from the Java player service: Bedrock identities are gamertags or
// XUIDs, not Mojang UUID profiles, and BDS owns the allowlist/permission data.

const httpError = require('../utils/httpError');
const fs = require('node:fs/promises');
const path = require('node:path');
const serverRuntime = require('./serverRuntime');
const { sendConsoleCommandParts } = require('./consoleCommands');
const { dataPath } = require('../storage/pathGuard');

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

async function readEntries(file) {
  try {
    const entries = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(entries)) throw new Error('Expected an array.');
    return entries;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw httpError(500, `Could not read Bedrock ${file.endsWith('allowlist.json') ? 'allow list' : 'permissions'} data.`);
  }
}

async function writeEntries(file, entries) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
}

async function setXuidAllowlisted(server, serverId, xuid, on) {
  const file = dataPath('servers', serverId, 'allowlist.json');
  const entries = await readEntries(file);
  const withoutXuid = entries.filter((entry) => entry.xuid !== xuid);
  // BDS matches the supplied XUID. Keep it as the display name too because a
  // bare XUID has no gamertag to store in allowlist.json.
  if (on) withoutXuid.push({ ignoresPlayerLimit: false, name: xuid, xuid });
  await writeEntries(file, withoutXuid);
  await sendConsoleCommandParts(server, serverId, ['allowlist', 'reload']);
}

async function setXuidPermission(server, serverId, xuid, permission) {
  const file = dataPath('servers', serverId, 'permissions.json');
  const entries = await readEntries(file);
  const withoutXuid = entries.filter((entry) => entry.xuid !== xuid);
  withoutXuid.push({ permission, xuid });
  await writeEntries(file, withoutXuid);
  await sendConsoleCommandParts(server, serverId, ['permission', 'reload']);
}

async function setAllowlisted(server, serverId, identity, on) {
  assertBedrock(server);
  const player = assertIdentity(identity);
  if (XUID_RE.test(player)) {
    await setXuidAllowlisted(server, serverId, player, on);
    return { identity: player, allowlisted: Boolean(on) };
  }
  await sendConsoleCommandParts(server, serverId, ['allowlist', on ? 'add' : 'remove', player]);
  return { identity: player, allowlisted: Boolean(on) };
}

async function setPermission(server, serverId, identity, permission) {
  assertBedrock(server);
  const player = assertIdentity(identity);
  const level = String(permission || '').toLowerCase();
  if (!LEVELS.has(level)) throw httpError(400, 'Permission must be visitor, member, or operator.');
  if (XUID_RE.test(player)) {
    await setXuidPermission(server, serverId, player, level);
    return { identity: player, permission: level };
  }
  await sendConsoleCommandParts(server, serverId, ['permission', 'set', player, level]);
  return { identity: player, permission: level };
}

module.exports = { LEVELS, assertIdentity, setAllowlisted, setPermission };
