'use strict';

// The 12 built-in profile-picture choices: original flat-icon SVGs (public/
// icons/avatars/*.svg, hand-drawn for this panel) themed around Minecraft
// tools and items - deliberately NOT the game's own textures, to keep this
// artwork clearly original rather than reusing Mojang's assets.

const AVATAR_PRESETS = [
  { key: 'pickaxe', file: 'pickaxe.svg', label: 'Pickaxe' },
  { key: 'sword', file: 'sword.svg', label: 'Sword' },
  { key: 'shield', file: 'shield.svg', label: 'Shield' },
  { key: 'diamond', file: 'diamond.svg', label: 'Diamond' },
  { key: 'emerald', file: 'emerald.svg', label: 'Emerald' },
  { key: 'ender-pearl', file: 'ender-pearl.svg', label: 'Ender Pearl' },
  { key: 'chest', file: 'chest.svg', label: 'Chest' },
  { key: 'torch', file: 'torch.svg', label: 'Torch' },
  { key: 'anvil', file: 'anvil.svg', label: 'Anvil' },
  { key: 'compass', file: 'compass.svg', label: 'Compass' },
  { key: 'potion', file: 'potion.svg', label: 'Potion' },
  { key: 'tnt', file: 'tnt.svg', label: 'TNT' },
];

const byKey = new Map(AVATAR_PRESETS.map((p) => [p.key, p]));

/** The <img src> for a stored `avatar` value ('preset:x' / 'custom:file'), or null for the default initial-letter avatar. */
function avatarSrc(avatar) {
  if (typeof avatar !== 'string' || !avatar) return null;
  if (avatar.startsWith('preset:')) {
    const preset = byKey.get(avatar.slice('preset:'.length));
    return preset ? `/icons/avatars/${preset.file}` : null;
  }
  if (avatar.startsWith('custom:')) {
    return `/api/avatars/custom/${encodeURIComponent(avatar.slice('custom:'.length))}`;
  }
  return null;
}

module.exports = { AVATAR_PRESETS, avatarSrc };
