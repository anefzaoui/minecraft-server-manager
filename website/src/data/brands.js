// Everything the panel works with, as badge data. One entry per thing; the
// pills, the "works with" band and the FAQ rows all read from here so a brand
// is described once. `si` is a Simple Icons slug (CC0 marks, inlined at build
// time); `icon` is a generated pixel item icon (src/assets/gen/icon-<id>.webp)
// for things that have no CC0 mark. Brand names are never translated.
import * as icons from 'simple-icons';
import { art } from './art.js';

/** @typedef {{ id: string, label: string, kind: string, si?: string, icon?: string, hex?: string, note?: string }} Brand */

/** @type {Brand[]} */
export const BRANDS = [
  // Mod and plugin registries
  { id: 'modrinth', label: 'Modrinth', kind: 'registry', si: 'siModrinth', note: 'keyless' },
  { id: 'curseforge', label: 'CurseForge', kind: 'registry', si: 'siCurseforge' },
  { id: 'hangar', label: 'Hangar', kind: 'registry', icon: 'hangar', note: 'keyless' },
  { id: 'spigotmc', label: 'SpigotMC', kind: 'registry', si: 'siSpigotmc', note: 'keyless' },
  { id: 'github-releases', label: 'GitHub Releases', kind: 'registry', si: 'siGithub' },
  // Server types / loaders
  { id: 'vanilla', label: 'Vanilla', kind: 'loader', icon: 'vanilla' },
  { id: 'paper', label: 'Paper', kind: 'loader', icon: 'paper' },
  { id: 'purpur', label: 'Purpur', kind: 'loader', icon: 'purpur' },
  { id: 'fabric', label: 'Fabric', kind: 'loader', icon: 'fabric' },
  { id: 'forge', label: 'Forge', kind: 'loader', icon: 'forge' },
  { id: 'neoforge', label: 'NeoForge', kind: 'loader', icon: 'neoforge' },
  { id: 'quilt', label: 'Quilt', kind: 'loader', icon: 'quilt' },
  // Modpack sources
  { id: 'packs-curseforge', label: 'CurseForge packs', kind: 'pack', si: 'siCurseforge' },
  { id: 'packs-modrinth', label: 'Modrinth packs', kind: 'pack', si: 'siModrinth' },
  { id: 'ftb', label: 'FTB', kind: 'pack', icon: 'ftb' },
  { id: 'gtnh', label: 'GT New Horizons', kind: 'pack', icon: 'gtnh' },
  // Import formats
  { id: 'mrpack', label: '.mrpack', kind: 'format', si: 'siModrinth' },
  { id: 'cf-export', label: 'CurseForge export', kind: 'format', si: 'siCurseforge' },
  { id: 'zip', label: 'Zip of jars', kind: 'format', icon: 'ftb' },
  // Platforms
  { id: 'docker', label: 'Docker', kind: 'platform', si: 'siDocker' },
  { id: 'portainer', label: 'Portainer', kind: 'platform', si: 'siPortainer' },
  { id: 'dockge', label: 'Dockge', kind: 'platform', icon: 'dockge' },
  { id: 'pm2', label: 'PM2', kind: 'platform', si: 'siPm2' },
  { id: 'linux', label: 'Linux', kind: 'os', si: 'siLinux' },
  { id: 'windows', label: 'Windows', kind: 'os', icon: 'windows' },
  { id: 'macos', label: 'macOS', kind: 'os', si: 'siApple' },
  { id: 'nodejs', label: 'Node.js 24+', kind: 'platform', si: 'siNodedotjs' },
  { id: 'amd64', label: 'amd64', kind: 'arch' },
  { id: 'arm64', label: 'arm64', kind: 'arch' },
  // Integrations
  { id: 'discord', label: 'Discord', kind: 'integration', si: 'siDiscord' },
  { id: 'bluemap', label: 'BlueMap', kind: 'integration', icon: 'bluemap' },
  { id: 'mclogs', label: 'mclo.gs', kind: 'integration' },
  { id: 'geyser', label: 'Geyser', kind: 'integration', icon: 'geyser' },
  { id: 'floodgate', label: 'Floodgate', kind: 'integration', icon: 'geyser' },
  // Checksums
  { id: 'sha512', label: 'sha512', kind: 'hash' },
  { id: 'sha256', label: 'sha256', kind: 'hash' },
  { id: 'sha1', label: 'sha1', kind: 'hash' },
  { id: 'md5', label: 'md5', kind: 'hash' },
];

const byId = new Map(BRANDS.map((b) => [b.id, b]));

/** @param {string} id */
export function brand(id) {
  const b = byId.get(id);
  if (!b) throw new Error(`Unknown brand: ${id}`);
  return b;
}

/** @param {string[]} ids */
export function brands(ids) {
  return ids.map(brand);
}

/** Simple Icons path + colour for a brand, or null. @param {Brand} b */
export function simpleIcon(b) {
  if (!b.si) return null;
  const icon = /** @type {Record<string, { path: string, hex: string, title: string }>} */ (icons)[b.si];
  if (!icon) throw new Error(`Simple Icons has no ${b.si}`);
  return icon;
}

/** Generated pixel icon for a brand, or undefined. @param {Brand} b */
export function pixelIcon(b) {
  return b.icon ? art(`icon-${b.icon}`) : undefined;
}
