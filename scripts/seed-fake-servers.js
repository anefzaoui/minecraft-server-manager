'use strict';

// Seeds fake server rows for UI/dev testing - realistic-looking metadata
// (name, type, version, resources, tags, icon, accent), but no Docker image
// pull and no real container. Start/stop/console/RCON won't work against
// them; everything else (lists, search/filter/sort, settings, players,
// backups UI, etc.) renders normally since it's real DB data.
//
// Safe to run repeatedly - each run only ADDS servers, it never touches
// existing ones.
//
// Usage:
//   node scripts/seed-fake-servers.js [count]
//
// count defaults to 3, capped at 50.

const { nanoid } = require('nanoid');
const db = require('../src/db');
const { migrate } = require('../src/db/migrate');
const { suggestPorts } = require('../src/services/ports');
const secrets = require('../src/services/secrets');

const TYPES = ['VANILLA', 'PAPER', 'PURPUR', 'FORGE', 'NEOFORGE', 'FABRIC', 'QUILT'];
const VERSIONS = ['1.21.4', '1.21.1', '1.20.6', '1.20.4', '1.20.1', '1.19.4', 'LATEST'];
const ICONS = ['grass', 'creeper', 'sword', 'tnt', 'diamond', 'chest', 'potion', 'portal'];
// Same swatches the wizard's accent picker offers (Grass/Diamond/Redstone/Gold/Amethyst).
const ACCENTS = ['#3fa62b', '#21a7ab', '#e5484d', '#e99417', '#9a5cc6'];
const TAG_POOL = [
  'smp',
  'modded',
  'creative',
  'survival',
  'friends',
  'test',
  'skyblock',
  'pvp',
  'hardcore',
  'vanilla+',
];
const HEAP_OPTIONS_MB = [2048, 3072, 4096, 6144, 8192];

const ADJECTIVES = [
  'Emerald',
  'Obsidian',
  'Redstone',
  'Nether',
  'Crystal',
  'Sunken',
  'Frostbound',
  'Rusty',
  'Ancient',
  'Blazing',
  'Shattered',
  'Golden',
  'Whispering',
  'Iron',
  'Molten',
];
const NOUNS = [
  'Outpost',
  'Frontier',
  'Nexus',
  'Hollow',
  'Bastion',
  'Archipelago',
  'Sanctum',
  'Overlook',
  'Hideout',
  'Republic',
  'Enclave',
  'Depths',
  'Summit',
  'Refuge',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

/** "Emerald Outpost" style, retried until it doesn't collide with an existing name. */
function randomName(used) {
  let name;
  do {
    name = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  } while (used.has(name));
  used.add(name);
  return name;
}

async function seedOne(usedNames) {
  const id = `srv_${nanoid(8)}`;
  const name = randomName(usedNames);
  const type = pick(TYPES);
  const heapMb = pick(HEAP_OPTIONS_MB);
  const containerMemoryMb = Math.round((heapMb * 1.5) / 512) * 512;
  // Real allocator: checks the DB AND probes the OS, so fake servers can't
  // collide with each other or with a real server/process on this machine.
  const ports = await suggestPorts();

  db.run(
    `INSERT INTO servers (id, display_name, description, icon, accent, tags_json, type, mc_version,
       java_tag, env_json, port_game, port_rcon, rcon_password_cipher, heap_mb, container_memory_mb,
       container_swap_mb, cpus, disk_quota_bytes, quota_strict, update_policy, auto_start, auto_restart, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', '{}', ?, ?, ?, ?, ?, 0, 0, ?, 0, 'manual', 0, 1, 'stopped')`,
    id,
    name,
    'Seeded test server - fake data, no real Docker container.',
    pick(ICONS),
    pick(ACCENTS),
    JSON.stringify(pickSome(TAG_POOL, 1 + Math.floor(Math.random() * 3))),
    type,
    pick(VERSIONS),
    ports.game,
    ports.rcon,
    secrets.encrypt(secrets.generatePassword()),
    heapMb,
    containerMemoryMb,
    25 * 1024 ** 3 // 25 GB disk quota, matching the panel's own default
  );
  return { id, name, type };
}

async function main() {
  const count = Math.max(1, Math.min(50, Number(process.argv[2]) || 3));
  migrate();

  const usedNames = new Set(
    db.all('SELECT display_name FROM servers WHERE deleted_at IS NULL').map((r) => r.display_name)
  );
  const created = [];
  for (let i = 0; i < count; i++) {
    created.push(await seedOne(usedNames));
  }

  console.log(`Seeded ${created.length} fake server(s):`);
  for (const s of created) console.log(`  - ${s.name}  (${s.id}, ${s.type})`);
  console.log(
    '\nThese are DB rows only, with no matching Docker container - Start/Console/RCON will fail against ' +
      'them, but everything else (dashboard, search/filter/sort, settings, players, backups UI, …) works ' +
      'normally. Delete them from the panel like any other server when done.'
  );
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
