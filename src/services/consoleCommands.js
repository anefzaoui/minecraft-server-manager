'use strict';

// The Native Bedrock image has no RCON service. Its bundled `send-command`
// utility writes to the Bedrock server process's stdin; BDS sends any command
// result to its stdout, which the panel already exposes as the live log.

const { execCapture, execCaptureChecked } = require('../docker/containers');
const serverRuntime = require('./serverRuntime');
const { stripAnsi } = require('../utils/ansi');

const BEDROCK_QUEUED_OUTPUT = 'Command sent to the Bedrock console. Its result will appear in the live log.';

/**
 * Send an administrator command through the runtime's supported console path.
 *
 * @param {{runtime?: unknown}} server
 * @param {string} serverId
 * @param {string} command already validated/trimmed panel command
 * @returns {Promise<{source: 'rcon'|'bedrock-console', output: string}>}
 */
async function sendConsoleCommand(server, serverId, command) {
  const words = command.split(/\s+/);
  if (serverRuntime.supports(server, 'bedrockConsole')) {
    const { stdout, exitCode } = await execCaptureChecked(serverId, ['send-command', ...words]);
    if (exitCode !== 0) {
      const detail = String(stdout || '').trim();
      throw new Error(`Bedrock console command failed${detail ? `: ${detail}` : '.'}`);
    }
    return { source: 'bedrock-console', output: BEDROCK_QUEUED_OUTPUT };
  }

  const raw = await execCapture(serverId, ['rcon-cli', '--', ...words]);
  return { source: 'rcon', output: stripAnsi(raw).trim() };
}

module.exports = { BEDROCK_QUEUED_OUTPUT, sendConsoleCommand };
