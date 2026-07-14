'use strict';

// Runtime preflight — runs FIRST in the boot sequence (before config, the DB, or
// the runtime uncaughtException net). Its whole job is to turn "won't run on this
// Node" from a cryptic swallowed error into one clear, actionable line.
//
// The app depends on the built-in `node:sqlite`, which is flagless and available
// from Node 23.4+ and shipped in the Node 24 LTS line. On the Node 22.x LTS line
// it exists only behind `--experimental-sqlite`, so a stranger who installs the
// default LTS and runs `node src/server.js` would otherwise hit
// `ERR_UNKNOWN_BUILTIN_MODULE` with no hint about why.

const MIN_MAJOR = 24;

function fail(message) {
  // Written straight to stderr so it survives even if logging isn't set up yet.
  process.stderr.write('\n' + message + '\n\n');
  process.exit(1);
}

const nodeVersion = process.versions.node;
const major = Number(nodeVersion.split('.')[0]);

try {
  // Probe the one built-in that gates the whole app.
  require('node:sqlite');
} catch (err) {
  if (err && err.code === 'ERR_UNKNOWN_BUILTIN_MODULE') {
    fail(
      `Minecraft Server Manager needs Node.js ${MIN_MAJOR} or newer.\n` +
        `  You are running Node ${nodeVersion}, where the built-in \`node:sqlite\` module\n` +
        `  is not available (on the Node 22.x line it exists only behind\n` +
        `  --experimental-sqlite). Install Node ${MIN_MAJOR} LTS from https://nodejs.org/\n` +
        `  and run the panel again.`
    );
  }
  throw err;
}

if (major < MIN_MAJOR) {
  // node:sqlite loaded (e.g. a 22.x/23.x build with the flag) but we're below the
  // supported floor — warn, don't block: the operator clearly opted in.
  console.warn(
    `[preflight] Node ${nodeVersion} is below the supported floor (Node ${MIN_MAJOR}+). ` +
      `node:sqlite is experimental here; upgrade to Node ${MIN_MAJOR} LTS if you hit problems.`
  );
}

module.exports = { MIN_MAJOR };
