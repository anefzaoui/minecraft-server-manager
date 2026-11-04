'use strict';

// Networks (#5): ensureNetwork creates a missing bridge network on demand, and
// containers.createContainer runs it before creating the container so a
// wizard/Settings network name can be brand new instead of requiring it to
// exist on the host first.

require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/db/migrate').migrate(); // containers.js reads the servers table via db

// Stub the Docker client BEFORE networks.js/containers.js load.
const connect = require('../src/docker/connect');
let names = []; // listNetworks result
let created = []; // createNetwork specs
let fail = null; // next createNetwork failure to simulate
let createdContainerSpec = null;
connect.getDocker = () => ({
  listNetworks: async () => names.map((name) => ({ Name: name, Driver: 'bridge', Scope: 'local', Id: 'x' })),
  createNetwork: async (spec) => {
    created.push(spec); // record the attempt regardless of outcome
    if (fail) {
      const err = new Error('createNetwork exploded');
      err.statusCode = fail;
      throw err;
    }
  },
  createContainer: async (spec) => {
    createdContainerSpec = spec;
    return { id: 'abc' };
  },
});

const networks = require('../src/docker/networks');
const containers = require('../src/docker/containers');

test('ensureNetwork creates a missing network with the bridge driver and dedup flag', async () => {
  names = [];
  created = [];
  assert.equal(await networks.ensureNetwork('fresh-net'), true);
  assert.deepEqual(created, [{ Name: 'fresh-net', Driver: 'bridge', CheckDuplicate: true }]);
});

test('ensureNetwork does nothing for an existing network', async () => {
  names = ['existing-net'];
  created = [];
  assert.equal(await networks.ensureNetwork('existing-net'), false);
  assert.deepEqual(created, []);
});

test('ensureNetwork treats a 409 race as already-created', async () => {
  names = [];
  created = [];
  fail = 409;
  assert.equal(await networks.ensureNetwork('race-net'), false);
  assert.deepEqual(created, [{ Name: 'race-net', Driver: 'bridge', CheckDuplicate: true }]);
});

test('ensureNetwork rethrows a non-409 failure (a declared network must win, not silently drop to bridge)', async () => {
  names = [];
  created = [];
  fail = 500;
  await assert.rejects(() => networks.ensureNetwork('daemon-down'), /createNetwork exploded/);
  fail = null; // this test must not poison later ones
});

test('ensureNetwork ignores an empty name', async () => {
  created = [];
  assert.equal(await networks.ensureNetwork(''), false);
  assert.equal(await networks.ensureNetwork(null), false);
  assert.deepEqual(created, []);
});

test('createContainer ensures the network before creating the container', async () => {
  names = [];
  created = [];
  createdContainerSpec = null;
  const id = await containers.createContainer({
    serverId: 'net01',
    image: 'itzg/minecraft-server:latest',
    env: { EULA: 'TRUE' },
    dataDir: `${process.env.DATA_DIR}/servers/net01`,
    ports: { game: 25565, rcon: 25575 },
    resources: { memoryMb: 1024, swapMb: 0, cpus: 0 },
    networkName: 'fresh-net',
  });
  assert.equal(id, 'abc');
  assert.deepEqual(
    created.map((c) => c.Name),
    ['fresh-net'],
    'network ensure ran before create'
  );
  assert.equal(createdContainerSpec.HostConfig.NetworkMode, 'fresh-net');
});

test('createContainer does not create an already-listed network, but still attaches', async () => {
  names = ['existing-net'];
  created = [];
  createdContainerSpec = null;
  await containers.createContainer({
    serverId: 'net02',
    image: 'itzg/minecraft-server:latest',
    env: { EULA: 'TRUE' },
    dataDir: `${process.env.DATA_DIR}/servers/net02`,
    ports: { game: 25566, rcon: 25576 },
    resources: { memoryMb: 1024, swapMb: 0, cpus: 0 },
    networkName: 'existing-net',
  });
  assert.deepEqual(created, [], 'no createNetwork call for an existing network');
  assert.equal(createdContainerSpec.HostConfig.NetworkMode, 'existing-net');
});
