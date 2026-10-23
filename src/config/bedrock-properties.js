'use strict';

// Bedrock Dedicated Server properties supported by itzg/minecraft-bedrock-server.
// These are intentionally separate from the Java field catalog: the image uses
// different property names and a Native Bedrock server has no JVM or RCON.
const fields = [
  {
    key: 'SERVER_NAME',
    label: 'Server name',
    help: 'Name shown to Bedrock players in the server list.',
    type: 'text',
    section: 'identity',
  },
  {
    key: 'GAMEMODE',
    label: 'Game mode',
    help: 'Default game mode for new players.',
    type: 'enum',
    default: 'survival',
    options: ['survival', 'creative', 'adventure'].map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    section: 'gameplay',
  },
  {
    key: 'DIFFICULTY',
    label: 'Difficulty',
    help: 'Controls hostile mobs and survival challenge.',
    type: 'enum',
    default: 'easy',
    options: ['peaceful', 'easy', 'normal', 'hard'].map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    section: 'gameplay',
  },
  {
    key: 'ALLOW_CHEATS',
    label: 'Allow cheats',
    help: 'Lets operators use cheat commands.',
    type: 'boolean',
    default: false,
    section: 'gameplay',
  },
  {
    key: 'MAX_PLAYERS',
    label: 'Max players',
    help: 'Maximum number of concurrent players.',
    type: 'number',
    min: 1,
    max: 1000,
    unit: 'players',
    section: 'gameplay',
  },
  {
    key: 'DEFAULT_PLAYER_PERMISSION_LEVEL',
    label: 'Default player permission',
    help: 'Permission level assigned to new players.',
    type: 'enum',
    default: 'member',
    options: ['visitor', 'member', 'operator'].map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
    section: 'gameplay',
  },
  { key: 'LEVEL_NAME', label: 'World name', help: 'Name of the Bedrock world folder.', type: 'text', section: 'world' },
  {
    key: 'LEVEL_SEED',
    label: 'World seed',
    help: 'Seed used only when creating a new world.',
    type: 'text',
    section: 'world',
  },
  {
    key: 'VIEW_DISTANCE',
    label: 'View distance',
    help: 'Maximum chunks sent around each player.',
    type: 'number',
    min: 5,
    max: 64,
    unit: 'chunks',
    section: 'world',
  },
  {
    key: 'TICK_DISTANCE',
    label: 'Tick distance',
    help: 'Chunks that actively simulate around each player.',
    type: 'number',
    min: 4,
    max: 12,
    unit: 'chunks',
    section: 'world',
  },
  {
    key: 'PLAYER_IDLE_TIMEOUT',
    label: 'Idle kick timeout',
    help: 'Minutes before an idle player is kicked. 0 disables idle kicks.',
    type: 'number',
    min: 0,
    max: 1440,
    unit: 'minutes',
    section: 'gameplay',
  },
  {
    key: 'TEXTUREPACK_REQUIRED',
    label: 'Require resource packs',
    help: 'Prevents players joining until they download required resource packs.',
    type: 'boolean',
    default: false,
    section: 'gameplay',
  },
  {
    key: 'ALLOW_LIST',
    label: 'Allow list',
    help: 'Restricts joining to players on the Bedrock allow list.',
    type: 'boolean',
    default: false,
    section: 'players',
  },
  {
    key: 'ONLINE_MODE',
    label: 'Online mode',
    help: 'Verifies players with Xbox Live before they join.',
    type: 'boolean',
    default: true,
    section: 'network',
  },
  {
    key: 'ENABLE_LAN_VISIBILITY',
    label: 'LAN visibility',
    help: 'Advertises the server to Bedrock clients on the local network.',
    type: 'boolean',
    default: true,
    section: 'network',
  },
  {
    key: 'COMPRESSION_THRESHOLD',
    label: 'Compression threshold',
    help: 'Packets at or above this size are compressed. 0 compresses every packet.',
    type: 'number',
    min: 0,
    max: 65535,
    unit: 'bytes',
    section: 'network',
  },
];

const sections = [
  { id: 'identity', label: 'Identity', icon: 'tag' },
  { id: 'gameplay', label: 'Gameplay Rules', icon: 'swords' },
  { id: 'world', label: 'World', icon: 'earth' },
  { id: 'players', label: 'Players', icon: 'users' },
  { id: 'network', label: 'Networking', icon: 'network' },
];

const byKey = new Map(fields.map((field) => [field.key, field]));
const MANAGED_ENV_KEYS = new Set(['EULA', 'VERSION', 'UID', 'GID', 'TZ']);
const JAVA_ONLY_ENV_KEYS = new Set([
  'MEMORY',
  'INIT_MEMORY',
  'MAX_MEMORY',
  'ENABLE_RCON',
  'RCON_PASSWORD',
  'RCON_PORT',
  'JVM_OPTS',
  'JVM_DD_OPTS',
  'JAVA_VERSION',
  'TYPE',
  'STOP_DURATION',
]);

function sectionsForSettings() {
  return sections
    .map((section) => ({
      ...section,
      fields: fields.filter((field) => field.section === section.id).map((field) => ({ ...field, scope: 'env' })),
    }))
    .filter((section) => section.fields.length);
}

function validateEnv(env) {
  for (const [key, value] of Object.entries(env)) {
    if (JAVA_ONLY_ENV_KEYS.has(key)) throw new Error(`${key} is not available for Native Bedrock servers.`);
    const field = byKey.get(key);
    if (!field) continue; // Preserve image-supported settings that this UI does not manage yet.
    if (field.type === 'boolean' && !['true', 'false'].includes(value))
      throw new Error(`${field.label} must be true or false.`);
    if (field.type === 'enum' && !field.options.some((option) => option.value === value))
      throw new Error(`${field.label} has an invalid value.`);
    if (field.type === 'number') {
      const n = Number(value);
      if (
        !Number.isInteger(n) ||
        (field.min !== undefined && n < field.min) ||
        (field.max !== undefined && n > field.max)
      ) {
        throw new Error(`${field.label} must be a whole number within the supported range.`);
      }
    }
  }
  return env;
}

module.exports = { fields, sectionsForSettings, validateEnv, MANAGED_ENV_KEYS, JAVA_ONLY_ENV_KEYS };
