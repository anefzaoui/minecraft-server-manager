'use strict';

// Versioned vanilla command-tree catalog for the web console. minecraft-data
// supplies the built-in Brigadier tree; the panel adds local player names and
// common selectors because the catalog cannot contain live server state.

const minecraftData = require('minecraft-data');

const MAX_SUGGESTIONS = 12;
const MAX_USAGES = 6;
const catalogs = new Map();
const valueCache = new WeakMap();

const COMMAND_HELP = {
  advancement: 'Grant, revoke, or inspect player advancements.',
  attribute: 'View or change an entity attribute.',
  ban: 'Ban a player from the server.',
  'ban-ip': 'Ban an IP address from the server.',
  banlist: 'Show the current player and IP bans.',
  bossbar: 'Create and manage boss bars.',
  clear: 'Clear items from a player inventory.',
  clone: 'Copy blocks from one area to another.',
  damage: 'Apply damage to an entity.',
  data: 'Inspect or change entity, block, and storage data.',
  datapack: 'List, enable, or disable data packs.',
  debug: 'Run server diagnostics or profiling tools.',
  defaultgamemode: 'Set the default game mode for new players.',
  deop: "Remove a player's operator permissions.",
  difficulty: 'View or change the world difficulty.',
  effect: 'Add or remove status effects on entities.',
  enchant: 'Apply an enchantment to a player item.',
  execute: 'Run a command with a chosen execution context.',
  experience: 'Give or remove experience from a player.',
  fill: 'Fill an area with blocks.',
  fillbiome: 'Change the biome in an area.',
  forceload: 'Keep selected chunks loaded.',
  function: 'Run a function from a data pack.',
  gamemode: "Change a player's game mode.",
  gamerule: 'View or change a world rule.',
  give: 'Give items to players.',
  help: 'Show command help.',
  item: 'Replace, modify, or copy an entity item slot.',
  jfr: 'Start or stop a Java Flight Recorder profile.',
  kick: 'Remove a player from the server.',
  kill: 'Remove an entity from the world.',
  list: 'List players currently online.',
  locate: 'Find a structure, biome, or point of interest.',
  loot: 'Generate or move loot from tables.',
  me: 'Send an action message to all players.',
  msg: 'Send a private message to a player.',
  op: 'Grant a player operator permissions.',
  pardon: 'Remove a player from the ban list.',
  'pardon-ip': 'Remove an IP address from the ban list.',
  particle: 'Display particles at a position.',
  perf: 'Start or stop a performance recording.',
  place: 'Place a feature, structure, or jigsaw at a position.',
  playsound: 'Play a sound for selected players.',
  publish: 'Open a single-player world to the local network.',
  random: 'Generate random values or sequences.',
  recipe: 'Grant or revoke recipes for players.',
  reload: 'Reload data packs.',
  return: 'Return a value or stop the current function.',
  ride: 'Make entities ride or stop riding other entities.',
  'save-all': 'Save world data to disk.',
  'save-off': 'Pause automatic world saves.',
  'save-on': 'Resume automatic world saves.',
  say: 'Send a message to all players.',
  schedule: 'Schedule or cancel a data pack function.',
  scoreboard: 'Manage scoreboard objectives, players, and teams.',
  seed: 'Show the world seed.',
  setblock: 'Place or replace a block at a position.',
  setidletimeout: 'Set how long an idle player may remain connected.',
  setworldspawn: 'Set the world spawn point.',
  spawnpoint: "Set a player's respawn point.",
  spectate: 'Make a player spectate an entity.',
  spreadplayers: 'Spread entities across an area.',
  stop: 'Save the world and stop the server.',
  stopsound: 'Stop sounds for selected players.',
  summon: 'Create an entity at a position.',
  tag: 'Add, remove, or list entity tags.',
  team: 'Create and manage scoreboard teams.',
  teammsg: 'Send a message to your scoreboard team.',
  tell: 'Send a private message to a player.',
  tellraw: 'Send formatted JSON text to players.',
  teleport: 'Teleport entities to a player or position.',
  time: 'View or change the world time.',
  tick: 'Inspect or control the server tick rate and tick flow.',
  title: 'Show titles, subtitles, or action-bar text to players.',
  tm: 'Change the current game test mode.',
  tp: 'Teleport entities to a player or position.',
  trigger: 'Change a trigger scoreboard objective.',
  weather: 'Change the weather.',
  whitelist: 'Manage the server whitelist.',
  w: 'Send a private message to a player.',
  worldborder: 'View or change the world border.',
  xp: 'Give or remove experience from a player.',
};

const PARSER_HELP = {
  'brigadier:bool': 'true or false',
  'brigadier:double': 'a decimal number',
  'brigadier:float': 'a decimal number',
  'brigadier:integer': 'a whole number',
  'brigadier:long': 'a whole number',
  'brigadier:string': 'a text value',
  'minecraft:angle': 'an angle in degrees',
  'minecraft:block_predicate': 'a block ID, block tag, or block condition',
  'minecraft:block_pos': 'x, y, and z block coordinates',
  'minecraft:block_state': 'a block ID with optional block states',
  'minecraft:color': 'a text color',
  'minecraft:column_pos': 'x and z block coordinates',
  'minecraft:component': 'a text component, usually JSON text',
  'minecraft:dimension': 'a dimension ID',
  'minecraft:entity': 'a player, entity, or selector',
  'minecraft:entity_anchor': 'eyes or feet',
  'minecraft:game_profile': 'a player name',
  'minecraft:function': 'a data pack function ID',
  'minecraft:gamemode': 'a game mode',
  'minecraft:heightmap': 'a heightmap type',
  'minecraft:int_range': 'a number or number range',
  'minecraft:item_predicate': 'an item ID or item condition',
  'minecraft:item_slot': 'an entity inventory slot',
  'minecraft:item_stack': 'an item ID with optional components or count',
  'minecraft:message': 'text',
  'minecraft:nbt_compound_tag': 'an NBT compound, such as {key:1}',
  'minecraft:nbt_path': 'an NBT path',
  'minecraft:nbt_tag': 'an NBT value',
  'minecraft:objective': 'a scoreboard objective',
  'minecraft:objective_criteria': 'a scoreboard criterion',
  'minecraft:operation': 'a scoreboard operation',
  'minecraft:particle': 'a particle ID',
  'minecraft:resource': 'a namespaced ID',
  'minecraft:resource_key': 'a registry ID',
  'minecraft:resource_location': 'a namespaced ID, such as minecraft:stone',
  'minecraft:resource_or_tag': 'a resource ID or tag',
  'minecraft:resource_or_tag_key': 'a resource ID or tag',
  'minecraft:rotation': 'yaw and pitch angles',
  'minecraft:score_holder': 'a player name or selector',
  'minecraft:scoreboard_slot': 'a scoreboard display slot',
  'minecraft:style': 'a text style',
  'minecraft:swizzle': 'coordinate axes, such as xyz',
  'minecraft:team': 'a scoreboard team',
  'minecraft:time': 'a duration, such as 10s',
  'minecraft:template_mirror': 'a structure mirror direction',
  'minecraft:template_rotation': 'a structure rotation',
  'minecraft:uuid': 'a player or entity UUID',
  'minecraft:vec2': 'x and z coordinates',
  'minecraft:vec3': 'x, y, and z coordinates',
};

const PLAYER_PARSERS = new Set(['minecraft:entity', 'minecraft:game_profile', 'minecraft:score_holder']);
const SELECTORS = ['@a', '@e', '@p', '@r', '@s'];
const SELECTOR_HELP = {
  '@a': 'all players',
  '@e': 'all entities',
  '@p': 'nearest player',
  '@r': 'a random player',
  '@s': 'the executing entity',
};
const PARSER_VALUES = {
  'minecraft:difficulty': ['easy', 'hard', 'normal', 'peaceful'],
  'minecraft:entity_anchor': ['eyes', 'feet'],
  'minecraft:gamemode': ['adventure', 'creative', 'spectator', 'survival'],
  'minecraft:template_mirror': ['front_back', 'left_right', 'none'],
  'minecraft:template_rotation': ['clockwise_180', 'clockwise_90', 'counterclockwise_90', 'none'],
};
const DATA_PARSERS = {
  'minecraft:block_predicate': 'blocks',
  'minecraft:block_state': 'blocks',
  'minecraft:enchantment': 'enchantments',
  'minecraft:entity_summon': 'entities',
  'minecraft:item_predicate': 'items',
  'minecraft:item_stack': 'items',
  'minecraft:mob_effect': 'effects',
};
const RESOURCE_REGISTRIES = {
  'minecraft:block': 'blocks',
  'minecraft:enchantment': 'enchantments',
  'minecraft:entity_type': 'entities',
  'minecraft:item': 'items',
  'minecraft:mob_effect': 'effects',
  'minecraft:worldgen/biome': 'biomes',
};
const REGISTRY_HELP = {
  'minecraft:enchantment': 'an enchantment ID',
  'minecraft:entity_type': 'an entity type',
  'minecraft:item': 'an item ID',
  'minecraft:mob_effect': 'an effect ID',
  'minecraft:worldgen/biome': 'a biome ID',
};

function hasCommands(data) {
  return Boolean(data && data.commands && data.commands.root && Array.isArray(data.commands.root.children));
}

function loadCatalog(version) {
  const requested = String(version || '').trim();
  const exact = requested && requested.toUpperCase() !== 'LATEST' ? minecraftData(requested) : null;
  if (hasCommands(exact)) return exact;

  const versions = minecraftData.versions.pc;
  const minor = /^(\d+\.\d+)/.exec(requested)?.[1];
  if (minor) {
    const sameMinor = versions.find((entry) => entry.minecraftVersion.startsWith(`${minor}-`));
    const data = sameMinor && minecraftData(sameMinor.minecraftVersion);
    if (hasCommands(data)) return data;
  }

  // For LATEST and unknown pins, prefer the newest stable command tree shipped
  // in minecraft-data instead of guessing an unsupported future command schema.
  for (const entry of versions) {
    if (entry.releaseType !== 'release') continue;
    const data = minecraftData(entry.minecraftVersion);
    if (hasCommands(data)) return data;
  }
  return null;
}

function getCatalog(version) {
  const key = String(version || '').trim() || 'LATEST';
  if (!catalogs.has(key)) catalogs.set(key, loadCatalog(key));
  return catalogs.get(key);
}

function tokenize(input) {
  const tokens = [];
  let token = '';
  let quote = false;
  let depth = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && input[i - 1] !== '\\') quote = !quote;
    if (!quote) {
      if ('[{('.includes(char)) depth++;
      else if (']})'.includes(char)) depth = Math.max(0, depth - 1);
    }
    if (/\s/.test(char) && !quote && depth === 0) {
      if (token) tokens.push(token);
      token = '';
    } else token += char;
  }
  if (token) tokens.push(token);
  const trailingSpace = input.length > 0 && /\s$/.test(input);
  const partial = trailingSpace ? '' : tokens.pop() || '';
  return { completed: tokens, partial, replaceFrom: trailingSpace ? input.length : currentStart(input) };
}

function currentStart(input) {
  let quote = false;
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && input[i - 1] !== '\\') quote = !quote;
    if (!quote) {
      if ('[{('.includes(char)) depth++;
      else if (']})'.includes(char)) depth = Math.max(0, depth - 1);
    }
    if (/\s/.test(char) && !quote && depth === 0) start = i + 1;
  }
  return start;
}

function children(node) {
  return Array.isArray(node.children) ? node.children : [];
}

function matches(node, token) {
  return node.type === 'argument' || node.name.toLowerCase() === token.toLowerCase();
}

function descend(states, token) {
  const next = [];
  for (const state of states) {
    for (const node of children(state.node)) {
      if (matches(node, token)) next.push({ node });
    }
  }
  return next;
}

function argumentDescription(node) {
  const parser = node.parser && node.parser.parser;
  const registry = node.parser && node.parser.modifier && node.parser.modifier.registry;
  return REGISTRY_HELP[registry] || PARSER_HELP[parser] || `a ${node.name} value`;
}

function commandDescription(name) {
  return COMMAND_HELP[name] || `Use the ${name} command.`;
}

function valuesFor(data, parser, modifier) {
  const field =
    parser === 'minecraft:resource' ? RESOURCE_REGISTRIES[modifier && modifier.registry] : DATA_PARSERS[parser];
  if (!field) return [];
  if (!valueCache.has(data)) valueCache.set(data, new Map());
  const values = valueCache.get(data);
  if (!values.has(field)) {
    values.set(
      field,
      Object.values(data[field] || {})
        .map((entry) => `minecraft:${entry.name}`)
        .sort((a, b) => a.localeCompare(b))
    );
  }
  return values.get(field);
}

function usagePaths(command, node, tokens) {
  const found = [];
  function walk(current, path) {
    if (found.length >= 80) return;
    if (current.executable) {
      found.push({
        nodes: path,
        text: `/${command}${path.map((part) => ` ${part.type === 'argument' ? `<${part.name}>` : part.name}`).join('')}`,
      });
    }
    for (const child of children(current)) walk(child, [...path, child]);
  }
  walk(node, []);
  const matching = found.filter(({ nodes }) =>
    tokens.every((token, index) => nodes[index] && matches(nodes[index], token))
  );
  return (matching.length ? matching : found).slice(0, MAX_USAGES).map((entry) => entry.text);
}

function expectedArguments(states) {
  const output = new Map();
  for (const state of states) {
    for (const node of children(state.node)) {
      if (node.type !== 'argument') continue;
      const description = argumentDescription(node);
      output.set(`${node.name}:${description}`, { name: node.name, description });
    }
  }
  return [...output.values()].slice(0, 4);
}

function commandHelp(root, completed, suggestions) {
  const name = completed[0] || (suggestions[0] && suggestions[0].kind === 'command' ? suggestions[0].value : null);
  if (!name) return null;
  const node = root.children.find((child) => child.type === 'literal' && child.name === name);
  if (!node) return null;
  return { command: name, description: commandDescription(name), usages: usagePaths(name, node, completed.slice(1)) };
}

function suggest(version, rawInput, onlinePlayers = []) {
  const input = String(rawInput || '').replace(/^\s*\//, '');
  const parsed = tokenize(input);
  const data = getCatalog(version);
  if (!hasCommands(data)) {
    return { catalogVersion: null, suggestions: [], expected: [], help: null, replaceFrom: parsed.replaceFrom };
  }

  const root = data.commands.root;
  let states = [{ node: root }];
  for (const token of parsed.completed) {
    states = descend(states, token);
    if (!states.length) break;
  }

  const possible = new Map();
  for (const state of states) {
    for (const node of children(state.node)) {
      if (node.type === 'literal') {
        if (!node.name.toLowerCase().startsWith(parsed.partial.toLowerCase())) continue;
        const command = parsed.completed.length === 0;
        possible.set(node.name, {
          value: node.name,
          kind: command ? 'command' : 'subcommand',
          description: command ? commandDescription(node.name) : 'Command option.',
        });
        continue;
      }
      const parser = node.parser && node.parser.parser;
      const values = PLAYER_PARSERS.has(parser)
        ? [...SELECTORS, ...onlinePlayers.map((name) => String(name))]
        : parser === 'brigadier:bool'
          ? ['true', 'false']
          : PARSER_VALUES[parser] || valuesFor(data, parser, node.parser && node.parser.modifier);
      for (const value of values) {
        const lower = value.toLowerCase();
        const partial = parsed.partial.toLowerCase();
        if (!lower.startsWith(partial) && !lower.split(':').at(-1).startsWith(partial)) continue;
        possible.set(value, {
          value,
          kind: 'argument',
          description: SELECTOR_HELP[value] || argumentDescription(node),
        });
      }
    }
  }

  const suggestions = [...possible.values()].sort((a, b) => a.value.localeCompare(b.value)).slice(0, MAX_SUGGESTIONS);
  const help = commandHelp(root, parsed.completed, suggestions);
  if (help) help.catalogVersion = data.version.minecraftVersion;
  for (const item of suggestions) {
    const name = parsed.completed[0] || (item.kind === 'command' ? item.value : null);
    const tokens = item.kind === 'subcommand' ? [...parsed.completed, item.value] : parsed.completed;
    item.help = name ? commandHelp(root, [name, ...tokens.slice(1)], [item]) : null;
    if (item.help) item.help.catalogVersion = data.version.minecraftVersion;
  }

  return {
    catalogVersion: data.version.minecraftVersion,
    suggestions,
    expected: expectedArguments(states),
    help,
    replaceFrom: parsed.replaceFrom,
  };
}

module.exports = { suggest };
