'use strict';

// Server runtime is deliberately separate from `servers.type`: type is the
// itzg Java server type (PAPER, FABRIC, ...), while runtime selects the
// edition-specific contract used to operate the server.

const JAVA = 'java';
const BEDROCK = 'bedrock';

/**
 * Capability definitions are the single boundary for runtime-specific
 * behavior. Consumers must ask this service instead of deriving behavior from
 * a Java server type or from a Geyser setting.
 */
const CAPABILITIES = Object.freeze({
  [JAVA]: Object.freeze({
    java: true,
    nativeBedrock: false,
    rcon: true,
    geyserUdpPort: true,
    jvm: true,
    javaServerProperties: true,
    javaContent: true,
    javaWorldTools: true,
    javaInventory: true,
    javaAnalytics: true,
    javaCrashReports: true,
    javaChatCommands: true,
    map: true,
    bedrockProperties: false,
    bedrockConsole: false,
    bedrockPacks: false,
    bedrockWorlds: false,
    bedrockPlayerPermissions: false,
    netherNet: false,
    rakNet: false,
  }),
  [BEDROCK]: Object.freeze({
    java: false,
    nativeBedrock: true,
    rcon: false,
    geyserUdpPort: false,
    jvm: false,
    javaServerProperties: false,
    javaContent: false,
    javaWorldTools: false,
    javaInventory: false,
    javaAnalytics: false,
    javaCrashReports: false,
    javaChatCommands: false,
    map: false,
    bedrockProperties: true,
    bedrockConsole: true,
    bedrockPacks: true,
    bedrockWorlds: true,
    bedrockPlayerPermissions: true,
    netherNet: true,
    rakNet: true,
  }),
});

/**
 * Resolve a stored runtime. Rows written before the runtime migration are Java
 * by definition, which keeps their Java behavior and Geyser UDP port intact.
 *
 * @param {{ runtime?: unknown } | null | undefined} server
 * @returns {'java' | 'bedrock'}
 */
function runtimeFor(server) {
  return server?.runtime === BEDROCK ? BEDROCK : JAVA;
}

/**
 * @param {{ runtime?: unknown } | null | undefined} server
 * @param {string} capability
 * @returns {boolean}
 */
function supports(server, capability) {
  return CAPABILITIES[runtimeFor(server)][capability] === true;
}

/**
 * Runtime description for services and view models that need a stable
 * capability boundary.
 *
 * @param {{ runtime?: unknown } | null | undefined} server
 */
function resolve(server) {
  const runtime = runtimeFor(server);
  return Object.freeze({
    runtime,
    capabilities: CAPABILITIES[runtime],
    supports: (capability) => supports({ runtime }, capability),
  });
}

module.exports = { JAVA, BEDROCK, CAPABILITIES, runtimeFor, supports, resolve };
