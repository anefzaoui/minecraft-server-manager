// Marketing page registry. Keys match `meta.*` in src/i18n/en.json and `nav.*`.
// `header: true` puts a page in the top navigation; every page is in the footer.
import { localePrefix } from '../i18n/locales.js';
import { brands } from '../data/brands.js';

export const PAGES = [
  { key: 'home', path: '/' },
  { key: 'features', path: '/features/', header: true },
  { key: 'screenshots', path: '/screenshots/', header: true },
  { key: 'servers', path: '/servers/', header: true },
  { key: 'guides', path: '/guides/', header: true },
  { key: 'install', path: '/install/', header: true },
  { key: 'docs', path: '/docs/', header: true },
  { key: 'faq', path: '/faq/' },
  { key: 'compare', path: '/compare/' },
  { key: 'changelog', path: '/changelog/' },
];

// Landing pages, grouped under a hub. Each page's copy is the top-level
// en.json key `key`; the hub's copy is `hubKey`. `sprite` is an art id from
// src/assets/gen. `published` is the date the page first went live (JSON-LD);
// pages without one went live with the site, on LANDING_PUBLISHED.
export const HUBS = [
  {
    id: 'servers',
    hubKey: 'serversHub',
    sprite: 'sprite-server',
    pages: [
      { key: 'serverPaper', slug: 'paper', sprite: 'icon-paper' },
      { key: 'serverFabric', slug: 'fabric', sprite: 'icon-fabric' },
      { key: 'serverForge', slug: 'forge', sprite: 'icon-forge' },
      { key: 'serverVanilla', slug: 'vanilla', sprite: 'icon-vanilla' },
      { key: 'serverModpacks', slug: 'modpacks', sprite: 'icon-ftb' },
    ],
  },
  {
    id: 'guides',
    hubKey: 'guidesHub',
    sprite: 'sprite-map',
    article: true,
    pages: [
      { key: 'guideFriends', slug: 'modpack-server-for-friends', sprite: 'sprite-chest', published: '2026-11-20' },
      { key: 'guidePi', slug: 'raspberry-pi', sprite: 'sprite-server' },
      { key: 'guideHome', slug: 'home-server', sprite: 'icon-windows' },
      { key: 'guideHosting', slug: 'leave-paid-hosting', sprite: 'sprite-chest' },
      { key: 'guideMulti', slug: 'multiple-servers', sprite: 'sprite-clock' },
    ],
  },
  {
    id: 'compare',
    hubKey: 'compareHub',
    sprite: 'sprite-shield',
    article: true,
    pages: [
      { key: 'comparePtero', slug: 'pterodactyl', sprite: 'sprite-shield' },
      { key: 'compareCrafty', slug: 'crafty-controller', sprite: 'sprite-shield' },
      { key: 'compareAmp', slug: 'amp', sprite: 'sprite-shield' },
      { key: 'compareMcsm', slug: 'mcsmanager', sprite: 'sprite-shield' },
      { key: 'comparePuffer', slug: 'pufferpanel', sprite: 'sprite-shield', published: '2026-11-20' },
    ],
  },
];

export const LANDING_PUBLISHED = '2026-10-28';

/** Every landing page with its hub and full path. */
export function landingPages() {
  return HUBS.flatMap((hub) => hub.pages.map((p) => ({ ...p, hub, path: `/${hub.id}/${p.slug}/` })));
}

/** The landing page registered under a copy key, or undefined. */
export function landingByKey(key) {
  return landingPages().find((p) => p.key === key);
}

export const REPO_URL = 'https://github.com/anefzaoui/minecraft-server-manager';
export const DISCORD_URL = 'https://discord.gg/Ud6TrQkbDZ';
export const SITE_URL = 'https://minecraft-server-manager.com';

/** '/features/' for English, '/ar/features/' for Arabic, ... */
export function href(locale, path) {
  return `${localePrefix(locale)}${path}`;
}

/** Absolute URL of a page in a locale. */
export function absolute(locale, path) {
  return new URL(href(locale, path), SITE_URL).href;
}

/** BreadcrumbList JSON-LD from [name, path] pairs (home first). */
export function breadcrumbLd(locale, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: absolute(locale, path),
    })),
  };
}

/**
 * FAQPage JSON-LD from [{ q, a, pills? }]. On the page an answer's brands are
 * pills next to it rather than words in it ("boast, don't bury"), so the
 * structured answer names them in words, or it would read "Both can be...".
 */
export function faqLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.pills?.length
          ? `${f.a} (${brands(f.pills)
              .map((b) => b.label)
              .join(', ')})`
          : f.a,
      },
    })),
  };
}
