'use strict';

const net = require('node:net');
const os = require('node:os');
const httpError = require('../utils/httpError');
const serverRuntime = require('./serverRuntime');

const PUBLIC_IP = '<public_ip>';

/** A NetherNet mapping needs an IP literal; BDS does not accept a hostname. */
function normalizeAdvertisedAddress(value) {
  const address = String(value || '').trim();
  if (!address) return '';
  if (address === PUBLIC_IP) return address;
  if (!net.isIP(address)) {
    throw httpError(400, 'Enter a valid IPv4 or IPv6 address, or use <public_ip> for a dynamic public address.');
  }
  return address;
}

function suggestedAdvertisedAddress() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const iface of interfaces || []) {
      if (!iface.internal && iface.family === 'IPv4') addresses.push(iface.address);
    }
  }
  return (
    addresses.find((address) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)) || addresses[0] || ''
  );
}

function netherNetDetails(server) {
  if (!serverRuntime.supports(server, 'netherNet') || server.bedrock_transport === 'raknet') return null;
  const host = normalizeAdvertisedAddress(server.advertised_address) || suggestedAdvertisedAddress();
  const signalingPort = Number(server.port_game);
  const udpStart = Number(server.nethernet_udp_start);
  const udpEnd = Number(server.nethernet_udp_end);
  return {
    host,
    signalingPort,
    udpStart,
    udpEnd,
    address: host ? `${net.isIP(host) === 6 ? `[${host}]` : host}:${signalingPort}` : '',
    firewallRules: [`TCP ${signalingPort}`, `UDP ${udpStart}-${udpEnd}`, 'UDP 7551 for LAN discovery'],
  };
}

function netherNetUdpPorts(server) {
  const details = netherNetDetails(server);
  if (!details || !details.host) return `19140-${19140 + (details?.udpEnd - details?.udpStart || 0)}`;
  const count = details.udpEnd - details.udpStart;
  return `${details.host}:${details.udpStart}-${details.udpEnd}:19140-${19140 + count}`;
}

module.exports = {
  PUBLIC_IP,
  normalizeAdvertisedAddress,
  suggestedAdvertisedAddress,
  netherNetDetails,
  netherNetUdpPorts,
};
