'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { dataPath } = require('../src/storage/pathGuard');

const commandsPath = require.resolve('../src/services/consoleCommands');
const permissionsPath = require.resolve('../src/services/bedrockPlayerPermissions');

async function withConsole(stub, fn) {
  const previous = require.cache[commandsPath];
  require.cache[commandsPath] = { id: commandsPath, filename: commandsPath, loaded: true, exports: stub };
  delete require.cache[permissionsPath];
  try {
    return await fn(require(permissionsPath));
  } finally {
    if (previous) require.cache[commandsPath] = previous;
    else delete require.cache[commandsPath];
    delete require.cache[permissionsPath];
  }
}

test('Native Bedrock permission changes use supported allowlist and permission console commands', async () => {
  const commands = [];
  await withConsole(
    { sendConsoleCommandParts: async (_server, _serverId, command) => commands.push(command) },
    async ({ setAllowlisted, setPermission }) => {
      await setAllowlisted({ runtime: 'bedrock' }, 'srv_bedrock', 'Alex', true);
      await setPermission({ runtime: 'bedrock' }, 'srv_bedrock', 'Alex One', 'visitor');
    }
  );
  assert.deepEqual(commands, [
    ['allowlist', 'add', 'Alex'],
    ['permission', 'set', 'Alex One', 'visitor'],
  ]);
});

test('Native Bedrock XUID changes update the dedicated-server files and reload them', async () => {
  const serverId = 'srv_xuid_permissions';
  const serverDir = dataPath('servers', serverId);
  await fs.rm(serverDir, { recursive: true, force: true });
  await fs.mkdir(serverDir, { recursive: true });
  const commands = [];

  await withConsole(
    { sendConsoleCommandParts: async (_server, _serverId, command) => commands.push(command) },
    async ({ setAllowlisted, setPermission }) => {
      await setAllowlisted({ runtime: 'bedrock' }, serverId, '2533274790123456', true);
      await setPermission({ runtime: 'bedrock' }, serverId, '2533274790123456', 'operator');
    }
  );

  assert.deepEqual(JSON.parse(await fs.readFile(dataPath('servers', serverId, 'allowlist.json'), 'utf8')), [
    { ignoresPlayerLimit: false, name: '2533274790123456', xuid: '2533274790123456' },
  ]);
  assert.deepEqual(JSON.parse(await fs.readFile(dataPath('servers', serverId, 'permissions.json'), 'utf8')), [
    { permission: 'operator', xuid: '2533274790123456' },
  ]);
  assert.deepEqual(commands, [
    ['allowlist', 'reload'],
    ['permission', 'reload'],
  ]);
});

test('Native Bedrock permission changes reject Java UUIDs and invalid permission levels', async () => {
  await withConsole(
    { sendConsoleCommandParts: async () => assert.fail('console command should not run') },
    async ({ setAllowlisted, setPermission }) => {
      await assert.rejects(
        () => setAllowlisted({ runtime: 'bedrock' }, 'srv_bedrock', '3f5f7c2a-8a4e-4a1a-9c1b-000000000001', true),
        /Xbox gamertag or XUID/
      );
      await assert.rejects(
        () => setPermission({ runtime: 'bedrock' }, 'srv_bedrock', 'Alex', 'admin'),
        /visitor, member, or operator/
      );
    }
  );
});
