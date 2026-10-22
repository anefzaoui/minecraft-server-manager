'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const containersPath = require.resolve('../src/docker/containers');
const commandsPath = require.resolve('../src/services/consoleCommands');

async function withContainers(stub, fn) {
  const previous = require.cache[containersPath];
  require.cache[containersPath] = { id: containersPath, filename: containersPath, loaded: true, exports: stub };
  delete require.cache[commandsPath];
  try {
    return await fn(require(commandsPath));
  } finally {
    if (previous) require.cache[containersPath] = previous;
    else delete require.cache[containersPath];
    delete require.cache[commandsPath];
  }
}

test('a Native Bedrock console command uses send-command and explains that output is in the live log', async () => {
  let received;
  await withContainers(
    {
      execCaptureChecked: async (_serverId, command) => {
        received = command;
        return { stdout: '', exitCode: 0 };
      },
    },
    async ({ sendConsoleCommand }) => {
      const result = await sendConsoleCommand({ runtime: 'bedrock' }, 'srv_bedrock', 'gamerule dofiretick false');
      assert.deepEqual(result, {
        source: 'bedrock-console',
        output: 'Command sent to the Bedrock console. Its result will appear in the live log.',
      });
    }
  );
  assert.deepEqual(received, ['send-command', 'gamerule', 'dofiretick', 'false']);
});

test('a Native Bedrock console command reports send-command failures instead of treating them as command output', async () => {
  await withContainers(
    {
      execCaptureChecked: async () => ({ stdout: 'ERROR: unable to find bedrock server process', exitCode: 2 }),
    },
    async ({ sendConsoleCommand }) => {
      await assert.rejects(
        () => sendConsoleCommand({ runtime: 'bedrock' }, 'srv_bedrock', 'say hello'),
        /Bedrock console command failed: ERROR: unable to find bedrock server process/
      );
    }
  );
});

test('a Java console command retains its RCON result behavior', async () => {
  let received;
  await withContainers(
    {
      execCapture: async (_serverId, command) => {
        received = command;
        return '\u001b[32mDone\u001b[0m';
      },
    },
    async ({ sendConsoleCommand }) => {
      const result = await sendConsoleCommand({ runtime: 'java' }, 'srv_java', 'say hello');
      assert.deepEqual(result, { source: 'rcon', output: 'Done' });
    }
  );
  assert.deepEqual(received, ['rcon-cli', '--', 'say', 'hello']);
});
