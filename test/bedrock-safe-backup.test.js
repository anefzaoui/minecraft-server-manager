'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');

const backupsPath = require.resolve('../src/services/backups');
const commandsPath = require.resolve('../src/services/consoleCommands');

function replacement(modulePath, exports) {
  const previous = require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports };
  return () => {
    if (previous) require.cache[modulePath] = previous;
    else delete require.cache[modulePath];
  };
}

async function withBedrockCommands(sendConsoleCommandParts, fn) {
  const restore = replacement(commandsPath, { sendConsoleCommandParts });
  delete require.cache[backupsPath];
  try {
    return await fn(require(backupsPath));
  } finally {
    delete require.cache[backupsPath];
    restore();
  }
}

test('a Native Bedrock snapshot holds world saves before archiving and always resumes them', async () => {
  const commands = [];
  let archived = false;
  await withBedrockCommands(
    async (_server, _serverId, words) => {
      commands.push(words);
      return { source: 'bedrock-console', output: 'queued' };
    },
    async ({ withBedrockSnapshot }) => {
      await withBedrockSnapshot({ runtime: 'bedrock' }, 'srv_bedrock_backup', async () => {
        archived = true;
      });
    }
  );

  assert.equal(archived, true);
  assert.deepEqual(commands, [
    ['save', 'hold'],
    ['save', 'resume'],
  ]);
});

test('a failed Bedrock save hold aborts the archive instead of creating an inconsistent backup', async () => {
  let archived = false;
  await withBedrockCommands(
    async () => {
      throw new Error('Bedrock console command failed.');
    },
    async ({ withBedrockSnapshot }) => {
      await assert.rejects(
        withBedrockSnapshot({ runtime: 'bedrock' }, 'srv_bedrock_backup', async () => {
          archived = true;
        }),
        /Bedrock console command failed/
      );
    }
  );

  assert.equal(archived, false);
});

test('a failed archive still resumes Bedrock world saves', async () => {
  const commands = [];
  await withBedrockCommands(
    async (_server, _serverId, words) => {
      commands.push(words);
      return { source: 'bedrock-console', output: 'queued' };
    },
    async ({ withBedrockSnapshot }) => {
      await assert.rejects(
        withBedrockSnapshot({ runtime: 'bedrock' }, 'srv_bedrock_backup', async () => {
          throw new Error('archive failed');
        }),
        /archive failed/
      );
    }
  );

  assert.deepEqual(commands, [
    ['save', 'hold'],
    ['save', 'resume'],
  ]);
});
