// Cross-platform dev runner: Tailwind watcher + auto-restarting app server.
// Replaces `concurrently` so we carry zero extra dev dependencies.
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

function run(name, cmd, args) {
  const child = spawn(cmd, args, { cwd: root, shell: isWin, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `[${name}] `;
  const pipe = (stream) =>
    stream.on('data', (buf) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        if (line.trim()) process.stdout.write(prefix + line + '\n');
      }
    });
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`);
  });
  return child;
}

const css = run('css', npx, ['@tailwindcss/cli', '-i', 'assets/css/input.css', '-o', 'public/css/app.css', '--watch']);
const app = run('app', process.execPath, ['--watch', 'src/server.js']);

function shutdown() {
  css.kill();
  app.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
