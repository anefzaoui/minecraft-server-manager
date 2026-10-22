'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

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
      await setAllowlisted({ runtime: 'bedrock' }, 'srv_bedrock', '2533274790123456', false);
      await setPermission({ runtime: 'bedrock' }, 'srv_bedrock', 'Alex One', 'visitor');
      await setPermission({ runtime: 'bedrock' }, 'srv_bedrock', '2533274790123456', 'operator');
    }
  );
  assert.deepEqual(commands, [
    ['allowlist', 'add', 'Alex'],
    ['allowlist', 'remove', '2533274790123456'],
    ['permission', 'set', 'Alex One', 'visitor'],
    ['permission', 'set', '2533274790123456', 'operator'],
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
