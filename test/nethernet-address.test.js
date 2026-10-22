'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app');
const db = require('../src/db');
const servers = require('../src/services/servers');
const connection = require('../src/services/bedrockConnection');

let cookie;
const id = 'srv_nethernet_address';

test.before(async () => {
  await app.start();
  cookie = await app.adminCookie();
  db.run(
    `INSERT INTO servers (id, display_name, type, runtime, mc_version, port_game, port_rcon, rcon_password_cipher,
       bedrock_transport, nethernet_udp_start, nethernet_udp_end, advertised_address, heap_mb, container_memory_mb, env_json)
     VALUES (?, 'NetherNet address', 'BEDROCK', 'bedrock', 'LATEST', 45100, 0, '', 'nethernet', 45110, 45125, '192.168.1.42', 1024, 1536, '{}')`,
    id
  );
});

test.after(async () => app.stop());

test('Native Bedrock NetherNet connection details use the configured literal address and complete firewall rules', () => {
  const details = connection.netherNetDetails(servers.getServer(id));
  assert.deepEqual(details, {
    host: '192.168.1.42',
    signalingPort: 45100,
    udpStart: 45110,
    udpEnd: 45125,
    address: '192.168.1.42:45100',
    firewallRules: ['TCP 45100', 'UDP 45110-45125', 'UDP 7551 for LAN discovery'],
  });
  assert.throws(() => connection.normalizeAdvertisedAddress('play.example.com'), /IPv4 or IPv6 address/i);
  assert.equal(connection.normalizeAdvertisedAddress('<public_ip>'), '<public_ip>');
});

test('Bedrock overview and invitation views give the NetherNet host, TCP signaling port, UDP range, and firewall rules', async () => {
  const overview = await app.req('GET', `/servers/${id}`, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(overview.status, 200);
  assert.match(overview.text, /192\.168\.1\.42:45100/);
  assert.match(overview.text, /TCP signaling port.*45100/s);
  assert.match(overview.text, /UDP gameplay ports.*45110-45125/s);

  const invites = await app.req('GET', `/servers/${id}/invites`, { cookie, headers: { Accept: 'text/html' } });
  assert.equal(invites.status, 200);
  assert.match(invites.text, /192\.168\.1\.42:45100/);
  assert.match(invites.text, /TCP 45100/);
  assert.match(invites.text, /UDP 45110-45125/);
  assert.match(invites.text, /UDP 7551 for LAN discovery/);
});
