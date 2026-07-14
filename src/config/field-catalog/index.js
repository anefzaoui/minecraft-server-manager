'use strict';

// FIELD CATALOG — the single source of truth for every configurable setting
// the panel exposes: itzg env vars, Docker resource limits, server.properties
// keys, and panel settings. Forms render from it; server-side validation is
// derived from it; nothing anywhere shows a raw env var without its friendly
// label and help text.
//
// Entry schema (all sections use it):
// {
//   key:      'MEMORY'                    // env var name, or property key for scope 'properties'
//   scope:    'env' | 'docker' | 'properties' | 'panel'
//   label:    'RAM (Java heap)'           // friendly, human
//   help:     '1-2 sentences of plain English, sourced from the itzg docs.'
//   type:     'text'|'number'|'size-mb'|'boolean'|'enum'|'list'|'password'|'range'|'cron'|'duration'
//   unit:     'MB' | 'cores' | 'players' | … (optional)
//   default:  value the image/panel uses when unset (optional)
//   options:  [{value, label, desc?}] for enum (optional)
//   min, max, step: for number/range (optional)
//   mode:     'simple' | 'advanced'       // which wizard mode shows it
//   section:  section id (matches SECTIONS below)
//   danger:   true → red styling + extra warning copy (optional)
//   requiresRestart: true when a running container must be recreated to apply
//   hidden:   true → never rendered (footguns the panel manages itself)
//   note:     short 'recommended' hint or warning shown as a badge (optional)
// }

const SECTIONS = [
  { id: 'identity', label: 'Identity', icon: 'tag' },
  { id: 'flavor', label: 'Flavor & version', icon: 'box' },
  { id: 'resources', label: 'Resources', icon: 'gauge' },
  { id: 'jvm', label: 'Java / JVM tuning', icon: 'wrench' },
  { id: 'world', label: 'World', icon: 'earth' },
  { id: 'gameplay', label: 'Gameplay rules', icon: 'swords' },
  { id: 'players', label: 'Players, whitelist & ops', icon: 'users' },
  { id: 'network', label: 'Networking & ports', icon: 'network' },
  { id: 'rcon', label: 'RCON & console', icon: 'terminal' },
  { id: 'packs', label: 'Modpacks & content', icon: 'package' },
  { id: 'autopause', label: 'Auto-pause / auto-stop', icon: 'pause' },
  { id: 'maintenance', label: 'Logs & maintenance', icon: 'file-text' },
  { id: 'advanced', label: 'Advanced & experimental', icon: 'flask-conical' },
];

const fields = [
  ...require('./resources'),
  ...require('./jvm'),
  ...require('./general'),
  ...require('./world'),
  ...require('./gameplay'),
  ...require('./players'),
  ...require('./network'),
  ...require('./rcon'),
  ...require('./packs'),
  ...require('./autopause'),
  ...require('./maintenance'),
];

const byKey = new Map(fields.map((f) => [`${f.scope}:${f.key}`, f]));

function forSection(sectionId, mode = 'advanced') {
  return fields.filter((f) => f.section === sectionId && !f.hidden && (mode === 'advanced' || f.mode === 'simple'));
}

function getField(scope, key) {
  return byKey.get(`${scope}:${key}`) || null;
}

module.exports = { SECTIONS, fields, forSection, getField };
