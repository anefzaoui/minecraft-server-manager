// @ts-nocheck — dynamic Docker/NBT/HTTP-JSON interop; not yet under checkJs (incremental typing).
'use strict';

// Invites & client modpack generation (MP7).
// - inviteInfo: everything a friend needs to join (address candidates, version,
//   flavor, whitelist state) plus a ready-to-paste text block.
// - generateMrpack: Modrinth-format client pack built from the server's overlay
//   mods, with a hand-written servers.dat in overrides/ so launchers (Prism,
//   Modrinth App) pre-add the server to the multiplayer list.
// - No UPnP: we detect the public IP (ipify, cached 1h) and give manual
//   port-forward guidance instead.

const httpError = require('../utils/httpError');
const fs = require('node:fs');
const os = require('node:os');
const archiver = require('archiver');
const db = require('../db');
const { dataPath } = require('../storage/pathGuard');
const serversService = require('../services/servers');
const modsService = require('../services/mods');
const modrinth = require('../services/modrinthApi');
const { getVersionManifest } = require('../services/mojang');
const { displayVersion, flavorLabel } = require('../web/viewModels');
const players = require('../services/players');

function mustGet(serverId) {
  const server = serversService.getServer(serverId);
  if (!server) throw httpError(404, 'Server not found');
  return server;
}

/** Non-internal local IPv4 addresses, LAN-looking ones first. */
function localIPv4s() {
  const ips = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips.sort((a, b) => Number(isLan(b)) - Number(isLan(a)));
}

function isLan(ip) {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

// ---------------------------------------------------------------------------
// Public IP detection (replaces UPnP — no new dependencies).

let publicIpCache = { ip: null, at: 0 };

async function detectPublicIp() {
  if (Date.now() - publicIpCache.at < 60 * 60 * 1000) return publicIpCache.ip;
  try {
    const res = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(5000) });
    const ip = res.ok ? (await res.text()).trim() : null;
    publicIpCache = { ip: /^[\d.]+$/.test(ip || '') ? ip : null, at: Date.now() };
  } catch {
    publicIpCache = { ip: null, at: Date.now() };
  }
  return publicIpCache.ip;
}

function portForwardGuidance(port) {
  return [
    `To let friends outside your network join, forward TCP port ${port} on your router to this machine.`,
    'Open your router admin page (usually 192.168.1.1 or 192.168.0.1), find "Port Forwarding" (sometimes under NAT or Virtual Server),',
    `and add a rule: external port ${port} → this computer's LAN IP, port ${port}, protocol TCP.`,
    'Then share your public IP with the port. If your ISP uses CGNAT, port forwarding will not work — consider a tunnel (e.g. playit.gg) instead.',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Invite info

async function inviteInfo(serverId) {
  const server = mustGet(serverId);
  const port = server.port_game;
  const candidates = localIPv4s().map((ip) => `${ip}:${port}`);

  const mcVersion = await displayVersion(server.mc_version);
  const flavor = flavorLabel(server.type);
  const whitelistEnforced = players.getWhitelistEnforced(serverId);

  const content = await modsService.listContent(serverId).catch(() => []);
  const activeMods = content.filter((m) => m.enabled && !m.missing && (m.kind === 'mod' || m.kind === 'plugin'));
  const { manual } = splitOverlay(serverId);
  const publicIp = await detectPublicIp();

  const address = candidates[0] || `<this machine's IP>:${port}`;
  const lines = [
    `You're invited to "${server.display_name}"!`,
    `Address: ${address}`,
    `Version: Minecraft ${mcVersion} (${flavor})`,
  ];
  if (whitelistEnforced) lines.push('Whitelist is ON — send me your Minecraft username so I can add you.');
  if (activeMods.length && !isPluginFlavor(server.type)) {
    lines.push(
      `Mods: ${activeMods.length} — grab the client modpack (.mrpack) I sent and import it into your launcher (Prism / Modrinth App).`
    );
    if (manual.length)
      lines.push(`Also install these manually (not on Modrinth): ${manual.map((m) => m.name).join(', ')}.`);
  }

  return {
    serverId,
    name: server.display_name,
    port,
    candidates,
    publicIp,
    publicAddress: publicIp ? `${publicIp}:${port}` : null,
    portForwardGuidance: portForwardGuidance(port),
    mcVersion,
    flavor,
    whitelistEnforced,
    modCount: activeMods.length,
    manualMods: manual.map((m) => ({ name: m.name, filename: m.filename })),
    inviteText: lines.join('\n'),
    modded: activeMods.length > 0 && !isPluginFlavor(server.type),
  };
}

function isPluginFlavor(type) {
  // Plugin servers (Paper & friends) need nothing on the client.
  return ['PAPER', 'PURPUR', 'PUFFERFISH', 'LEAF', 'FOLIA', 'SPIGOT', 'BUKKIT', 'CANYON'].includes(type);
}

/** Overlay rows split into mrpack-embeddable (Modrinth) vs install-manually. */
function splitOverlay(serverId) {
  const rows = db
    .all(
      `SELECT sc.name, sc.filename, sc.enabled, lf.platform, lf.file_id
       FROM server_content sc LEFT JOIN library_files lf ON lf.id = sc.library_id
      WHERE sc.server_id = ? AND sc.managed_by = 'overlay' AND sc.kind IN ('mod', 'plugin')`,
      serverId
    )
    .filter((r) => r.enabled);
  return {
    modrinth: rows.filter((r) => r.platform === 'modrinth' && r.file_id),
    manual: rows.filter((r) => !(r.platform === 'modrinth' && r.file_id)),
  };
}

// ---------------------------------------------------------------------------
// .mrpack generation

/** Concrete MC version for the pack manifest (LATEST/SNAPSHOT resolved now). */
async function resolvedMcVersion(server) {
  if (server.mc_version !== 'LATEST' && server.mc_version !== 'SNAPSHOT') return server.mc_version;
  try {
    const manifest = await getVersionManifest();
    return server.mc_version === 'LATEST' ? manifest.latest.release : manifest.latest.snapshot;
  } catch {
    return server.mc_version; // offline — better than nothing
  }
}

// itzg env var → Modrinth loader dependency id
const LOADER_ENVS = {
  FABRIC_LOADER_VERSION: 'fabric-loader',
  QUILT_LOADER_VERSION: 'quilt-loader',
  FORGE_VERSION: 'forge',
  NEOFORGE_VERSION: 'neoforge',
};

/**
 * Build a client .mrpack into data/tmp and return { absPath, filename,
 * fileCount, manual }. Caller streams it to the user and deletes it after.
 * `host` is the address the user picked for the bundled servers.dat entry.
 */
async function generateMrpack(serverId, { host } = {}) {
  const server = mustGet(serverId);
  const { modrinth: embeddable, manual } = splitOverlay(serverId);

  const files = [];
  for (const row of embeddable) {
    let version;
    try {
      version = await modrinth.getVersion(row.file_id);
    } catch {
      manual.push(row); // metadata gone from Modrinth — fall back to manual
      continue;
    }
    const file = modrinth.primaryFile(version);
    files.push({
      path: `mods/${file.filename}`,
      hashes: { sha1: file.hashes.sha1, sha512: file.hashes.sha512 },
      env: { client: 'required', server: 'required' },
      downloads: [file.url],
      fileSize: file.size,
    });
  }

  const dependencies = { minecraft: await resolvedMcVersion(server) };
  for (const [envVar, depId] of Object.entries(LOADER_ENVS)) {
    const v = server.env[envVar];
    if (v && v.toUpperCase() !== 'LATEST') dependencies[depId] = v;
  }

  const index = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: `${server.display_name} 1.0`,
    name: server.display_name,
    summary: `Client pack for the "${server.display_name}" server (generated by Minecraft Server Manager)`,
    dependencies,
    files,
  };

  const address = host || `${localIPv4s()[0] || 'localhost'}:${server.port_game}`;
  const serversDat = buildServersDat({ name: server.display_name, ip: address });

  fs.mkdirSync(dataPath('tmp'), { recursive: true });
  const filename = `${slugify(server.display_name)}.mrpack`;
  const absPath = dataPath('tmp', `invite-${serverId}-${Date.now()}.mrpack`);

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(absPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    out.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(out);
    archive.append(JSON.stringify(index, null, 2), { name: 'modrinth.index.json' });
    archive.append(serversDat, { name: 'overrides/servers.dat' });
    archive.finalize();
  });

  return { absPath, filename, fileCount: files.length, manual: manual.map((m) => m.name) };
}

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'server'
  );
}

// ---------------------------------------------------------------------------
// Minimal NBT writer — servers.dat is a tiny fixed structure, so we emit the
// bytes directly instead of pulling in an NBT dependency. Uncompressed NBT:
// root TAG_Compound("") { TAG_List("servers") of TAG_Compound { ip, name } }.

const TAG_END = 0x00;
const TAG_STRING = 0x08;
const TAG_LIST = 0x09;
const TAG_COMPOUND = 0x0a;

function nbtStr(s) {
  const bytes = Buffer.from(String(s), 'utf8');
  const len = Buffer.alloc(2);
  len.writeUInt16BE(Math.min(bytes.length, 0xffff));
  return Buffer.concat([len, bytes.subarray(0, 0xffff)]);
}

function namedTag(type, name, payload) {
  return Buffer.concat([Buffer.from([type]), nbtStr(name), payload]);
}

function buildServersDat({ name, ip }) {
  // List entries are compound PAYLOADS (no type byte / name of their own).
  const entry = Buffer.concat([
    namedTag(TAG_STRING, 'ip', nbtStr(ip)),
    namedTag(TAG_STRING, 'name', nbtStr(name)),
    Buffer.from([TAG_END]),
  ]);
  const count = Buffer.alloc(4);
  count.writeInt32BE(1);
  const listPayload = Buffer.concat([Buffer.from([TAG_COMPOUND]), count, entry]);
  return Buffer.concat([
    Buffer.from([TAG_COMPOUND]),
    nbtStr(''),
    namedTag(TAG_LIST, 'servers', listPayload),
    Buffer.from([TAG_END]),
  ]);
}

module.exports = { inviteInfo, generateMrpack, detectPublicIp, portForwardGuidance, buildServersDat };
