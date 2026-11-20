// Screenshot registry. Images are the repo's own docs screenshots (single-sourced),
// pulled in through Astro's image pipeline so they ship resized and as WebP.
// Caption keys map to `screenshots.items.*` in the i18n copy.
const desktopFiles = import.meta.glob('../../../docs/screenshots/*.png', { eager: true, import: 'default' });
const mobileFiles = import.meta.glob('../../../docs/images/mobile/*.png', { eager: true, import: 'default' });
const docImages = import.meta.glob('../../../docs/images/*.png', { eager: true, import: 'default' });

function pick(files, name) {
  const entry = Object.entries(files).find(([p]) => p.endsWith(`/${name}`));
  if (!entry) throw new Error(`Screenshot missing: ${name}`);
  return entry[1];
}

export const DESKTOP = [
  { key: 'dashboard', image: pick(desktopFiles, '01-dashboard.png') },
  { key: 'wizard', image: pick(desktopFiles, '02-create-wizard.png') },
  { key: 'overview', image: pick(desktopFiles, '03-server-overview.png') },
  { key: 'console', image: pick(desktopFiles, '05-console.png') },
  { key: 'mods', image: pick(desktopFiles, '06-mods.png') },
  { key: 'modpacks', image: pick(docImages, 'modpacks.png') },
  { key: 'worlds', image: pick(desktopFiles, '07-worlds.png') },
  { key: 'backups', image: pick(desktopFiles, '08-backups.png') },
  { key: 'schedules', image: pick(desktopFiles, '14-schedules.png') },
  { key: 'blueprints', image: pick(desktopFiles, '13-blueprints.png') },
  { key: 'storage', image: pick(desktopFiles, '15-storage.png') },
];

export const MOBILE = [
  { key: 'dashboard', image: pick(mobileFiles, 'dashboard.png') },
  { key: 'overview', image: pick(mobileFiles, 'server-overview.png') },
  { key: 'console', image: pick(mobileFiles, 'server-console.png') },
  { key: 'mods', image: pick(mobileFiles, 'mods.png') },
  { key: 'backups', image: pick(mobileFiles, 'server-backups.png') },
];

export const HERO = pick(desktopFiles, '01-dashboard.png');
