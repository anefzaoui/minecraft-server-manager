'use strict';

// Seeds a fake roster onto one server, or every server at once - whitelist,
// ops, a temp AND a permanent ban, a linked IP ban, and a couple of
// moderator notes - through the exact same service functions the real
// players UI calls, so it's a good way to exercise the players/moderation
// pages without a live server.
//
// Usage:
//   node scripts/seed-players.js [serverId] [count]
//   node scripts/seed-players.js --all [count]
//
// serverId defaults to the most recently created server (typically the one
// you just made with `pnpm run seed:servers`). --all seeds every server that
// doesn't already have a roster instead - servers that already have players
// (real or previously seeded) are left untouched and reported, not
// overwritten, since usercache.json is a full replace, not a merge. count
// defaults to 6, capped at 30 (the fake-name pool's size).
//
// The single-target form deliberately requires an explicit id rather than
// defaulting to "every server" - this writes real whitelist/op/ban data, and
// doing that to a real server by accident would be a genuinely bad time.
// --all is opt-in for exactly that reason.

const db = require('../src/db');
const { migrate } = require('../src/db/migrate');
const players = require('../src/services/players');
const { seedPlayersForServer } = require('./lib/fakePlayers');

function parseArgs(argv) {
  let serverId = null;
  let count = 6;
  let all = false;
  for (const arg of argv) {
    if (arg === '--all') all = true;
    else if (/^\d+$/.test(arg)) count = Math.max(1, Math.min(30, Number(arg)));
    else serverId = arg;
  }
  return { serverId, count, all };
}

// rowid, not created_at: several servers created in the same batch (e.g. by
// seed:servers) can land in the same second - created_at has no sub-second
// resolution, so ordering by it doesn't reliably pick the actual last one.
// rowid is monotonic insertion order regardless of timestamp granularity.
function listServers() {
  return db.all('SELECT id, display_name FROM servers WHERE deleted_at IS NULL ORDER BY rowid DESC');
}

function reportRoster(target, roster) {
  console.log(`Seeded ${roster.total} fake player(s) onto "${target.display_name}" (${target.id}):`);
  if (roster.opped) console.log(`  - ${roster.opped} opped`);
  if (roster.banned) console.log(`  - ${roster.banned} banned (+ a linked IP ban)`);
}

async function seedAll(count) {
  const all = listServers();
  if (!all.length) {
    console.error('No servers exist yet. Run `pnpm run seed:servers` first.');
    process.exit(1);
  }
  let seeded = 0;
  let skipped = 0;
  for (const target of all) {
    // Full replace, not a merge - never clobber a server that already has a
    // roster, real or previously seeded.
    if (players.readJson(target.id, 'usercache.json').length > 0) {
      console.log(`Skipped "${target.display_name}" (${target.id}) - already has players.`);
      skipped += 1;
      continue;
    }
    const roster = await seedPlayersForServer(target.id, count);
    reportRoster(target, roster);
    seeded += 1;
  }
  console.log(`\n${seeded} server(s) seeded, ${skipped} skipped (already had players).`);
}

async function main() {
  migrate();
  const { serverId, count, all } = parseArgs(process.argv.slice(2));

  if (all) {
    await seedAll(count);
    return;
  }

  let target;
  if (serverId) {
    target = db.get('SELECT id, display_name FROM servers WHERE id = ? AND deleted_at IS NULL', serverId);
    if (!target) {
      const allServers = listServers();
      console.error(`No server found with id "${serverId}".`);
      console.error(
        allServers.length
          ? `Available servers:\n${allServers.map((s) => `  ${s.id}  ${s.display_name}`).join('\n')}`
          : 'No servers exist yet. Run `pnpm run seed:servers` first.'
      );
      process.exit(1);
    }
  } else {
    target = listServers()[0];
    if (!target) {
      console.error(
        'No servers exist yet. Run `pnpm run seed:servers` first, or pass a server id:\n' +
          '  node scripts/seed-players.js <serverId> [count]'
      );
      process.exit(1);
    }
  }

  const roster = await seedPlayersForServer(target.id, count);
  reportRoster(target, roster);
  console.log(
    '\nWhitelist/ops/bans/notes are real writes via the same service functions the players UI calls - ' +
      "open the server's Players tab in the panel to see them."
  );
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
