'use strict';

// Seeds a fake roster onto ONE server - whitelist, ops, a temp AND a
// permanent ban, a linked IP ban, and a couple of moderator notes - through
// the exact same service functions the real players UI calls, so it's a
// good way to exercise the players/moderation pages without a live server.
//
// Usage:
//   node scripts/seed-players.js [serverId] [count]
//
// serverId defaults to the most recently created server (typically the one
// you just made with `npm run seed:servers`). count defaults to 6, capped
// at 30 (the fake-name pool's size).
//
// Deliberately requires an explicit target rather than defaulting to "every
// server" - this writes real whitelist/op/ban data, and doing that to a real
// server by accident would be a genuinely bad time.

const db = require('../src/db');
const { migrate } = require('../src/db/migrate');
const { seedPlayersForServer } = require('./lib/fakePlayers');

function parseArgs(argv) {
  let serverId = null;
  let count = 6;
  for (const arg of argv) {
    if (/^\d+$/.test(arg)) count = Math.max(1, Math.min(30, Number(arg)));
    else serverId = arg;
  }
  return { serverId, count };
}

// rowid, not created_at: several servers created in the same batch (e.g. by
// seed:servers) can land in the same second - created_at has no sub-second
// resolution, so ordering by it doesn't reliably pick the actual last one.
// rowid is monotonic insertion order regardless of timestamp granularity.
function listServers() {
  return db.all('SELECT id, display_name FROM servers WHERE deleted_at IS NULL ORDER BY rowid DESC');
}

async function main() {
  migrate();
  const { serverId, count } = parseArgs(process.argv.slice(2));

  let target;
  if (serverId) {
    target = db.get('SELECT id, display_name FROM servers WHERE id = ? AND deleted_at IS NULL', serverId);
    if (!target) {
      const all = listServers();
      console.error(`No server found with id "${serverId}".`);
      console.error(
        all.length
          ? `Available servers:\n${all.map((s) => `  ${s.id}  ${s.display_name}`).join('\n')}`
          : 'No servers exist yet - run `npm run seed:servers` first.'
      );
      process.exit(1);
    }
  } else {
    target = listServers()[0];
    if (!target) {
      console.error(
        'No servers exist yet. Run `npm run seed:servers` first, or pass a server id:\n' +
          '  node scripts/seed-players.js <serverId> [count]'
      );
      process.exit(1);
    }
  }

  const roster = await seedPlayersForServer(target.id, count);
  console.log(`Seeded ${roster.total} fake player(s) onto "${target.display_name}" (${target.id}):`);
  if (roster.opped) console.log(`  - ${roster.opped} opped`);
  if (roster.banned) console.log(`  - ${roster.banned} banned (+ a linked IP ban)`);
  console.log(
    '\nWhitelist/ops/bans/notes are real writes via the same service functions the players UI calls - ' +
      "open the server's Players tab in the panel to see them."
  );
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
