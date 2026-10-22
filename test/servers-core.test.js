'use strict';

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/db');
const servers = require('../src/services/servers');
const secrets = require('../src/services/secrets');
const app = require('./helpers/app');

test.before(async () => {
  await app.start();
});
test.after(async () => {
  await app.stop();
});

test('updateServer flags a recreate when memory/version/java fields change', async () => {
  const id = app.seedServer('srv_gr1');
  const res = servers.updateServer(id, { heapMb: 2048, mcVersion: '1.21' }, { actor: 'tester' });
  assert.equal(res.needsRecreate, true);
  assert.equal(servers.getServer(id).heap_mb, 2048);
  assert.equal(servers.getServer(id).mc_version, '1.21');
  assert.equal(servers.getServer(id).pending_recreate, 1);
});

test('updateServer does not flag a recreate for cosmetic-only changes', () => {
  const id = app.seedServer('srv_gr2');
  const res = servers.updateServer(id, { name: 'Renamed', accent: 'Blue' });
  assert.equal(res.needsRecreate, false);
  assert.equal(servers.getServer(id).display_name, 'Renamed');
});

test('updateServer with no effective changes returns the unchanged server', () => {
  const id = app.seedServer('srv_gr3');
  const res = servers.updateServer(id, { accent: undefined });
  assert.equal(res.needsRecreate, false);
  assert.deepEqual(res.server.id, id);
});

test('updateServer converts disk quota to/from bytes', () => {
  const id = app.seedServer('srv_gr4');
  servers.updateServer(id, { diskQuotaGb: 10 });
  const row = db.get('SELECT disk_quota_bytes FROM servers WHERE id = ?', id);
  assert.equal(row.disk_quota_bytes, 10 * 1024 ** 3);
  const diff = servers.updateServer(id, { diskQuotaGb: 10 }).server;
  assert.equal(diff.disk_quota_bytes, 10 * 1024 ** 3);
});

test('updateServer applies boolean flags and persists env/tags', () => {
  const id = app.seedServer('srv_gr5');
  const res = servers.updateServer(id, {
    autoStart: true,
    quotaStrict: true,
    tags: ['foo'],
    env: { ENABLE_AUTOPAUSE: 'TRUE' },
  });
  assert.equal(res.needsRecreate, true);
  const server = servers.getServer(id);
  assert.equal(server.auto_start, 1);
  assert.equal(server.quota_strict, 1);
  assert.deepEqual(server.tags, ['foo']);
  assert.equal(server.env.ENABLE_AUTOPAUSE, 'TRUE');
});

test('assembleEnv enforces panel-owned invariants last', () => {
  const id = app.seedServer('srv_env1');
  const server = servers.getServer(id);
  servers.updateServer(id, {
    env: { EULA: 'FALSE', MEMORY: '999M', LOAD_ENV_FROM_FILE: '/etc/x', SERVER_PORT: '12345' },
  });
  const env = servers.assembleEnv(servers.getServer(id));
  assert.equal(env.EULA, 'TRUE');
  assert.equal(env.MEMORY, `${server.heap_mb}M`);
  assert.equal(env.ENABLE_RCON, 'true');
  assert.equal(env.TYPE, 'PAPER');
  assert.equal(env.LOAD_ENV_FROM_FILE, undefined);
  assert.equal(env.SERVER_PORT, undefined);
  assert.match(env.RCON_PASSWORD, /^[\w-]{12,}$/);
});

test('assembleEnv self-heals an undecryptable RCON password and records an event', () => {
  const id = app.seedServer('srv_env2');
  servers.assembleEnv(servers.getServer(id));
  const row = db.get('SELECT rcon_password_cipher FROM servers WHERE id = ?', id);
  assert.notEqual(row.rcon_password_cipher, 'x');
  const event = db.get(
    "SELECT * FROM events WHERE server_id = ? AND type = 'rcon-password-regenerated' ORDER BY id DESC LIMIT 1",
    id
  );
  assert.ok(event);
});

test('assembleEnv reuses a decryptable RCON password without regenerating', () => {
  const id = app.seedServer('srv_env3');
  const pw = secrets.generatePassword();
  db.run('UPDATE servers SET rcon_password_cipher = ? WHERE id = ?', secrets.encrypt(pw), id);
  const env = servers.assembleEnv(servers.getServer(id));
  assert.equal(env.RCON_PASSWORD, pw);
  const row = db.get('SELECT rcon_password_cipher FROM servers WHERE id = ?', id);
  assert.ok(secrets.tryDecrypt(row.rcon_password_cipher));
});

test('assembleEnv applies the panel timezone only when unset', () => {
  const settings = require('../src/services/settings');
  const id = app.seedServer('srv_env4');
  settings.setTimezone('Etc/GMT-5');
  try {
    const env = servers.assembleEnv(servers.getServer(id));
    assert.equal(env.TZ, 'Etc/GMT-5');
    servers.updateServer(id, { env: { TZ: 'Europe/Berlin' } });
    const custom = servers.assembleEnv(servers.getServer(id));
    assert.equal(custom.TZ, 'Europe/Berlin');
  } finally {
    settings.setTimezone('auto');
  }
});

test('previewCreateSpec applies defaults and supports overrides', () => {
  const defaults = require('../src/config').defaults;
  const preview = servers.previewCreateSpec({ type: 'PAPER', mcVersion: '1.20' });
  assert.equal(preview.env.EULA, 'TRUE');
  assert.equal(preview.env.VERSION, '1.20');
  assert.equal(preview.env.MEMORY, `${defaults.heapMb}M`);
  assert.equal(preview.resources.memoryMb, defaults.containerMemoryMb);
  assert.equal(preview.ports.game, '(auto-assigned)');

  const over = servers.previewCreateSpec({
    type: 'FORGE',
    mcVersion: 'LATEST',
    heapMb: 512,
    containerMemoryMb: 1024,
    cpus: 2,
    portGame: 25565,
    withBedrock: true,
    extraPorts: [{ containerPort: 8080, hostPort: 8080, protocol: 'tcp' }],
  });
  assert.equal(over.env.VERSION, undefined);
  assert.equal(over.env.MEMORY, '512M');
  assert.equal(over.resources.memoryMb, 1024);
  assert.equal(over.resources.cpus, 2);
  assert.equal(over.ports.game, 25565);
  assert.equal(over.ports.rcon, 25565 + require('../src/config').ports.rconOffset);
  assert.equal(over.ports.bedrock, '(auto-assigned)');
  assert.equal(over.ports.extra.length, 1);
});

test('createServer persists a Native Bedrock runtime and uses its container contract', async (t) => {
  const images = require('../src/docker/images');
  const containers = require('../src/docker/containers');
  let created;
  t.mock.method(images, 'ensureImage', async () => {});
  t.mock.method(containers, 'createContainer', async (spec) => {
    created = spec;
    return 'bedrock-container-id';
  });

  const server = await servers.createServer(
    {
      name: 'Bedrock test',
      runtime: 'bedrock',
      type: 'BEDROCK',
      mcVersion: 'PREVIEW',
      eulaAccepted: true,
      portGame: 45211,
      autoBackup: false,
    },
    { start: false }
  );

  assert.equal(server.runtime, 'bedrock');
  assert.equal(server.type, 'BEDROCK');
  assert.equal(server.port_rcon, 0);
  assert.equal(created.runtime, 'bedrock');
  assert.equal(created.image, 'itzg/minecraft-bedrock-server:latest');
  assert.equal(created.env.EULA, 'TRUE');
  assert.equal(created.env.VERSION, 'PREVIEW');
  assert.equal(created.env.TYPE, undefined);
  assert.equal(created.env.ENABLE_RCON, undefined);
  assert.equal(created.env.RCON_PASSWORD, undefined);
  assert.equal(created.ports.game, 45211);
  assert.equal(created.ports.rcon, 0);
});

test('createServer reserves NetherNet signaling and a player-sized UDP range by default', async (t) => {
  const images = require('../src/docker/images');
  const containers = require('../src/docker/containers');
  let created;
  t.mock.method(images, 'ensureImage', async () => {});
  t.mock.method(containers, 'createContainer', async (spec) => {
    created = spec;
    return 'nethernet-container-id';
  });

  const server = await servers.createServer(
    {
      name: 'NetherNet test',
      runtime: 'bedrock',
      type: 'BEDROCK',
      eulaAccepted: true,
      portGame: 45212,
      netherNetUdpStart: 45220,
      maxPlayers: 3,
    },
    { start: false }
  );

  assert.equal(server.bedrock_transport, 'nethernet');
  assert.equal(server.nethernet_udp_start, 45220);
  assert.equal(server.nethernet_udp_end, 45222);
  assert.deepEqual(created.ports, { game: 45212, rcon: 0, bedrock: null, nethernetUdpStart: 45220, nethernetUdpEnd: 45222 });
  assert.equal(created.env.MAX_PLAYERS, '3');
  assert.equal(created.env.SERVER_UDP_PORTS, '19140-19142');
});

test('createServer rejects an advanced mapping that overlaps a NetherNet UDP range', async () => {
  await assert.rejects(
    servers.createServer(
      {
        name: 'Conflicting NetherNet ports',
        runtime: 'bedrock',
        type: 'BEDROCK',
        eulaAccepted: true,
        portGame: 45240,
        netherNetUdpStart: 45250,
        maxPlayers: 2,
        extraPorts: [{ hostPort: 45251, containerPort: 8080, protocol: 'tcp' }],
      },
      { start: false }
    ),
    /advanced port mapping conflicts/i
  );
});

test('dirSize sums file sizes including nested subdirectories', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'msm-dirsize-'));
  try {
    fs.writeFileSync(path.join(root, 'a.bin'), Buffer.alloc(100));
    fs.mkdirSync(path.join(root, 'sub'));
    fs.writeFileSync(path.join(root, 'sub', 'b.bin'), Buffer.alloc(250));
    assert.equal(await servers.dirSize(root), 350);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
